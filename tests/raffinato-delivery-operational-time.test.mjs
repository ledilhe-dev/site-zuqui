import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const bridge=fs.readFileSync(new URL('../tools/raffinato-bridge/raffinato_bridge.py',import.meta.url),'utf8');
const manager=fs.readFileSync(new URL('../assets/js/93-raffinato-managerial.js',import.meta.url),'utf8');
const relay=fs.readFileSync(new URL('../supabase/functions/raffinato-relay/index.ts',import.meta.url),'utf8');

test('delivery usa data e hora da TeleEntrega com vinculo pela filial',()=>{
  assert.match(bridge,/T\.Id=VT\.IdTeleEntrega AND T\.IdFilial=VT\.IdFilial/);
  assert.match(bridge,/VT\.IdVenda=V\.Id AND VT\.IdFilial=V\.IdFilial/);
  assert.match(bridge,/COALESCE\(TE\.Data,V\.Data\)/);
  assert.match(bridge,/COALESCE\(TE\.Hora,V\.Hora\)/);
});

test('sincronizacao preserva a data fiscal e altera somente a hora do delivery',()=>{
  const canonical=bridge.match(/SQL_BASE_CANONICA_SYNC = """([\s\S]*?)"""/)?.[1]||'';
  const analysis=bridge.match(/SQL_VENDAS_ANALISE = """([\s\S]*?)"""/)?.[1]||'';
  assert.match(canonical,/CONVERT\(date,D\.Data\) data/);
  assert.doesNotMatch(canonical,/CONVERT\(date,COALESCE\(TE\.Data,D\.Data\)\) data/);
  assert.match(canonical,/CAST\(COALESCE\(TE\.Hora,D\.Hora\) AS time\)/);
  assert.match(canonical,/T\.Id=VT\.IdTeleEntrega AND T\.IdFilial=VT\.IdFilial/);
  assert.match(canonical,/CASE WHEN TE\.IdTeleEntrega IS NOT NULL THEN 'DELIVERY'/);
  assert.match(canonical,/SUM\(CAST\(ISNULL\(F\.Valor,0\)-ISNULL\(F\.ValorTroco,0\) AS decimal\(19,4\)\)\) valor_pagamento/);
  assert.match(analysis,/AS Data,CONVERT\(varchar\(8\),CAST\(COALESCE\(TE\.Hora,D\.Hora\) AS time\),108\) Hora/);
  assert.match(analysis,/SELECT I\.data,I\.hora,I\.id_documento_fiscal/);
});

test('vinculo delivery e deterministico e nao multiplica documentos',()=>{
  assert.match(bridge,/OUTER APPLY\(SELECT TOP 1[\s\S]*?ORDER BY VT\.Id\) TE/);
  assert.match(bridge,/CREATE UNIQUE CLUSTERED INDEX IX_IdsVendas ON #IdsVendas\(Id\)/);
});

test('curva ABC e item obrigatorio filtram pela data operacional',()=>{
  const abc=bridge.match(/SQL_CURVA_ABC = """([\s\S]*?)"""/)?.[1]||'';
  const mandatory=bridge.match(/SQL_MANDATORY_V2 = """([\s\S]*?)"""/)?.[1]||'';
  assert.match(abc,/CONVERT\(date,COALESCE\(TE\.Data,V\.Data\)\)>=\?/);
  assert.match(mandatory,/CONVERT\(date,COALESCE\(TE\.Data,VI\.Data\)\)>=\?/);
});

test('painel gerencial agrega uma unica base temporal compartilhada',()=>{
  const definitions=[...bridge.matchAll(/SQL_VENDAS_GERENCIAL = """/g)];
  const active=bridge.slice(definitions.at(-1).index);
  assert.match(active,/INTO #Gerencial/);
  assert.match(active,/DATEPART\(HOUR,CAST\(COALESCE\(TE\.Hora,D\.Hora\) AS time\)\)/);
  assert.match(active,/GROUP BY D\.Id/);
});

test('BI prioriza o conector e mantém relatórios disponíveis durante reconstrução do cache remoto',()=>{
  assert.doesNotMatch(manager,/remoteOnly=path==='\/api\/raffinato\/vendas-analise'/);
  assert.match(manager,/Number\(remote\?\.schema_version\|\|0\)<4/);
  assert.match(manager,/Number\(local\?\.schema_version\|\|0\)<4/);
  assert.match(manager,/local\?\.operational_time_source!=='TELEENTREGA_DELIVERY_V1'/);
  assert.match(manager,/TELEENTREGA_DELIVERY_V1/);
  assert.match(manager,/temporal_warning/);
  assert.match(manager,/cache remoto em sincronização/);
  assert.match(relay,/schema_version:2,operational_time_source:"LEGACY_CACHE_UNVERIFIED"/);
});

test('versao nova invalida cache local anterior e filtra Delivery antes de agregar',()=>{
  assert.match(bridge,/CONNECTOR_VERSION = "2\.0\.28"/);
  assert.match(bridge,/CACHE_SCHEMA_VERSION = 4/);
  assert.match(bridge,/if origins:[\s\S]*?modulo_venda/);
  assert.match(bridge,/analysis\["items"\]=items/);
});

test('reprocessamento remoto e limitado a loja vinculada e no maximo sete dias',()=>{
  assert.match(bridge,/"\/api\/raffinato\/reprocessar-periodo"/);
  assert.match(bridge,/validate_request_tenant\(body, store_id\)/);
  assert.match(bridge,/\(end\.date\(\)-start\.date\(\)\)\.days>7/);
  assert.match(bridge,/sync_period\(\{\*\*config,"_store_id":store_id\},start,end-timedelta\(seconds=1\)\)/);
});
