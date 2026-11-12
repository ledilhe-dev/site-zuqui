import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-funcionario-id, x-loja-id, x-operational-token, x-global-admin-token","Access-Control-Allow-Methods":"POST, OPTIONS"};
const buckets=new Map<string,number[]>();

Deno.serve(async request=>{
  if(request.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(request.method!=="POST")return json({ok:false,message:"Método não permitido."},405);
  try{
    const env=getEnv(),body=await request.json();
    validateUuid(body.empresa_id);validateUuid(body.loja_id);validateUuid(body.usuario_id);
    const question=String(body.question||"").replace(/\s+/g," ").trim().slice(0,1000),today=String(body.today||"");
    if(!question)throw pub("INVALID_QUESTION","Escreva uma pergunta para a CheckIA.",400);
    if(!validDate(today))throw pub("INVALID_DATE","Data de referência inválida.",400);
    const principal=String(request.headers.get("x-funcionario-id")||""),store=String(request.headers.get("x-loja-id")||""),token=String(request.headers.get("x-operational-token")||"");
    if(principal!==body.usuario_id||store!==body.loja_id||!token)throw pub("AUTH_REQUIRED","Sessão obrigatória.",401);
    const admin=createClient(env.url,env.key,{auth:{persistSession:false}});
    await authorize(admin,body,principal,token);
    rate(`${body.empresa_id}:${principal}`,30);
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),env.timeout);
    try{
      const response=await fetch(env.codexUrl,{method:"POST",headers:{"Content-Type":"application/json","X-Codex-Reader-Secret":env.secret},body:JSON.stringify({task:"checkia_intent",question,today}),signal:controller.signal});
      const payload=await response.json().catch(()=>({}));
      if(!response.ok||payload?.ok!==true)throw pub(String(payload?.code||"CODEX_ERROR"),String(payload?.message||"A CheckIA não conseguiu interpretar a pergunta."),response.status>=400?response.status:502);
      return json({ok:true,intent:validateIntent(payload.intent,today)});
    }finally{clearTimeout(timer)}
  }catch(error:any){if(error?.name==="AbortError")return json({ok:false,code:"CODEX_TIMEOUT",message:"A CheckIA demorou além do esperado. Tente novamente."},504);return json({ok:false,code:error?.code||"CHECKIA_ERROR",message:error?.message||"Não foi possível interpretar sua pergunta."},error?.status||500)}
});

async function authorize(admin:any,body:any,principal:string,token:string){
  const {data:valid,error}=await admin.rpc("validar_contexto_operacional_relay",{p_principal_id:principal,p_token:token,p_empresa_id:body.empresa_id,p_loja_id:body.loja_id});
  if(error)throw pub("AUTH_DATABASE_ERROR","Não foi possível validar a sessão.",500);if(valid!==true)throw pub("ACCESS_DENIED","Sessão sem acesso à loja selecionada.",403);
  const [{data:systemAdmin},{data:link,error:linkError}]=await Promise.all([
    admin.from("usuarios_admin").select("id").eq("id",principal).eq("empresa_id",body.empresa_id).eq("loja_id",body.loja_id).eq("ativo",true).maybeSingle(),
    admin.from("funcionario_lojas").select("perfil_id,perfis!inner(codigo,permissoes,ativo)").eq("funcionario_id",principal).eq("loja_id",body.loja_id).eq("ativo",true).maybeSingle()
  ]);
  if(linkError)throw pub("AUTH_DATABASE_ERROR","Não foi possível validar as permissões.",500);if(systemAdmin)return;
  const profile:any=Array.isArray(link?.perfis)?link.perfis[0]:link?.perfis,code=String(profile?.codigo||"").toUpperCase();
  if(profile?.ativo!==false&&(code==="ADM"||code==="MASTER"||profile?.permissoes?.relatorio_vendas_raffinato===true))return;
  throw pub("PERMISSION_DENIED","Seu perfil não possui acesso ao relatório de vendas.",403);
}
function validateIntent(value:any,today:string){if(!value||value.schema_version!=="1.0"||!["sales_query","unsupported"].includes(value.intent))throw pub("INVALID_RESPONSE","A interpretação retornou um formato inválido.",502);if(value.intent==="unsupported")return{schema_version:"1.0",intent:"unsupported",start_date:null,end_date:null,origins:[],period_label:""};const start=String(value.start_date||""),end=String(value.end_date||"");if(!validDate(start)||!validDate(end)||start>end||end>today)throw pub("INVALID_PERIOD","Não consegui determinar um período válido para a consulta.",422);const allowed=new Set(["VENDA_RAPIDA","DELIVERY","CARTAO_MESA"]),origins=[...new Set((Array.isArray(value.origins)?value.origins:[]).map(String).filter(x=>allowed.has(x)))];return{schema_version:"1.0",intent:"sales_query",start_date:start,end_date:end,origins,period_label:String(value.period_label||"").slice(0,100)}}
function rate(key:string,limit:number){const cutoff=Date.now()-10*60*1000,calls=(buckets.get(key)||[]).filter(x=>x>cutoff);if(calls.length>=limit)throw pub("RATE_LIMITED","Muitas perguntas em pouco tempo. Aguarde alguns minutos.",429);calls.push(Date.now());buckets.set(key,calls)}
function getEnv(){for(const n of ["SUPABASE_URL","SUPABASE_SERVICE_ROLE_KEY","CODEX_READER_URL","CODEX_READER_SECRET"])if(!Deno.env.get(n))throw pub("SERVER_NOT_CONFIGURED","A integração da CheckIA ainda não está configurada.",503);return{url:Deno.env.get("SUPABASE_URL")!,key:Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,codexUrl:Deno.env.get("CODEX_READER_URL")!,secret:Deno.env.get("CODEX_READER_SECRET")!,timeout:Math.max(30000,Math.min(120000,Number(Deno.env.get("CODEX_READER_TIMEOUT_MS")||90000)))}}
function validDate(v:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const[y,m,d]=v.split("-").map(Number),x=new Date(Date.UTC(y,m-1,d));return x.getUTCFullYear()===y&&x.getUTCMonth()===m-1&&x.getUTCDate()===d}function validateUuid(v:any){if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||"")))throw pub("INVALID_CONTEXT","Contexto da sessão inválido.",400)}function pub(code:string,message:string,status:number){return Object.assign(new Error(message),{code,status})}function json(value:any,status=200){return new Response(JSON.stringify(value),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}})}
