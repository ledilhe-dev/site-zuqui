import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const edge = readFileSync(new URL('../supabase/functions/telegram-webhook/index.ts', import.meta.url), 'utf8');
const sql = readFileSync(new URL('../supabase/migrations/202610280004_telegram_financeiro_saldo_atual_e_loja_patrick.sql', import.meta.url), 'utf8');

test('saldo é relido das contas financeiras imediatamente antes do envio', () => {
  assert.match(edge, /await refreshFinancialSnapshot\(admin, alert\)/);
  assert.match(edge, /from\("contas_financeiras"\)/);
  assert.match(edge, /\.eq\("loja_id", alert\.loja_id\)/);
  assert.match(edge, /Total no cofre/);
});

test('resumo financeiro consulta e publica somente a loja PATRICK', () => {
  assert.match(sql, /lower\(trim\(l\.nome\)\)='patrick'/);
  assert.doesNotMatch(sql, /like\s+'%patrick%'/i);
  assert.match(sql, /c\.loja_id=l\.id/);
  assert.match(sql, /c\.data_pagamento is null/);
});
