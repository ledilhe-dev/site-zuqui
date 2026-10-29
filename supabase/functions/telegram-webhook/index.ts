import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TELEGRAM_API = "https://api.telegram.org";

type TelegramUpdate = {
  message?: { chat?: { id?: number; title?: string; first_name?: string } };
  edited_message?: { chat?: { id?: number; title?: string; first_name?: string } };
  channel_post?: { chat?: { id?: number; title?: string } };
  edited_channel_post?: { chat?: { id?: number; title?: string } };
};

type TelegramAlert = {
  id: string;
  chave_unica?: string;
  tipo: "tarefa_iniciada" | "tarefa_nao_iniciada" | "tarefa_finalizada" | "tarefa_nao_finalizada"
    | "financeiro_vencimento" | "financeiro_saldo" | "financeiro_ajuste" | "financeiro_recebimento" | "produto_cadastrado" | "produto_vencimento"
    | "agenda_cadastrada" | "agenda_dia" | "ponto_entrada";
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
  if (request.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "https://checkdiario.com.br",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-checkdiario-internal-secret, x-telegram-bot-api-secret-token",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }
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
    if (!configuredSecret || receivedSecret !== configuredSecret) {
      return json({ error: "Invalid webhook secret" }, 401);
    }

    const chatId = getChatId(payload);
    if (!chatId) return json({ ok: true });

    const registration = await registerZuquiDestination(chatId, getChatTitle(payload));
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

  if (payload.origem !== "cron") return json({ ok: true });

  const configuredInternalSecret = Deno.env.get("TELEGRAM_INTERNAL_SECRET") || "";
  const receivedInternalSecret = request.headers.get("x-checkdiario-internal-secret") || "";
  if (!configuredInternalSecret) return json({ error: "Missing TELEGRAM_INTERNAL_SECRET" }, 500);
  if (receivedInternalSecret !== configuredInternalSecret) return json({ error: "Invalid internal secret" }, 401);

  return processQueue();
});

function isTelegramUpdate(payload: Record<string, unknown>): payload is Record<string, unknown> & TelegramUpdate {
  return typeof payload.update_id === "number";
}

async function registerZuquiDestination(chatId: number, chatTitle = "") {
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

  const route = destinationRoute(chatTitle);
  const values = {
    empresa_id: empresa.id,
    loja_id: loja.id,
    chat_id: chatId,
    nome: chatTitle || "Telegram CheckDiário - Zuqui",
    ativo: true,
    notificar_tarefa_iniciada: true,
    notificar_tarefa_nao_iniciada: true,
    notificar_tarefa_finalizada: true,
    notificar_tarefa_nao_finalizada: true,
    notificar_ponto: true,
    ...route,
    atualizado_em: new Date().toISOString(),
  };
  const result = existing
    ? await admin.from("telegram_destinos").update(values).eq("id", existing.id)
    : await admin.from("telegram_destinos").insert(values);

  return result.error ? { ok: false, error: result.error.message } : { ok: true };
}

function getChatTitle(update: TelegramUpdate) {
  const chat = update.message?.chat ?? update.edited_message?.chat
    ?? update.channel_post?.chat ?? update.edited_channel_post?.chat;
  return String(chat?.title || chat?.first_name || "").trim();
}

