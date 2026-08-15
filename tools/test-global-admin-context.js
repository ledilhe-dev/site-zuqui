const fs = require('fs');
const assert = require('assert');

const read = file => fs.readFileSync(file, 'utf8');
const core = read('assets/js/01-core-supabase.js');
const permissions = read('assets/js/05-shared-helpers.js');
const runtime = read('assets/js/79-runtime-extensions.js');
const navigation = read('assets/js/04-navigation.js');
const html = read('index.html');
const migration = read('supabase/migrations/202608150300_contexto_admin_global_seguro.sql');

assert(core.includes("context_mode || ''"), 'modo de contexto ausente');
assert(core.includes("if (contextoEhAdminGlobal()) return null;"), 'tenant não é suspenso no modo global');
assert(permissions.includes("'dashboard_saas','empresas_saas','lojas_saas','usuarios_saas','conectores_saas'"), 'whitelist global ausente');
assert(permissions.includes('paginasAdminGlobal.has(pageId)'), 'admin global ainda recebe permissões operacionais');
assert(runtime.includes("context_mode: 'store'"), 'entrada em loja não ativa store mode');
assert(runtime.includes("context_mode: 'global_admin'"), 'entrada global não ativa global_admin');
assert(runtime.includes("empresa_id:null, loja_id:null"), 'modo global mantém tenant operacional');
assert(runtime.includes("sb.rpc('validar_sessao_admin_global'"), 'autoridade global não é revalidada no backend');
assert(navigation.includes("document.getElementById('navGlobalAdmin')"), 'menu global independente ausente');
assert(html.includes('id="navGlobalAdmin"'), 'árvore global não foi criada');
assert(html.includes('id="dashboard_saas"'), 'dashboard SaaS ausente');
assert(migration.includes('private.sessoes_admin_global'), 'sessão opaca de admin ausente');
assert(migration.includes("raise exception 'Acesso global nao autorizado'"), 'RPC global não bloqueia token inválido');

console.log('OK: contexto global/store, navegação exclusiva e autorização backend validados');
