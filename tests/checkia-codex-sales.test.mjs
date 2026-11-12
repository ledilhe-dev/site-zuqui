import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const frontend=fs.readFileSync(new URL('../assets/js/94-checkia.js',import.meta.url),'utf8');
const edge=fs.readFileSync(new URL('../supabase/functions/checkia-codex/index.ts',import.meta.url),'utf8');
const bridge=fs.readFileSync(new URL('../tools/codex-reader/reader_bridge.py',import.meta.url),'utf8');
const schema=JSON.parse(fs.readFileSync(new URL('../tools/codex-reader/checkia_schema.json',import.meta.url),'utf8'));

test('CheckIA interpreta perguntas pela ponte protegida do Codex',()=>{
  assert.match(frontend,/sb\.functions\.invoke\("checkia-codex"/);
  assert.doesNotMatch(frontend,/CODEX_READER_SECRET|OPENAI_API_KEY|api\.openai\.com/);
  assert.match(edge,/X-Codex-Reader-Secret/);
  assert.match(edge,/validar_contexto_operacional_relay/);
  assert.match(bridge,/task"\) == "checkia_intent"/);
});

test('Codex devolve somente periodo e modulos, nunca valores',()=>{
  assert.equal(schema.additionalProperties,false);
  assert.deepEqual(schema.properties.origins.items.enum,['VENDA_RAPIDA','DELIVERY','CARTAO_MESA']);
  assert.equal('value' in schema.properties,false);
  assert.match(bridge,/Nunca calcule nem invente valor financeiro/);
});

test('faturamento vem do relay Raffinato com intervalo inclusivo e filtro de origem',()=>{
  assert.match(frontend,/rmRelayBody\("sales_bi_dashboard", body\)/);
  assert.match(frontend,/fim_exclusivo: `\$\{nextDayIso\(intent\.end_date\)\}T00:00:00`/);
  assert.match(frontend,/origens: intent\.origins \|\| \[\]/);
  assert.match(frontend,/totals\.faturamento/);
});

test('inicio do ano e delivery possuem regras explicitas de interpretacao',()=>{
  assert.match(bridge,/01\/01 do ano atual ate hoje/);
  assert.match(bridge,/apenas delivery, use origins \[DELIVERY\]/);
});
