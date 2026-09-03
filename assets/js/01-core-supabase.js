// ---- SUPABASE CLIENT ----
const APP_VERSION = '3.2.49';
const APP_VERSION_LABEL = '3.2.49-auth-rls-contexto';
function aplicarVersaoVisivelSistema() {
  const texto = `INDEX ${APP_VERSION}`;
  const badge = document.getElementById('appVersionBadge');
  if (badge) badge.textContent = texto;
  const loginBadge = document.getElementById('loginVersionProtecao');
  if (loginBadge) loginBadge.textContent = `VERSÃO DE PROTEÇÃO: ${APP_VERSION}`;
  try { document.documentElement.setAttribute('data-app-version', APP_VERSION); } catch (_) {}
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', aplicarVersaoVisivelSistema);
} else {
  aplicarVersaoVisivelSistema();
}
// Configurações carregadas do config.js (separado do código principal)
const SUPABASE_URL = (window.APP_CONFIG || {}).supabaseUrl || '';
const SUPABASE_ANON_KEY = (window.APP_CONFIG || {}).supabaseAnonKey || '';
const EMAIL_FUNCTION_NAME = (window.APP_CONFIG || {}).emailFunctionName || 'notificar-alertas-email';
const AUTH_EMAIL_FUNCTION_NAME = (window.APP_CONFIG || {}).authEmailFunctionName || 'autenticacao-email';
const AUTH_REDIRECT_URL = (window.APP_CONFIG || {}).authRedirectUrl || 'https://checkdiario.com.br/';

window.__tenantContextVersion = Number(window.__tenantContextVersion || 0);
window.__tenantScopedResetHandlers = window.__tenantScopedResetHandlers || new Set();
window.__tenantScopedModules = window.__tenantScopedModules || new Map();
function capturarContextoTenant() {
  const sessao = (typeof usuarioSistemaLogado !== 'undefined' && usuarioSistemaLogado) || window.usuarioSistemaLogado || {};
  return Object.freeze({ version:Number(window.__tenantContextVersion || 0), empresaId:String(sessao.empresa_id || '').trim(), lojaId:String(sessao.loja_id || '').trim() });
}
function contextoTenantAindaValido(contexto) {
  if (!contexto) return false;
  const atual = capturarContextoTenant();
  return contexto.version === atual.version && contexto.empresaId === atual.empresaId && contexto.lojaId === atual.lojaId;
}
function registrarModuloTenantScoped(nome, reset) {
  if (!nome || typeof reset !== 'function') throw new Error('Módulo tenant-scoped precisa registrar uma rotina de limpeza.');
  const anterior = window.__tenantScopedModules.get(nome);
  if (anterior) window.__tenantScopedResetHandlers.delete(anterior);
  window.__tenantScopedModules.set(nome, reset);
  window.__tenantScopedResetHandlers.add(reset);
  return () => { window.__tenantScopedModules.delete(nome); window.__tenantScopedResetHandlers.delete(reset); };
}
function registrarResetTenantUI(handler) {
  if (typeof handler === 'function') window.__tenantScopedResetHandlers.add(handler);
  return () => window.__tenantScopedResetHandlers.delete(handler);
}
function resetTenantScopedUI(motivo = 'tenant-change') {
  window.__tenantContextVersion += 1;
  for (const handler of [...window.__tenantScopedResetHandlers]) {
    try { handler({ motivo, version:window.__tenantContextVersion }); } catch (error) { console.warn('Falha ao limpar estado do tenant:', error); }
  }
  try { window.dispatchEvent(new CustomEvent('tenant:reset', { detail:{ motivo,version:window.__tenantContextVersion } })); } catch (_) {}
  document.querySelectorAll('[data-tenant-result]').forEach(el => {
    el.replaceChildren();
    el.setAttribute('data-tenant-invalidated', 'true');
  });
}

