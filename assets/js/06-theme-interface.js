const CHECKDIARIO_THEME_KEY = 'checkdiario-theme';
const CHECKDIARIO_THEMES = new Set(['light', 'dark', 'system']);

function temaEfetivoCheckDiario(preferencia) {
  return preferencia === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : preferencia;
}

function aplicarTemaInterface(preferencia, persistir = true) {
  const escolha = CHECKDIARIO_THEMES.has(preferencia) ? preferencia : 'system';
  const efetivo = temaEfetivoCheckDiario(escolha);
  document.documentElement.dataset.themePreference = escolha;
  document.documentElement.dataset.theme = efetivo;
  document.documentElement.style.colorScheme = efetivo;
  if (persistir) localStorage.setItem(CHECKDIARIO_THEME_KEY, escolha);
  const seletor = document.getElementById('themeSelector');
  if (seletor) seletor.value = escolha;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = efetivo === 'dark' ? '#0B1220' : '#F8FAFC';
  window.dispatchEvent(new CustomEvent('checkdiario:themechange', { detail: { preference: escolha, theme: efetivo } }));
}

function definirTemaInterface(preferencia) { aplicarTemaInterface(preferencia, true); }
async function carregarTemaInterface() { aplicarTemaInterface(localStorage.getItem(CHECKDIARIO_THEME_KEY) || 'system', false); }

const temaSistemaMedia = window.matchMedia('(prefers-color-scheme: dark)');
temaSistemaMedia.addEventListener?.('change', () => {
  if ((localStorage.getItem(CHECKDIARIO_THEME_KEY) || 'system') === 'system') aplicarTemaInterface('system', false);
});
document.addEventListener('DOMContentLoaded', carregarTemaInterface, { once: true });
