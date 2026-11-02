import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const bridge=fs.readFileSync(new URL('../tools/raffinato-bridge/raffinato_bridge.py',import.meta.url),'utf8');
const manager=fs.readFileSync(new URL('../assets/js/93-raffinato-managerial.js',import.meta.url),'utf8');
const sales=fs.readFileSync(new URL('../assets/js/36-raffinato-sales-analysis.js',import.meta.url),'utf8');
const relay=fs.readFileSync(new URL('../supabase/functions/raffinato-relay/index.ts',import.meta.url),'utf8');

test('consulta Delivery usa exatamente o relacionamento validado e limita a filial pelo documento financeiro',()=>{
  const start=bridge.indexOf('def query_delivery_entry_times'),end=bridge.indexOf('def apply_delivery_entry_times',start),overlay=bridge.slice(start,end);
  assert.match(overlay,/T\.Id=VT\.IdTeleEntrega/);
  assert.match(overlay,/V\.Id=VCF\.IdVenda/);
  assert.match(overlay,/VT\.IdVenda=V\.Id/);
  assert.doesNotMatch(overlay,/VT\.IdFilial=V\.IdFilial/);
  assert.doesNotMatch(overlay,/T\.IdFilial=VT\.IdFilial/);
  assert.match(overlay,/D\.IdFilial=\?/);
  assert.match(overlay,/IntegracaoDeliveryOnline IDO/);
  assert.match(overlay,/UPPER\(CONVERT\(nvarchar\(255\),IDO\.IdIntegracaoDeliveryOnline\)\)/);
  assert.match(overlay,/UPPER\(CONVERT\(nvarchar\(255\),T\.IdIntegracaoDeliveryOnline\)\)/);
  assert.match(overlay,/CASE WHEN IDO\.IdIntegracaoDeliveryOnline IS NOT NULL THEN IDO\.DataGravacao ELSE T\.Data END/);
  assert.match(overlay,/LEFT JOIN dbo\.IntegracaoDeliveryOnline/);
  assert.match(overlay,/T\.IdIntegracaoDeliveryOnline IS NULL/);
  assert.doesNotMatch(overlay,/SELECT TOP 1 T\.Data,T\.Hora/);
});

test('sincronizacao e analise padrao preservam data e hora fiscais originais',()=>{
  const canonical=bridge.match(/SQL_BASE_CANONICA_SYNC = """([\s\S]*?)"""/)?.[1]||'';
  const analysis=bridge.match(/SQL_VENDAS_ANALISE = """([\s\S]*?)"""/)?.[1]||'';
  assert.match(canonical,/CONVERT\(date,D\.Data\) data/);
  assert.doesNotMatch(canonical,/CONVERT\(date,COALESCE\(TE\.Data,D\.Data\)\) data/);
  assert.match(canonical,/CAST\(D\.Hora AS time\)/);
  assert.doesNotMatch(canonical,/COALESCE\(TE\.(?:Data|Hora),D\.(?:Data|Hora)\)/);
  assert.match(canonical,/SUM\(CAST\(ISNULL\(F\.Valor,0\)-ISNULL\(F\.ValorTroco,0\) AS decimal\(19,4\)\)\) valor_pagamento/);
  assert.match(analysis,/AS Data,CONVERT\(varchar\(8\),CAST\(D\.Hora AS time\),108\) Hora/);
  assert.match(analysis,/SELECT I\.data,I\.hora,I\.id_documento_fiscal/);
});

