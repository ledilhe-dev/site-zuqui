import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const finance = fs.readFileSync(new URL('../assets/js/30-finance.js', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../supabase/migrations/202611140001_fatura_categoria_memoria.sql', import.meta.url), 'utf8');

test('aprendizado inclui tenant no upsert e valida o erro devolvido pelo PostgREST', () => {
  const save = finance.slice(
    finance.indexOf('async function faturaSalvarMemoriaCategorias'),
    finance.indexOf('// Verifica quais FITIDs', finance.indexOf('async function faturaSalvarMemoriaCategorias')),
  );
  assert.match(save, /empresa_id:\s*empresaId/);
  assert.match(save, /loja_id:\s*lojaId/);
  assert.match(save, /onConflict:\s*'empresa_id,loja_id,chave_estabelecimento'/);
  assert.match(save, /if \(error\) throw error/);
});

test('sugestao carrega somente da empresa/loja atual e considera nome do fornecedor', () => {
  const loadStart = finance.indexOf('async function faturaConstruirMemoriaCategorias');
  const loadEnd = finance.indexOf('// Salva/atualiza as escolhas', loadStart);
  const load = finance.slice(loadStart, loadEnd);
  assert.match(load, /\.eq\('empresa_id', empresaId\)/);
  assert.match(load, /\.eq\('loja_id', lojaId\)/);
  assert.match(finance, /faturaChaveEstabelecimento\(fornecedor\?\.nome\)/);
  assert.match(finance, /_faturaMemoriaCategorias\[fornecedorChave\]/);
});

test('migracao cria memoria persistente protegida por RLS e chave composta por tenant', () => {
  assert.match(migration, /create table if not exists public\.fatura_categoria_memoria/i);
  assert.match(migration, /unique index if not exists fatura_categoria_memoria_unica[\s\S]*\(empresa_id, loja_id, chave_estabelecimento\)/i);
  assert.doesNotMatch(migration, /fatura_categoria_memoria_tenant_chave_uidx/i);
  assert.match(migration, /request_store_authorized\(empresa_id, loja_id\)/i);
  assert.match(migration, /grant select, insert, update, delete/i);
});
