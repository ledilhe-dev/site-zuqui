import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const js=fs.readFileSync(new URL('../assets/js/97-raffinato-daily-detail.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const relay=fs.readFileSync(new URL('../supabase/functions/raffinato-relay/index.ts',import.meta.url),'utf8');

test('relatorio somente consulta pelo botao Consultar',()=>{
  assert.match(js,/onclick="consultarRelatorioDetalhadoVendaDiariaRaffinato\(\)"/);
  const init=js.match(/async function iniciarRelatorioDetalhadoVendaDiariaRaffinato\(\)[\s\S]*?\n(?=async function rddLoadMetadata)/)?.[0]||'';
  assert.doesNotMatch(init,/consultarRelatorioDetalhadoVendaDiariaRaffinato/);
  assert.doesNotMatch(js,/onchange="consultarRelatorioDetalhadoVendaDiariaRaffinato/);
});

test('menu, permissao e backend estao ligados',()=>{
  assert.match(html,/data-page="relatorio_detalhado_venda_diaria_raffinato"/);
  assert.match(relay,/authorizeReportPermission\(admin,body\.usuario_id,body\.loja_id,"relatorio_detalhado_venda_diaria_raffinato"/);
  assert.match(relay,/body\.action === "detailed_daily_sales_report"/);
});