function normalizeTitle(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function destinationRoute(title: string) {
  const value = normalizeTitle(title);
  if (value.includes("financeiro")) return {
    notificar_tarefa_iniciada: false, notificar_tarefa_nao_iniciada: false,
    notificar_tarefa_finalizada: false, notificar_tarefa_nao_finalizada: false,
    notificar_financeiro: true, notificar_produtos_vencimento: false, notificar_ponto: false,
  };
  if (value.includes("tarefa") || value.includes("padaria")) return {
    notificar_tarefa_iniciada: true, notificar_tarefa_nao_iniciada: true,
    notificar_tarefa_finalizada: true, notificar_tarefa_nao_finalizada: true,
    notificar_financeiro: false, notificar_produtos_vencimento: true, notificar_ponto: true,
  };
  return {
    notificar_tarefa_iniciada: false, notificar_tarefa_nao_iniciada: false,
    notificar_tarefa_finalizada: false, notificar_tarefa_nao_finalizada: false,
    notificar_financeiro: false, notificar_produtos_vencimento: false, notificar_ponto: true,
  };
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
  const { error: scheduledError } = await admin.rpc("telegram_enfileirar_alertas_programados");
  if (scheduledError) return json({ error: scheduledError.message }, 500);
  const { error: summaryError } = await admin.rpc("telegram_enfileirar_resumo_financeiro");
  if (summaryError) return json({ error: summaryError.message }, 500);
  const { error: agendaError } = await admin.rpc("telegram_enfileirar_agendas_do_dia");
  if (agendaError) return json({ error: agendaError.message }, 500);

  if (!botToken) {
    return json({ processed: 0, sent: 0, failed: 0, waiting_for: "TELEGRAM_BOT_TOKEN" });
  }

  const routes = await syncDestinationRoutes(admin, botToken);

  const { data, error } = await admin.rpc("telegram_reservar_alertas", { p_limite: 20 });
  if (error) return json({ error: error.message }, 500);

  const { data: financialStores } = await admin.from("lojas").select("id,nome").eq("ativo", true);
  const patrickStoreIds = new Set((financialStores || [])
    .filter((store) => normalizeTitle(String(store.nome || "")).includes("patrick"))
    .map((store) => String(store.id)));

  let sent = 0;
  let failed = 0;

  for (const alert of (data || []) as TelegramAlert[]) {
    if (isFinancialAlert(alert.tipo) && !patrickStoreIds.has(String(alert.loja_id))) {
      await admin.from("telegram_alertas").update({
        status: "enviado",
        enviado_em: new Date().toISOString(),
        ultimo_erro: "Ignorado: financeiro centralizado na loja Patrick.",
      }).eq("id", alert.id).eq("status", "processando");
      continue;
    }
    try {
      await refreshFinancialSnapshot(admin, alert);
    } catch (cause) {
      failed += 1;
      await markError(admin, alert.id, cause instanceof Error ? cause.message : "Falha ao atualizar resumo financeiro.");
      continue;
    }
    const flag = destinationFlag(alert.tipo);
    let destinationsQuery = admin
      .from("telegram_destinos")
      .select("chat_id")
      .eq("ativo", true);
    // O financeiro fica concentrado na Patrick, mas o grupo foi conectado pela
    // Zuqui. Eventos financeiros sao roteados por empresa; operacionais continuam
    // isolados pela loja para nao misturar tarefas, agendas e validades.
    if (!isFinancialAlert(alert.tipo)) {
      destinationsQuery = destinationsQuery.eq("empresa_id", alert.empresa_id)
        .or(`loja_id.eq.${alert.loja_id},loja_id.is.null`);
    }
    if (flag) destinationsQuery = destinationsQuery.eq(flag, true);
    const { data: destinations, error: destinationsError } = await destinationsQuery;

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

    const deliveryErrors: string[] = [];
    let delivered = 0;
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
        if (response.ok) {
          delivered += 1;
        } else {
          const detail = (await response.text()).slice(0, 1200);
          deliveryErrors.push(`${chatId}: ${detail}`);
          // Chat removido, bot bloqueado ou identificador inválido não deve
          // bloquear os demais grupos nem consumir novas tentativas eternamente.
          if (response.status === 400 || response.status === 403) {
            await admin.from("telegram_destinos").update({ ativo: false, atualizado_em: new Date().toISOString() })
              .eq("empresa_id", alert.empresa_id).eq("chat_id", chatId);
          }
        }
      } catch (cause) {
        deliveryErrors.push(`${chatId}: ${cause instanceof Error ? cause.message : "Falha ao chamar o Telegram."}`);
      }
    }

    if (!delivered) {
      failed += 1;
      await markError(admin, alert.id, deliveryErrors.join(" | "));
    } else {
      sent += 1;
      await admin.from("telegram_alertas").update({
        status: "enviado",
        enviado_em: new Date().toISOString(),
        ultimo_erro: deliveryErrors.length ? deliveryErrors.join(" | ").slice(0, 1500) : null,
      }).eq("id", alert.id).eq("status", "processando");
    }
  }

  return json({ processed: (data || []).length, sent, failed, routes });
}

async function refreshFinancialSnapshot(admin: ReturnType<typeof createClient>, alert: TelegramAlert) {
  if (alert.tipo !== "financeiro_saldo" || !String(alert.chave_unica || "").startsWith("financeiro:saldos:")) return;
  const { data: contas, error } = await admin.from("contas_financeiras")
    .select("nome,saldo_atual")
    .eq("loja_id", alert.loja_id)
    .eq("ativo", true)
    .order("nome");
  if (error) throw new Error(`Falha ao atualizar saldos antes do Telegram: ${error.message}`);
  const formatar = (valor: unknown) => new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(valor || 0));
  const linhas = (contas || []).map((conta) => `${conta.nome} - R$ ${formatar(conta.saldo_atual)}`);
  const total = (contas || []).reduce((soma, conta) => soma + Number(conta.saldo_atual || 0), 0);
  const horario = String(alert.chave_unica || "").includes(":16:") ? "16:00" : "08:00";
  alert.descricao = `💰 SALDO EM CONTAS - ${horario}\n\n${linhas.join("\n----------------------\n")}\n\nTotal no cofre = R$ ${formatar(total)}`;
  // Persiste exatamente o texto calculado no instante do envio para auditoria.
  await admin.from("telegram_alertas").update({ descricao: alert.descricao }).eq("id", alert.id);
}

