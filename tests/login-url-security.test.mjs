import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const guard=fs.readFileSync(new URL('../assets/js/88-password-manager-guard.js',import.meta.url),'utf8');
const cleanup=fs.readFileSync(new URL('../assets/js/90-sensitive-url-cleanup.js',import.meta.url),'utf8');
const runtime=fs.readFileSync(new URL('../assets/js/79-runtime-extensions.js',import.meta.url),'utf8');

assert.match(html,/<meta name="referrer" content="no-referrer">/,'credenciais não podem vazar pelo cabeçalho Referer');
assert.match(html,/<form id="loginForm"[^>]*method="post"[^>]*action="\.\/"[^>]*onsubmit="event\.preventDefault\(\); return handleLogin\(event\)"/,'login deve impedir GET mesmo antes do JavaScript principal');
assert.ok(html.indexOf('id="limpeza-url-login-imediata"') < html.indexOf('00-theme-bootstrap.js'),'limpeza sensível deve carregar antes de qualquer recurso externo');
assert.match(guard,/nativeSubmitBlocked[\s\S]*event\.preventDefault\(\)/,'envio nativo deve possuir uma segunda barreira independente');
assert.match(cleanup,/username\|password\|passwd\|pwd\|senha\|usuario/,'limpeza passiva deve reconhecer credenciais legadas');
assert.match(runtime,/delete preferencias\.password/,'senhas antigas devem ser removidas do armazenamento web');
assert.doesNotMatch(runtime,/localStorage\.setItem\([^\n]*password/,'senha não pode ser gravada diretamente no localStorage');
assert.match(runtime,/navigator\.credentials\.store/,'opção salvar senha deve usar o gerenciador seguro do navegador');
console.log('OK: login não expõe credenciais na URL ou no armazenamento web');
