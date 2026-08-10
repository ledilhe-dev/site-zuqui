import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "Metodo nao permitido." }, 405);
  try {
    const body = await request.json();
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });

    if (body.action === "pair") {
      validateUuid(body.empresa_id, "empresa"); validateUuid(body.loja_id, "loja");
      await authorizeStore(admin, body.usuario_id, body.empresa_id, body.loja_id);
      const token = validateToken(body.token);
      const { error } = await admin.from("raffinato_integracoes").update({
        conector_token_hash: await sha256(token), status: "ativa", ultimo_erro: null,
      }).eq("empresa_id", body.empresa_id).eq("loja_id", body.loja_id);
      if (error) throw error;
      return json({ ok: true });
    }

    if (body.action === "sync") {
      const integration = await integrationForToken(admin, validateToken(body.token));
      const inicio = validateDate(body.inicio, "inicio");
      const fim = validateDate(body.fim, "fim");
      if (fim < inicio) throw new Error("Periodo invalido.");
      const items = Array.isArray(body.items) ? body.items.slice(0, 10000) : [];
      const { error: deleteError } = await admin.from("raffinato_sangrias_cache").delete()
        .eq("empresa_id", integration.empresa_id).eq("loja_id", integration.loja_id)
        .gte("data", inicio).lte("data", fim);
      if (deleteError) throw deleteError;
      if (items.length) {
        const rows = items.map((item: any) => ({
          empresa_id: integration.empresa_id, loja_id: integration.loja_id,
          data: brDateToIso(item.data), hora: String(item.hora || "00:00:00").slice(0, 8),
          motivo: String(item.motivo || "Sem motivo").slice(0, 500), valor: Number(item.valor || 0),
        }));
        const { error } = await admin.from("raffinato_sangrias_cache").insert(rows);
        if (error) throw error;
      }
      await admin.from("raffinato_integracoes").update({ ultima_sincronizacao_em: new Date().toISOString(), ultimo_erro: null })
        .eq("id", integration.id);
      return json({ ok: true, quantidade: items.length });
    }

    if (body.action === "billing_sync") {
      const integration = await integrationForToken(admin, validateToken(body.token));
      const inicio = validateDate(body.inicio, "inicio"); const fim = validateDate(body.fim, "fim");
      if (fim < inicio) throw new Error("Periodo invalido.");
      const items = Array.isArray(body.items) ? body.items.slice(0, 10000) : [];
      const { error: deleteError } = await admin.from("raffinato_faturamento_cache").delete()
        .eq("empresa_id", integration.empresa_id).eq("loja_id", integration.loja_id).gte("data", inicio).lte("data", fim);
      if (deleteError) throw deleteError;
      if (items.length) {
        const rows = items.map((item: any) => ({
          empresa_id: integration.empresa_id, loja_id: integration.loja_id, data: validateDate(item.data, "data"),
          id_forma_pagamento: Number(item.id_forma_pagamento), forma_pagamento: String(item.forma_pagamento || "Sem forma").slice(0, 200),
          valor_movimento: Number(item.valor_movimento || 0), valor_abertura: Number(item.valor_abertura || 0),
          valor_suprimento: Number(item.valor_suprimento || 0), valor_sangria: Number(item.valor_sangria || 0),
          valor_apurado: Number(item.valor_apurado || 0), valor_confirmado: Number(item.valor_confirmado || 0),
          sincronizado_em: new Date().toISOString(),
        }));
        const { error } = await admin.from("raffinato_faturamento_cache").upsert(rows, { onConflict:"empresa_id,loja_id,data,id_forma_pagamento" });
        if (error) throw error;
      }
      return json({ ok:true, quantidade:items.length });
    }

    if (body.action === "billing_dashboard") {
      validateUuid(body.empresa_id, "empresa"); validateUuid(body.loja_id, "loja");
      await authorizeStore(admin, body.usuario_id, body.empresa_id, body.loja_id);
      const inicio = validateDate(body.inicio, "inicio"); const fimExclusivo = validateDate(body.fim_exclusivo, "fim");
      const payment = body.id_forma_pagamento ? Number(body.id_forma_pagamento) : null;
      let query = admin.from("raffinato_faturamento_cache").select("*")
        .eq("empresa_id", body.empresa_id).eq("loja_id", body.loja_id).gte("data", inicio).lt("data", fimExclusivo).order("data").limit(10000);
      if (payment) query = query.eq("id_forma_pagamento", payment);
      const { data, error } = await query; if (error) throw error;
      const keys = ["valor_movimento","valor_abertura","valor_suprimento","valor_sangria","valor_apurado","valor_confirmado"];
      const forms = new Map<string, any>(); const evolution:any[] = [];
      for (const row of data || []) {
        const id=String(row.id_forma_pagamento), item=forms.get(id)||{id_forma_pagamento:row.id_forma_pagamento,forma_pagamento:row.forma_pagamento};
        for (const key of keys) item[key]=Number(item[key]||0)+Number(row[key]||0);
        forms.set(id,item); evolution.push({data:row.data,id_forma_pagamento:row.id_forma_pagamento,forma_pagamento:row.forma_pagamento,valor_movimento:Number(row.valor_movimento||0)});
      }
      const formas_pagamento=[...forms.values()]; const totalizadores:any={};
      for (const key of keys) totalizadores[key]=formas_pagamento.reduce((sum,item)=>sum+Number(item[key]||0),0);
      return json({ formas_pagamento,totalizadores,evolucao:evolution,origem_consulta:"sincronizacao" });
    }

    if (body.action === "billing_forms") {
      validateUuid(body.empresa_id, "empresa"); validateUuid(body.loja_id, "loja");
      await authorizeStore(admin, body.usuario_id, body.empresa_id, body.loja_id);
      const { data,error }=await admin.from("raffinato_faturamento_cache").select("id_forma_pagamento,forma_pagamento")
        .eq("empresa_id",body.empresa_id).eq("loja_id",body.loja_id).limit(1000);
      if(error)throw error;const unique=new Map<string,any>();
      for(const item of data||[])unique.set(String(item.id_forma_pagamento),{id:item.id_forma_pagamento,nome:item.forma_pagamento});
      return json({formas:[...unique.values()].sort((a,b)=>String(a.nome).localeCompare(String(b.nome)))});
    }

    if (body.action === "dashboard" || body.action === "status") {
      validateUuid(body.empresa_id, "empresa"); validateUuid(body.loja_id, "loja");
      await authorizeStore(admin, body.usuario_id, body.empresa_id, body.loja_id);
      const { data: integration, error: integrationError } = await admin.from("raffinato_integracoes")
        .select("status,ultima_sincronizacao_em,ultimo_erro,conector_token_hash")
        .eq("empresa_id", body.empresa_id).eq("loja_id", body.loja_id).maybeSingle();
      if (integrationError) throw integrationError;
      if (body.action === "status") return json({
        configurado: !!integration, pareado: !!integration?.conector_token_hash,
        ultima_sincronizacao_em: integration?.ultima_sincronizacao_em || null,
        online: isRecent(integration?.ultima_sincronizacao_em), ultimo_erro: integration?.ultimo_erro || null,
      });
      const inicioCompleto = validateDateTime(body.inicio, "inicio");
      const fimCompleto = validateDateTime(body.fim, "fim");
      const inicio = inicioCompleto.slice(0, 10); const fim = fimCompleto.slice(0, 10);
      let query = admin.from("raffinato_sangrias_cache").select("motivo,valor,hora,data")
        .eq("empresa_id", body.empresa_id).eq("loja_id", body.loja_id)
        .gte("data", inicio).lte("data", fim).order("data").order("hora").limit(10000);
      const { data, error } = await query;
      if (error) throw error;
      const items = (data || []).filter((item: any) => {
        const instante = `${String(item.data).slice(0, 10)}T${String(item.hora || "00:00:00").slice(0, 8)}`;
        return instante >= inicioCompleto && instante <= fimCompleto;
      }).map((item: any) => ({ ...item, data: isoDateToBr(item.data) }));
      return json({ items, quantidade: items.length, total: items.reduce((sum: number, item: any) => sum + Number(item.valor || 0), 0), ultima_sincronizacao_em: integration?.ultima_sincronizacao_em || null });
    }
    throw new Error("Acao desconhecida.");
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Falha inesperada." }, 400);
  }
});

