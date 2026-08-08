import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
const ratings: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const env = getEnv();
    const admin = createClient(env.supabaseUrl, env.serviceKey, { auth: { persistSession: false } });

    if (request.method === "GET") {
      ensureOAuthConfigured(env);
      const url = new URL(request.url);
      const code = url.searchParams.get("code");
      const stateRaw = url.searchParams.get("state");
      if (!code || !stateRaw) throw new Error("Retorno OAuth incompleto.");
      const state = await verifyState(stateRaw, env.stateSecret);
      const tokens = await exchangeCode(code, env);
      if (!tokens.refresh_token) throw new Error("O Google não forneceu refresh_token. Revogue o acesso anterior e conecte novamente.");
      const profile = await googleJson("https://www.googleapis.com/oauth2/v2/userinfo", tokens.access_token);
      let accountId = "";
      if (env.mockMode) {
        // Enquanto a API Business Profile estiver sem quota, valida OAuth e armazena
        // o token sem consultar contas, locais ou avaliações reais.
        accountId = `pending-approval:${String(profile.id || profile.email || "google-user")}`;
      } else {
        const accounts = await googleJson("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", tokens.access_token);
        const account = accounts.accounts?.[0];
        if (!account?.name) throw new Error("Nenhuma conta do Google Business foi encontrada.");
        accountId = account.name.replace("accounts/", "");
      }
      const encrypted = await encrypt(tokens.refresh_token, env.tokenKey);
      const { error } = await admin.from("google_business_conexoes").upsert({
        empresa_id: state.empresa_id, loja_id: state.loja_id || null,
        google_account_id: accountId, google_email: profile.email || null,
        refresh_token_cifrado: encrypted, status: "ativa",
        ultimo_erro: env.mockMode ? "OAuth validado; aguardando liberação da API Google Business Profile." : null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "empresa_id,google_account_id" });
      if (error) throw error;
      const destino = new URL(state.return_url);
      destino.searchParams.set("google_business", "conectado");
      return Response.redirect(destino.toString(), 302);
    }

    if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);
    const body = await request.json();
    validateTenant(body);

    if (body.action === "dashboard") {
      const acesso = await resolveAuthorizedStores(admin, body.usuario_id, body.loja_id);
      if (!acesso.storeIds.length) return json({ locais: [], avaliacoes: [], conexao: null, lojas_autorizadas: 0, simulated: env.mockMode });
      if (env.mockMode) return json(buildMockDashboard(acesso.stores));
      const { data: locais, error: locaisError } = await admin.from("google_business_locais")
        .select("id,nome,loja_id,ativo").in("loja_id", acesso.storeIds).eq("ativo", true).order("nome");
      if (locaisError) throw locaisError;
      const localIds = (locais || []).map((item: any) => item.id);
      let avaliacoes: any[] = [];
      if (localIds.length) {
        const { data, error } = await admin.from("google_avaliacoes")
          .select("id,local_id,review_id,avaliador_nome,avaliador_foto_url,nota,comentario,criado_em,atualizado_em,resposta_texto,resposta_atualizada_em,google_business_locais(nome,loja_id)")
          .in("local_id", localIds).order("criado_em", { ascending: false }).limit(1000);
        if (error) throw error;
        avaliacoes = data || [];
      }
      const empresaIds = [...new Set(acesso.stores.map((item: any) => item.empresa_id).filter(Boolean))];
      let conexaoQuery = admin.from("google_business_conexoes")
        .select("id,status,google_email,ultima_sincronizacao_em,empresa_id").eq("status", "ativa")
        .order("ultima_sincronizacao_em", { ascending: false, nullsFirst: false }).limit(1);
      if (empresaIds.length) conexaoQuery = conexaoQuery.in("empresa_id", empresaIds);
      const { data: conexoes } = await conexaoQuery;
      return json({ locais: locais || [], avaliacoes, conexao: conexoes?.[0] || null, lojas_autorizadas: acesso.storeIds.length });
    }

    if (body.action === "auth-url") {
      ensureOAuthConfigured(env);
      const state = await signState({
        empresa_id: body.empresa_id, loja_id: body.loja_id || "", usuario_id: body.usuario_id || "",
        return_url: safeReturnUrl(body.return_url, env.appUrl), exp: Date.now() + 10 * 60 * 1000,
      }, env.stateSecret);
      const params = new URLSearchParams({
        client_id: env.clientId, redirect_uri: env.redirectUri, response_type: "code",
        scope: "openid email https://www.googleapis.com/auth/business.manage",
        access_type: "offline", prompt: "consent", include_granted_scopes: "true", state,
      });
      return json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
    }

    if (env.mockMode && body.action === "sync") {
      return json({ success: true, processed: 0, simulated: true });
    }
    const connection = await getConnection(admin, body.empresa_id, body.loja_id);
    const accessToken = await refreshAccessToken(await decrypt(connection.refresh_token_cifrado, env.tokenKey), env);
    if (body.action === "sync") {
      const count = await syncAll(admin, connection, accessToken, body);
      return json({ success: true, processed: count });
    }
    if (body.action === "reply") {
      if (!body.avaliacao_id || !String(body.resposta || "").trim()) throw new Error("Avaliação e resposta são obrigatórias.");
      const { data: review, error } = await admin.from("google_avaliacoes")
        .select("id,review_id,local_id,google_business_locais!inner(google_account_id,google_location_id,empresa_id)")
        .eq("id", body.avaliacao_id).eq("empresa_id", body.empresa_id).single();
      if (error || !review) throw error || new Error("Avaliação não encontrada.");
      const location = review.google_business_locais as unknown as { google_account_id: string; google_location_id: string; loja_id?: string };
      const acesso = await resolveAuthorizedStores(admin, body.usuario_id, body.loja_id);
      const { data: localDaAvaliacao } = await admin.from("google_business_locais").select("loja_id").eq("id", review.local_id).single();
      if (!localDaAvaliacao?.loja_id || !acesso.storeIds.includes(String(localDaAvaliacao.loja_id))) {
        throw new Error("Seu perfil não possui permissão para responder avaliações desta loja.");
      }
      const endpoint = `https://mybusiness.googleapis.com/v4/accounts/${location.google_account_id}/locations/${location.google_location_id}/reviews/${review.review_id}/reply`;
      const reply = await googleJson(endpoint, accessToken, { method: "PUT", body: { comment: String(body.resposta).trim() } });
      await admin.from("google_avaliacoes").update({ resposta_texto: reply.comment, resposta_atualizada_em: reply.updateTime || new Date().toISOString() }).eq("id", review.id);
      return json({ success: true });
    }
    throw new Error("Ação desconhecida.");
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Erro inesperado." }, 400);
  }
});

