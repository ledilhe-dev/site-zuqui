import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const edge = readFileSync(new URL('../supabase/functions/google-business/index.ts', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../supabase/migrations/202609040001_google_business_contexto_autorizado.sql', import.meta.url), 'utf8');
const frontend = readFileSync(new URL('../assets/js/72-atendimento-estatisticas.js', import.meta.url), 'utf8');

test('Edge Function usa uma única resolução server-side de contexto', () => {
  assert.match(edge, /admin\.rpc\("resolver_contexto_google_business"/);
  assert.doesNotMatch(edge, /resolveAuthorizedStores/);
  assert.doesNotMatch(edge, /validar_contexto_operacional_relay/);
});

test('RPC usa campo canônico e_administrador e não depende do vínculo do administrador do sistema', () => {
  assert.match(migration, /v_funcionario\.e_administrador is true/);
  assert.doesNotMatch(migration, /"é_administrador"|"Ã©_administrador"/);
  const adminAntesDoVinculo = migration.indexOf('v_funcionario.e_administrador is true');
  const consultaVinculo = migration.indexOf('from public.funcionario_lojas');
  assert.ok(adminAntesDoVinculo >= 0 && consultaVinculo > adminAntesDoVinculo);
});

test('erros de banco na autorização não são convertidos em ACCESS_DENIED', () => {
  assert.match(edge, /if \(error\)[\s\S]*AUTH_DATABASE_ERROR/);
  assert.match(edge, /AUTH_DATABASE_ERROR.*\? 500/);
});

test('frontend diferencia carregamento, conexão, sincronização e resposta', () => {
  assert.match(frontend, /Não foi possível carregar os dados do Google Business/);
  assert.match(frontend, /Não foi possível iniciar a conexão com o Google/);
  assert.match(frontend, /Não foi possível sincronizar as avaliações/);
  assert.match(frontend, /Não foi possível enviar a resposta ao Google/);
});
