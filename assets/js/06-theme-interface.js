const CHECKDIARIO_THEME_LEGACY_KEY = 'checkdiario-theme';
const CHECKDIARIO_THEME_BOOTSTRAP_KEY = 'checkdiario-theme-bootstrap';
const CHECKDIARIO_THEMES = new Set(['light', 'dark', 'system']);
let minhaContaAvatarUrl = '';
let avatarCropper = null;
let avatarCropArquivoUrl = '';
let avatarCropZoomBase = 1;

function temaEfetivoCheckDiario(preferencia) {
  return preferencia === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : preferencia;
}

function identidadePreferenciasVisuais() {
  const usuario = window.usuarioSistemaLogado || null;
  if (!usuario) return null;
  const usuarioId = usuario.id
    ? `usuario-${usuario.id}`
    : `admin-${usuario.username || usuario.email || 'principal'}`;
  const lojaId = String((typeof obterLojaIdSessao === 'function' && obterLojaIdSessao()) || usuario.loja_id || 'global');
  return { usuarioId, lojaId };
}

function chaveTemaPreferenciasVisuais() {
  const identidade = identidadePreferenciasVisuais();
  return identidade
    ? `checkdiario.preferences.${encodeURIComponent(identidade.usuarioId)}.${encodeURIComponent(identidade.lojaId)}.theme`
    : null;
}

function obterPreferenciaTemaAtual() {
  const chave = chaveTemaPreferenciasVisuais();
  if (chave) return localStorage.getItem(chave) || 'system';
  return localStorage.getItem(CHECKDIARIO_THEME_BOOTSTRAP_KEY)
    || localStorage.getItem(CHECKDIARIO_THEME_LEGACY_KEY)
    || 'system';
}

function atualizarControlesTema(escolha) {
  const seletor = document.getElementById('themeSelector');
  if (seletor) seletor.value = escolha;
  document.querySelectorAll('[data-account-theme]').forEach((botao) => {
    const ativo = botao.dataset.accountTheme === escolha;
    botao.classList.toggle('is-active', ativo);
    botao.setAttribute('aria-checked', String(ativo));
  });
}

function aplicarTemaInterface(preferencia, persistir = true) {
  const escolha = CHECKDIARIO_THEMES.has(preferencia) ? preferencia : 'system';
  const efetivo = temaEfetivoCheckDiario(escolha);
  document.documentElement.dataset.themePreference = escolha;
  document.documentElement.dataset.theme = efetivo;
  document.documentElement.style.colorScheme = efetivo;
  if (persistir) {
    const chave = chaveTemaPreferenciasVisuais();
    if (chave) localStorage.setItem(chave, escolha);
    localStorage.setItem(CHECKDIARIO_THEME_BOOTSTRAP_KEY, escolha);
  }
  atualizarControlesTema(escolha);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = efetivo === 'dark' ? '#0B1220' : '#F8FAFC';
  window.dispatchEvent(new CustomEvent('checkdiario:themechange', { detail: { preference: escolha, theme: efetivo } }));
}

function definirTemaInterface(preferencia) { aplicarTemaInterface(preferencia, true); }
async function carregarTemaInterface() { aplicarTemaInterface(obterPreferenciaTemaAtual(), false); atualizarMinhaContaInterface(); }

function nomeUsuarioMinhaConta() {
  const usuario = window.usuarioSistemaLogado || {};
  return String(usuario.nome || usuario.username || usuario.email || 'Usuário').trim();
}

function iniciaisUsuarioMinhaConta() {
  const partes = nomeUsuarioMinhaConta().split(/\s+/).filter(Boolean);
  return ((partes[0]?.[0] || 'U') + (partes.length > 1 ? partes.at(-1)[0] : '')).toUpperCase();
}

function aplicarAvatarMinhaConta() {
  const iniciais = iniciaisUsuarioMinhaConta();
  document.querySelectorAll('#topbarAccountAvatar,#minhaContaAvatar').forEach((avatar) => {
    avatar.textContent = minhaContaAvatarUrl ? '' : iniciais;
    avatar.style.backgroundImage = minhaContaAvatarUrl ? `url("${minhaContaAvatarUrl}")` : '';
  });
  const escolher = document.getElementById('minhaContaEscolherFoto');
  const remover = document.getElementById('minhaContaRemoverFoto');
  if (escolher) escolher.textContent = minhaContaAvatarUrl ? 'Trocar foto' : 'Escolher foto';
  if (remover) remover.hidden = !minhaContaAvatarUrl;
}

