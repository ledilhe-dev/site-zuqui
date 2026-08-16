import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { aggregateMandatoryV2 } from "./mandatory-v2.mjs";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (request) => {
  const requestId = crypto.randomUUID();
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "Metodo nao permitido." }, 405);
  try {
    const body = await request.json();
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });

    if (body.action === "connector_pair") {
      validateUuid(body.connector_instance_id, "instalacao");
      const credential = validateToken(body.credential);
      const { data, error } = await admin.rpc("consumir_codigo_pareamento_raffinato", {
        p_codigo:String(body.code || ""), p_connector_instance_id:body.connector_instance_id,
        p_credencial_hash:await sha256(credential), p_nome:String(body.name || "Conector Raffinato"),
        p_versao:String(body.version || ""),
      });
      if (error) throw error;
      return json({ ok:true, ...data });
    }

    if (body.action === "connector_heartbeat") {
      const instance = await connectorForCredential(admin, body.connector_instance_id, validateToken(body.credential));
      const { error } = await admin.from("raffinato_connector_instances").update({
        status:"online", ultimo_contato_em:new Date().toISOString(), versao:String(body.version || "").slice(0,30),
        perfis_cadastrados:Math.max(0,Number(body.profiles || 0)), filiais_vinculadas:Math.max(0,Number(body.mappings || 0)),
      }).eq("id",instance.id);
      if (error) throw error;
      return json({ok:true,empresa_id:instance.empresa_id});
    }

    if (body.action === "connector_link_store") {
      validateUuid(body.empresa_id,"empresa"); validateUuid(body.loja_id,"loja"); validateUuid(body.connector_instance_id,"instalacao");
      await authorizeStore(admin,body.usuario_id,body.empresa_id,body.loja_id,body.global_admin_token);
      const {data:instance,error:instanceError}=await admin.from("raffinato_connector_instances").select("id").eq("id",body.connector_instance_id).eq("empresa_id",body.empresa_id).neq("status","revogado").maybeSingle();
      if(instanceError||!instance)throw instanceError||new Error("Instalacao nao pertence a empresa selecionada.");
      const {error}=await admin.from("raffinato_integracoes").update({connector_instance_id:instance.id}).eq("empresa_id",body.empresa_id).eq("loja_id",body.loja_id);
      if(error)throw error; return json({ok:true});
    }

    if (body.action === "pair") {
      validateUuid(body.empresa_id, "empresa"); validateUuid(body.loja_id, "loja");
      await authorizeStore(admin, body.usuario_id, body.empresa_id, body.loja_id, body.global_admin_token);
      const token = validateToken(body.token);
      const { error } = await admin.from("raffinato_integracoes").update({
        conector_token_hash: await sha256(token), status: "ativa", ultimo_erro: null,
      }).eq("empresa_id", body.empresa_id).eq("loja_id", body.loja_id);
      if (error) throw error;
      return json({ ok: true });
    }

    if (body.action === "sync") {
      const integration = await integrationForToken(admin, validateToken(body.token), body);
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
      const integration = await integrationForToken(admin, validateToken(body.token), body);
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
          valor_retirada: Number(item.valor_retirada || 0), caixa_aberto: Boolean(item.caixa_aberto),
          valor_confirmado_disponivel: item.valor_confirmado_disponivel !== false,
          valor_apurado: Number(item.valor_apurado || 0), valor_confirmado: Number(item.valor_confirmado || 0),
          sincronizado_em: new Date().toISOString(),
        }));
        const { error } = await admin.from("raffinato_faturamento_cache").upsert(rows, { onConflict:"empresa_id,loja_id,data,id_forma_pagamento" });
        if (error) throw error;
      }
      return json({ ok:true, quantidade:items.length });
    }

    if (body.action === "products_sync") {
      const integration = await integrationForToken(admin, validateToken(body.token), body);
      const inicio = validateDate(body.inicio, "inicio"); const fim = validateDate(body.fim, "fim");
      if (fim < inicio) throw new Error("Periodo invalido.");
      const items = Array.isArray(body.items) ? body.items.slice(0, 50000) : [];
      const { error: deleteError } = await admin.from("raffinato_produtos_cache").delete()
        .eq("empresa_id", integration.empresa_id).eq("loja_id", integration.loja_id).gte("data", inicio).lte("data", fim);
      if (deleteError) throw deleteError;
      for (let offset=0; offset<items.length; offset+=1000) {
        const rows=items.slice(offset,offset+1000).map((item:any)=>({
          empresa_id:integration.empresa_id,loja_id:integration.loja_id,data:validateDate(item.data,"data"),
          codigo:Number(item.codigo),produto:String(item.produto||"").slice(0,300),
          id_agrupamento:item.id_agrupamento==null?null:Number(item.id_agrupamento),
          agrupamento:item.agrupamento==null?null:String(item.agrupamento).slice(0,300),
          quantidade:Number(item.quantidade||0),total_faturado:Number(item.total_faturado||0),
          sincronizado_em:new Date().toISOString(),
        }));
        const { error }=await admin.from("raffinato_produtos_cache").upsert(rows,{onConflict:"empresa_id,loja_id,data,codigo"});
        if(error)throw error;
      }
      return json({ok:true,quantidade:items.length});
    }

    if (body.action === "metadata_sync") {
      const integration=await integrationForToken(admin,validateToken(body.token),body);
      const filial=Number(body.id_filial||1),syncedAt=new Date().toISOString();
      const groups=Array.isArray(body.agrupamentos)?body.agrupamentos.slice(0,10000):[],products=Array.isArray(body.produtos)?body.produtos.slice(0,100000):[],payments=Array.isArray(body.formas_pagamento)?body.formas_pagamento.slice(0,10000):[];
      for(const table of ["raffinato_agrupamentos_cache","raffinato_produtos_catalogo_cache","raffinato_formas_pagamento_catalogo_cache"]){const {error}=await admin.from(table).delete().eq("empresa_id",integration.empresa_id).eq("loja_id",integration.loja_id).eq("id_filial",filial);if(error)throw error;}
      const batches=async(table:string,rows:any[],onConflict:string)=>{for(let offset=0;offset<rows.length;offset+=1000){const {error}=await admin.from(table).upsert(rows.slice(offset,offset+1000),{onConflict});if(error)throw error;}};
      await batches("raffinato_agrupamentos_cache",groups.map((x:any)=>({empresa_id:integration.empresa_id,loja_id:integration.loja_id,id_filial:filial,id_agrupamento:Number(x.id),nome:String(x.nome||"").trim().slice(0,300),sincronizado_em:syncedAt})).filter((x:any)=>x.nome),"empresa_id,loja_id,id_filial,id_agrupamento");
      await batches("raffinato_produtos_catalogo_cache",products.map((x:any)=>({empresa_id:integration.empresa_id,loja_id:integration.loja_id,id_filial:filial,id_produto:Number(x.id),nome:String(x.nome||"").trim().slice(0,300),id_agrupamento:x.id_agrupamento==null?null:Number(x.id_agrupamento),agrupamento:x.agrupamento==null?null:String(x.agrupamento).trim().slice(0,300),sincronizado_em:syncedAt})).filter((x:any)=>x.nome),"empresa_id,loja_id,id_filial,id_produto");
      await batches("raffinato_formas_pagamento_catalogo_cache",payments.map((x:any)=>({empresa_id:integration.empresa_id,loja_id:integration.loja_id,id_filial:filial,id_forma_pagamento:Number(x.id),nome:String(x.nome||"").trim().slice(0,300),sincronizado_em:syncedAt})).filter((x:any)=>x.nome),"empresa_id,loja_id,id_filial,id_forma_pagamento");
      await admin.from("raffinato_integracoes").update({ultima_sincronizacao_em:syncedAt,ultimo_erro:null}).eq("id",integration.id);
      return json({ok:true,agrupamentos:groups.length,produtos:products.length,formas_pagamento:payments.length,sincronizado_em:syncedAt});
    }

    if (body.action === "canonical_sync") {
      const integration = await integrationForToken(admin, validateToken(body.token), body);
      const inicio=validateDate(body.inicio,"inicio"),fim=validateDate(body.fim,"fim");
      if(fim<inicio)throw new Error("Periodo invalido.");
      const documents=Array.isArray(body.documents)?body.documents.slice(0,100000):[];
      const items=Array.isArray(body.items)?body.items.slice(0,100000):[];
      const openDeliveries=Array.isArray(body.open_deliveries)?body.open_deliveries.slice(0,10000):[];
      // O snapshot operacional deve ser substituido inclusive quando vazio: isso
      // representa o ultimo delivery tendo migrado corretamente para faturado.
      const {error:openDeleteError}=await admin.from("raffinato_delivery_aberto_cache").delete()
        .eq("empresa_id",integration.empresa_id).eq("loja_id",integration.loja_id)
        .gte("data",inicio).lte("data",fim);
      if(openDeleteError)throw openDeleteError;
      for(let offset=0;offset<openDeliveries.length;offset+=1000){
        const rows=openDeliveries.slice(offset,offset+1000).map((x:any)=>({
          empresa_id:integration.empresa_id,loja_id:integration.loja_id,id_filial:Number(x.id_filial||1),
          id_tele_entrega:Number(x.id_tele_entrega),id_venda:x.id_venda==null?null:Number(x.id_venda),pedido:Number(x.pedido),
          data:validateDate(x.data,"data"),hora:String(x.hora||"00:00:00").slice(0,8),
          id_status:Number(x.id_status),status:String(x.status||"").slice(0,100),valor:Number(x.valor||0),
          cancelado:Boolean(x.cancelado),finalizado:Boolean(x.finalizado),
          id_documento_fiscal:x.id_documento_fiscal==null?null:Number(x.id_documento_fiscal),sincronizado_em:new Date().toISOString(),
        }));
        const {error}=await admin.from("raffinato_delivery_aberto_cache").upsert(rows,{onConflict:"empresa_id,loja_id,id_tele_entrega"});if(error)throw error;
      }
      // Nunca destrua o snapshot historico quando uma leitura transitoria do SQL
      // chegar vazia (por exemplo, durante o fechamento do caixa). Um periodo
      // realmente sem movimento nao precisa substituir dados previamente validos.
      if(!documents.length){
        return json({ok:true,documentos:0,itens:0,deliveries_abertos:openDeliveries.length,preservado:true,motivo:"fonte_faturada_vazia"});
      }
      const documentDates=[...new Set(documents.map((x:any)=>validateDate(x.data,"data")))];
      const itemDates=[...new Set(items.map((x:any)=>validateDate(x.data,"data")))];
      for(const table of ["raffinato_documentos_faturados_cache","raffinato_itens_faturados_cache"]){
        const dates=table==="raffinato_documentos_faturados_cache"?documentDates:itemDates;
        if(!dates.length)continue;
        const {error}=await admin.from(table).delete().eq("empresa_id",integration.empresa_id)
          .eq("loja_id",integration.loja_id).in("data",dates);
        if(error)throw error;
      }
      for(let offset=0;offset<documents.length;offset+=1000){
        const rows=documents.slice(offset,offset+1000).map((x:any)=>({
          empresa_id:integration.empresa_id,loja_id:integration.loja_id,id_filial:Number(x.id_filial||1),
          id_documento_fiscal:Number(x.id_documento_fiscal),data:validateDate(x.data,"data"),hora:String(x.hora||"00:00:00").slice(0,8),
          tipo:x.tipo==null?null:String(x.tipo).slice(0,20),eh_contingencia:Boolean(x.eh_contingencia),
          modulo_venda:String(x.modulo_venda||"VENDA_RAPIDA").slice(0,20),
          id_forma_pagamento:Number(x.id_forma_pagamento),forma_pagamento:String(x.forma_pagamento||"Sem forma").slice(0,200),
          valor_pagamento:Number(x.valor_pagamento||0),sincronizado_em:new Date().toISOString(),
        }));
        const {error}=await admin.from("raffinato_documentos_faturados_cache").upsert(rows,{onConflict:"empresa_id,loja_id,id_documento_fiscal,id_forma_pagamento"});if(error)throw error;
      }
      for(let offset=0;offset<items.length;offset+=1000){
        const rows=items.slice(offset,offset+1000).map((x:any)=>({
          empresa_id:integration.empresa_id,loja_id:integration.loja_id,id_filial:Number(x.id_filial||1),
          id_documento_fiscal:Number(x.id_documento_fiscal),data:validateDate(x.data,"data"),hora:String(x.hora||"00:00:00").slice(0,8),
          codigo:Number(x.codigo),produto:String(x.produto||"").slice(0,300),id_agrupamento:x.id_agrupamento==null?null:Number(x.id_agrupamento),
          agrupamento:x.agrupamento==null?null:String(x.agrupamento).slice(0,300),quantidade:Number(x.quantidade||0),
          total_faturado:Number(x.total_faturado||0),sincronizado_em:new Date().toISOString(),
        }));
        const {error}=await admin.from("raffinato_itens_faturados_cache").upsert(rows,{onConflict:"empresa_id,loja_id,id_documento_fiscal,codigo"});if(error)throw error;
      }
      return json({ok:true,documentos:documents.length,itens:items.length,deliveries_abertos:openDeliveries.length});
    }

    if(body.action==="mandatory_v2_sync"){
      const integration=await integrationForToken(admin,validateToken(body.token),body),filial=Number(body.id_filial),inicio=validateDate(body.inicio,"inicio"),fim=validateDate(body.fim,"fim"),items=Array.isArray(body.items)?body.items.slice(0,100000):[];
      if(!Number.isInteger(filial)||filial<=0)throw new Error("Filial Raffinato vinculada invalida.");
      const {error:deleteError}=await admin.from("raffinato_mandatory_v2_cache").delete().eq("empresa_id",integration.empresa_id).eq("loja_id",integration.loja_id).eq("id_filial",filial).gte("data",inicio).lte("data",fim);if(deleteError)throw deleteError;
      for(let offset=0;offset<items.length;offset+=1000){const rows=items.slice(offset,offset+1000).map((x:any)=>({empresa_id:integration.empresa_id,loja_id:integration.loja_id,id_filial:filial,data:validateDate(x.data||x.Data,"data"),hora:String(x.hora||x.Hora||"00:00:00").slice(0,8),id_venda:Number(x.id_venda),id_item:Number(x.id_item),id_pai:Number(x.id_pai),id_produto_pai:x.id_produto_pai==null?null:Number(x.id_produto_pai),produto_pai:String(x.produto_pai||"").slice(0,300),id_agrupamento_pai:x.id_agrupamento_pai==null?null:Number(x.id_agrupamento_pai),agrupamento_pai:String(x.agrupamento_pai||"").slice(0,300),origem:String(x.origem||"VENDA_RAPIDA"),valor_item:Number(x.valor_item||0),id_grupo_obrigatorio:Number(x.id_grupo_obrigatorio),grupo_obrigatorio:String(x.grupo_obrigatorio||"").slice(0,300),quantidade_maxima:x.quantidade_maxima==null?null:Number(x.quantidade_maxima),quantidade_minima:x.quantidade_minima==null?null:Number(x.quantidade_minima),id_componente:Number(x.id_componente),componente:String(x.componente||"").slice(0,300),quantidade_componente:Number(x.quantidade_componente||0),valor_componente:Number(x.valor_componente||0),sincronizado_em:new Date().toISOString()}));const {error}=await admin.from("raffinato_mandatory_v2_cache").upsert(rows,{onConflict:"empresa_id,loja_id,id_filial,id_venda,id_pai,id_grupo_obrigatorio,id_item"});if(error)throw error;}
      return json({ok:true,quantidade:items.length,id_filial:filial});
    }

    if(body.action==="managerial_sync"){
      const integration=await integrationForToken(admin,validateToken(body.token),body),inicio=validateDate(body.inicio,"inicio"),fim=validateDate(body.fim,"fim"),abc=Array.isArray(body.abc_items)?body.abc_items.slice(0,100000):[];
      for(const table of ["raffinato_abc_cache"]){const {error}=await admin.from(table).delete().eq("empresa_id",integration.empresa_id).eq("loja_id",integration.loja_id).gte("data",inicio).lte("data",fim);if(error)throw error;}
      for(let offset=0;offset<abc.length;offset+=1000){const rows=abc.slice(offset,offset+1000).map((x:any)=>({empresa_id:integration.empresa_id,loja_id:integration.loja_id,data:validateDate(x.data,"data"),id_filial:Number(x.id_filial||1),codigo:Number(x.codigo),produto:String(x.produto||"").slice(0,300),id_agrupamento:x.id_agrupamento==null?null:Number(x.id_agrupamento),agrupamento:x.agrupamento==null?null:String(x.agrupamento).slice(0,300),quantidade:Number(x.quantidade||0),faturamento:Number(x.faturamento||0),custo_conhecido:Number(x.custo_conhecido||0),faturamento_com_custo:Number(x.faturamento_com_custo||0),itens_com_custo:Number(x.itens_com_custo||0),itens_sem_custo:Number(x.itens_sem_custo||0),sincronizado_em:new Date().toISOString()}));const {error}=await admin.from("raffinato_abc_cache").upsert(rows,{onConflict:"empresa_id,loja_id,data,id_filial,codigo"});if(error)throw error;}
      return json({ok:true,abc:abc.length});
    }

    if(body.action==="annual_sync"){
      const integration=await integrationForToken(admin,validateToken(body.token),body),filial=Number(body.id_filial||1),items=Array.isArray(body.items)?body.items.slice(0,10000):[];const {error:del}=await admin.from("raffinato_anual_cache").delete().eq("empresa_id",integration.empresa_id).eq("loja_id",integration.loja_id).eq("id_filial",filial);if(del)throw del;
      if(items.length){const rows=items.map((x:any)=>({empresa_id:integration.empresa_id,loja_id:integration.loja_id,id_filial:filial,ano:Number(x.ano),mes:Number(x.mes),modulo_venda:String(x.modulo_venda||"TODOS"),faturamento:Number(x.faturamento||0),vendas:Number(x.vendas||0),quantidade:Number(x.quantidade||0),primeira_data:x.primeira_data,ultima_data:x.ultima_data,sincronizado_em:new Date().toISOString()}));const {error}=await admin.from("raffinato_anual_cache").upsert(rows,{onConflict:"empresa_id,loja_id,id_filial,ano,mes,modulo_venda"});if(error)throw error;}return json({ok:true,quantidade:items.length});
    }

    const mappedReportActions=new Set(["abc_dashboard","mandatory_v2_dashboard","mandatory_v2_metadata","annual_comparison","sales_bi_dashboard","sales_canonical_dashboard","products_canonical_dashboard","products_dashboard","products_metadata","metadata_dashboard","billing_dashboard","billing_forms"]);
    if(mappedReportActions.has(String(body.action||""))){
      validateUuid(body.empresa_id,"empresa");validateUuid(body.loja_id,"loja");
      const {data:mapping,error:mappingError}=await admin.from("raffinato_integracoes")
        .select("connection_profile_id,raffinato_filial_id,instancia_sql,banco_dados")
        .eq("empresa_id",body.empresa_id).eq("loja_id",body.loja_id).eq("status","ativa").maybeSingle();
      if(mappingError)throw mappingError;
      if(!mapping||mapping.raffinato_filial_id==null||!mapping.connection_profile_id)throw new Error("Esta loja ainda nao possui uma filial Raffinato vinculada.");
      body.id_filial=Number(mapping.raffinato_filial_id);
      body.connection_profile_id=mapping.connection_profile_id;
      console.info(JSON.stringify({event:"RAFFINATO_STORE_MAPPING_RESOLVED",request_id:requestId,action:body.action,empresa_id:body.empresa_id,loja_id:body.loja_id,connection_profile_id:mapping.connection_profile_id,raffinato_filial_id:body.id_filial,sql_filial_id:body.id_filial,server:mapping.instancia_sql,database:mapping.banco_dados}));
    }

    if(body.action==="mandatory_v2_metadata"){
      validateUuid(body.empresa_id,"empresa");validateUuid(body.loja_id,"loja");await authorizeStore(admin,body.usuario_id,body.empresa_id,body.loja_id,body.global_admin_token);const filial=Number(body.id_filial);
      const {data,error}=await admin.from("raffinato_agrupamentos_cache").select("id_agrupamento,nome,sincronizado_em").eq("empresa_id",body.empresa_id).eq("loja_id",body.loja_id).eq("id_filial",filial).order("nome");if(error)throw error;
      return json({raffinato_filial_id:filial,connection_profile_id:body.connection_profile_id,agrupamentos:(data||[]).map((x:any)=>({id:x.id_agrupamento,nome:x.nome})),quantidade_agrupamentos:(data||[]).length,sincronizado_em:(data||[]).map((x:any)=>x.sincronizado_em).sort().pop()||null});
    }

    if(body.action==="mandatory_v2_dashboard"){
      validateUuid(body.empresa_id,"empresa");validateUuid(body.loja_id,"loja");await authorizeStore(admin,body.usuario_id,body.empresa_id,body.loja_id,body.global_admin_token);const filial=Number(body.id_filial),start=validateDateTime(body.inicio,"inicio"),end=validateDateTime(body.fim_exclusivo,"fim"),rows:any[]=[];
      for(let offset=0;offset<100000;offset+=1000){let query=admin.from("raffinato_mandatory_v2_cache").select("*").eq("empresa_id",body.empresa_id).eq("loja_id",body.loja_id).eq("id_filial",filial).gte("data",start.slice(0,10)).lte("data",end.slice(0,10)).range(offset,offset+999);if(body.origem)query=query.eq("origem",body.origem);const {data,error}=await query;if(error)throw error;rows.push(...(data||[]));if(!data||data.length<1000)break;}
      const groupIds=new Set((Array.isArray(body.agrupamentos)?body.agrupamentos:[]).map((x:any)=>Number(x)).filter(Number.isFinite)),product=String(body.produto||"").trim().toLocaleLowerCase("pt-BR");
      const filtered=rows.filter((row:any)=>{const stamp=`${row.data}T${String(row.hora||"00:00:00").slice(0,8)}`;return stamp>=start&&stamp<end&&(!groupIds.size||groupIds.has(Number(row.id_agrupamento_pai)))&&(!product||String(row.id_produto_pai)===product||String(row.produto_pai||"").toLocaleLowerCase("pt-BR").includes(product));});
      return json({...aggregateMandatoryV2(filtered),raffinato_filial_id:filial,connection_profile_id:body.connection_profile_id,rastreamento:{cache:rows.length,filtrado:filtered.length},origem_consulta:"mandatory_v2_cache"});
    }

    if(body.action==="abc_dashboard"){
      validateUuid(body.empresa_id,"empresa");validateUuid(body.loja_id,"loja");await authorizeStore(admin,body.usuario_id,body.empresa_id,body.loja_id,body.global_admin_token);const start=String(body.inicio||"").slice(0,10),end=String(body.fim_exclusivo||"").slice(0,10),mode=String(body.modo||"faturamento"),all:any[]=[];
      for(let offset=0;offset<100000;offset+=1000){let q=admin.from("raffinato_abc_cache").select("codigo,produto,id_agrupamento,agrupamento,quantidade,faturamento,custo_conhecido,faturamento_com_custo,itens_com_custo,itens_sem_custo").eq("empresa_id",body.empresa_id).eq("loja_id",body.loja_id).eq("id_filial",Number(body.id_filial||1)).gte("data",start).lt("data",end).range(offset,offset+999);if(body.id_agrupamento)q=q.eq("id_agrupamento",Number(body.id_agrupamento));const {data,error}=await q;if(error)throw error;all.push(...(data||[]));if(!data||data.length<1000)break;}
      const product=String(body.produto||"").trim().toLocaleLowerCase("pt-BR"),map=new Map<string,any>();for(const x of all.filter(x=>!product||String(x.codigo)===product||String(x.produto||"").toLocaleLowerCase("pt-BR").includes(product))){const k=String(x.codigo),r=map.get(k)||{codigo:x.codigo,produto:x.produto,id_agrupamento:x.id_agrupamento,agrupamento:x.agrupamento,quantidade:0,faturamento:0,custo_conhecido:0,faturamento_com_custo:0,itens_com_custo:0,itens_sem_custo:0};for(const f of ["quantidade","faturamento","custo_conhecido","faturamento_com_custo","itens_com_custo","itens_sem_custo"])r[f]+=Number(x[f]||0);map.set(k,r);}const rows=[...map.values()];for(const r of rows){const covered=r.faturamento_com_custo,cost=r.custo_conhecido;r.lucro=covered>0?covered-cost:null;r.margem=covered>0?(covered-cost)/covered*100:null;r.cobertura_custo=r.faturamento?r.faturamento_com_custo/r.faturamento*100:0;r.valor_principal=mode==="quantidade"?r.quantidade:(mode==="lucro"?r.lucro:r.faturamento);}const eligible=rows.filter(r=>r.valor_principal!=null&&(mode!=="lucro"||r.valor_principal>0)).sort((a,b)=>b.valor_principal-a.valor_principal),total=eligible.reduce((s,r)=>s+r.valor_principal,0);let acc=0;for(const r of eligible){const before=acc;r.participacao=total?r.valor_principal/total*100:0;acc+=r.participacao;r.acumulado=acc;r.classe=before<80?"A":before<95?"B":"C";}for(const r of rows.filter(r=>!r.classe)){r.participacao=0;r.acumulado=null;r.classe="SEM_CUSTO";}const revenue=rows.reduce((s,r)=>s+r.faturamento,0),covered=rows.reduce((s,r)=>s+r.faturamento_com_custo,0);return json({modo:mode,items:[...eligible,...rows.filter(r=>!eligible.includes(r))],resumo:{faturamento:revenue,faturamento_com_custo:covered,faturamento_sem_custo:revenue-covered,cobertura_custo:revenue?covered/revenue*100:0},origem_consulta:"cache_gerencial_remoto"});
    }

    if (body.action === "annual_comparison") {
      validateUuid(body.empresa_id,"empresa");validateUuid(body.loja_id,"loja");await authorizeStore(admin,body.usuario_id,body.empresa_id,body.loja_id,body.global_admin_token);
      const loadAnnualCache=async()=>{const rows:any[]=[];for(let offset=0;offset<10000;offset+=1000){const {data,error}=await admin.from("raffinato_anual_cache").select("ano,mes,modulo_venda,faturamento,vendas,quantidade,primeira_data,ultima_data").eq("empresa_id",body.empresa_id).eq("loja_id",body.loja_id).eq("id_filial",Number(body.id_filial||1)).order("ano").order("mes").range(offset,offset+999);if(error)throw error;rows.push(...(data||[]));if(!data||data.length<1000)break;}return rows;};
      if(String(body.mode||"")==="history"){
        const annual=await loadAnnualCache();if(annual.length){const firstDate=annual.map(x=>x.primeira_data).filter(Boolean).sort()[0],lastDate=annual.map(x=>x.ultima_data).filter(Boolean).sort().at(-1),firstYear=Number(String(firstDate).slice(0,4)),lastYear=Number(String(lastDate).slice(0,4));return json({schema_version:3,primeira_data:firstDate,ultima_data:lastDate,anos:Array.from({length:lastYear-firstYear+1},(_,i)=>firstYear+i)});}
        const base=()=>admin.from("raffinato_documentos_faturados_cache").select("data").eq("empresa_id",body.empresa_id).eq("loja_id",body.loja_id);
        const [{data:firstRows,error:firstError},{data:lastRows,error:lastError}]=await Promise.all([base().order("data").limit(1),base().order("data",{ascending:false}).limit(1)]);
        if(firstError)throw firstError;if(lastError)throw lastError;
        const firstDate=firstRows?.[0]?.data||null,lastDate=lastRows?.[0]?.data||null;if(!firstDate||!lastDate)throw new Error("CACHE_MISS: historico ainda nao sincronizado pelo conector.");
        const firstYear=Number(String(firstDate).slice(0,4)),lastYear=Number(String(lastDate).slice(0,4));return json({schema_version:2,primeira_data:firstDate,ultima_data:lastDate,anos:Array.from({length:lastYear-firstYear+1},(_,i)=>firstYear+i)});
      }
      const first=Math.max(1900,Number(body.ano_inicial||new Date().getFullYear()-1)),last=Math.min(2100,Number(body.ano_final||new Date().getFullYear()));if(last<first)throw new Error("Intervalo de anos invalido.");
      if(String(body.mode||"summary")==="summary"&&!body.produto&&!body.id_agrupamento){const annual=(await loadAnnualCache()).filter(x=>Number(x.ano)>=first&&Number(x.ano)<=last),months=annual.filter(x=>x.modulo_venda==="TODOS").map(x=>({ano:x.ano,mes:x.mes,faturamento:Number(x.faturamento||0),vendas:Number(x.vendas||0),quantidade:Number(x.quantidade||0),ticket_medio:Number(x.vendas||0)?Number(x.faturamento||0)/Number(x.vendas):0})),modules=annual.filter(x=>x.modulo_venda!=="TODOS").map(x=>({modulo_venda:x.modulo_venda,ano:x.ano,mes:x.mes,faturamento:Number(x.faturamento||0)}));if(months.length)return json({schema_version:3,meses:months,modulos:modules,modulos_totais:[...new Set(modules.map(x=>x.modulo_venda))].map(m=>({modulo_venda:m,faturamento:modules.filter(x=>x.modulo_venda===m).reduce((s,x)=>s+x.faturamento,0)})),agrupamentos:[],origem_consulta:"historico_mensal_completo"});}
      const start=`${first}-01-01`,end=`${last+1}-01-01`,loadAnnual=async(table:string,fields:string)=>{const rows:any[]=[];for(let offset=0;offset<200000;offset+=1000){const {data,error}=await admin.from(table).select(fields).eq("empresa_id",body.empresa_id).eq("loja_id",body.loja_id).gte("data",start).lt("data",end).order("data").range(offset,offset+999);if(error)throw error;rows.push(...(data||[]));if(!data||data.length<1000)break;}return rows;};
      const docs=await loadAnnual("raffinato_documentos_faturados_cache","id_documento_fiscal,data,hora,modulo_venda,valor_pagamento"),items=await loadAnnual("raffinato_itens_faturados_cache","id_documento_fiscal,data,hora,codigo,produto,id_agrupamento,agrupamento,quantidade,total_faturado"),open=await loadAnnual("raffinato_delivery_aberto_cache","id_tele_entrega,data,hora,valor,cancelado,finalizado,id_documento_fiscal");
      const docMap=new Map<string,any>();for(const d of docs){const id=String(d.id_documento_fiscal),x=docMap.get(id)||{id,data:d.data,hora:d.hora||"00:00:00",modulo_venda:d.modulo_venda||"VENDA_RAPIDA",faturamento:0};x.faturamento+=Number(d.valor_pagamento||0);docMap.set(id,x);}
      const productText=String(body.produto||"").trim().toLocaleLowerCase("pt-BR"),group=body.id_agrupamento==null?"":String(body.id_agrupamento),eligibleByProduct=new Set(items.filter(x=>(!group||String(x.id_agrupamento)===group)&&(!productText||String(x.codigo)===productText||String(x.produto||"").toLocaleLowerCase("pt-BR").includes(productText))).map(x=>String(x.id_documento_fiscal))),hasItemFilter=!!(group||productText),module=String(body.modulo_venda||"");
      const weekday=body.dia_semana==null?null:Number(body.dia_semana),hour=body.hora==null?null:Number(body.hora),dayOf=(d:string)=>new Date(`${d}T12:00:00Z`).getUTCDay(),eligibleDocs=[...docMap.values()].filter(x=>(!module||x.modulo_venda===module)&&(!hasItemFilter||eligibleByProduct.has(x.id))&&(weekday==null||dayOf(x.data)===weekday)&&(hour==null||Number(String(x.hora).slice(0,2))===hour)),eligibleIds=new Set(eligibleDocs.map(x=>x.id)),eligibleItems=items.filter(x=>eligibleIds.has(String(x.id_documento_fiscal))&&(!group||String(x.id_agrupamento)===group)&&(!productText||String(x.codigo)===productText||String(x.produto||"").toLocaleLowerCase("pt-BR").includes(productText)));
      const monthMap=new Map<string,any>(),moduleMonthMap=new Map<string,any>();for(const d of eligibleDocs){const year=Number(String(d.data).slice(0,4)),month=Number(String(d.data).slice(5,7)),key=`${year}-${month}`,x=monthMap.get(key)||{ano:year,mes:month,faturamento:0,vendas:0,quantidade:0};x.faturamento+=d.faturamento;x.vendas++;monthMap.set(key,x);const mk=`${d.modulo_venda}-${year}-${month}`,mx=moduleMonthMap.get(mk)||{modulo_venda:d.modulo_venda,ano:year,mes:month,faturamento:0};mx.faturamento+=d.faturamento;moduleMonthMap.set(mk,mx);}
      for(const item of eligibleItems){const key=`${String(item.data).slice(0,4)}-${Number(String(item.data).slice(5,7))}`,x=monthMap.get(key);if(x)x.quantidade+=Number(item.quantidade||0);}
      if(!hasItemFilter&&(!module||module==="DELIVERY"))for(const d of open.filter(x=>!x.cancelado&&!x.finalizado&&!x.id_documento_fiscal)){const year=Number(String(d.data).slice(0,4)),month=Number(String(d.data).slice(5,7)),value=Number(d.valor||0),key=`${year}-${month}`,x=monthMap.get(key)||{ano:year,mes:month,faturamento:0,vendas:0,quantidade:0};x.faturamento+=value;x.vendas++;monthMap.set(key,x);const mk=`DELIVERY-${year}-${month}`,mx=moduleMonthMap.get(mk)||{modulo_venda:"DELIVERY",ano:year,mes:month,faturamento:0};mx.faturamento+=value;moduleMonthMap.set(mk,mx);}
      const months=[...monthMap.values()].map(x=>({...x,ticket_medio:x.vendas?x.faturamento/x.vendas:0})).sort((a,b)=>a.ano-b.ano||a.mes-b.mes),modules=[...moduleMonthMap.values()],moduleTotals=["VENDA_RAPIDA","DELIVERY","CARTAO_MESA"].map(m=>({modulo_venda:m,faturamento:modules.filter(x=>x.modulo_venda===m).reduce((s,x)=>s+x.faturamento,0)}));
      const mode=String(body.mode||"summary");if(mode==="summary"){const groupMap=new Map<string,string>();for(const x of items)if(x.id_agrupamento!=null)groupMap.set(String(x.id_agrupamento),String(x.agrupamento||x.id_agrupamento));return json({schema_version:1,meses:months,modulos:modules,modulos_totais:moduleTotals,agrupamentos:[...groupMap].map(([id,nome])=>({id,nome})).sort((a,b)=>a.nome.localeCompare(b.nome))});}
      if(mode==="product"){const id=String(body.id_produto||"");if(!id)throw new Error("Selecione um produto.");const itemMonths=new Map<string,any>();for(const x of eligibleItems.filter(x=>String(x.codigo)===id)){const year=Number(String(x.data).slice(0,4)),month=Number(String(x.data).slice(5,7)),key=`${year}-${month}`,row=itemMonths.get(key)||{ano:year,mes:month,faturamento:0,quantidade:0,vendas:0};row.faturamento+=Number(x.total_faturado||0);row.quantidade+=Number(x.quantidade||0);itemMonths.set(key,row);}return json({schema_version:1,meses:[...itemMonths.values()]});}
      const selectedYear=Number(body.ano||last),selectedMonth=Number(body.mes||0),periodDocs=eligibleDocs.filter(x=>Number(String(x.data).slice(0,4))===selectedYear&&(!selectedMonth||Number(String(x.data).slice(5,7))===selectedMonth)),periodIds=new Set(periodDocs.map(x=>x.id)),periodItems=eligibleItems.filter(x=>periodIds.has(String(x.id_documento_fiscal))),productMap=new Map<string,any>(),groupMap=new Map<string,any>(),dayMap=new Map<string,any>(),weekdayMap=new Map<number,any>(),hourMap=new Map<number,any>();for(const x of periodItems){const id=String(x.codigo),p=productMap.get(id)||{id,nome:x.produto||id,faturamento:0,quantidade:0};p.faturamento+=Number(x.total_faturado||0);p.quantidade+=Number(x.quantidade||0);productMap.set(id,p);const gid=String(x.id_agrupamento||"SEM_GRUPO"),g=groupMap.get(gid)||{id:gid,nome:x.agrupamento||"Sem agrupamento",faturamento:0};g.faturamento+=Number(x.total_faturado||0);groupMap.set(gid,g);}for(const d of periodDocs){const day=String(d.data),x=dayMap.get(day)||{data:day,faturamento:0,vendas:0};x.faturamento+=d.faturamento;x.vendas++;dayMap.set(day,x);const wd=dayOf(day),w=weekdayMap.get(wd)||{dia_semana:wd,faturamento:0,vendas:0};w.faturamento+=d.faturamento;w.vendas++;weekdayMap.set(wd,w);const hr=Number(String(d.hora).slice(0,2)),h=hourMap.get(hr)||{hora:hr,faturamento:0,vendas:0};h.faturamento+=d.faturamento;h.vendas++;hourMap.set(hr,h);}const limit=Math.min(20,Math.max(10,Number(body.limite||10))),allProducts=[...productMap.values()];return json({schema_version:2,produtos:[...allProducts].sort((a,b)=>b.faturamento-a.faturamento).slice(0,limit),produtos_quantidade:[...allProducts].sort((a,b)=>b.quantidade-a.quantidade).slice(0,limit),agrupamentos:[...groupMap.values()].sort((a,b)=>b.faturamento-a.faturamento).slice(0,15),dias:[...dayMap.values()].sort((a,b)=>a.data.localeCompare(b.data)),dias_semana:[...weekdayMap.values()].map(x=>({...x,ticket_medio:x.vendas?x.faturamento/x.vendas:0})),horarios:[...hourMap.values()].sort((a,b)=>a.hora-b.hora).map(x=>({...x,ticket_medio:x.vendas?x.faturamento/x.vendas:0}))});
    }

    if (body.action === "sales_bi_dashboard") {
      validateUuid(body.empresa_id,"empresa");validateUuid(body.loja_id,"loja");await authorizeStore(admin,body.usuario_id,body.empresa_id,body.loja_id,body.global_admin_token);
      const start=String(body.inicio||"").slice(0,19),end=String(body.fim_exclusivo||"").slice(0,19);if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(end)||end<=start)throw new Error("Periodo invalido.");
      const load=async(table:string,fields:string)=>{const rows:any[]=[];for(let offset=0;offset<100000;offset+=1000){const {data,error}=await admin.from(table).select(fields).eq("empresa_id",body.empresa_id).eq("loja_id",body.loja_id).gte("data",start.slice(0,10)).lte("data",end.slice(0,10)).order("data").range(offset,offset+999);if(error)throw error;rows.push(...(data||[]));if(!data||data.length<1000)break;}return rows.filter((x:any)=>{const dt=`${x.data}T${String(x.hora||"00:00:00").slice(0,8)}`;return dt>=start&&dt<end;});};
      const docs=await load("raffinato_documentos_faturados_cache","id_documento_fiscal,data,hora,modulo_venda,id_forma_pagamento,forma_pagamento,valor_pagamento"),allItems=await load("raffinato_itens_faturados_cache","id_documento_fiscal,data,hora,codigo,produto,id_agrupamento,agrupamento,quantidade,total_faturado");if(!docs.length)throw new Error("CACHE_MISS: periodo ainda nao sincronizado pelo conector.");
      const payment=body.id_forma_pagamento==null?"":String(body.id_forma_pagamento),module=String(body.origem||body.modulo_venda||""),group=body.id_agrupamento==null?"":String(body.id_agrupamento),product=String(body.produto||"").trim().toLocaleLowerCase("pt-BR"),weekday=body.dia_semana==null?null:Number(body.dia_semana),hour=body.hora==null?null:Number(body.hora),dayOf=(d:string)=>new Date(`${d}T12:00:00Z`).getUTCDay();
      const docMeta=new Map<string,any>(),docTotal=new Map<string,number>();for(const d of docs){const id=String(d.id_documento_fiscal);docMeta.set(id,d);docTotal.set(id,(docTotal.get(id)||0)+Number(d.valor_pagamento||0));}
      const selectedDocs=docs.filter(d=>(!payment||String(d.id_forma_pagamento)===payment)&&(!module||String(d.modulo_venda)===module)&&(weekday==null||dayOf(String(d.data))===weekday)&&(hour==null||Number(String(d.hora||"00").slice(0,2))===hour)),selectedIds=new Set(selectedDocs.map(d=>String(d.id_documento_fiscal)));
      const selectedPayments=new Map<string,any[]>();for(const d of selectedDocs){const id=String(d.id_documento_fiscal),list=selectedPayments.get(id)||[];list.push(d);selectedPayments.set(id,list);}const items=allItems.filter(x=>selectedIds.has(String(x.id_documento_fiscal))&&(!group||String(x.id_agrupamento)===group)&&(!product||String(x.codigo)===product||String(x.produto||"").toLocaleLowerCase("pt-BR").includes(product))),eligibleIds=new Set(items.map(x=>String(x.id_documento_fiscal))),rows:any[]=[];
      for(const item of items)for(const pay of selectedPayments.get(String(item.id_documento_fiscal))||[]){const factor=Number(pay.valor_pagamento||0)/(docTotal.get(String(item.id_documento_fiscal))||1);rows.push({...item,modulo_venda:pay.modulo_venda,id_forma_pagamento:pay.id_forma_pagamento,forma_pagamento:pay.forma_pagamento,quantidade_atribuida:Number(item.quantidade||0)*factor,valor_atribuido:Number(item.total_faturado||0)*factor});}
      const aggregate=(key:(x:any)=>string,seed:(x:any)=>any)=>{const map=new Map<string,any>();for(const x of rows){const k=key(x),r=map.get(k)||seed(x);r.faturamento+=x.valor_atribuido;r.quantidade+=x.quantidade_atribuida;r.documentos.add(String(x.id_documento_fiscal));map.set(k,r);}return[...map.values()].map(x=>({...x,vendas:x.documentos.size,ticket_medio:x.documentos.size?x.faturamento/x.documentos.size:0,documentos:undefined})).sort((a,b)=>b.faturamento-a.faturamento);};
      const products=aggregate(x=>String(x.codigo),x=>({codigo:x.codigo,produto:x.produto,id_agrupamento:x.id_agrupamento,agrupamento:x.agrupamento,faturamento:0,quantidade:0,documentos:new Set()})),payments=aggregate(x=>String(x.id_forma_pagamento),x=>({id_forma_pagamento:x.id_forma_pagamento,forma_pagamento:x.forma_pagamento,faturamento:0,quantidade:0,documentos:new Set()})),channels=aggregate(x=>String(x.modulo_venda),x=>({origem:x.modulo_venda,faturamento:0,quantidade:0,documentos:new Set()})),days=aggregate(x=>String(dayOf(String(x.data))),x=>({dia_semana:dayOf(String(x.data)),faturamento:0,quantidade:0,documentos:new Set()})),hours=aggregate(x=>String(String(x.hora||"00").slice(0,2)),x=>({hora:Number(String(x.hora||"00").slice(0,2)),faturamento:0,quantidade:0,documentos:new Set()})),groups=aggregate(x=>String(x.id_agrupamento||""),x=>({id_agrupamento:x.id_agrupamento,agrupamento:x.agrupamento||"Sem agrupamento",faturamento:0,quantidade:0,documentos:new Set()}));
      const hasProductFilter=!!(group||product),financial=selectedDocs.filter(x=>!hasProductFilter||eligibleIds.has(String(x.id_documento_fiscal))).reduce((s,x)=>s+Number(x.valor_pagamento||0),0),itemRevenue=rows.reduce((s,x)=>s+x.valor_atribuido,0),quantity=rows.reduce((s,x)=>s+x.quantidade_atribuida,0),docIds=hasProductFilter?eligibleIds:new Set(selectedDocs.map(x=>String(x.id_documento_fiscal))),revenue=hasProductFilter?itemRevenue:financial;
      const aggregateDocs=(key:(x:any)=>string,seed:(x:any)=>any)=>{const map=new Map<string,any>();for(const x of selectedDocs.filter(x=>!hasProductFilter||eligibleIds.has(String(x.id_documento_fiscal)))){const k=key(x),r=map.get(k)||seed(x);r.faturamento+=Number(x.valor_pagamento||0);r.documentos.add(String(x.id_documento_fiscal));map.set(k,r);}return[...map.values()].map(x=>({...x,quantidade:x.documentos.size,vendas:x.documentos.size,ticket_medio:x.documentos.size?x.faturamento/x.documentos.size:0,documentos:undefined})).sort((a,b)=>b.faturamento-a.faturamento);};
      const finalPayments=hasProductFilter?payments:aggregateDocs(x=>String(x.id_forma_pagamento),x=>({id_forma_pagamento:x.id_forma_pagamento,forma_pagamento:x.forma_pagamento,faturamento:0,documentos:new Set()})),finalChannels=hasProductFilter?channels:aggregateDocs(x=>String(x.modulo_venda),x=>({origem:x.modulo_venda,faturamento:0,documentos:new Set()})),finalDays=hasProductFilter?days:aggregateDocs(x=>String(dayOf(String(x.data))),x=>({dia_semana:dayOf(String(x.data)),faturamento:0,documentos:new Set()})),finalHours=hasProductFilter?hours:aggregateDocs(x=>String(String(x.hora||"00").slice(0,2)),x=>({hora:Number(String(x.hora||"00").slice(0,2)),faturamento:0,documentos:new Set()}));
      return json({schema_version:2,totalizadores:{faturamento:revenue,faturamento_financeiro:financial,produtos_identificados:itemRevenue,acrescimos_descontos:financial-itemRevenue,vendas:docIds.size,itens:quantity,ticket_medio:docIds.size?revenue/docIds.size:0},produtos:products,formas_pagamento:finalPayments,canais:finalChannels,dias_semana:finalDays,horarios:finalHours,agrupamentos:groups,reconciliacao:{total_financeiro:financial,total_produtos:itemRevenue,diferenca:financial-itemRevenue},origem_consulta:"bi_agregado_remoto"});
    }

    if (body.action === "sales_canonical_dashboard") {
      validateUuid(body.empresa_id,"empresa");validateUuid(body.loja_id,"loja");await authorizeStore(admin,body.usuario_id,body.empresa_id,body.loja_id,body.global_admin_token);
      const start=String(body.inicio||"").slice(0,19),end=String(body.fim_exclusivo||"").slice(0,19);if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(end)||end<=start)throw new Error("Periodo invalido.");
      const load=async(table:string,fields:string)=>{const rows:any[]=[];for(let offset=0;offset<100000;offset+=1000){const {data,error}=await admin.from(table).select(fields).eq("empresa_id",body.empresa_id).eq("loja_id",body.loja_id).gte("data",start.slice(0,10)).lte("data",end.slice(0,10)).order("data").range(offset,offset+999);if(error)throw error;rows.push(...(data||[]));if(!data||data.length<1000)break;}return rows.filter((x:any)=>{const dt=`${x.data}T${String(x.hora||"00:00:00").slice(0,8)}`;return dt>=start&&dt<end;});};
      const docs=await load("raffinato_documentos_faturados_cache","id_documento_fiscal,data,hora,tipo,eh_contingencia,modulo_venda,id_forma_pagamento,forma_pagamento,valor_pagamento"),items=await load("raffinato_itens_faturados_cache","id_documento_fiscal,data,hora,codigo,produto,id_agrupamento,agrupamento,quantidade,total_faturado"),openDeliveries=await load("raffinato_delivery_aberto_cache","id_tele_entrega,id_venda,pedido,data,hora,id_status,status,valor,cancelado,finalizado,id_documento_fiscal"),paymentsByDoc=new Map<string,any[]>(),totalByDoc=new Map<string,number>();
      if(!docs.length)throw new Error("CACHE_MISS: periodo ainda nao sincronizado pelo conector.");
      for(const d of docs){const id=String(d.id_documento_fiscal),list=paymentsByDoc.get(id)||[];list.push(d);paymentsByDoc.set(id,list);totalByDoc.set(id,(totalByDoc.get(id)||0)+Number(d.valor_pagamento||0));}
      const rows:any[]=[],dimensions:any[]=[];for(const item of items){const id=String(item.id_documento_fiscal),payments=paymentsByDoc.get(id)||[];for(const payment of payments){const factor=Number(payment.valor_pagamento||0)/(totalByDoc.get(id)||1),row={data:item.data,hora:item.hora,id_documento_fiscal:item.id_documento_fiscal,modulo_venda:payment.modulo_venda||"VENDA_RAPIDA",codigo:item.codigo,produto:item.produto,id_agrupamento:item.id_agrupamento,agrupamento:item.agrupamento,quantidade_atribuida:Number(item.quantidade||0)*factor,preco_medio:Number(item.quantidade||0)?Number(item.total_faturado||0)/Number(item.quantidade):0,faturamento_produto:Number(item.total_faturado||0),id_forma_pagamento:payment.id_forma_pagamento,forma_pagamento:payment.forma_pagamento,valor_atribuido:Number(item.total_faturado||0)*factor};rows.push(row);dimensions.push({id_documento:id,codigo:item.codigo,id_agrupamento:item.id_agrupamento,id_forma_pagamento:payment.id_forma_pagamento,modulo_venda:row.modulo_venda});}}
      const financial=[...totalByDoc.values()].reduce((s,x)=>s+x,0),contingencyDocs=new Set(docs.filter(x=>x.eh_contingencia).map(x=>String(x.id_documento_fiscal))),contingency=[...contingencyDocs].reduce((s,id)=>s+(totalByDoc.get(id)||0),0),identified=items.reduce((s,x)=>s+Number(x.total_faturado||0),0),adjustments=Math.round((financial-identified-contingency)*100)/100,moduleMap=new Map<string,any>();
      for(const [id,total] of totalByDoc){const module=String((paymentsByDoc.get(id)||[])[0]?.modulo_venda||"VENDA_RAPIDA"),x=moduleMap.get(module)||{modulo_venda:module,valor:0,ids:new Set<string>()};x.valor+=total;x.ids.add(id);moduleMap.set(module,x);}
      const canonicalTotals={faturamento:financial,produtos_identificados:identified,contingencia:contingency,ajustes_pedido:adjustments,total_reconciliado:identified+contingency+adjustments,diferenca_conciliacao:Math.round((financial-identified-contingency-adjustments)*100)/100,documentos_financeiro:totalByDoc.size,documentos_produtos:new Set(items.map(x=>String(x.id_documento_fiscal))).size,documentos_contingencia:contingencyDocs.size};
      const validOpenDeliveries=openDeliveries.filter(x=>!x.cancelado&&!x.finalizado&&!x.id_documento_fiscal),openDeliveryTotal=validOpenDeliveries.reduce((s,x)=>s+Number(x.valor||0),0);
      return json({schema_version:3,items:rows,documentos_dimensao:dimensions,contingencias:docs.filter(x=>x.eh_contingencia),operacoes_abertas:validOpenDeliveries.length?[{modulo_venda:"DELIVERY",quantidade:validOpenDeliveries.length,valor:openDeliveryTotal}]:[],modulos_faturados:[...moduleMap.values()].map(x=>({modulo_venda:x.modulo_venda,valor:x.valor,quantidade:x.ids.size})),totalizadores_canonicos:canonicalTotals,totais_operacionais:{recebido:financial,em_aberto:openDeliveryTotal,previsto:financial+openDeliveryTotal},cache_version:3,duplicidades:0,cobertura:{completa:true},origem_consulta:"base_canonica_remota"});
    }

    if (body.action === "products_canonical_dashboard") {
      validateUuid(body.empresa_id,"empresa");validateUuid(body.loja_id,"loja");
      await authorizeStore(admin,body.usuario_id,body.empresa_id,body.loja_id,body.global_admin_token);
      const start=String(body.inicio||"").slice(0,19),end=String(body.fim_exclusivo||"").slice(0,19);
      if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(end)||end<=start)throw new Error("Periodo invalido.");
      const startDate=start.slice(0,10),endDate=end.slice(0,10),payment=body.id_forma_pagamento?Number(body.id_forma_pagamento):null;
      const load=async(table:string,fields:string)=>{const rows:any[]=[];for(let offset=0;offset<100000;offset+=1000){const {data,error}=await admin.from(table).select(fields).eq("empresa_id",body.empresa_id).eq("loja_id",body.loja_id).gte("data",startDate).lte("data",endDate).order("data").range(offset,offset+999);if(error)throw error;rows.push(...(data||[]));if(!data||data.length<1000)break;}return rows.filter((x:any)=>{const dt=`${x.data}T${String(x.hora||"00:00:00").slice(0,8)}`;return dt>=start&&dt<end;});};
      const docs=await load("raffinato_documentos_faturados_cache","id_documento_fiscal,data,hora,tipo,eh_contingencia,id_forma_pagamento,forma_pagamento,valor_pagamento");
      if(!docs.length)throw new Error("CACHE_MISS: periodo ainda nao sincronizado pelo conector.");
      const allByDoc=new Map<string,number>();for(const d of docs)allByDoc.set(String(d.id_documento_fiscal),(allByDoc.get(String(d.id_documento_fiscal))||0)+Number(d.valor_pagamento||0));
      const selectedDocs=payment?docs.filter(x=>Number(x.id_forma_pagamento)===payment):docs;
      const selectedByDoc=new Map<string,number>();for(const d of selectedDocs)selectedByDoc.set(String(d.id_documento_fiscal),(selectedByDoc.get(String(d.id_documento_fiscal))||0)+Number(d.valor_pagamento||0));
      const ids=new Set(selectedDocs.map(x=>String(x.id_documento_fiscal))),product=String(body.produto||"").trim().toLocaleLowerCase(),group=body.id_agrupamento?Number(body.id_agrupamento):null;
      let sourceItems=(await load("raffinato_itens_faturados_cache","id_documento_fiscal,data,hora,codigo,produto,id_agrupamento,agrupamento,quantidade,total_faturado")).filter(x=>ids.has(String(x.id_documento_fiscal)));
      if(group)sourceItems=sourceItems.filter(x=>Number(x.id_agrupamento)===group);if(product)sourceItems=sourceItems.filter(x=>/^\d+$/.test(product)?Number(x.codigo)===Number(product):String(x.produto||"").toLocaleLowerCase().includes(product));
      const products=new Map<string,any>(),days=new Map<string,any>();
      for(const x of sourceItems){const id=String(x.id_documento_fiscal),factor=payment?(selectedByDoc.get(id)||0)/(allByDoc.get(id)||1):1,key=String(x.codigo),row=products.get(key)||{codigo:x.codigo,produto:x.produto,id_agrupamento:x.id_agrupamento,agrupamento:x.agrupamento,quantidade:0,total_faturado:0};row.quantidade+=Number(x.quantidade||0)*factor;row.total_faturado+=Number(x.total_faturado||0)*factor;products.set(key,row);const day=days.get(x.data)||{data:x.data,total_faturado:0,quantidade:0};day.total_faturado+=Number(x.total_faturado||0)*factor;day.quantidade+=Number(x.quantidade||0)*factor;days.set(x.data,day);}
      const resultItems=[...products.values()].map(x=>({...x,preco_medio:x.quantidade?x.total_faturado/x.quantidade:0})).sort((a,b)=>b.total_faturado-a.total_faturado),identified=resultItems.reduce((s,x)=>s+x.total_faturado,0);
      const contingencyDocs=new Set(selectedDocs.filter(x=>x.eh_contingencia).map(x=>String(x.id_documento_fiscal))),contingencies=selectedDocs.filter(x=>x.eh_contingencia).map(x=>({...x,valor:Number(x.valor_pagamento||0)})),contingency=[...contingencyDocs].reduce((s,id)=>s+(selectedByDoc.get(id)||0),0),financial=[...selectedByDoc.values()].reduce((s,x)=>s+x,0),unexplained=[...ids].filter(id=>!contingencyDocs.has(id)&&!sourceItems.some(x=>String(x.id_documento_fiscal)===id));
      const adjustments=Math.round((financial-identified-contingency)*100)/100;
      return json({schema_version:3,items:resultItems,evolucao:[...days.values()].sort((a,b)=>String(a.data).localeCompare(String(b.data))),contingencias:contingencies,totalizadores:{faturamento:financial,produtos_identificados:identified,contingencia:contingency,ajustes_pedido:adjustments,total_reconciliado:identified+contingency+adjustments,diferenca_conciliacao:Math.round((financial-identified-contingency-adjustments)*100)/100,quantidade:resultItems.reduce((s,x)=>s+x.quantidade,0),produtos:resultItems.length,documentos_financeiro:ids.size,documentos_produtos:new Set(sourceItems.map(x=>String(x.id_documento_fiscal))).size,documentos_contingencia:contingencyDocs.size,diferenca_nao_explicada:unexplained.reduce((s,id)=>s+(selectedByDoc.get(id)||0),0)},origem_consulta:"base_canonica"});
    }

    if (body.action === "products_dashboard") {
      validateUuid(body.empresa_id,"empresa"); validateUuid(body.loja_id,"loja");
      await authorizeStore(admin,body.usuario_id,body.empresa_id,body.loja_id,body.global_admin_token);
      const inicio=validateDate(body.inicio,"inicio"),fimExclusivo=validateDate(body.fim_exclusivo,"fim");
      const product=String(body.produto||"").trim().slice(0,120);
      const group=body.id_agrupamento?Number(body.id_agrupamento):null;
      const data:any[]=[];
      for(let offset=0;offset<50000;offset+=1000){
        let query=admin.from("raffinato_produtos_cache").select("data,codigo,produto,id_agrupamento,agrupamento,quantidade,total_faturado")
          .eq("empresa_id",body.empresa_id).eq("loja_id",body.loja_id).gte("data",inicio).lt("data",fimExclusivo)
          .order("data").order("codigo").range(offset,offset+999);
        if(group)query=query.eq("id_agrupamento",group);
        if(product)query=/^\d+$/.test(product)?query.eq("codigo",Number(product)):query.ilike("produto",`%${product.replace(/[%_,]/g,"")}%`);
        const {data:page,error}=await query;if(error)throw error;
        data.push(...(page||[]));if(!page||page.length<1000)break;
      }
      const products=new Map<string,any>(),days=new Map<string,any>();
      for(const row of data||[]){
        const key=String(row.codigo),item=products.get(key)||{codigo:row.codigo,produto:row.produto,id_agrupamento:row.id_agrupamento,agrupamento:row.agrupamento,quantidade:0,total_faturado:0};
        item.quantidade+=Number(row.quantidade||0);item.total_faturado+=Number(row.total_faturado||0);products.set(key,item);
        const day=days.get(row.data)||{data:row.data,total_faturado:0,quantidade:0};day.total_faturado+=Number(row.total_faturado||0);day.quantidade+=Number(row.quantidade||0);days.set(row.data,day);
      }
      const items=[...products.values()].map(item=>({...item,preco_medio:item.quantidade?item.total_faturado/item.quantidade:0})).sort((a,b)=>b.total_faturado-a.total_faturado);
      return json({items,evolucao:[...days.values()].sort((a,b)=>String(a.data).localeCompare(String(b.data))),totalizadores:{faturamento:items.reduce((s,x)=>s+x.total_faturado,0),quantidade:items.reduce((s,x)=>s+x.quantidade,0),produtos:items.length},origem_consulta:"sincronizacao"});
    }

    if (body.action === "products_metadata" || body.action === "metadata_dashboard") {
      validateUuid(body.empresa_id,"empresa");validateUuid(body.loja_id,"loja");
      await authorizeStore(admin,body.usuario_id,body.empresa_id,body.loja_id,body.global_admin_token);
      const filial=Number(body.id_filial||1),load=async(table:string,fields:string)=>{const rows:any[]=[];for(let offset=0;offset<100000;offset+=1000){const {data,error}=await admin.from(table).select(fields).eq("empresa_id",body.empresa_id).eq("loja_id",body.loja_id).eq("id_filial",filial).range(offset,offset+999);if(error)throw error;rows.push(...(data||[]));if(!data||data.length<1000)break;}return rows;};
      const groups=await load("raffinato_agrupamentos_cache","id_agrupamento,nome,sincronizado_em"),products=await load("raffinato_produtos_catalogo_cache","id_produto,nome,id_agrupamento,agrupamento,sincronizado_em"),payments=await load("raffinato_formas_pagamento_catalogo_cache","id_forma_pagamento,nome,sincronizado_em");
      const stamp=[...groups,...products,...payments].map(x=>x.sincronizado_em).sort().pop()||null;
      return json({agrupamentos:groups.map(x=>({id:x.id_agrupamento,nome:x.nome})).sort((a,b)=>String(a.nome).localeCompare(String(b.nome),"pt-BR")),produtos:products.map(x=>({id:x.id_produto,nome:x.nome,id_agrupamento:x.id_agrupamento,agrupamento:x.agrupamento})).sort((a,b)=>String(a.nome).localeCompare(String(b.nome),"pt-BR")),formas_pagamento:payments.map(x=>({id:x.id_forma_pagamento,nome:x.nome})).sort((a,b)=>String(a.nome).localeCompare(String(b.nome),"pt-BR")),sincronizado_em:stamp});
    }

    if (body.action === "billing_dashboard") {
      validateUuid(body.empresa_id, "empresa"); validateUuid(body.loja_id, "loja");
      await authorizeStore(admin, body.usuario_id, body.empresa_id, body.loja_id, body.global_admin_token);
      const inicio = validateDate(body.inicio, "inicio"); const fimExclusivo = validateDate(body.fim_exclusivo, "fim");
      const payment = body.id_forma_pagamento ? Number(body.id_forma_pagamento) : null;
      let query = admin.from("raffinato_faturamento_cache").select("*")
        .eq("empresa_id", body.empresa_id).eq("loja_id", body.loja_id).gte("data", inicio).lt("data", fimExclusivo).order("data").limit(10000);
      if (payment) query = query.eq("id_forma_pagamento", payment);
      const { data, error } = await query; if (error) throw error;
      const startDateTime=String(body.inicio||"").slice(0,19),endDateTime=String(body.fim_exclusivo||"").slice(0,19),exactRows:any[]=[];
      for(let offset=0;offset<100000;offset+=1000){let exactQuery=admin.from("raffinato_documentos_faturados_cache").select("data,hora,id_documento_fiscal,id_forma_pagamento,forma_pagamento,valor_pagamento").eq("empresa_id",body.empresa_id).eq("loja_id",body.loja_id).gte("data",inicio).lte("data",fimExclusivo).order("data").range(offset,offset+999);if(payment)exactQuery=exactQuery.eq("id_forma_pagamento",payment);const {data:page,error:pageError}=await exactQuery;if(pageError)throw pageError;exactRows.push(...(page||[]));if(!page||page.length<1000)break;}
      const exact=exactRows.filter(x=>{const dt=`${x.data}T${String(x.hora||"00:00:00").slice(0,8)}`;return dt>=startDateTime&&dt<endDateTime;}),exactMap=new Map<string,any>();
      for(const row of exact){const key=`${row.data}|${row.id_forma_pagamento}`,item=exactMap.get(key)||{data:row.data,id_forma_pagamento:row.id_forma_pagamento,forma_pagamento:row.forma_pagamento,valor_movimento:0,documentos:new Set<string>(),primeiro_documento:null,ultimo_documento:null},dt=`${row.data}T${String(row.hora).slice(0,8)}`;item.valor_movimento+=Number(row.valor_pagamento||0);item.documentos.add(String(row.id_documento_fiscal));item.primeiro_documento=!item.primeiro_documento||dt<item.primeiro_documento?dt:item.primeiro_documento;item.ultimo_documento=!item.ultimo_documento||dt>item.ultimo_documento?dt:item.ultimo_documento;exactMap.set(key,item);}
      const keys = ["valor_movimento","valor_abertura","valor_suprimento","valor_sangria","valor_retirada","valor_apurado","valor_confirmado"];
      const forms = new Map<string, any>(); const evolution:any[] = [];
      let openCash=false, hasClosed=false;
      for (const row of data || []) {
        const id=String(row.id_forma_pagamento), item=forms.get(id)||{id_forma_pagamento:row.id_forma_pagamento,forma_pagamento:row.forma_pagamento};
        for (const key of keys) item[key]=Number(item[key]||0)+Number(key==="valor_movimento"?(exactMap.get(`${row.data}|${row.id_forma_pagamento}`)?.valor_movimento||0):(row[key]||0));
        item.caixa_aberto=Boolean(item.caixa_aberto)||Boolean(row.caixa_aberto);
        item.valor_confirmado_disponivel=Boolean(item.valor_confirmado_disponivel)||Boolean(row.valor_confirmado_disponivel);
        openCash=openCash||Boolean(row.caixa_aberto);hasClosed=hasClosed||Boolean(row.valor_confirmado_disponivel);
        forms.set(id,item); evolution.push({data:row.data,id_forma_pagamento:row.id_forma_pagamento,forma_pagamento:row.forma_pagamento,valor_movimento:Number(exactMap.get(`${row.data}|${row.id_forma_pagamento}`)?.valor_movimento||0)});
      }
      const formas_pagamento=[...forms.values()]; const totalizadores:any={};
      for (const key of keys) totalizadores[key]=formas_pagamento.reduce((sum,item)=>sum+Number(item[key]||0),0);
      if(openCash&&!hasClosed)totalizadores.valor_confirmado=null;
      const documentIds=new Set(exact.map(x=>String(x.id_documento_fiscal))),instants=exact.map(x=>`${x.data}T${String(x.hora).slice(0,8)}`).sort();
      return json({ formas_pagamento,totalizadores,evolucao:evolution,caixa_aberto:openCash,
        valor_confirmado_parcial:openCash&&hasClosed,origem_consulta:"base_canonica",
        periodo:{inicio:startDateTime,fim_exclusivo:endDateTime,quantidade_documentos:documentIds.size,primeiro_documento:instants[0]||null,ultimo_documento:instants.at(-1)||null} });
    }

    if (body.action === "billing_forms") {
      validateUuid(body.empresa_id, "empresa"); validateUuid(body.loja_id, "loja");
      await authorizeStore(admin, body.usuario_id, body.empresa_id, body.loja_id, body.global_admin_token);
      const { data,error }=await admin.from("raffinato_faturamento_cache").select("id_forma_pagamento,forma_pagamento")
        .eq("empresa_id",body.empresa_id).eq("loja_id",body.loja_id).limit(1000);
      if(error)throw error;const unique=new Map<string,any>();
      for(const item of data||[])unique.set(String(item.id_forma_pagamento),{id:item.id_forma_pagamento,nome:item.forma_pagamento});
      return json({formas:[...unique.values()].sort((a,b)=>String(a.nome).localeCompare(String(b.nome)))});
    }

    if (body.action === "dashboard" || body.action === "status") {
      validateUuid(body.empresa_id, "empresa"); validateUuid(body.loja_id, "loja");
      await authorizeStore(admin, body.usuario_id, body.empresa_id, body.loja_id, body.global_admin_token);
      const { data: integration, error: integrationError } = await admin.from("raffinato_integracoes")
        .select("status,ultima_sincronizacao_em,ultimo_erro,conector_token_hash,connector_instance_id")
        .eq("empresa_id", body.empresa_id).eq("loja_id", body.loja_id).maybeSingle();
      if (integrationError) throw integrationError;
      if (body.action === "status") {
        let instance:any=null;
        if(integration?.connector_instance_id){const response=await admin.from("raffinato_connector_instances").select("id,status,ultimo_contato_em,versao").eq("id",integration.connector_instance_id).maybeSingle();if(response.error)throw response.error;instance=response.data;}
        return json({configurado:!!integration,pareado:!!integration?.conector_token_hash||!!instance,
          ultima_sincronizacao_em:integration?.ultima_sincronizacao_em||null,ultimo_erro:integration?.ultimo_erro||null,
          connector_instance_id:instance?.id||integration?.connector_instance_id||null,versao:instance?.versao||null,
          ultimo_contato_em:instance?.ultimo_contato_em||null,online:instance?instance.status!=="revogado"&&isRecent(instance.ultimo_contato_em):isRecent(integration?.ultima_sincronizacao_em)});
      }
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
    const message = error instanceof Error ? error.message : "Falha inesperada.";
    console.error(JSON.stringify({ request_id: requestId, message, stack: error instanceof Error ? error.stack : null }));
    return json({ error: message, request_id: requestId }, 400);
  }
});