const fetchComContextoSeguro = async (input, init = {}) => {
  const sessao = (typeof usuarioSistemaLogado !== 'undefined' && usuarioSistemaLogado) || window.usuarioSistemaLogado || {};
  const headers = new Headers(init.headers || {});
  const funcionarioId = String(sessao.id || window.__authPrincipalId || '').trim();
  const lojaId = String(sessao.loja_id || window.__authLojaId || '').trim();
  const tokenOperacional = String(sessao.operational_access_token || window.__authOperationalToken || '').trim();
  const tokenGlobal = String(sessao.global_admin_token || window.__authGlobalToken || '').trim();
  if (funcionarioId) headers.set('x-funcionario-id', funcionarioId);
  if (lojaId) headers.set('x-loja-id', lojaId);
  if (tokenOperacional) headers.set('x-operational-token', tokenOperacional);
  if (tokenGlobal) headers.set('x-global-admin-token', tokenGlobal);
  return fetch(input, { ...init, headers });
};
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { fetch: fetchComContextoSeguro } });
window.sb = sb; // compatibilidade para módulos seguros de agenda
const AGENDA_TABLE = 'agenda';
window.AGENDA_TABLE = AGENDA_TABLE;


// Controle de consumo: evita uma consulta ao Supabase a cada tecla digitada em filtros.
const __consumoDebounceTimers = {};
function debounceConsumo(chave, callback, atraso = 650) {
  try {
    if (__consumoDebounceTimers[chave]) {
      clearTimeout(__consumoDebounceTimers[chave]);
    }
    __consumoDebounceTimers[chave] = setTimeout(() => {
      delete __consumoDebounceTimers[chave];
      try {
        callback();
      } catch (erro) {
        console.warn('Falha ao executar ação com debounce:', chave, erro);
      }
    }, atraso);
  } catch (erro) {
    console.warn('Falha no debounce de consumo:', chave, erro);
  }
}

// Sobrescreve sb.from para injetar filtro empresa_id automaticamente.
// PADRÃO SAAS: empresa_id é o campo oficial de isolamento.
// Importante: admin master continua sem filtro para conseguir gerenciar todas as empresas.
const TABELAS_COM_EMPRESA_ID = new Set([
  'funcionarios',
  'checklists',
  'checklist_lancamentos',
  'checklist_execucoes',
  'ponto_registros',
  'ponto_intervalos',
  'ponto_ajustes_solicitacoes',
  'alertas_rapidos',
  'tarefas',
  'usuarios_admin',
  'filiais',
  'lojas',
  'fornecedores',
  'formas_pagamento',
  'contasapagar',
  'contas_financeiras',
  'contas_financeiras_movimentacoes',
  'contas_financeiras_ajustes_saldo',
  'recebiveis','recebiveis_futuros','agenda','escala_plantoes',
  'fatura_categoria_memoria','fatura_importacoes_log','raffinato_integracoes',
  'categorias_compra','grupos_fornecedor','perfis','google_business_conexoes','google_business_locais','google_avaliacoes','google_avaliacoes_metricas_diarias','google_sincronizacoes_logs'
]);

const TABELAS_COM_LOJA_ID = new Set([
  'tarefas','checklists','checklist_execucoes','checklist_lancamentos','ponto_registros','funcionarios','usuarios','email_notificacoes','financeiro_titulos','financeiro_baixas','fornecedores','formas_pagamento','contasapagar','contas_financeiras','contas_financeiras_movimentacoes','contas_financeiras_ajustes_saldo','recebiveis','recebiveis_futuros','agenda','escala_plantoes','fatura_categoria_memoria','fatura_importacoes_log','raffinato_integracoes','categorias_compra','grupos_fornecedor','perfis','google_business_conexoes','google_business_locais','google_avaliacoes','google_avaliacoes_metricas_diarias','google_sincronizacoes_logs'
]);

let filtroLojaSuspensoTemporariamente = false;
let filtroEmpresaSuspensoTemporariamente = false;

function obterModoContexto() {
  const modo = String(usuarioSistemaLogado?.context_mode || '').trim();
  if (modo === 'global_admin' || modo === 'store') return modo;
  return usuarioSistemaLogado?.tipo === 'admin' && !String(usuarioSistemaLogado?.loja_id || '').trim()
    ? 'global_admin' : 'store';
}

