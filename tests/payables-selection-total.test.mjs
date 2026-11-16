import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const script = readFileSync(new URL('../assets/js/41-finance-vault-calendar.js', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../assets/css/125-app-design-system.css', import.meta.url), 'utf8');

test('resumo das contas selecionadas exibe o valor total', () => {
  assert.match(html, /id="totalSelecaoContasAPagarFinanceiro"/);
  assert.match(script, /totalSelecionadoCentavos/);
  assert.match(script, /Math\.round\(valor \* 100\)/);
  assert.match(script, /Total selecionado: \$\{formatarMoedaBRFinanceiro\(totalSelecionadoCentavos \/ 100\)\}/);
});

test('filtros de contas a pagar ficam em uma linha e com a mesma altura no desktop', () => {
  assert.match(styles, /@media \(min-width: 1280px\)[\s\S]*?\.contas-pagar-filtros-unificados[\s\S]*?display: grid !important/);
  assert.match(styles, /grid-template-columns:[\s\S]*?minmax\(150px, 1fr\) !important/);
  assert.match(styles, /height: 38px !important;[\s\S]*?min-height: 38px !important;[\s\S]*?max-height: 38px !important/);
});