function nomeEmpresaMinhaConta(usuario = {}) {
  const empresaDireta = usuario.empresa_nome
    || usuario.nome_empresa
    || usuario.empresa?.nome
    || (typeof usuario.empresa === 'string' ? usuario.empresa : '');
  if (String(empresaDireta || '').trim()) return String(empresaDireta).trim();

  const empresaId = String(usuario.empresa_id || '').trim();
  const lojaAtual = (usuario.lojas_permitidas || []).find((loja) =>
    String(loja?.id || loja?.loja_id || '') === String(usuario.loja_id || '')
  );
  const empresaDaLoja = lojaAtual?.empresa_nome || lojaAtual?.nome_empresa
    || lojaAtual?.empresas?.nome || lojaAtual?.empresa?.nome;
  if (String(empresaDaLoja || '').trim()) return String(empresaDaLoja).trim();

  const cachesConhecidos = [
    typeof empresasSaasCache !== 'undefined' ? empresasSaasCache : [],
    typeof _empresasCacheVinculos !== 'undefined' ? _empresasCacheVinculos : []
  ];
  for (const cache of cachesConhecidos) {
    const empresa = (cache || []).find((item) => String(item?.id || '') === empresaId);
    const nome = empresa?.nome || empresa?.nome_fantasia || empresa?.razao_social;
    if (String(nome || '').trim()) return String(nome).trim();
  }

  const opcaoEmpresa = [...document.querySelectorAll('select option')].find((opcao) =>
    String(opcao.value || '') === empresaId && String(opcao.textContent || '').trim()
  );
  return String(opcaoEmpresa?.textContent || 'Empresa não identificada').trim();
}

function atualizarMinhaContaInterface() {
  const usuario = window.usuarioSistemaLogado || {};
  const nome = nomeUsuarioMinhaConta();
  const nomeEl = document.getElementById('minhaContaNome');
  const empresaEl = document.getElementById('minhaContaEmpresa');
  const lojaEl = document.getElementById('minhaContaLoja');
  if (nomeEl) nomeEl.textContent = nome;
  if (empresaEl) empresaEl.textContent = nomeEmpresaMinhaConta(usuario);
  if (lojaEl) lojaEl.textContent = String(usuario.loja_nome || usuario.nome_loja || document.getElementById('topbar-store-name')?.textContent || '-');
  aplicarAvatarMinhaConta();
  atualizarControlesTema(document.documentElement.dataset.themePreference || 'system');
}

function toggleMenuMinhaConta(event) {
  event?.stopPropagation();
  const menu = document.getElementById('accountMenu');
  const trigger = document.querySelector('.account-menu-trigger');
  if (!menu) return;
  menu.hidden = !menu.hidden;
  trigger?.setAttribute('aria-expanded', String(!menu.hidden));
}

function abrirMinhaConta(secao = 'conta') {
  const menu = document.getElementById('accountMenu');
  if (menu) menu.hidden = true;
  atualizarMinhaContaInterface();
  const overlay = document.getElementById('minhaContaOverlay');
  if (!overlay) return;
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
  const alvo = document.getElementById(secao === 'aparencia' ? 'minhaContaSecaoAparencia' : 'minhaContaSecaoConta');
  setTimeout(() => alvo?.scrollIntoView({ block: 'nearest' }), 0);
}

function fecharMinhaConta() {
  const overlay = document.getElementById('minhaContaOverlay');
  overlay?.classList.remove('open');
  overlay?.setAttribute('aria-hidden', 'true');
}