function contextoEhAdminGlobal() {
  return obterModoContexto() === 'global_admin';
}

function obterEmpresaIdSessao() {
  if (filtroEmpresaSuspensoTemporariamente) return null;
  if (contextoEhAdminGlobal()) return null;
  const s = typeof usuarioSistemaLogado !== 'undefined' ? usuarioSistemaLogado : null;
  if (!s) return null;
  return s.empresa_id || null;
}

function obterLojaIdSessao() {
  if (filtroLojaSuspensoTemporariamente) return null;
  if (contextoEhAdminGlobal()) return null;
  const s = typeof usuarioSistemaLogado !== 'undefined' ? usuarioSistemaLogado : null;
  if (!s) return null;
  return s.loja_id || null;
}

function aplicarFiltroLojaFuncionariosQuery(query) {
  // Corrige vazamento multi-loja na listagem/seleção de funcionários.
  // empresa_id já é aplicado automaticamente; aqui restringimos também pela loja logada.
  try {
    const lojaId = String(obterLojaIdSessao?.() || usuarioSistemaLogado?.loja_id || '').trim();
    if (lojaId && query && typeof query.eq === 'function') {
      return query.eq('loja_id', lojaId);
    }
  } catch (e) {
    console.warn('Filtro de loja dos funcionários não aplicado:', e);
  }
  return query;
}

