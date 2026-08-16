import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateMandatoryV2 } from './mandatory-v2.mjs';

function unit(parent, count, group = 2) {
  return Array.from({ length: count }, (_, index) => ({id_venda:10,id_pai:parent,id_grupo_obrigatorio:group,id_item:parent*10+index,id_produto_pai:100,produto_pai:'PIZZA',id_agrupamento_pai:20,grupo_obrigatorio:'PIZZA GRAND',quantidade_maxima:4,quantidade_minima:1,id_componente:1000+index,componente:`SABOR ${index+1}`,quantidade_componente:1,valor_componente:3,valor_item:60}));
}

test('classifica 1, 2, 3 e 4 sabores pela venda real', () => {
  const result = aggregateMandatoryV2([...unit(1,1),...unit(2,2),...unit(3,3),...unit(4,4)]);
  assert.deepEqual({total:result.resumo.total,inteiras:result.resumo.inteiras,duas:result.resumo.duas,tres:result.resumo.tres,multiplas:result.resumo.multiplas},{total:4,inteiras:1,duas:1,tres:1,multiplas:1});
});

test('equivalente reparte cada item pai sem contar duas pizzas', () => {
  const result = aggregateMandatoryV2([...unit(1,2),...unit(2,3),...unit(3,4)]);
  const totalEquivalent = result.itens.reduce((sum, item) => sum + item.equivalente, 0);
  assert.ok(Math.abs(totalEquivalent - 3) < 1e-9);
});

test('separa agrupamentos obrigatorios dentro do mesmo item pai', () => {
  const result = aggregateMandatoryV2([...unit(1,2,2),...unit(1,1,6)]);
  assert.equal(result.resumo.total, 2);
  assert.equal(result.grupos_obrigatorios.length, 2);
});
