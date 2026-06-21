import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type EmailAlert = {
  id: string;
  tipo: string;
  assunto: string;
  mensagem: string;
  destinatarios: string[] | null;
  attempts: number;
  meta: Record<string, unknown> | null;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";
  const fromEmail = Deno.env.get("ALERT_FROM_EMAIL") || "";
  const fromName = Deno.env.get("ALERT_FROM_NAME") || "CHECK DIARIO";

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Missing Supabase environment variables" }, 500);
  }

  if (!resendApiKey || !fromEmail) {
    return jsonResponse({ error: "Missing e-mail provider environment variables" }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: alerts, error: alertsError } = await admin
    .from("email_alertas")
    .select("id, tipo, assunto, mensagem, destinatarios, attempts, meta")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(20);

  if (alertsError) {
    return jsonResponse({ error: alertsError.message }, 500);
  }

  if (!alerts?.length) {
    return jsonResponse({ processed: 0, sent: 0, failed: 0 });
  }

  let sent = 0;
  let failed = 0;

  for (const alert of alerts as EmailAlert[]) {
    const recipients = Array.isArray(alert.destinatarios)
      ? alert.destinatarios.filter((item): item is string => typeof item === "string" && item.includes("@"))
      : [];

    if (!recipients.length) {
      failed += 1;
      await markAlertFailed(admin, alert.id, alert.attempts, "Nenhum destinatario valido encontrado.");
      continue;
    }

    const html = buildEmailHtml(alert);

    try {
      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `${fromName} <${fromEmail}>`,
          to: recipients,
          subject: alert.assunto,
          html,
        }),
      });

      if (!resendResponse.ok) {
        const errorText = await resendResponse.text();
        failed += 1;
        await markAlertFailed(admin, alert.id, alert.attempts, errorText || "Falha ao enviar e-mail.");
        continue;
      }

      sent += 1;
      await admin
        .from("email_alertas")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          failed_at: null,
          ultimo_erro: null,
          attempts: (alert.attempts || 0) + 1,
        })
        .eq("id", alert.id);
    } catch (error) {
      failed += 1;
      await markAlertFailed(
        admin,
        alert.id,
        alert.attempts,
        error instanceof Error ? error.message : "Erro inesperado ao enviar e-mail.",
      );
    }
  }

  return jsonResponse({
    processed: alerts.length,
    sent,
    failed,
  });
});

