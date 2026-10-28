import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../assets/js/10-dashboard.js',import.meta.url),'utf8');
const finance=fs.readFileSync(new URL('../assets/js/30-finance.js',import.meta.url),'utf8');

test('dashboard consolida categorias historicas equivalentes no cadastro ativo',()=>{
  assert.match(source,/let _dashGfCategoriaAlias = \{\}/);
  assert.match(source,/\.select\('id, nome, cor, icone, ativo'\)/);
  assert.match(source,/\(!atual\.ativo && c\.ativo\)/);
  assert.match(source,/_dashGfCategoriaAlias\[String\(c\.id\)\] = String\(canonica\.id\)/);
  assert.match(source,/return id\?\(_dashGfCategoriaAlias\[id\]\|\|id\):'sem'/);
});

test('detalhes e graficos usam a chave canonica da categoria',()=>{
  assert.match(source,/const categoriasAno = new Set\(_dashGfDados\.map\(_dashGfChaveCategoria\)\)/);
  assert.match(source,/_dashGfCategoriasMapa\[_dashGfChaveCategoria\(c\)\]/);
});

test('imagem indisponivel no dashboard usa a inicial da categoria',()=>{
  assert.match(finance,/closest\('\.dash-gf-category-rank'\)/);
  assert.match(finance,/\.dash-gf-category-name span:last-child/);
});