test('vinculo delivery e deterministico e nao multiplica documentos',()=>{
  assert.match(bridge,/OUTER APPLY\(SELECT TOP 1[\s\S]*?FonteHorario[\s\S]*?ORDER BY CASE WHEN IDO\.IdIntegracaoDeliveryOnline IS NOT NULL THEN 0 ELSE 1 END/);
  assert.match(bridge,/CREATE UNIQUE CLUSTERED INDEX IX_IdsVendas ON #IdsVendas\(Id\)/);
});

test('curva ABC continua filtrando pela data original da venda',()=>{
  const abc=bridge.match(/SQL_CURVA_ABC = """([\s\S]*?)"""/)?.[1]||'';
  assert.match(abc,/WHERE V\.Data>=\? AND V\.Data<\?/);
  assert.doesNotMatch(abc,/COALESCE\(TE\.(?:Data|Hora),V\.(?:Data|Hora)\)/);
});

test('painel gerencial preserva a base temporal original',()=>{
  const definitions=[...bridge.matchAll(/SQL_VENDAS_GERENCIAL = """/g)];
  const active=bridge.slice(definitions.at(-1).index);
  assert.match(active,/DATEPART\(HOUR,CAST\(D\.Hora AS time\)\)/);
  assert.doesNotMatch(active,/COALESCE\(TE\.Hora,D\.Hora\)/);
});

test('horario Delivery e automatico e altera somente dimensao temporal',()=>{
  assert.doesNotMatch(bridge,/body\.get\("usar_horario_entrada_delivery"\)/);
  assert.match(bridge,/apply_delivery_time=body\.get\("_preservar_periodo_financeiro"\) is not True/);
  assert.match(bridge,/if str\(item\.get\("modulo_venda"\).*!= "DELIVERY"/s);
  assert.match(bridge,/item\["data"\]=temporal\["data"\]/);
  assert.match(bridge,/item\["hora"\]=temporal\["hora"\]/);
  assert.doesNotMatch(bridge,/item\["(?:valor_atribuido|quantidade_atribuida|faturamento_produto)"\]=temporal/);
  assert.match(bridge,/FECHAMENTO_FINANCEIRO_FALLBACK/);
  assert.doesNotMatch(sales,/type="checkbox"> Usar horário de entrada do pedido/);
  assert.doesNotMatch(sales,/usar_horario_entrada_delivery/);
  assert.match(sales,/raffinatoBridgePost\('\/api\/raffinato\/vendas-analise'/);
});

test('sincronizacao principal preserva periodo financeiro original',()=>{
  assert.match(bridge,/body = \{"inicio":start\.isoformat\(\),"fim_exclusivo":end\.isoformat\(\),"id_filial":filial,"_preservar_periodo_financeiro":True\}/);
  assert.match(bridge,/body=\{"inicio":datetime\.combine\(start_day[\s\S]*?"_preservar_periodo_financeiro":True\}/);
});

test('cache remoto recebe horario Delivery sem alterar valores ou pagamentos',()=>{
  assert.match(bridge,/delivery_times=query_delivery_entry_times\(config,start\.date\(\),end\.date\(\)\+timedelta\(days=1\),filial\)/);
  assert.match(bridge,/apply_delivery_times_to_canonical_sync\(documents,items,delivery_times\)/);
  const syncOverlay=bridge.slice(bridge.indexOf('def apply_delivery_times_to_canonical_sync'),bridge.indexOf('def filter_items_by_effective_period'));
  assert.match(syncOverlay,/document\["data"\]=temporal\["data"\]/);
  assert.match(syncOverlay,/item\["hora"\]=temporal\["hora"\]/);
  assert.doesNotMatch(syncOverlay,/\["(?:valor_pagamento|total_faturado|id_forma_pagamento|forma_pagamento)"\]=/);
});

test('BI usa horario local quando disponivel e restaura cache remoto como contingencia',()=>{
  assert.doesNotMatch(manager,/remoteOnly=path==='\/api\/raffinato\/vendas-analise'/);
  assert.match(manager,/Number\(local\?\.schema_version\|\|0\)<4/);
  assert.match(manager,/Conector local indisponível\. Exibindo os dados sincronizados/);
  assert.match(sales,/sales_canonical_dashboard/);
  assert.doesNotMatch(manager,/operational_time_source!=='TELEENTREGA_DELIVERY_V1'/);
  assert.match(bridge,/ORIGINAL_DOCUMENTO_FISCAL/);
  assert.match(manager,/temporal_warning/);
  assert.match(manager,/cache remoto em sincronização/);
  assert.match(relay,/schema_version:2,operational_time_source:"LEGACY_CACHE_UNVERIFIED"/);
});

test('versao nova invalida cache contaminado e filtra Delivery antes de agregar',()=>{
  assert.match(bridge,/CONNECTOR_VERSION = "2\.0\.34"/);
  assert.match(bridge,/CACHE_SCHEMA_VERSION = 5/);
  assert.match(bridge,/if origins:[\s\S]*?modulo_venda/);
  assert.match(bridge,/analysis\["items"\]=items/);
});

test('reprocessamento remoto e limitado a loja vinculada e no maximo sete dias',()=>{
  assert.match(bridge,/"\/api\/raffinato\/reprocessar-periodo"/);
  assert.match(bridge,/validate_request_tenant\(body, store_id\)/);
  assert.match(bridge,/\(end\.date\(\)-start\.date\(\)\)\.days>7/);
  assert.match(bridge,/sync_period\(\{\*\*config,"_store_id":store_id\},start,end-timedelta\(seconds=1\)\)/);
});

test('exe encerra qualquer versao antiga sem console e cardapio consulta continuamente',()=>{
  assert.match(bridge,/Name -like 'Conector-Raffinato-v\*\.exe'/);
  assert.match(bridge,/"-WindowStyle","Hidden"/);
  const dispatcher=bridge.slice(bridge.indexOf('def start_cardapio_dispatcher'),bridge.indexOf('def ensure_browser_loopback_policy'));
  assert.doesNotMatch(dispatcher,/time\.monotonic\(\) >= CARDAPIO_ACTIVE_UNTIL/);
  assert.match(dispatcher,/module\.dispatch_order\(dispatcher_config\)/);
});
