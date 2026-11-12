import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../assets/js/21-employees.js', import.meta.url), 'utf8');
const loginJs = readFileSync(new URL('../assets/js/79-runtime-extensions.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('vínculo oferece somente perfis ativos da loja escolhida', () => {
  assert.match(js, /_perfisPorLojaVinculos = new Map\(\)/);
  assert.match(js, /\.eq\('ativo', true\)[\s\S]*\.in\('loja_id', idsLojasCarregadas\)/);
  assert.match(js, /obterPerfisAtribuiveisFuncionario\(loja\.id\)/);
  assert.match(js, /usuarioPodeAtribuirPerfilFuncionario\(perfilId, lojaId\)/);
});

test('login multiloja consulta vínculo e perfil com as credenciais operacionais do login', () => {
  assert.match(loginJs, /x-operational-token/);
  assert.match(loginJs, /rest\/v1\/funcionario_lojas/);
  assert.match(loginJs, /rest\/v1\/perfis/);
  assert.match(loginJs, /urlPerfil\.searchParams\.set\('loja_id', 'eq\.' \+ lojaId\)/);
  assert.match(loginJs, /cache: 'no-store'/);
});

test('erro ao abrir loja aparece no seletor e não fica invisível na primeira fase', () => {
  assert.match(html, /id="msgLoginStore"/);
  assert.match(loginJs, /setMsg\('msgLoginStore', 'Abrindo /);
  assert.match(loginJs, /setMsg\('msgLoginStore', 'Não foi possível abrir esta loja:/);
  assert.match(loginJs, /btn\.disabled = true/);
});

test('falha de vínculo aparece dentro do modal sem alert do navegador', () => {
  assert.match(html, /id="msgSeletorLojas"/);
  assert.match(js, /setMsg\('msgSeletorLojas', 'Não foi possível vincular o acesso:/);
  assert.doesNotMatch(js, /alert\('Erro ao vincular:/);
});
