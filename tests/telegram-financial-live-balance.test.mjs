import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const edge = readFileSync(new URL('../supabase/functions/telegram-webhook/index.ts', import.meta.url), 'utf8');
const sql = readFileSync(new URL('../supabase/migrations/202610280005_telegram_financeiro_sem_interrogacoes.sql', import.meta.url), 'utf8');

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

test('mensagens financeiras substituem interrogacoes por icones compativeis', () => {
  assert.match(edge, /normalizeFinancialMessage\(alert\.descricao\)/);
  assert.match(edge, /const money = "\\u\{1F4B0\}"/);
  assert.match(edge, /const warning = "\\u26A0\\uFE0F"/);
  assert.match(sql, /v_money text := chr\(128176\)/);
  assert.match(sql, /v_warning text := chr\(9888\)\|\|chr\(65039\)/);
  assert.doesNotMatch(sql, /\?\? SALDO|\?\? CONTAS|\?\? FALTA/);
});
