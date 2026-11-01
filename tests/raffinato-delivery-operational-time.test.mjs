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

test('BI consulta primeiro o conector e rejeita cache remoto temporal antigo',()=>{
  assert.doesNotMatch(manager,/remoteOnly=path==='\/api\/raffinato\/vendas-analise'/);
  assert.match(manager,/Number\(remote\?\.schema_version\|\|0\)<4/);
  assert.match(manager,/TELEENTREGA_DELIVERY_V1/);
  assert.match(relay,/schema_version:4,operational_time_source:"TELEENTREGA_DELIVERY_V1"/);
});

test('versao nova invalida cache local anterior e filtra Delivery antes de agregar',()=>{
  assert.match(bridge,/CONNECTOR_VERSION = "2\.0\.26"/);
  assert.match(bridge,/CACHE_SCHEMA_VERSION = 4/);
  assert.match(bridge,/if origins:[\s\S]*?modulo_venda/);
  assert.match(bridge,/analysis\["items"\]=items/);
});
