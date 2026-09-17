import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TELEGRAM_API = "https://api.telegram.org";

type TelegramUpdate = {
  message?: { chat?: { id?: number } };
  edited_message?: { chat?: { id?: number } };
  channel_post?: { chat?: { id?: number } };
  edited_channel_post?: { chat?: { id?: number } };
};

type TelegramAlert = {
  id: string;
  tipo: "tarefa_iniciada" | "tarefa_nao_iniciada" | "tarefa_finalizada" | "tarefa_nao_finalizada";
  empresa_id: string;
  loja_id: string;
  descricao: string;
  funcionario_nome: string;
  horario_previsto: string;
  horario_real: string | null;
  funcionario_inicio_nome: string | null;
  funcionario_fim_nome: string | null;
  inicio_previsto: string | null;
  inicio_real: string | null;
  fim_previsto: string | null;
  finalizacao_real: string | null;
};

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  if (isTelegramUpdate(payload)) {
    const configuredSecret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") || "";
    const receivedSecret = request.headers.get("x-telegram-bot-api-secret-token") || "";
    if (configuredSecret && receivedSecret !== configuredSecret) {
      return json({ error: "Invalid webhook secret" }, 401);
    }

    const chatId = getChatId(payload);
    if (!chatId) return json({ ok: true });

    const registration = await registerZuquiDestination(chatId);
    if (!registration.ok) {
      console.error("Falha ao vincular chat do Telegram:", registration.error);
    }

    // A Bot API aceita o método na própria resposta ao webhook.
    return json({
      method: "sendMessage",
      chat_id: chatId,
      text: "✅ CheckDiário conectado ao Telegram",
    });
  }

  if (payload.origem !== "cron") {
    return json({ ok: true });
  }

  return processQueue();
});

function isTelegramUpdate(payload: Record<string, unknown>): payload is Record<string, unknown> & TelegramUpdate {
  return typeof payload.update_id === "number";
}

async function registerZuquiDestination(chatId: number) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceRoleKey) return { ok: false, error: "Missing Supabase secrets" };

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const empresaId = Deno.env.get("TELEGRAM_EMPRESA_ID") || "";
  const lojaId = Deno.env.get("TELEGRAM_LOJA_ID") || "";
  if (!empresaId || !lojaId) return { ok: false, error: "Missing Telegram tenant secrets" };

  const { data: empresa, error: empresaError } = await admin
    .from("empresas")
    .select("id")
    .eq("id", empresaId)
    .eq("ativo", true)
    .single();
  if (empresaError || !empresa) return { ok: false, error: empresaError?.message || "Empresa Zuqui não encontrada" };

  const { data: loja, error: lojaError } = await admin
    .from("lojas")
    .select("id")
    .eq("id", lojaId)
    .eq("empresa_id", empresa.id)
    .eq("ativo", true)
    .single();
  if (lojaError || !loja) return { ok: false, error: lojaError?.message || "Loja Zuqui não encontrada" };

  const { data: existing, error: existingError } = await admin
    .from("telegram_destinos")
    .select("id")
    .eq("empresa_id", empresa.id)
    .eq("loja_id", loja.id)
    .eq("chat_id", chatId)
    .maybeSingle();
  if (existingError) return { ok: false, error: existingError.message };

  const values = {
    empresa_id: empresa.id,
    loja_id: loja.id,
    chat_id: chatId,
    nome: "Telegram CheckDiário - Zuqui",
    ativo: true,
    notificar_tarefa_iniciada: true,
    notificar_tarefa_nao_iniciada: true,
    notificar_tarefa_finalizada: true,
    notificar_tarefa_nao_finalizada: true,
    atualizado_em: new Date().toISOString(),
  };
  const result = existing
    ? await admin.from("telegram_destinos").update(values).eq("id", existing.id)
    : await admin.from("telegram_destinos").insert(values);

  return result.error ? { ok: false, error: result.error.message } : { ok: true };
}

function getChatId(update: TelegramUpdate) {
  return update.message?.chat?.id
    ?? update.edited_message?.chat?.id
    ?? update.channel_post?.chat?.id
    ?? update.edited_channel_post?.chat?.id
    ?? null;
}