function previsualizarAvatarMinhaConta(input) {
  const arquivo = input?.files?.[0];
  if (!arquivo) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(arquivo.type) || arquivo.size > 10 * 1024 * 1024) {
    input.value = '';
    if (typeof alert === 'function') alert('Escolha uma imagem JPG, PNG ou WEBP de até 10 MB.');
    return;
  }
  if (typeof Cropper !== 'function') {
    input.value = '';
    if (typeof alert === 'function') alert('O editor de foto não pôde ser carregado. Verifique sua conexão e tente novamente.');
    return;
  }
  destruirEditorRecorteAvatar();
  avatarCropArquivoUrl = URL.createObjectURL(arquivo);
  const imagem = document.getElementById('avatarCropImage');
  const overlay = document.getElementById('avatarCropOverlay');
  if (!imagem || !overlay) {
    destruirEditorRecorteAvatar();
    input.value = '';
    return;
  }
  imagem.src = avatarCropArquivoUrl;
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.classList.add('avatar-crop-open');
  requestAnimationFrame(() => {
    avatarCropper = new Cropper(imagem, {
      aspectRatio: 1,
      viewMode: 1,
      dragMode: 'move',
      autoCropArea: 1,
      background: false,
      guides: false,
      center: true,
      highlight: false,
      cropBoxMovable: false,
      cropBoxResizable: false,
      toggleDragModeOnDblclick: false,
      responsive: true,
      restore: false,
      zoomOnWheel: true,
      wheelZoomRatio: 0.08,
      ready() {
        avatarCropZoomBase = avatarCropper.getImageData().ratio || 1;
        const zoom = document.getElementById('avatarCropZoom');
        if (zoom) zoom.value = '0';
      },
      zoom(event) {
        if (!avatarCropper || !avatarCropZoomBase) return;
        const valor = Math.max(0, Math.min(100, ((event.detail.ratio / avatarCropZoomBase) - 1) * 25));
        const zoom = document.getElementById('avatarCropZoom');
        if (zoom) zoom.value = String(Math.round(valor));
      }
    });
  });
}

function destruirEditorRecorteAvatar() {
  avatarCropper?.destroy();
  avatarCropper = null;
  if (avatarCropArquivoUrl) URL.revokeObjectURL(avatarCropArquivoUrl);
  avatarCropArquivoUrl = '';
}

function fecharEditorRecorteAvatar() {
  const overlay = document.getElementById('avatarCropOverlay');
  overlay?.classList.remove('open');
  overlay?.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('avatar-crop-open');
}

function cancelarRecorteAvatar() {
  fecharEditorRecorteAvatar();
  destruirEditorRecorteAvatar();
  const input = document.getElementById('minhaContaFotoInput');
  if (input) input.value = '';
}

function definirZoomAvatar(valor) {
  if (!avatarCropper) return;
  const nivel = Math.max(0, Math.min(100, Number(valor) || 0));
  avatarCropper.zoomTo(avatarCropZoomBase * (1 + nivel / 25));
}

function alterarZoomAvatar(delta) {
  const controle = document.getElementById('avatarCropZoom');
  if (!controle) return;
  controle.value = String(Math.max(0, Math.min(100, Number(controle.value) + delta)));
  definirZoomAvatar(controle.value);
}

function centralizarRecorteAvatar() {
  if (!avatarCropper) return;
  avatarCropper.reset();
  avatarCropZoomBase = avatarCropper.getImageData().ratio || 1;
  const zoom = document.getElementById('avatarCropZoom');
  if (zoom) zoom.value = '0';
}

function aplicarRecorteAvatar() {
  if (!avatarCropper) return;
  const recorte = avatarCropper.getCroppedCanvas({
    width: 512,
    height: 512,
    minWidth: 512,
    minHeight: 512,
    maxWidth: 512,
    maxHeight: 512,
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high'
  });
  if (!recorte) return;
  const avatar = document.createElement('canvas');
  avatar.width = 512;
  avatar.height = 512;
  const contexto = avatar.getContext('2d');
  contexto.imageSmoothingEnabled = true;
  contexto.imageSmoothingQuality = 'high';
  contexto.beginPath();
  contexto.arc(256, 256, 256, 0, Math.PI * 2);
  contexto.clip();
  contexto.drawImage(recorte, 0, 0, 512, 512);
  minhaContaAvatarUrl = avatar.toDataURL('image/png');
  aplicarAvatarMinhaConta();
  fecharEditorRecorteAvatar();
  destruirEditorRecorteAvatar();
  const input = document.getElementById('minhaContaFotoInput');
  if (input) input.value = '';
}

function removerAvatarMinhaConta() {
  minhaContaAvatarUrl = '';
  const input = document.getElementById('minhaContaFotoInput');
  if (input) input.value = '';
  aplicarAvatarMinhaConta();
}

const temaSistemaMedia = window.matchMedia('(prefers-color-scheme: dark)');
temaSistemaMedia.addEventListener?.('change', () => {
  if (obterPreferenciaTemaAtual() === 'system') aplicarTemaInterface('system', false);
});
document.addEventListener('click', (event) => {
  if (!event.target.closest('.account-menu-wrap')) {
    const menu = document.getElementById('accountMenu');
    if (menu) menu.hidden = true;
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (document.getElementById('avatarCropOverlay')?.classList.contains('open')) cancelarRecorteAvatar();
  else fecharMinhaConta();
});
document.addEventListener('DOMContentLoaded', carregarTemaInterface, { once: true });
