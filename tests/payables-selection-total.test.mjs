import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const script = readFileSync(new URL('../assets/js/41-finance-vault-calendar.js', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../assets/css/125-app-design-system.css', import.meta.url), 'utf8');
const serviceWorker = readFileSync(new URL('../service-worker-v4.js', import.meta.url), 'utf8');
const executions = readFileSync(new URL('../assets/js/71-executions.js', import.meta.url), 'utf8');

test('resumo das contas selecionadas exibe o valor total', () => {
  assert.match(html, /id="totalSelecaoContasAPagarFinanceiro"/);
  assert.match(html, /Total selecionado: R\$ 0,00/);
  assert.match(script, /totalSelecionadoCentavos/);
  assert.match(script, /Math\.round\(valor \* 100\)/);
  assert.match(script, /Total selecionado: \$\{formatarMoedaBRFinanceiro\(totalSelecionadoCentavos \/ 100\)\}/);
});

test('agrupamentos permitem selecionar e somar todas as parcelas', () => {
  assert.match(script, /function atualizarSelecaoGrupoContasAPagarFinanceiro/);
  assert.match(script, /checkbox-grupo-contas-apagar-financeiro/);
  assert.match(script, /input\.indeterminate = selecionadas > 0 && selecionadas < ids\.length/);
});

test('agrupamento usa fornecedor e vencimento com ordem alfabetica', () => {
  assert.match(script, /const chave = `\$\{fornecedor\}\|\$\{vencimento\}\|\$\{loja\}`/);
  assert.match(script, /fornecedorA\.localeCompare\(fornecedorB, 'pt-BR'/);
  assert.doesNotMatch(script, /const gid = String\(item\.grupo_parcelas_id/);
});

test('agrupamento soma fornecedores iguais e separa vencimentos diferentes', () => {
  const context = {
    console,
    textoFinanceiroNormalizado: valor => String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(),
  };
  vm.createContext(context);
  vm.runInContext(script, context);
  const grupos = context.agruparContasAPagarPorFornecedorEVencimento([
    { id: '1', loja_id: 'L1', data_vencimento: '2026-11-17', valor_compra: 10, fornecedores: { nome: 'Zeta' } },
    { id: '2', loja_id: 'L1', data_vencimento: '2026-11-17', valor_compra: 20, fornecedores: { nome: 'Ábaco' } },
    { id: '3', loja_id: 'L1', data_vencimento: '2026-11-17', valor_compra: 30, fornecedores: { nome: 'Abaco' } },
    { id: '4', loja_id: 'L1', data_vencimento: '2026-11-18', valor_compra: 40, fornecedores: { nome: 'Ábaco' } },
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(grupos.map(grupo => grupo.map(item => item.id)))), [['2', '3'], ['4'], ['1']]);
  assert.equal(grupos[0].reduce((soma, item) => soma + item.valor_compra, 0), 50);
});

test('filtros de contas a pagar ficam em uma linha e com a mesma altura no desktop', () => {
  assert.match(styles, /@media \(min-width: 1280px\)[\s\S]*?\.contas-pagar-filtros-unificados[\s\S]*?display: grid !important/);
  assert.match(styles, /grid-template-columns:[\s\S]*?minmax\(150px, 1fr\) !important/);
  assert.match(styles, /grid-template-rows: 14px 36px !important/);
  assert.match(styles, /height: 36px !important;[\s\S]*?min-height: 36px !important;[\s\S]*?max-height: 36px !important/);
});

test('publicacao invalida o cache PWA para entregar a correcao', () => {
  assert.match(serviceWorker, /check-diario-pwa-v319-agrupamento-fornecedor-2026-11-16/);
  assert.match(executions, /service-worker-v4\.js\?v=20261116-v319-agrupamento-fornecedor/);
  assert.match(html, /71-executions\.js\?v=20261116-v319-atualizacao-pwa/);
});
