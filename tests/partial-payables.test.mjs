import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const js = fs.readFileSync(new URL('../assets/js/41-finance-vault-calendar.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const sql = fs.readFileSync(new URL('../supabase/migrations/202610280002_baixa_parcial_contas_pagar.sql', import.meta.url), 'utf8');

test('valor menor abre confirmacao e resposta negativa retorna ao editor', () => {
  assert.match(js, /valorPagoFinal < valorTitulo/);
  assert.match(js, /confirmarBaixaParcialFinanceiro/);
  assert.match(js, /if \(confirmado\) break;[\s\S]*valorSugerido = valorPagoFinal/);
  assert.match(html, /Não, editar valor/);
});

test('lista inicia a baixa apenas em Pagar e confirmar', () => {
  const render = js.match(/async function carregarBaixarContasFinanceiro[\s\S]*?function obterParcelasRelacionadasBaixarContasFinanceiro/)?.[0] || '';
  assert.doesNotMatch(render, /Editar pagamento/);
  assert.match(render, /Pagar e confirmar/);
  assert.match(render, /confirmarPagamentoContaFinanceiro/);
});

test('baixa parcial e atomica, vinculada e preserva saldo residual', () => {
  assert.match(sql, /titulo_origem_id uuid references public\.contasapagar/);
  assert.match(sql, /baixa_parcial_grupo_id uuid/);
  assert.match(sql, /update public\.contasapagar[\s\S]*valor_compra = v_saldo/);
  assert.match(sql, /insert into public\.contasapagar/);
  assert.match(sql, /insert into public\.contas_financeiras_movimentacoes/);
  assert.match(sql, /\[PAGAMENTO PARCIAL\]/);
});

test('confirmacao final mostra valores e vencimento original', () => {
  assert.match(js, /Pagamento parcial registrado/);
  assert.match(js, /Vencimento original/);
  assert.match(js, /OK, voltar para contas/);
});

