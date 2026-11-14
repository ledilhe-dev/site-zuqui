import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const reportSource = readFileSync(new URL('../assets/js/60-timeclock.js', import.meta.url), 'utf8');
const responsiveCss = readFileSync(new URL('../assets/css/101-financial-pages-responsive.css', import.meta.url), 'utf8');

test('relatorio de recebimentos consulta e exibe a data prevista original', () => {
  assert.match(reportSource, /data_prevista_original/);
  assert.match(reportSource, /item\.data_prevista_original \|\| item\.data_prevista/);
  assert.match(reportSource, /prevista:item\.data_prevista_original/);
});

test('detalhes dos recebimentos viram cartoes legiveis no celular', () => {
  assert.match(reportSource, /data-label="Data\/hora"/);
  assert.match(reportSource, /data-label="Valor" class="rr-valor"/);
  assert.match(responsiveCss, /#tabelaRelatorioRecebimentos thead\{display:none\}/);
  assert.match(responsiveCss, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(responsiveCss, /\.rr-valor\{color:var\(--accent\);font-size:16px;font-weight:800\}/);
});