async function syncDestinationRoutes(admin: ReturnType<typeof createClient>, botToken: string) {
  const { data: destinations, error } = await admin.from("telegram_destinos")
    .select("id, chat_id, nome").eq("ativo", true);
  if (error) {
    console.error("Falha ao carregar destinos para roteamento:", error.message);
    return { tarefas: 0, financeiro: 0 };
  }
  let tarefas = 0;
  let financeiro = 0;
  for (const destination of destinations || []) {
    try {
      const response = await fetch(`${TELEGRAM_API}/bot${botToken}/getChat?chat_id=${encodeURIComponent(String(destination.chat_id))}`);
      if (!response.ok) continue;
      const body = await response.json();
      const title = String(body?.result?.title || body?.result?.first_name || destination.nome || "").trim();
      const route = destinationRoute(title);
      if (!Object.keys(route).length) continue;
      if (route.notificar_financeiro === true) financeiro += 1;
      if (route.notificar_tarefa_iniciada === true) tarefas += 1;
      await admin.from("telegram_destinos").update({ nome: title, ...route, atualizado_em: new Date().toISOString() })
        .eq("id", destination.id);
    } catch (cause) {
      console.error("Falha ao identificar grupo do Telegram:", cause);
    }
  }
  return { tarefas, financeiro };
}

function destinationFlag(tipo: TelegramAlert["tipo"]) {
  const flags = {
    tarefa_iniciada: "notificar_tarefa_iniciada",
    tarefa_nao_iniciada: "notificar_tarefa_nao_iniciada",
    tarefa_finalizada: "notificar_tarefa_finalizada",
    tarefa_nao_finalizada: "notificar_tarefa_nao_finalizada",
    financeiro_vencimento: "notificar_financeiro",
    financeiro_saldo: "notificar_financeiro",
    financeiro_ajuste: "notificar_financeiro",
    financeiro_recebimento: "notificar_financeiro",
    produto_cadastrado: "notificar_produtos_vencimento",
    produto_vencimento: "notificar_produtos_vencimento",
    agenda_cadastrada: "notificar_tarefa_iniciada",
    agenda_dia: "notificar_tarefa_iniciada",
    ponto_entrada: "notificar_ponto",
  } as const;
  return flags[tipo];
}

function buildMessage(alert: TelegramAlert) {
  if (isFinancialAlert(alert.tipo)) {
    return normalizeFinancialMessage(alert.descricao);
  }
  if (alert.tipo === "produto_cadastrado" || alert.tipo === "produto_vencimento"
    || alert.tipo === "agenda_cadastrada" || alert.tipo === "agenda_dia"
    || alert.tipo === "ponto_entrada") {
    return alert.descricao;
  }
  const titles = {
    tarefa_iniciada: "🟢 Tarefa iniciada",
    tarefa_nao_iniciada: "🔴 Tarefa não iniciada no horário",
    tarefa_finalizada: "✅ Tarefa finalizada",
    tarefa_nao_finalizada: "🟠 Tarefa não finalizada no prazo",
  } as const;

  // O banco prefixa a orientacao com o nome do checklist. O rotulo "Tarefa"
  // deixa explicito no Telegram qual atividade originou o alerta.
  const lines = [titles[alert.tipo], `Tarefa: ${alert.descricao}`];

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

function normalizeFinancialMessage(value: string) {
  // Escapes Unicode mantêm o deploy independente da codificação do terminal.
  // Nenhuma mensagem financeira deve chegar ao Telegram com "??".
  const money = "\u{1F4B0}";
  const warning = "\u26A0\uFE0F";
  return String(value || "")
    .replace(/^\?{2}\s*SALDO EM CONTAS/im, `${money} SALDO EM CONTAS`)
    .replace(/^\?{2}\s*CONTAS EM ABERTO(?:\s*\?{2})?/im, `${warning} CONTAS EM ABERTO`)
    .replace(/^\?{2}\s*FALTA PAGAR/im, `${warning} FALTA PAGAR`)
    .replace(/Per\?odo/gi, "Per\u00EDodo")
    .replace(/\?{2,}/g, warning);
}

function isFinancialAlert(tipo: TelegramAlert["tipo"]) {
  return tipo === "financeiro_vencimento" || tipo === "financeiro_saldo" || tipo === "financeiro_ajuste"
    || tipo === "financeiro_recebimento";
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