async function syncAll(admin: ReturnType<typeof createClient>, connection: any, token: string, body: any) {
  const accountName = `accounts/${connection.google_account_id}`;
  const locationsData = await googleJson(`https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title,storefrontAddress,metadata&pageSize=100`, token);
  let processed = 0;
  for (const source of locationsData.locations || []) {
    const googleLocationId = String(source.name).split("/").pop();
    const address = source.storefrontAddress?.addressLines?.join(", ") || "";
    const { data: local, error } = await admin.from("google_business_locais").upsert({
      empresa_id: body.empresa_id, loja_id: connection.loja_id || body.loja_id || null, conexao_id: connection.id,
      google_account_id: connection.google_account_id, google_location_id: googleLocationId,
      nome: source.title || googleLocationId, endereco: address, ativo: true, updated_at: new Date().toISOString(),
    }, { onConflict: "conexao_id,google_location_id" }).select("id,loja_id").single();
    if (error) throw error;
    let pageToken = "";
    do {
      const endpoint = `https://mybusiness.googleapis.com/v4/${accountName}/locations/${googleLocationId}/reviews?pageSize=50${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`;
      const result = await googleJson(endpoint, token);
      for (const review of result.reviews || []) {
        const payload = {
          empresa_id: body.empresa_id, loja_id: local.loja_id, local_id: local.id, review_id: review.reviewId,
          avaliador_nome: review.reviewer?.displayName || null, avaliador_foto_url: review.reviewer?.profilePhotoUrl || null,
          nota: ratings[review.starRating] || 0, comentario: review.comment || null,
          criado_em: review.createTime, atualizado_em: review.updateTime || null,
          resposta_texto: review.reviewReply?.comment || null, resposta_atualizada_em: review.reviewReply?.updateTime || null,
          dados_origem: review, sincronizado_em: new Date().toISOString(),
        };
        const { error: reviewError } = await admin.from("google_avaliacoes").upsert(payload, { onConflict: "local_id,review_id" });
        if (reviewError) throw reviewError;
        processed++;
      }
      await admin.from("google_business_locais").update({
        nota_media: result.averageRating || null, total_avaliacoes: result.totalReviewCount || 0, updated_at: new Date().toISOString(),
      }).eq("id", local.id);
      pageToken = result.nextPageToken || "";
    } while (pageToken);
  }
  await admin.from("google_business_conexoes").update({ ultima_sincronizacao_em: new Date().toISOString(), ultimo_erro: null, status: "ativa" }).eq("id", connection.id);
  await admin.from("google_sincronizacoes_logs").insert({ empresa_id: body.empresa_id, loja_id: body.loja_id || null, conexao_id: connection.id, status: "sucesso", avaliacoes_processadas: processed });
  return processed;
}

