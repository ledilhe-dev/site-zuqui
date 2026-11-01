import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const helpers=fs.readFileSync(new URL('../assets/js/05-shared-helpers.js',import.meta.url),'utf8');
const employees=fs.readFileSync(new URL('../assets/js/21-employees.js',import.meta.url),'utf8');
const migration=fs.readFileSync(new URL('../supabase/migrations/202610310002_funcionario_nome_por_loja.sql',import.meta.url),'utf8');

test('duplicidade de nome e consultada dentro da empresa e loja selecionadas',()=>{
  assert.match(helpers,/consultaFuncionariosMesmoNome\.eq\('empresa_id', empresaId\)/);
  assert.match(helpers,/consultaFuncionariosMesmoNome\.eq\('loja_id', lojaId\)/);
  assert.match(employees,/empresaId: tenantCadastro\.empresa_id/);
  assert.match(employees,/lojaId: tenantCadastro\.loja_id/);
});

test('banco permite mesmo nome em lojas diferentes e bloqueia repeticao na mesma loja',()=>{
  assert.match(migration,/drop index if exists public\.funcionarios_nome_unique_idx/);
  assert.match(migration,/drop index if exists public\.ux_funcionarios_nome_normalizado/);
  assert.match(migration,/unique index if not exists ux_funcionarios_nome_loja_normalizado/);
  assert.match(migration,/empresa_id, loja_id, lower/);
});
