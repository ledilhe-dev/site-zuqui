import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../assets/js/41-finance-vault-calendar.js', import.meta.url), 'utf8');
const sql = fs.readFileSync(new URL('../supabase/migrations/202611110001_baixa_contas_lote_atomica.sql', import.meta.url), 'utf8');

test('modal oferece pagar total preenchendo somente a diferenca', () => {
  assert.match(source, /data-bcm-total="\$\{c\.id\}"/);
  assert.match(source, /const alocadoNasOutras = contas\.reduce/);
  assert.match(source, /total - alocadoNasOutras/);
});

test('lista de pendentes filtra loja status e datas antes de baixar dados', () => {
  assert.match(source, /aplicarFiltroLojasFinanceirasPermitidas\(query, lojasSelecionadas\)/);
  assert.match(source, /query = query\.is\('pago_confirmado_em', null\)/);
  assert.match(source, /consultarTodasPaginasSupabase/);
  assert.match(source, /baixarContasFinanceiroRequestSeq/);
});

test('baixa multipla usa uma unica RPC transacional', () => {
  assert.match(source, /sb\.rpc\('baixar_contas_lote'/);
  assert.match(sql, /for v_item in select value from jsonb_array_elements\(p_itens\)/);
  assert.match(sql, /for update/);
  assert.match(sql, /saldo_atual = coalesce\(saldo_atual, 0\) - v_valor_parte/);
  assert.match(sql, /contasapagar_loja_status_vencimento_idx/);
});