async function getConnection(admin: ReturnType<typeof createClient>, empresaId: string, lojaId?: string) {
  let query = admin.from("google_business_conexoes").select("*").eq("empresa_id", empresaId).eq("status", "ativa").order("updated_at", { ascending: false });
  if (lojaId) query = query.or(`loja_id.eq.${lojaId},loja_id.is.null`);
  const { data, error } = await query.limit(1).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Conecte uma conta do Google Business primeiro.");
  return data;
}

async function resolveAuthorizedStores(admin: ReturnType<typeof createClient>, userId: string, currentStoreId?: string) {
  if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) return { storeIds: [], stores: [] };
  const { data: links, error } = await admin.from("funcionario_lojas")
    .select("loja_id,ativo,perfil_id")
    .eq("funcionario_id", userId).eq("ativo", true);
  if (error) throw error;
  const storeIds = [...new Set((links || []).map((link: any) => String(link.loja_id || "")).filter(Boolean))];
  const profileIds = [...new Set((links || []).map((link: any) => String(link.perfil_id || "")).filter(Boolean))];
  const { data: stores } = storeIds.length
    ? await admin.from("lojas").select("id,nome,empresa_id,ativo").in("id", storeIds)
    : { data: [] as any[] };
  const { data: profiles } = profileIds.length
    ? await admin.from("perfis").select("id,codigo,permissoes").in("id", profileIds)
    : { data: [] as any[] };
  const storeMap = new Map((stores || []).map((store: any) => [String(store.id), store]));
  const profileMap = new Map((profiles || []).map((profile: any) => [String(profile.id), profile]));
  const allowed = (links || []).filter((link: any) => {
    const store = storeMap.get(String(link.loja_id));
    const profile = profileMap.get(String(link.perfil_id));
    if (!store || store.ativo === false || !profile) return false;
    const code = String(profile.codigo || "").toUpperCase();
    return code === "ADM" || code === "MASTER" || profile.permissoes?.estatisticas_atendimento === true;
  }).map((link: any) => ({ ...link, lojas: storeMap.get(String(link.loja_id)), perfis: profileMap.get(String(link.perfil_id)) }));

  // Compatibilidade com cadastros antigos em que a loja principal ainda não possui
  // um registro em funcionario_lojas. A permissão continua vindo do perfil local.
  if (currentStoreId && !allowed.some((link: any) => String(link.loja_id) === String(currentStoreId))) {
    const { data: employee } = await admin.from("funcionarios")
      .select("loja_id,perfil_id")
      .eq("id", userId).maybeSingle();
    if (employee && String(employee.loja_id) === String(currentStoreId)) {
      const [{ data: store }, { data: profile }] = await Promise.all([
        admin.from("lojas").select("id,nome,empresa_id,ativo").eq("id", employee.loja_id).maybeSingle(),
        admin.from("perfis").select("id,codigo,permissoes").eq("id", employee.perfil_id).maybeSingle(),
      ]);
      const code = String(profile?.codigo || "").toUpperCase();
      const canSee = code === "ADM" || code === "MASTER" || profile?.permissoes?.estatisticas_atendimento === true;
      if (store && store.ativo !== false && canSee) allowed.push({ ...employee, lojas: store, perfis: profile });
    }
  }
  const map = new Map<string, any>();
  allowed.forEach((link: any) => {
    const store = link.lojas;
    if (store?.id) map.set(String(store.id), store);
  });
  return { storeIds: [...map.keys()], stores: [...map.values()] };
}

