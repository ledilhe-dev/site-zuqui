import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const helpers = fs.readFileSync(new URL('../assets/js/05-shared-helpers.js', import.meta.url), 'utf8');
const payables = fs.readFileSync(new URL('../assets/js/41-finance-vault-calendar.js', import.meta.url), 'utf8');
const dashboard = fs.readFileSync(new URL('../assets/js/10-dashboard.js', import.meta.url), 'utf8');

function loadPager() {
  const context = vm.createContext({ console, setTimeout, clearTimeout });
  vm.runInContext(`${helpers}\nthis.pager = consultarTodasPaginasSupabase;`, context);
  return context.pager;
}

test('pager loads more than the PostgREST default limit without gaps', async () => {
  const pager = loadPager();
  const rows = Array.from({ length: 1323 }, (_, index) => ({ id: String(index + 1) }));
  const result = await pager(async (from, to) => ({ data: rows.slice(from, to + 1), error: null }), { tamanhoPagina: 500 });
  assert.equal(result.complete, true);
  assert.equal(result.data.length, 1323);
  assert.equal(result.paginas, 3);
  assert.equal(new Set(result.data.map(row => row.id)).size, 1323);
});

test('pager rejects partial data when a later page fails', async () => {
  const pager = loadPager();
  const result = await pager(async (from) => from >= 500
    ? { data: null, error: new Error('timeout') }
    : { data: Array.from({ length: 500 }, (_, index) => ({ id: String(index + 1) })), error: null },
  { tamanhoPagina: 500 });
  assert.equal(result.complete, false);
  assert.equal(result.data, null);
  assert.match(result.error.message, /timeout/);
});

test('financial loaders use complete pagination and stable ordering', () => {
  assert.match(payables, /consultarTodasPaginasSupabase/);
  assert.match(payables, /\.order\('data_vencimento',[\s\S]*?\.order\('id'/);
  assert.match(payables, /Nenhum resultado parcial foi exibido/);
  assert.match(payables, /cadastro:\s*'created_at'/);
  assert.match(payables, /atualizacao:\s*'updated_at'/);
  assert.match(dashboard, /consultarTodasPaginasSupabase/);
  assert.match(dashboard, /\.order\(campoData,[\s\S]*?\.order\('id'/);
});