function buildEmailHtml(alert: EmailAlert) {
  const detalhes = renderMeta(alert.meta);
  const resumo = buildSummary(alert.meta, alert.tipo);
  const tom = getAlertTone(alert.tipo);

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${escapeHtml(alert.assunto)}</title>
      </head>
      <body style="margin:0;padding:0;font-family:'Segoe UI',Arial,Helvetica,sans-serif;background:#eef3ed;color:#163020;">
        <div style="padding:32px 16px;background:radial-gradient(circle at top,#f8fbf6 0%,#eef3ed 52%,#e5ede7 100%);">
          <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #d8e5da;border-radius:28px;overflow:hidden;box-shadow:0 18px 48px rgba(16,24,18,0.12);">
            <div style="padding:32px 32px 24px;background:linear-gradient(135deg,#14311f 0%,#1c4c30 55%,#245b39 100%);">
              <div style="display:inline-block;padding:7px 12px;border-radius:999px;background:rgba(255,255,255,0.12);font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#d7fbe0;margin-bottom:16px;">CHECK DIARIO</div>
              <div style="font-size:28px;line-height:1.15;font-weight:800;color:#f5fff7;">${escapeHtml(alert.assunto)}</div>
              <div style="margin-top:10px;font-size:14px;line-height:1.6;color:#d2e7d8;">Alerta automático de acompanhamento de checklist.</div>
            </div>
            <div style="padding:32px;">
              <div style="border:1px solid ${tom.border};background:${tom.background};border-radius:22px;padding:20px 22px;margin-bottom:24px;">
                <div style="font-size:12px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:${tom.eyebrow};margin-bottom:10px;">Resumo do alerta</div>
                <div style="font-size:18px;line-height:1.5;color:#183425;">${resumo}</div>
              </div>
              <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#365240;">${escapeHtml(alert.mensagem)}</p>
              ${detalhes}
              <div style="margin-top:28px;padding-top:18px;border-top:1px solid #e2ece3;font-size:12px;line-height:1.6;color:#6c8472;">
                Este e-mail foi enviado automaticamente pelo CHECK DIARIO para acompanhamento operacional.
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

function renderMeta(meta: Record<string, unknown> | null | undefined) {
  if (!meta || typeof meta !== "object") return "";

  const allowedKeys = ["nome_funcionario", "nome_checklist", "horario_programado", "horario_conclusao", "status_alerta"];
  const entries = Object.entries(meta)
    .filter(([key, value]) => allowedKeys.includes(key) && value !== null && value !== undefined && value !== "")
    .sort(([left], [right]) => {
      const leftIndex = allowedKeys.indexOf(left);
      const rightIndex = allowedKeys.indexOf(right);
      return (leftIndex === -1 ? 99 : leftIndex) - (rightIndex === -1 ? 99 : rightIndex);
    });
  if (!entries.length) return "";

  const labels: Record<string, string> = {
    nome_checklist: "Checklist",
    nome_funcionario: "Funcionário",
    horario_programado: "Horário previsto",
    horario_conclusao: "Horário da conclusão",
    status_alerta: "Situação",
    horario_lembrete: "Horário de lembrete",
    quantidade_pendentes: "Quantidade pendente",
  };

  const rows = entries.map(([key, value]) => {
    const label = labels[key];
    const content = formatMetaValue(key, value);
    return `
      <tr>
        <td style="padding:12px 0;color:#6f8774;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;width:190px;border-bottom:1px solid #edf2ee;vertical-align:top;">${escapeHtml(label)}</td>
        <td style="padding:12px 0;color:#183425;font-size:14px;border-bottom:1px solid #edf2ee;vertical-align:top;">${escapeHtml(content)}</td>
      </tr>
    `;
  }).join("");

  return `
    <table style="width:100%;border-collapse:collapse;margin-top:8px;background:#fbfdfb;border:1px solid #e3ebe4;border-radius:18px;overflow:hidden;">
      <tbody>${rows}</tbody>
    </table>
  `;
}

function buildSummary(meta: Record<string, unknown> | null | undefined, tipo: string) {
  const nomeChecklist = metaValue(meta, "nome_checklist") || "Checklist não informado";
  const nomeFuncionario = metaValue(meta, "nome_funcionario") || "Funcionário não informado";
  const horarioProgramado = metaValue(meta, "horario_programado") || "horário não informado";
  const horarioConclusao = metaValue(meta, "horario_conclusao") || "horário não informado";

  if (tipo === "lancamento_atrasado") {
    return `${escapeHtml(nomeChecklist)} não foi iniciado por ${escapeHtml(nomeFuncionario)} até ${escapeHtml(horarioProgramado)}.`;
  }

  if (tipo === "execucao_atrasada") {
    return `${escapeHtml(nomeChecklist)} não foi concluído por ${escapeHtml(nomeFuncionario)} até ${escapeHtml(horarioProgramado)}.`;
  }

  if (tipo === "checklist_finalizado") {
    return `${escapeHtml(nomeChecklist)} foi finalizado por ${escapeHtml(nomeFuncionario)} às ${escapeHtml(horarioConclusao)}.`;
  }

  return `${escapeHtml(nomeChecklist)} requer atenção de ${escapeHtml(nomeFuncionario)}.`;
}

function getAlertTone(tipo: string) {
  if (tipo === "checklist_finalizado") {
    return {
      background: "#edf9ef",
      border: "#cde8d2",
      eyebrow: "#1f7a3d",
    };
  }

  if (tipo === "execucao_atrasada") {
    return {
      background: "#fff4eb",
      border: "#f3d3b6",
      eyebrow: "#a64b12",
    };
  }

  return {
    background: "#fff1f0",
    border: "#f2c8c5",
    eyebrow: "#b42318",
  };
}

function metaValue(meta: Record<string, unknown> | null | undefined, key: string) {
  if (!meta || typeof meta !== "object") return "";
  const value = meta[key];
  if (value === null || value === undefined) return "";
  return Array.isArray(value) ? value.join(", ") : String(value);
}

function formatMetaValue(key: string, value: unknown) {
  const raw = Array.isArray(value) ? value.join(", ") : String(value);

  if (key === "status_alerta") {
    const labels: Record<string, string> = {
      nao_iniciado: "Checklist não iniciado",
      proximo_do_prazo: "Checklist próximo do prazo",
      nao_concluido: "Checklist não concluído",
      em_andamento_atrasado: "Checklist em andamento após o prazo",
      finalizado: "Checklist finalizado",
    };
    return labels[raw] || raw;
  }

  return raw;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function markAlertFailed(
  admin: ReturnType<typeof createClient>,
  alertId: string,
  attempts: number,
  errorMessage: string,
) {
  await admin
    .from("email_alertas")
    .update({
      status: "error",
      failed_at: new Date().toISOString(),
      ultimo_erro: errorMessage.slice(0, 1500),
      attempts: (attempts || 0) + 1,
    })
    .eq("id", alertId);
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