function getEnv() {
  const required = ["SUPABASE_URL","SUPABASE_SERVICE_ROLE_KEY"];
  for (const name of required) if (!Deno.env.get(name)) throw new Error(`Secret ausente: ${name}`);
  return {
    supabaseUrl: Deno.env.get("SUPABASE_URL")!, serviceKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    clientId: Deno.env.get("GOOGLE_BUSINESS_CLIENT_ID") || "", clientSecret: Deno.env.get("GOOGLE_BUSINESS_CLIENT_SECRET") || "",
    redirectUri: Deno.env.get("GOOGLE_BUSINESS_REDIRECT_URI") || "", stateSecret: Deno.env.get("GOOGLE_BUSINESS_STATE_SECRET") || "",
    tokenKey: Deno.env.get("GOOGLE_BUSINESS_TOKEN_KEY") || "", appUrl: Deno.env.get("APP_URL") || "https://checkdiario.com.br/",
    mockMode: String(Deno.env.get("GOOGLE_BUSINESS_MOCK_MODE") || "").toLowerCase() === "true",
  };
}
function ensureOAuthConfigured(env: ReturnType<typeof getEnv>) {
  const missing = [
    ["GOOGLE_BUSINESS_CLIENT_ID", env.clientId], ["GOOGLE_BUSINESS_CLIENT_SECRET", env.clientSecret],
    ["GOOGLE_BUSINESS_REDIRECT_URI", env.redirectUri], ["GOOGLE_BUSINESS_STATE_SECRET", env.stateSecret],
    ["GOOGLE_BUSINESS_TOKEN_KEY", env.tokenKey],
  ].filter(([, value]) => !value).map(([name]) => name);
  if (missing.length) throw new Error(`OAuth ainda não configurado. Secrets ausentes: ${missing.join(", ")}`);
}

