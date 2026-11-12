import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const payables = readFileSync(new URL('../assets/js/41-finance-vault-calendar.js', import.meta.url), 'utf8');
const receivables = readFileSync(new URL('../assets/js/30-finance.js', import.meta.url), 'utf8');
const sql = readFileSync(new URL('../supabase/migrations/202611110003_operacoes_financeiras_lote_atomicas.sql', import.meta.url), 'utf8');

test('exclusão múltipla de contas a pagar usa uma RPC e aguarda a recarga completa', () => {
  assert.match(payables, /sb\.rpc\('excluir_contas_pagar_lote'/);
  assert.match(payables, /await carregarContasAPagarFinanceiro\(\)/);
  assert.match(payables, /Excluindo \$\{idsSelecionados\.length\} conta/);
});

test('recebimentos e exclusões múltiplas não percorrem títulos pela rede', () => {
  assert.match(receivables, /sb\.rpc\('baixar_recebiveis_lote'/);
  assert.match(receivables, /sb\.rpc\('excluir_recebiveis_futuros_lote'/);
  const baixa = receivables.match(/async function confirmarBaixaMultiplaRecebiveis\(\)[\s\S]*?\n}\n\nasync function excluirRecFuturosSelecionados/)?.[0] || '';
  const exclusao = receivables.match(/async function excluirRecFuturosSelecionados\(\)[\s\S]*?\n}\n/)?.[0] || '';
  assert.doesNotMatch(baixa, /for \(const item of itens\)/);
  assert.doesNotMatch(exclusao, /for \(const id of idsSelecionados\)/);
});

test('banco garante tudo ou nada e possui índice por loja e cadastro', () => {
  assert.match(sql, /create or replace function public\.excluir_contas_pagar_lote/i);
  assert.match(sql, /create or replace function public\.excluir_recebiveis_futuros_lote/i);
  assert.match(sql, /create or replace function public\.baixar_recebiveis_lote/i);
  assert.match(sql, /if v_afetado <> v_esperado then raise exception/i);
  assert.match(sql, /if v_inseridos <> v_esperado then raise exception/i);
  assert.match(sql, /contasapagar_loja_cadastro_idx/i);
  assert.match(sql, /old\.excluido_em is null and new\.excluido_em is not null/i);
  assert.match(sql, /old\.pago_confirmado_em is null and new\.pago_confirmado_em is not null/i);
  assert.match(sql, /to anon, authenticated/i);
});