async function authorizeStore(admin: any, userId: string, empresaId: string, lojaId: string, globalAdminToken = "") {
  validateUuid(userId, "usuario");
  const { data: loja } = await admin.from("lojas").select("id,empresa_id,ativo").eq("id", lojaId).eq("empresa_id", empresaId).maybeSingle();
  if (!loja || loja.ativo === false) throw new Error("Loja nao autorizada.");
  if (globalAdminToken) {
    const { data: globalAuthorized, error: globalError } = await admin.rpc("validar_sessao_admin_global", {
      p_funcionario_id:userId, p_token:String(globalAdminToken),
    });
    if (globalError) throw globalError;
    if (globalAuthorized === true) return;
  }
  const [{ data: employee }, { data: adminUser }, { data: link }] = await Promise.all([
    admin.from("funcionarios").select("id,empresa_id,loja_id").eq("id", userId).eq("empresa_id", empresaId).maybeSingle(),
    // O administrador pode trocar de loja/empresa pela própria interface. A
    // autorização externa deve respeitar essa mesma sessão administrativa;
    // exigir a empresa original do cadastro fazia todos os relatórios remotos
    // falharem depois da troca de loja, embora o conector local funcionasse.
    admin.from("usuarios_admin").select("id,empresa_id,ativo").eq("id", userId).eq("ativo", true).maybeSingle(),
    admin.from("funcionario_lojas").select("funcionario_id,loja_id,ativo").eq("funcionario_id", userId).eq("loja_id", lojaId).eq("ativo", true).maybeSingle(),
  ]);
  if (!adminUser && !link && String(employee?.loja_id || "") !== lojaId) {
    console.warn(JSON.stringify({event:"CONNECTOR_LINK_FORBIDDEN",user_id:userId,empresa_id:empresaId,loja_id:lojaId}));
    throw new Error("Usuario sem acesso a esta loja.");
  }
}
async function connectorForCredential(admin:any,instanceId:any,credential:string){
  validateUuid(instanceId,"instalacao");
  const {data,error}=await admin.from("raffinato_connector_instances").select("id,empresa_id,status").eq("id",instanceId).eq("credencial_hash",await sha256(credential)).maybeSingle();
  if(error||!data||data.status==="revogado")throw error||new Error("Credencial da instalacao invalida.");
  return data;
}
async function integrationForToken(admin: any, token: string, body:any={}) {
  if(body.connector_instance_id){
    const instance=await connectorForCredential(admin,body.connector_instance_id,token);
    validateUuid(body.loja_id,"loja");
    const {data,error}=await admin.from("raffinato_integracoes").select("id,empresa_id,loja_id").eq("connector_instance_id",instance.id).eq("empresa_id",instance.empresa_id).eq("loja_id",body.loja_id).maybeSingle();
    if(error||!data)throw error||new Error("Loja nao vinculada a esta instalacao.");
    return data;
  }
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