async function processQueue() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Missing Supabase secrets" }, 500);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: overdueError } = await admin.rpc("telegram_enfileirar_atrasos");
  if (overdueError) return json({ error: overdueError.message }, 500);

  if (!botToken) {
    return json({ processed: 0, sent: 0, failed: 0, waiting_for: "TELEGRAM_BOT_TOKEN" });
  }

  const { data, error } = await admin.rpc("telegram_reservar_alertas", { p_limite: 20 });
  if (error) return json({ error: error.message }, 500);

  let sent = 0;
  let failed = 0;

  for (const alert of (data || []) as TelegramAlert[]) {
    const flag = destinationFlag(alert.tipo);
    const { data: destinations, error: destinationsError } = await admin
      .from("telegram_destinos")
      .select("chat_id")
      .eq("empresa_id", alert.empresa_id)
      .eq("ativo", true)
      .eq(flag, true)
      .or(`loja_id.eq.${alert.loja_id},loja_id.is.null`);

    if (destinationsError) {
      failed += 1;
      await markError(admin, alert.id, destinationsError.message);
      continue;
    }

    const chatIds = [...new Set((destinations || []).map((item) => String(item.chat_id)))];
    if (!chatIds.length) {
      failed += 1;
      await markError(admin, alert.id, "Nenhum destino ativo para a empresa/loja.");
      continue;
    }

    let alertError = "";
    for (const chatId of chatIds) {
      try {
        const response = await fetch(`${TELEGRAM_API}/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: buildMessage(alert),
          }),
        });
        if (!response.ok) alertError = (await response.text()).slice(0, 1500);
      } catch (cause) {
        alertError = cause instanceof Error ? cause.message : "Falha ao chamar o Telegram.";
      }
      if (alertError) break;
    }

    if (alertError) {
      failed += 1;
      await markError(admin, alert.id, alertError);
    } else {
      sent += 1;
      await admin.from("telegram_alertas").update({
        status: "enviado",
        enviado_em: new Date().toISOString(),
        ultimo_erro: null,
      }).eq("id", alert.id).eq("status", "processando");
    }
  }

  return json({ processed: (data || []).length, sent, failed });
}

function destinationFlag(tipo: TelegramAlert["tipo"]) {
  const flags = {
    tarefa_iniciada: "notificar_tarefa_iniciada",
    tarefa_nao_iniciada: "notificar_tarefa_nao_iniciada",
    tarefa_finalizada: "notificar_tarefa_finalizada",
    tarefa_nao_finalizada: "notificar_tarefa_nao_finalizada",
  } as const;
  return flags[tipo];
}

function buildMessage(alert: TelegramAlert) {
  const titles = {
    tarefa_iniciada: "🟢 Tarefa iniciada",
    tarefa_nao_iniciada: "🔴 Tarefa não iniciada no horário",
    tarefa_finalizada: "✅ Tarefa finalizada",
    tarefa_nao_finalizada: "⚠️ ATENÇÃO: tarefa não finalizada no prazo",
  } as const;

  const lines = [titles[alert.tipo], `Descrição: ${alert.descricao}`];

  if (alert.tipo === "tarefa_nao_iniciada") {
    lines.push(`Responsável: ${alert.funcionario_nome}`);
    lines.push(`Início previsto: ${formatDateTime(alert.inicio_previsto || alert.horario_previsto)}`);
    lines.push("Início real: não registrado");
    return lines.join("\n");
  }

  lines.push(`Iniciada por: ${alert.funcionario_inicio_nome || alert.funcionario_nome}`);
  lines.push(`Início previsto: ${formatDateTime(alert.inicio_previsto || alert.horario_previsto)}`);
  lines.push(`Início real: ${alert.inicio_real ? formatDateTime(alert.inicio_real) : "não registrado"}`);

  if (alert.tipo === "tarefa_iniciada") {
    lines.push(`Fim previsto: ${alert.fim_previsto ? formatDateTime(alert.fim_previsto) : "não informado"}`);
    return lines.join("\n");
  }

  if (alert.tipo === "tarefa_finalizada") {
    lines.push(`Finalizada por: ${alert.funcionario_fim_nome || alert.funcionario_nome}`);
    lines.push(`Fim previsto: ${formatDateTime(alert.fim_previsto || alert.horario_previsto)}`);
    lines.push(`Finalização real: ${alert.finalizacao_real ? formatDateTime(alert.finalizacao_real) : "não registrado"}`);
    return lines.join("\n");
  }

  lines.push(`Fim previsto: ${formatDateTime(alert.fim_previsto || alert.horario_previsto)}`);
  lines.push("Finalização real: não registrada");
  return lines.join("\n");
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

async function markError(admin: ReturnType<typeof createClient>, id: string, message: string) {
  await admin.from("telegram_alertas").update({
    status: "erro",
    ultimo_erro: message.slice(0, 1500),
  }).eq("id", id).eq("status", "processando");
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
