import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../assets/js/30-finance.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const sql = readFileSync(new URL('../supabase/migrations/202610280003_baixa_parcial_contas_receber.sql', import.meta.url), 'utf8');

test('recebimento menor que o título abre confirmação e chama a baixa parcial', () => {
  assert.match(js, /valorConfirmado < valorTitulo/);
  assert.match(js, /abrirConfirmacaoRecebimentoParcialFinanceiro/);
  assert.match(js, /sb\.rpc\('baixar_recebivel_parcial'/);
  assert.match(js, /p_valor_recebido: valorConfirmado/);
  assert.match(js, /p_data_recebimento: dataConfirmacao/);
});

test('modal permite voltar para editar ou confirmar e informa o saldo residual', () => {
  assert.match(html, /id="recebimentoParcialOverlay"/);
  assert.match(html, /responderRecebimentoParcialFinanceiro\(false\)/);
  assert.match(html, /responderRecebimentoParcialFinanceiro\(true\)/);
  assert.match(js, /Novo saldo/);
  assert.match(js, /Vencimento original/);
  assert.match(js, /saldo restante continua pendente/);
  assert.match(js, /document\.body\.appendChild\(modal\)/);
});

test('função transacional preserva título original, cria parte recebida e mantém vínculo', () => {
  assert.match(sql, /for update/i);
  assert.match(sql, /update public\.recebiveis_futuros set valor=v_saldo/i);
  assert.match(sql, /titulo_origem_id/);
  assert.match(sql, /baixa_parcial_grupo_id/);
  assert.match(sql, /insert into public\.recebiveis\(/i);
  assert.match(sql, /p_movimentar_saldo/);
  assert.match(sql, /RECEBIMENTO PARCIAL/);
  assert.match(sql, /BAIXA PARCIAL/);
});