function buildMockDashboard(stores: any[]) {
  const baseStores = stores.length ? stores : [];
  const locais = baseStores.map((store, index) => ({
    id: `mock-local-${index + 1}`, nome: store.nome || `Loja ${index + 1}`, loja_id: store.id, ativo: true,
  }));
  const comments = [
    "Atendimento excelente e café muito gostoso. Voltarei mais vezes!",
    "Ambiente agradável e ótima variedade de produtos.",
    "Fui bem atendida, mas o pedido demorou um pouco para ficar pronto.",
    "Os bolos estavam fresquinhos e as crianças adoraram o espaço.",
    "Gostei bastante do local e do estacionamento.",
    "Atendimento poderia ser mais rápido no horário de movimento.",
  ];
  const names = ["Mariana Souza", "Paulo Mendes", "Ana Clara", "Carlos Oliveira", "Fernanda Lima", "João Pedro"];
  const avaliacoes: any[] = [];
  locais.forEach((local, storeIndex) => {
    for (let i = 0; i < 9; i++) {
      const dayOffset = storeIndex * 3 + i * 7;
      const noteCycle = [5, 5, 4, 5, 3, 4, 5, 2, 5];
      const nota = noteCycle[(i + storeIndex) % noteCycle.length];
      avaliacoes.push({
        id: `mock-review-${storeIndex + 1}-${i + 1}`, local_id: local.id, review_id: `simulada-${storeIndex + 1}-${i + 1}`,
        avaliador_nome: names[(i + storeIndex) % names.length], avaliador_foto_url: null, nota,
        comentario: comments[(i + storeIndex) % comments.length],
        criado_em: new Date(Date.now() - dayOffset * 86400000).toISOString(),
        atualizado_em: null,
        resposta_texto: i % 3 === 0 ? "Agradecemos pela avaliação e esperamos receber você novamente em breve!" : null,
        resposta_atualizada_em: i % 3 === 0 ? new Date(Date.now() - Math.max(dayOffset - 1, 0) * 86400000).toISOString() : null,
        google_business_locais: { nome: local.nome, loja_id: local.loja_id }, simulado: true,
      });
    }
  });
  return {
    locais, avaliacoes: avaliacoes.sort((a, b) => b.criado_em.localeCompare(a.criado_em)),
    conexao: { id: "mock", status: "simulada", google_email: null, ultima_sincronizacao_em: null },
    lojas_autorizadas: locais.length, simulated: true,
  };
}
function validateTenant(body: any) {
  if (!body?.empresa_id || !/^[0-9a-f-]{36}$/i.test(body.empresa_id)) throw new Error("Contexto de empresa inválido.");
}
function safeReturnUrl(value: string, fallback: string) {
  try { const url = new URL(value || fallback); const base = new URL(fallback); if (url.origin !== base.origin) return fallback; return url.toString(); } catch { return fallback; }
}
async function exchangeCode(code: string, env: ReturnType<typeof getEnv>) {
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: env.clientId, client_secret: env.clientSecret, redirect_uri: env.redirectUri, grant_type: "authorization_code" }) });
  const data = await response.json(); if (!response.ok) throw new Error(data.error_description || "Falha ao trocar autorização."); return data;
}
async function refreshAccessToken(refreshToken: string, env: ReturnType<typeof getEnv>) {
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ refresh_token: refreshToken, client_id: env.clientId, client_secret: env.clientSecret, grant_type: "refresh_token" }) });
  const data = await response.json(); if (!response.ok) throw new Error(data.error_description || "Falha ao renovar acesso ao Google."); return data.access_token;
}
async function googleJson(url: string, token: string, options: { method?: string; body?: any } = {}) {
  const response = await fetch(url, { method: options.method || "GET", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: options.body ? JSON.stringify(options.body) : undefined });
  const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error?.message || `Google API: HTTP ${response.status}`); return data;
}
async function keyBytes(secret: string) { return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret))); }
function b64(bytes: Uint8Array) { return btoa(String.fromCharCode(...bytes)).replaceAll("+","-").replaceAll("/","_").replaceAll("=",""); }
function unb64(value: string) { const raw=atob(value.replaceAll("-","+").replaceAll("_","/")); return Uint8Array.from(raw,c=>c.charCodeAt(0)); }
async function encrypt(value: string, secret: string) { const iv=crypto.getRandomValues(new Uint8Array(12)); const key=await crypto.subtle.importKey("raw",await keyBytes(secret),"AES-GCM",false,["encrypt"]); const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv},key,new TextEncoder().encode(value))); return `${b64(iv)}.${b64(encrypted)}`; }
async function decrypt(value: string, secret: string) { const [ivRaw,dataRaw]=value.split("."); const key=await crypto.subtle.importKey("raw",await keyBytes(secret),"AES-GCM",false,["decrypt"]); const plain=await crypto.subtle.decrypt({name:"AES-GCM",iv:unb64(ivRaw)},key,unb64(dataRaw)); return new TextDecoder().decode(plain); }
async function signState(data: any, secret: string) { const payload=b64(new TextEncoder().encode(JSON.stringify(data))); const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]); const sig=new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(payload))); return `${payload}.${b64(sig)}`; }
async function verifyState(raw: string, secret: string) { const [payload,sig]=raw.split("."); const expected=await signState(JSON.parse(new TextDecoder().decode(unb64(payload))),secret); if (expected.split(".")[1]!==sig) throw new Error("Estado OAuth inválido."); const data=JSON.parse(new TextDecoder().decode(unb64(payload))); if (Date.now()>data.exp) throw new Error("Autorização expirada."); return data; }
function json(body: any, status=200) { return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } }); }
