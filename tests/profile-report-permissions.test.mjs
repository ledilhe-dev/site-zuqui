import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const state = fs.readFileSync(new URL('../assets/js/03-core-state.js', import.meta.url), 'utf8');

const reports = [
  ['relatorio_sangrias_raffinato', 'Sangrias Raffinato'],
  ['relatorio_vendas_raffinato', 'Análise de vendas Raffinato'],
  ['relatorio_comparativo_anual', 'Comparativo Anual'],
  ['relatorio_curva_abc_raffinato', 'Curva ABC Raffinato'],
  ['relatorio_item_obrigatorio_pizza', 'Raffinato – Venda de Item Obrigatório'],
];

test('todos os relatórios Raffinato visíveis possuem permissão própria no perfil', () => {
  for (const [permission, label] of reports) {
    assert.match(state, new RegExp(`\\{ key: '${permission}', label: '${label}' \\}`));
    assert.match(state, new RegExp(`\\{ nome: '${label}', visualizar: '${permission}' \\}`));
  }
  assert.doesNotMatch(state, /nome: 'Produtos faturados Raffinato'/);
});
