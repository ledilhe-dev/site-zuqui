import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../assets/js/95-raffinato-mandatory-items.js', import.meta.url), 'utf8');

test('usa somente relay remoto e contexto empresa loja', () => {
  assert.match(source, /mandatory_v2_metadata/);
  assert.match(source, /mandatory_v2_dashboard/);
  assert.doesNotMatch(source, /127\.0\.0\.1|localhost|id_filial/);
});

test('carrega agrupamentos ao montar antes de qualquer consulta', () => {
  const mount = source.slice(source.indexOf('function mount()'));
  assert.ok(mount.indexOf('loadGroups(token)') >= 0);
  assert.match(source, /Carregando agrupamentos da filial/);
});

test('troca de loja invalida respostas pendentes', () => {
  assert.match(source, /token === state\.generation/);
  assert.match(source, /tenantKey\(context\(\)\) === state\.tenantKey/);
  assert.match(source, /function reset\(\) \{ \+\+state\.generation/);
});
