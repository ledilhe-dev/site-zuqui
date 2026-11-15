import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const reportSource = readFileSync(new URL('../assets/js/60-timeclock.js', import.meta.url), 'utf8');
const financeSource = readFileSync(new URL('../assets/js/30-finance.js', import.meta.url), 'utf8');
const responsiveCss = readFileSync(new URL('../assets/css/101-financial-pages-responsive.css', import.meta.url), 'utf8');
const designCss = readFileSync(new URL('../assets/css/125-app-design-system.css', import.meta.url), 'utf8');

test('relatorio de recebimentos consulta e exibe a data prevista original', () => {
  assert.match(reportSource, /data_prevista_original/);
  assert.match(reportSource, /item\.data_prevista_original \|\| item\.data_prevista/);
  assert.match(reportSource, /prevista:item\.data_prevista_original/);
});

test('observacao e preservada na confirmacao e exibida em coluna propria', () => {
  assert.match(financeSource, /observacao: item\.observacao \|\| null/);
  assert.match(reportSource, /\.select\('id, observacao, data_prevista'\)/);
  assert.match(reportSource, /data-label="Observa[^\"]+" class="rr-observacao"/);
});

test('filtros e detalhes usam densidade compacta no desktop', () => {
  assert.match(designCss, /@media \(min-width: 701px\)/);
  assert.match(designCss, /grid-template-columns: repeat\(8, minmax\(0, 1fr\)\)/);
  assert.match(designCss, /height: 30px !important/);
  assert.match(designCss, /table-layout: fixed !important/);
  assert.match(designCss, /font-size: 9px !important/);
});

test('detalhes dos recebimentos viram cartoes legiveis no celular', () => {
  assert.match(reportSource, /data-label="Data\/hora"/);
  assert.match(reportSource, /data-label="Valor" class="rr-valor"/);
  assert.match(responsiveCss, /#tabelaRelatorioRecebimentos thead\{display:none\}/);
  assert.match(responsiveCss, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(responsiveCss, /\.rr-valor\{color:var\(--accent\);font-size:13px;font-weight:800\}/);
});
