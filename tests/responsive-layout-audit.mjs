import { createServer } from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

const root = normalize(join(import.meta.dirname, '..'));
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
if (!existsSync(chromePath)) throw new Error(`Chrome não encontrado: ${chromePath}`);

const types = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'], ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'], ['.png', 'image/png'], ['.webmanifest', 'application/manifest+json'],
]);

const server = createServer((request, response) => {
  const rawPath = decodeURIComponent(new URL(request.url, 'http://local').pathname);
  const relative = rawPath === '/' ? 'index.html' : rawPath.replace(/^\/+/, '');
  const filePath = normalize(join(root, relative));
  if (!filePath.startsWith(root) || !existsSync(filePath)) {
    response.writeHead(404).end('not found');
    return;
  }
  response.setHeader('Content-Type', types.get(extname(filePath)) || 'application/octet-stream');
  createReadStream(filePath).pipe(response);
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const webPort = server.address().port;

const probe = createServer();
probe.listen(0, '127.0.0.1');
await once(probe, 'listening');
const debugPort = probe.address().port;
probe.close();

const chrome = spawn(chromePath, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${debugPort}`, '--user-data-dir=' + join(root, '.responsive-audit-profile'),
  'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });

async function waitForJson(url, attempts = 60) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Chrome DevTools não respondeu em ${url}`);
}

const version = await waitForJson(`http://127.0.0.1:${debugPort}/json/version`);
const socket = new WebSocket(version.webSocketDebuggerUrl);
await once(socket, 'open');
let sequence = 0;
const pending = new Map();
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const { resolve, reject } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) reject(new Error(message.error.message)); else resolve(message.result);
});
function call(method, params = {}, sessionId) {
  const id = ++sequence;
  socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

const { targetId } = await call('Target.createTarget', { url: 'about:blank' });
const attached = await call('Target.attachToTarget', { targetId, flatten: true });
const sessionId = attached.sessionId;
await call('Page.enable', {}, sessionId);
await call('Runtime.enable', {}, sessionId);

const viewports = [
  ['phone-portrait-small', 360, 800], ['phone-portrait', 390, 844],
  ['phone-landscape', 667, 375], ['ipad-portrait', 768, 1024],
  ['ipad-landscape', 1024, 768], ['tablet-landscape-wide', 1180, 820],
  ['windows-notebook', 1366, 768], ['desktop-fullhd', 1920, 1080],
];

const results = [];
for (const [name, width, height] of viewports) {
  await call('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile: width <= 1024,
    screenWidth: width, screenHeight: height,
  }, sessionId);
  await call('Page.navigate', { url: `http://127.0.0.1:${webPort}/index.html?audit=${Date.now()}` }, sessionId);
  await new Promise(resolve => setTimeout(resolve, 900));
  const evaluated = await call('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      document.querySelectorAll('[hidden]').forEach(el => {
        if (el.matches('.topbar-store,#topbarUserInfo')) el.removeAttribute('hidden');
      });
      const shell = document.querySelector('.shell');
      if (shell) shell.style.display = 'flex';
      const topbar = document.querySelector('.topbar');
      const menu = document.querySelector('.mobile-menu-btn');
      const sidebar = document.querySelector('.sidebar');
      const menuStyle = menu ? getComputedStyle(menu) : null;
      const menuRect = menu?.getBoundingClientRect();
      const topRect = topbar?.getBoundingClientRect();
      const loginScreenRect = document.querySelector('#loginScreen')?.getBoundingClientRect();
      const loginShowcaseRect = document.querySelector('.login-showcase')?.getBoundingClientRect();
      const loginCardRect = document.querySelector('#loginScreen > .login-card')?.getBoundingClientRect();
      const accountMenu = document.querySelector('#accountMenu');
      const accountMenuWasHidden = accountMenu?.hasAttribute('hidden');
      const accountMenuTrigger = document.querySelector('.account-menu-trigger');
      if (accountMenuWasHidden) accountMenuTrigger?.click();
      const accountMenuDisplayed = accountMenu ? getComputedStyle(accountMenu).display !== 'none' : false;
      const accountMenuRect = accountMenu?.getBoundingClientRect();
      if (accountMenuWasHidden && !accountMenu?.hasAttribute('hidden')) accountMenuTrigger?.click();
      const storeRect = document.querySelector('.topbar-store')?.getBoundingClientRect();
      const actionElements = [...document.querySelectorAll('.topbar-actions > .checkia-fab, .topbar-actions > #topbarUserInfo, .topbar-actions > .notification-btn, .topbar-actions > .btn-red')]
        .filter(element => getComputedStyle(element).display !== 'none');
      const actionRects = actionElements.map(element => element.getBoundingClientRect());
      const overlap = (a, b) => !!a && !!b && Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
      const topbarControlsOverlap = actionRects.some((rect, index) => actionRects.slice(index + 1).some(other => overlap(rect, other)));
      const storeActionsOverlap = actionRects.some(rect => overlap(storeRect, rect));
      const topbarControlsInside = actionRects.every(rect => rect.left >= -1 && rect.right <= innerWidth + 1 && rect.top >= -1);
      const compactHeaderAligned = innerWidth > 700 || actionRects.length < 3 || (!!storeRect && actionRects.every(rect => Math.abs(rect.height - storeRect.height) <= 1 && Math.abs(rect.top - storeRect.top) <= 1));
      const loginInside = [loginShowcaseRect, loginCardRect].every(rect => !!rect && rect.left >= -1 && rect.right <= innerWidth + 1);
      const loginOrderCorrect = !loginShowcaseRect || !loginCardRect || (innerWidth <= 900 ? loginShowcaseRect.bottom <= loginCardRect.top + 1 : loginShowcaseRect.right <= loginCardRect.left + 1);
      const loginElement = document.querySelector('#loginScreen');
      const originalLoginDisplay = loginElement?.style.display || '';
      if (loginElement) loginElement.style.display = 'none';
      const loginCanHide = !!loginElement && getComputedStyle(loginElement).display === 'none';
      if (loginElement) loginElement.style.display = originalLoginDisplay;
      const accountMenuInside = innerWidth > 700 || (!!accountMenuRect && accountMenuDisplayed && accountMenuRect.width >= 160 && accountMenuRect.left >= -1 && accountMenuRect.right <= innerWidth + 1);
      const closedSidebar = sidebar ? getComputedStyle(sidebar) : null;
      let openSidebarRect = null;
      if (sidebar) {
        const originalTransition = sidebar.style.transition;
        sidebar.style.setProperty('transition', 'none', 'important');
        sidebar.classList.add('open');
        void sidebar.offsetWidth;
        openSidebarRect = sidebar.getBoundingClientRect().toJSON();
        sidebar.classList.remove('open');
        sidebar.style.transition = originalTransition;
      }
      const pageOverflows = [];
      const pages = [...document.querySelectorAll('.pagina')];
      const original = pages.map(page => [page, page.getAttribute('style'), page.className]);
      for (const page of pages) {
        for (const candidate of pages) {
          candidate.style.setProperty('display', candidate === page ? 'block' : 'none', 'important');
          candidate.classList.toggle('ativa', candidate === page);
        }
        const right = page.getBoundingClientRect().right;
        const overflow = Math.max(page.scrollWidth - page.clientWidth, right - innerWidth, 0);
        if (overflow > 2) {
          const offenders = [...page.querySelectorAll('*')].map(element => {
            const rect = element.getBoundingClientRect();
            return {
              tag: element.tagName.toLowerCase(), id: element.id || '',
              className: typeof element.className === 'string' ? element.className.slice(0, 100) : '',
              right: Math.round(rect.right), width: Math.round(rect.width), scrollWidth: element.scrollWidth,
              overflowX: getComputedStyle(element).overflowX,
            };
          }).filter(item => !['hidden', 'clip'].includes(item.overflowX))
            .filter(item => item.right > innerWidth + 2 || item.scrollWidth > innerWidth + 2)
            .sort((a, b) => Math.max(b.right, b.scrollWidth) - Math.max(a.right, a.scrollWidth)).slice(0, 8);
          if (offenders.length) pageOverflows.push({ id: page.id || '(sem-id)', overflow: Math.round(overflow), offenders });
        }
      }
      for (const [page, style, className] of original) {
        if (style === null) page.removeAttribute('style'); else page.setAttribute('style', style);
        page.className = className;
      }
      return {
        viewport: [innerWidth, innerHeight],
        documentOverflow: Math.max(document.documentElement.scrollWidth - innerWidth, document.body.scrollWidth - innerWidth),
        topbarInside: !!topRect && topRect.left >= -1 && topRect.right <= innerWidth + 1,
        topbarControlsOverlap,
        storeActionsOverlap,
        topbarControlsInside,
        compactHeaderAligned,
        loginInside,
        loginOrderCorrect,
        loginCanHide,
        loginRects: { showcase: loginShowcaseRect?.toJSON(), card: loginCardRect?.toJSON() },
        accountMenuInside,
        accountMenuRect: accountMenuRect?.toJSON(),
        menuVisible: !!menuStyle && menuStyle.display !== 'none' && menuStyle.visibility !== 'hidden' && menuRect.width >= 38,
        menuHiddenOnDesktop: !!menuStyle && menuStyle.display === 'none',
        sidebarClosedOffCanvas: !closedSidebar || innerWidth > 1180 || closedSidebar.visibility === 'hidden' || closedSidebar.transform !== 'none',
        sidebarOpenInside: !openSidebarRect || innerWidth > 1180 || (openSidebarRect.left >= -1 && openSidebarRect.right <= innerWidth + 1),
        pageOverflows: pageOverflows.slice(0, 20),
      };
    })()`,
  }, sessionId);
  const data = evaluated.result.value;
  const compact = width <= 1180;
  const failures = [];
  if (data.documentOverflow > 2) failures.push(`document overflow ${data.documentOverflow}px`);
  if (!data.topbarInside) failures.push('topbar fora da viewport');
  if (!data.topbarControlsInside) failures.push('controle do topbar fora da viewport');
  if (data.topbarControlsOverlap) failures.push('controles do topbar sobrepostos');
  if (data.storeActionsOverlap) failures.push('loja e acoes do topbar sobrepostas');
  if (!data.compactHeaderAligned) failures.push('loja e icones do topbar desalinhados');
  if (!data.loginInside) failures.push('conteudo do login fora da viewport');
  if (!data.loginOrderCorrect) failures.push('vitrine e formulario do login sobrepostos');
  if (!data.loginCanHide) failures.push('tela de login nao fecha depois da autenticacao');
  if (!data.accountMenuInside) failures.push('menu do perfil fora da viewport ou invisivel');
  if (compact && !data.menuVisible) failures.push('botão de menu invisível');
  if (!compact && !data.menuHiddenOnDesktop) failures.push('botão móvel visível no desktop');
  if (compact && !data.sidebarOpenInside) failures.push('gaveta lateral fora da viewport');
  if (data.pageOverflows.length) failures.push(`${data.pageOverflows.length} páginas com overflow`);
  results.push({ name, width, height, failures, ...data });
}

console.log(JSON.stringify(results, null, 2));
const failed = results.filter(result => result.failures.length);

socket.close();
chrome.kill();
server.close();

if (failed.length) {
  console.error(`Falha responsiva em ${failed.length}/${results.length} viewports.`);
  process.exitCode = 1;
} else {
  console.log(`Auditoria responsiva aprovada em ${results.length} viewports.`);
}