// Loja atualmente em uso (logada ou trocada pelo admin no topo).
function obterLojaAtualParaIsolamento() {
  try {
    if (filtroLojaSuspensoTemporariamente) return '';
    if (contextoEhAdminGlobal()) return '';
    const direta = String(
      (typeof obterLojaIdSessao === 'function' ? obterLojaIdSessao() : '')
      || usuarioSistemaLogado?.loja_id
      || (typeof window !== 'undefined' ? window.lojaAtualId : '')
      || ''
    ).trim();
    if (direta) return direta;

    const normalizar = (valor) => String(valor || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
    const nomeTopo = normalizar(document.getElementById('topbar-store-name')?.textContent || '');
    const lojasPermitidas = Array.isArray(usuarioSistemaLogado?.lojas_permitidas)
      ? usuarioSistemaLogado.lojas_permitidas
      : [];
    if (nomeTopo && nomeTopo !== '-' && nomeTopo !== 'PAINEL ADMINISTRATIVO') {
      const lojaTopo = lojasPermitidas.find(loja => {
        const id = String(loja?.id || loja?.loja_id || '').trim();
        const nome = normalizar(loja?.nome || loja?.loja_nome || loja?.codigo || '');
        return id && nome && nome === nomeTopo;
      });
      if (lojaTopo) return String(lojaTopo.id || lojaTopo.loja_id || '').trim();
    }
    if (lojasPermitidas.length === 1) {
      return String(lojasPermitidas[0]?.id || lojasPermitidas[0]?.loja_id || '').trim();
    }
  } catch (e) {
    return '';
  }
  return '';
}

// Aplica .eq('loja_id', lojaAtual) em qualquer query que tenha coluna loja_id.
// Usado para isolar checklists/lançamentos por loja e evitar vazamento entre lojas.
function aplicarFiltroLojaGenericoQuery(query) {
  try {
    const lojaId = obterLojaAtualParaIsolamento();
    if (lojaId && query && typeof query.eq === 'function') {
      return query.eq('loja_id', lojaId);
    }
  } catch (e) {
    console.warn('Filtro de loja genérico não aplicado:', e);
  }
  return query;
}

async function executarSemFiltroLojaTemporario(callback) {
  const estadoAnterior = filtroLojaSuspensoTemporariamente;
  filtroLojaSuspensoTemporariamente = true;
  try {
    return await callback();
  } finally {
    filtroLojaSuspensoTemporariamente = estadoAnterior;
  }
}

async function executarSemFiltrosTenantTemporario(callback) {
  const estadoLojaAnterior = filtroLojaSuspensoTemporariamente;
  const estadoEmpresaAnterior = filtroEmpresaSuspensoTemporariamente;
  filtroLojaSuspensoTemporariamente = true;
  filtroEmpresaSuspensoTemporariamente = true;
  try {
    return await callback();
  } finally {
    filtroLojaSuspensoTemporariamente = estadoLojaAnterior;
    filtroEmpresaSuspensoTemporariamente = estadoEmpresaAnterior;
  }
}

async function aplicarEmpresaRLS() {
  // Esta chamada só funciona se existir uma RPC própria no Supabase.
  // O index não depende dela para filtrar: o filtro por empresa_id já é aplicado no sb.from abaixo.
  try {
    const empresaId = obterEmpresaIdSessao();
    if (!empresaId || typeof sb?.rpc !== 'function') return;
    await sb.rpc('set_app_empresa_id', { p_empresa_id: empresaId });
  } catch (erro) {
    console.warn('RLS por RPC não aplicado; seguindo com filtro frontend por empresa_id:', erro);
  }
}

(function() {
  const _from = sb.from.bind(sb);
  sb.from = function(tabela) {
    const builder = _from(tabela);
    const empresaId = obterEmpresaIdSessao();
    const lojaId = obterLojaIdSessao() || obterLojaAtualParaIsolamento();

    const aplicaEmpresa = !!empresaId && TABELAS_COM_EMPRESA_ID.has(tabela);
    const aplicaLoja = !!lojaId && TABELAS_COM_LOJA_ID.has(tabela);
    if (!aplicaEmpresa && !aplicaLoja) return builder;

    ['select', 'update', 'delete'].forEach(metodo => {
      if (typeof builder[metodo] !== 'function') return;
      const _orig = builder[metodo].bind(builder);
      builder[metodo] = function(...args) {
        let result = _orig(...args);
        if (result && typeof result.eq === 'function') {
          if (aplicaEmpresa) {
            result = result.eq('empresa_id', empresaId);
          }
          if (aplicaLoja) {
            result = result.eq('loja_id', lojaId);
          }
        }
        return result;
      };
    });

    if (typeof builder.insert === 'function') {
      const _origInsert = builder.insert.bind(builder);
      builder.insert = function(valores, opts) {
        const enriquecerTenant = (v) => ({
          ...v,
          ...(aplicaEmpresa ? { empresa_id: v?.empresa_id || empresaId } : {}),
          ...(aplicaLoja ? { loja_id: v?.loja_id || lojaId } : {}),
        });
        const comTenant = Array.isArray(valores)
          ? valores.map(enriquecerTenant)
          : enriquecerTenant(valores || {});
        return _origInsert(comTenant, opts);
      };
    }

    if (typeof builder.upsert === 'function') {
      const _origUpsert = builder.upsert.bind(builder);
      builder.upsert = function(valores, opts) {
        const enriquecerTenant = (v) => ({
          ...v,
          ...(aplicaEmpresa ? { empresa_id: v?.empresa_id || empresaId } : {}),
          ...(aplicaLoja ? { loja_id: v?.loja_id || lojaId } : {}),
        });
        const comTenant = Array.isArray(valores)
          ? valores.map(enriquecerTenant)
          : enriquecerTenant(valores || {});
        return _origUpsert(comTenant, opts);
      };
    }

    return builder;
  };
})();

let confirmacaoSistemaResolver = null;
let confirmacaoSistemaOpcaoAtual = null;

function abrirConfirmacaoSistema(opcoes = {}) {
  const overlay = document.getElementById('confirmacaoSistemaOverlay');
  if (!overlay) {
    console.error('Modal visual de confirmação não encontrado; ação cancelada para impedir diálogo nativo do navegador.');
    return Promise.resolve({ confirmado: false, acao: 'cancelar', valor: '' });
  }

  const title = document.getElementById('confirmacaoSistemaTitle');
  const subtitle = document.getElementById('confirmacaoSistemaSubtitle');
  const body = document.getElementById('confirmacaoSistemaBody');
  const inputWrap = document.getElementById('confirmacaoSistemaInputWrap');
  const inputLabel = document.getElementById('confirmacaoSistemaInputLabel');
  const input = document.getElementById('confirmacaoSistemaInput');
  const msg = document.getElementById('confirmacaoSistemaMsg');
  const btnCancelar = document.getElementById('confirmacaoSistemaCancelar');
  const btnNeutro = document.getElementById('confirmacaoSistemaNeutro');
  const btnConfirmar = document.getElementById('confirmacaoSistemaConfirmar');
  let btnExtra = document.getElementById('confirmacaoSistemaExtra');
  if (!btnExtra && btnConfirmar?.parentElement) {
    btnExtra = document.createElement('button');
    btnExtra.type = 'button';
    btnExtra.id = 'confirmacaoSistemaExtra';
    btnExtra.onclick = () => resolverConfirmacaoSistema('extra');
    btnConfirmar.parentElement.insertBefore(btnExtra, btnConfirmar);
  }

  confirmacaoSistemaOpcaoAtual = {
    exigeTexto: Boolean(opcoes.exigeTexto),
  };

  if (title) title.textContent = opcoes.title || 'Confirmar ação';
  if (subtitle) subtitle.textContent = opcoes.subtitle || '';
  if (body) body.innerHTML = opcoes.body || '';
  if (msg) msg.textContent = '';
  if (btnCancelar) {
    btnCancelar.textContent = opcoes.cancelText || 'Cancelar';
    btnCancelar.className = `btn ${opcoes.cancelClass || 'btn-ghost'}`;
  }
  if (btnNeutro) {
    btnNeutro.textContent = opcoes.neutralText || 'Não';
    btnNeutro.className = `btn ${opcoes.neutralClass || 'btn-amber'}`;
    btnNeutro.style.display = opcoes.neutralText ? '' : 'none';
  }
  if (btnConfirmar) {
    btnConfirmar.textContent = opcoes.confirmText || 'Confirmar';
    btnConfirmar.className = `btn ${opcoes.confirmClass || 'btn-green'}`;
  }
  if (btnExtra) {
    btnExtra.textContent = opcoes.extraText || '';
    btnExtra.className = `btn ${opcoes.extraClass || 'btn-amber'}`;
    btnExtra.style.display = opcoes.extraText ? '' : 'none';
  }
  if (inputWrap) inputWrap.style.display = opcoes.input ? 'flex' : 'none';
  if (inputLabel) inputLabel.textContent = opcoes.inputLabel || 'Motivo';
  if (input) {
    input.value = '';
    input.placeholder = opcoes.inputPlaceholder || 'Descreva o motivo';
  }

  overlay.classList.add('show');
  overlay.style.display = 'flex';
  overlay.style.zIndex = '100001';

  setTimeout(() => {
    if (opcoes.input && input) input.focus();
    else if (btnConfirmar) btnConfirmar.focus();
  }, 50);

  return new Promise((resolve) => {
    confirmacaoSistemaResolver = resolve;
  });
}

function resolverConfirmacaoSistema(confirmado) {
  const overlay = document.getElementById('confirmacaoSistemaOverlay');
  const input = document.getElementById('confirmacaoSistemaInput');
  const msg = document.getElementById('confirmacaoSistemaMsg');
  const valor = input ? input.value.trim() : '';

  if (confirmado === true && confirmacaoSistemaOpcaoAtual?.exigeTexto && !valor) {
    if (msg) msg.textContent = 'Informe o motivo antes de confirmar.';
    if (input) input.focus();
    return;
  }

  if (overlay) {
    overlay.classList.remove('show');
    overlay.style.display = 'none';
  }

  const resolver = confirmacaoSistemaResolver;
  confirmacaoSistemaResolver = null;
  confirmacaoSistemaOpcaoAtual = null;
  const acao = confirmado === true ? 'confirmar' : confirmado === 'neutro' ? 'neutro' : confirmado === 'extra' ? 'extra' : 'cancelar';
  if (resolver) resolver({ confirmado: confirmado === true, acao, valor });
}
