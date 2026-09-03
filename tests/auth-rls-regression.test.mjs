import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const runtime = readFileSync(new URL('../assets/js/79-runtime-extensions.js', import.meta.url), 'utf8');
const checklists = readFileSync(new URL('../assets/js/51-quick-alerts.js', import.meta.url), 'utf8');
const pointMigration = readFileSync(new URL('../supabase/migrations/202609030001_preservar_tenant_ponto_multiloja.sql', import.meta.url), 'utf8');

test('restaura cabeçalhos RLS antes de renovar e consultar a sessão persistida', () => {
  const parse = runtime.indexOf('let usuario = JSON.parse(salvo);');
  const restoreToken = runtime.indexOf("window.__authOperationalToken = String(usuario?.operational_access_token", parse);
  const renew = runtime.indexOf('await renovarContextoOperacionalPersistido(usuario)', parse);
  assert.ok(parse >= 0 && restoreToken > parse && renew > restoreToken);
});

test('limpa todos os cabeçalhos opacos no logout', () => {
  const logout = runtime.slice(runtime.indexOf('async function logout()'), runtime.indexOf('function toggleSolicitacaoAcesso'));
  for (const key of ['__authPrincipalId', '__authOperationalToken', '__authGlobalToken', '__authLojaId']) {
    assert.match(logout, new RegExp(`window\\.${key} = ''`));
  }
});

test('execução de checklist herda empresa e loja do lançamento autorizado', () => {
  assert.match(checklists, /horario_limite, empresa_id, loja_id/);
  assert.match(checklists, /empresa_id:\s*lancamentoAtual\.empresa_id/);
  assert.match(checklists, /loja_id:\s*lancamentoAtual\.loja_id/);
});

test('trigger do ponto preserva loja explícita e deriva empresa dessa loja', () => {
  assert.match(pointMigration, /new\.loja_id := coalesce\(new\.loja_id, v_loja_principal\)/i);
  assert.match(pointMigration, /new\.empresa_id := coalesce\(v_empresa_loja, new\.empresa_id, v_empresa_principal\)/i);
  assert.match(pointMigration, /from public\.funcionario_lojas fl[\s\S]*fl\.ativo is true/i);
  assert.doesNotMatch(pointMigration, /into\s+new\.loja_id\s*,\s*new\.empresa_id/i);
});