async function authorizeStore(admin: any, userId: string, empresaId: string, lojaId: string) {
  validateUuid(userId, "usuario");
  const { data: loja } = await admin.from("lojas").select("id,empresa_id,ativo").eq("id", lojaId).eq("empresa_id", empresaId).maybeSingle();
  if (!loja || loja.ativo === false) throw new Error("Loja nao autorizada.");
  const [{ data: employee }, { data: adminUser }, { data: link }] = await Promise.all([
    admin.from("funcionarios").select("id,empresa_id,loja_id").eq("id", userId).eq("empresa_id", empresaId).maybeSingle(),
    admin.from("usuarios_admin").select("id,empresa_id").eq("id", userId).eq("empresa_id", empresaId).maybeSingle(),
    admin.from("funcionario_lojas").select("funcionario_id,loja_id,ativo").eq("funcionario_id", userId).eq("loja_id", lojaId).eq("ativo", true).maybeSingle(),
  ]);
  if (!adminUser && !link && String(employee?.loja_id || "") !== lojaId) throw new Error("Usuario sem acesso a esta loja.");
}
async function integrationForToken(admin: any, token: string) {
  const { data, error } = await admin.from("raffinato_integracoes").select("id,empresa_id,loja_id")
    .eq("conector_token_hash", await sha256(token)).maybeSingle();
  if (error || !data) throw error || new Error("Conector nao pareado.");
  return data;
}
async function sha256(value: string) { return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))).map(b => b.toString(16).padStart(2, "0")).join(""); }
function validateToken(value: any) { const token=String(value||""); if(!/^[A-Za-z0-9_-]{40,200}$/.test(token)) throw new Error("Token do conector invalido."); return token; }
function validateUuid(value: any, label: string) { if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value||""))) throw new Error(`Contexto de ${label} invalido.`); }
function validateDate(value: any, label: string) { const result=String(value||"").slice(0,10); if(!/^\d{4}-\d{2}-\d{2}$/.test(result)) throw new Error(`Data de ${label} invalida.`); return result; }
function validateDateTime(value: any, label: string) { const result=String(value||""); if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(result)) throw new Error(`Data/hora de ${label} invalida.`); return result; }
function brDateToIso(value: any) { const raw=String(value||""); if(/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw; const [d,m,y]=raw.split("/"); return `${y}-${m}-${d}`; }
function isoDateToBr(value: any) { const [y,m,d]=String(value||"").slice(0,10).split("-"); return `${d}/${m}/${y}`; }
function isRecent(value: any) { return !!value && Date.now() - new Date(value).getTime() < 150000; }
function json(body: any, status=200) { return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } }); }
