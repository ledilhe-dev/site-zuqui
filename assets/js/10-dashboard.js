// DASHBOARD
// 

// ══════════════════════════════════════════════════════════════════
// MEU PAINEL — DASHBOARD PERSONALIZADO
// ══════════════════════════════════════════════════════════════════
const MEU_PAINEL_WIDGETS_DISPONIVEIS = [
  // ── Indicadores financeiros ──────────────────────────────────────
  { id: 'saldo_cofre',        tipo: 'indicador', ico: '🏦', label: 'Saldo do cofre',             grupo: 'financeiro' },
  { id: 'falta_quitar',       tipo: 'indicador', ico: '⚠️', label: 'Falta para quitar',           grupo: 'financeiro' },
  { id: 'recebiveis_futuros', tipo: 'indicador', ico: '📅', label: 'Recebíveis futuros',          grupo: 'financeiro' },
  { id: 'contas_vencer_7',    tipo: 'indicador', ico: '🔴', label: 'Contas a vencer 7 dias',      grupo: 'financeiro' },
  { id: 'contas_vencer_30',   tipo: 'indicador', ico: '🟡', label: 'Contas a vencer 30 dias',     grupo: 'financeiro' },
  { id: 'total_recebido_mes', tipo: 'indicador', ico: '💚', label: 'Recebido no mês',             grupo: 'financeiro' },
  // ── Atalhos — Financeiro ─────────────────────────────────────────
  { id: 'atalho_cofre',               tipo: 'atalho', ico: '🏦', label: 'Cofre',                          grupo: 'fin', pagina: 'financeiro_cofre' },
  { id: 'atalho_rel_contas_pagar',    tipo: 'atalho', ico: '📊', label: 'Relatório contas a pagar',       grupo: 'fin', pagina: 'relatorio_financeiro' },
  { id: 'atalho_cad_contas_pagar',    tipo: 'atalho', ico: '➕', label: 'Cadastro contas a pagar',        grupo: 'fin', pagina: 'financeiro_contasapagar' },
  { id: 'atalho_baixar_contas',       tipo: 'atalho', ico: '✅', label: 'Baixar contas',                  grupo: 'fin', pagina: 'financeiro_baixar_contas' },
  { id: 'atalho_rel_recebimentos',    tipo: 'atalho', ico: '📊', label: 'Relatório recebimentos',         grupo: 'fin', pagina: 'relatorio_recebimentos' },
  { id: 'atalho_cad_recebiveis',      tipo: 'atalho', ico: '💰', label: 'Cadastro recebíveis',            grupo: 'fin', pagina: 'financeiro_recebiveis' },
  { id: 'atalho_rec_futuros',         tipo: 'atalho', ico: '📅', label: 'Recebimentos futuros',           grupo: 'fin', pagina: 'financeiro_recebiveis' },
  { id: 'atalho_conta_financeira',    tipo: 'atalho', ico: '🏧', label: 'Conta financeira',               grupo: 'fin', pagina: 'financeiro_conta_financeira' },
  { id: 'atalho_fornecedores',        tipo: 'atalho', ico: '🏪', label: 'Cadastro fornecedores',          grupo: 'fin', pagina: 'financeiro_fornecedores' },
  { id: 'atalho_grupos_forn',         tipo: 'atalho', ico: '🏢', label: 'Grupos de fornecedor',           grupo: 'fin', pagina: 'financeiro_grupo_fornecedor' },
  { id: 'atalho_categorias',          tipo: 'atalho', ico: '🏷️', label: 'Categorias de compra',           grupo: 'fin', pagina: 'financeiro_categorias_compra' },
  { id: 'atalho_formas_pagamento',    tipo: 'atalho', ico: '💳', label: 'Formas de pagamento',            grupo: 'fin', pagina: 'financeiro_formas_pagamento' },
  { id: 'atalho_rel_ajuste_saldo',    tipo: 'atalho', ico: '📊', label: 'Relatório ajuste de saldo',      grupo: 'fin', pagina: 'relatorio_ajuste_saldo' },
  // ── Atalhos — Operação ───────────────────────────────────────────
  { id: 'atalho_ponto',               tipo: 'atalho', ico: '⏱️', label: 'Bater ponto',                    grupo: 'op', pagina: 'bater_ponto' },
  { id: 'atalho_rel_ponto',           tipo: 'atalho', ico: '📊', label: 'Relatório ponto',                grupo: 'op', pagina: 'relatorio_ponto' },
  { id: 'atalho_alertas',             tipo: 'atalho', ico: '⚡', label: 'Alertas rápidos',                grupo: 'op', pagina: 'tarefas_rapidas' },
  { id: 'atalho_checklist',           tipo: 'atalho', ico: '✅', label: 'Iniciar checklist',              grupo: 'op', pagina: 'checklists' },
  { id: 'atalho_cad_checklist',       tipo: 'atalho', ico: '📝', label: 'Cadastro checklist',             grupo: 'op', pagina: 'tarefas' },
  { id: 'atalho_escalas',             tipo: 'atalho', ico: '📆', label: 'Agenda',                         grupo: 'op', pagina: 'escala_plantoes' },
  { id: 'atalho_rel_escalas',         tipo: 'atalho', ico: '📊', label: 'Relatório escala/plantões',      grupo: 'op', pagina: 'relatorio_plantao' },
  { id: 'atalho_rel_tarefas',         tipo: 'atalho', ico: '📊', label: 'Relatório tarefas',              grupo: 'op', pagina: 'relatorio_lancamentos' },
  // ── Atalhos — Administração ──────────────────────────────────────
  { id: 'atalho_funcionarios',        tipo: 'atalho', ico: '👥', label: 'Cadastro funcionários',          grupo: 'adm', pagina: 'funcionarios' },
  { id: 'atalho_perfis',              tipo: 'atalho', ico: '🔐', label: 'Perfis de acesso',               grupo: 'adm', pagina: 'perfis' },
  { id: 'atalho_solicitacoes_ponto',  tipo: 'atalho', ico: '🕐', label: 'Solicitações ajuste ponto',      grupo: 'adm', pagina: 'ponto_ajustes' },
  { id: 'atalho_dashboard',           tipo: 'atalho', ico: '📊', label: 'Dashboard completo',             grupo: 'adm', pagina: 'dashboard' },
  { id: 'atalho_meu_painel',          tipo: 'atalho', ico: '🎛️', label: 'Meu Painel',                     grupo: 'adm', pagina: 'meu_painel' },
];

let _meuPainelConfig = []; // IDs dos widgets ativos

async function salvarPreferenciaMeuPainel(chave, valor) {
  try {
    const funcId = usuarioSistemaLogado?.id;
    const empresaId = usuarioSistemaLogado?.empresa_id || obterEmpresaIdSessao?.() || null;
    if (!funcId) return;
    await executarSemFiltroLojaTemporario(() =>
      sb.from('preferencias_usuario').upsert([{
        funcionario_id: funcId,
        empresa_id: empresaId,
        chave,
        valor: JSON.stringify(valor),
        atualizado_em: new Date().toISOString(),
      }], { onConflict: 'funcionario_id,chave' })
    );
  } catch(e) { console.warn('Erro ao salvar preferência:', e); }
}

async function carregarPreferenciaMeuPainel(chave, fallback = null) {
  try {
    const funcId = usuarioSistemaLogado?.id;
    if (!funcId) return fallback;
    const { data } = await executarSemFiltroLojaTemporario(() =>
      sb.from('preferencias_usuario').select('valor').eq('funcionario_id', funcId).eq('chave', chave).maybeSingle()
    );
    if (data?.valor) return JSON.parse(data.valor);
  } catch(e) {}
  return fallback;
}


// ══════════════════════════════════════════════════════════════════
// MENU LATERAL — ITENS ARRASTÁVEIS POR USUÁRIO
// ══════════════════════════════════════════════════════════════════
let _navItemDragSrc = null;

function navItemDragStart(e) {
  // Subir até o wrapper com data-nav-item-id
  const wrapper = e.currentTarget.closest('[data-nav-item-id]') || e.currentTarget;
  _navItemDragSrc = wrapper;
  setTimeout(() => wrapper.style.opacity = '0.35', 0);
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', wrapper.dataset.navItemId || '');
  e.stopPropagation();
}

function navItemDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  e.dataTransfer.dropEffect = 'move';
  const wrapper = e.currentTarget.closest('[data-nav-item-id]') || e.currentTarget;
  if (wrapper && wrapper !== _navItemDragSrc) {
    document.querySelectorAll('[data-nav-item-id]').forEach(el => el.style.outline = '');
    wrapper.style.outline = '2px solid var(--accent)';
    wrapper.style.outlineOffset = '-2px';
  }
}

function navItemDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  const wrapper = e.currentTarget.closest('[data-nav-item-id]') || e.currentTarget;
  document.querySelectorAll('[data-nav-item-id]').forEach(el => { el.style.outline = ''; el.style.opacity = ''; });
  if (!_navItemDragSrc || !wrapper || wrapper === _navItemDragSrc) return;
  const pai = wrapper.parentNode;
  // Determinar posição relativa
  const rect = wrapper.getBoundingClientRect();
  const meio = rect.top + rect.height / 2;
  if (e.clientY < meio) {
    pai.insertBefore(_navItemDragSrc, wrapper);
  } else {
    pai.insertBefore(_navItemDragSrc, wrapper.nextSibling);
  }
  atualizarGruposVaziosNav();
  salvarOrdemNavItens();
}

function navItemDragEnd(e) {
  document.querySelectorAll('[data-nav-item-id]').forEach(el => { el.style.outline = ''; el.style.opacity = ''; });
  _navItemDragSrc = null;
}

async function salvarOrdemNavItens() {
  const wrappers = [...document.querySelectorAll('#navContainer .nav-group > [data-nav-item-id]')];
  const ordem = wrappers.map(el => ({
    id: el.dataset.navItemId,
    grupo: el.parentElement?.id || 'navgrp_operacao'
  }));
  await salvarPreferenciaMeuPainel('nav_ordem_itens_v2', ordem);
}

async function carregarOrdemNavMenu() {
  try {
    let ordem = await carregarPreferenciaMeuPainel('nav_ordem_itens_v2', null);
    const mapa = {};
    document.querySelectorAll('#navContainer .nav-group > [data-nav-item-id]').forEach(el => {
      mapa[el.dataset.navItemId] = el;
    });
    if (Array.isArray(ordem) && ordem.length && typeof ordem[0] === 'object') {
      ordem.forEach(item => {
        const el = mapa[item.id];
        const grupo = document.getElementById(item.grupo);
        if (el && grupo?.classList.contains('nav-group')) grupo.appendChild(el);
      });
    } else {
      ordem = await carregarPreferenciaMeuPainel('nav_ordem_itens', null);
      const grupo = document.querySelector('#navContainer .nav-group.featured');
      if (Array.isArray(ordem) && grupo) ordem.forEach(id => mapa[id] && grupo.appendChild(mapa[id]));
    }
  } catch(e) { console.warn('Erro ao carregar ordem nav:', e); }
  inicializarControlesOrdemNav();
  atualizarGruposVaziosNav();
}

function atualizarGruposVaziosNav() {
  document.querySelectorAll('#navContainer .nav-group').forEach(grupo => {
    const temItem = !!grupo.querySelector(':scope > [data-nav-item-id]');
    grupo.style.display = temItem ? '' : 'none';
  });
}

function inicializarControlesOrdemNav() {
  document.querySelectorAll('#navContainer [data-nav-item-id]').forEach(item => {
    if (item.querySelector(':scope > .nav-order-handle')) return;
    const handle = document.createElement('span');
    handle.className = 'nav-order-handle';
    handle.textContent = '⠿';
    handle.title = 'Arraste para mover';
    handle.setAttribute('aria-label', 'Arraste para mover este item');
    handle.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); });
    handle.addEventListener('touchstart', e => {
      _navItemDragSrc = item;
      item.classList.add('nav-touch-moving');
      e.stopPropagation();
    }, { passive: true });
    handle.addEventListener('touchend', e => {
      const toque = e.changedTouches[0];
      const alvo = document.elementFromPoint(toque.clientX, toque.clientY)?.closest('[data-nav-item-id]');
      if (_navItemDragSrc && alvo && alvo !== _navItemDragSrc) {
        const rect = alvo.getBoundingClientRect();
        alvo.parentNode.insertBefore(_navItemDragSrc, toque.clientY < rect.top + rect.height / 2 ? alvo : alvo.nextSibling);
        atualizarGruposVaziosNav();
        salvarOrdemNavItens();
      }
      item.classList.remove('nav-touch-moving');
      _navItemDragSrc = null;
    });
    item.appendChild(handle);
  });
}
// ══════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════
// TEMAS PERSONALIZADOS
// ══════════════════════════════════════════════════════════════════
const TEMAS_PREDEFINIDOS = [
  {
    id: 'padrao',
    nome: 'Padrão (Obsidian)',
    preview: ['#09090f','#f0a500'],
    vars: { '--bg':'#09090f','--bg-alt':'#0c0c14','--surface':'#0f0f1a','--surface2':'#14141f','--surface3':'#1a1a28','--surface4':'#20202e','--border':'#1e1e2e','--border-mid':'#252535','--border-bright':'#30304a','--accent':'#f0a500','--accent-bright':'#ffbe1a','--accent-dim':'#c27f00','--accent-subtle':'rgba(240,165,0,0.08)','--accent-glow':'rgba(240,165,0,0.18)','--accent-glow-lg':'rgba(240,165,0,0.30)','--text':'#ffffff','--text-soft':'#eaeaf2','--text-muted':'#cdcdde','--text-dim':'#ababc2' }
  },
  {
    id: 'midnight_blue',
    nome: 'Midnight Blue',
    preview: ['#060d1a','#3b82f6'],
    vars: { '--bg':'#060d1a','--bg-alt':'#091220','--surface':'#0d1b2a','--surface2':'#122235','--surface3':'#172a40','--surface4':'#1c3250','--border':'#1a2e45','--border-mid':'#213a55','--border-bright':'#2a4a6e','--accent':'#3b82f6','--accent-bright':'#60a5fa','--accent-dim':'#2563eb','--accent-subtle':'rgba(59,130,246,0.08)','--accent-glow':'rgba(59,130,246,0.18)','--accent-glow-lg':'rgba(59,130,246,0.30)','--text':'#ffffff','--text-soft':'#e2ecfa','--text-muted':'#c2d2ea','--text-dim':'#9fb4d4' }
  },
  {
    id: 'forest',
    nome: 'Forest Dark',
    preview: ['#061410','#22c55e'],
    vars: { '--bg':'#061410','--bg-alt':'#091a14','--surface':'#0d2018','--surface2':'#122820','--surface3':'#173028','--surface4':'#1c3830','--border':'#1a3028','--border-mid':'#213d33','--border-bright':'#2a5040','--accent':'#22c55e','--accent-bright':'#4ade80','--accent-dim':'#16a34a','--accent-subtle':'rgba(34,197,94,0.08)','--accent-glow':'rgba(34,197,94,0.18)','--accent-glow-lg':'rgba(34,197,94,0.30)','--text':'#ffffff','--text-soft':'#def4e8','--text-muted':'#bcdecb','--text-dim':'#99c2ab' }
  },
  {
    id: 'crimson',
    nome: 'Crimson Night',
    preview: ['#120608','#f03e5a'],
    vars: { '--bg':'#120608','--bg-alt':'#180a0c','--surface':'#1e0e10','--surface2':'#251216','--surface3':'#2c161a','--surface4':'#341a1e','--border':'#2e1418','--border-mid':'#3a1a1e','--border-bright':'#4a2228','--accent':'#f03e5a','--accent-bright':'#ff6b82','--accent-dim':'#c01030','--accent-subtle':'rgba(240,62,90,0.08)','--accent-glow':'rgba(240,62,90,0.18)','--accent-glow-lg':'rgba(240,62,90,0.30)','--text':'#ffffff','--text-soft':'#f8e2e7','--text-muted':'#e9c2cb','--text-dim':'#d3a0ac' }
  },
  {
    id: 'purple_haze',
    nome: 'Purple Haze',
    preview: ['#0d0914','#a855f7'],
    vars: { '--bg':'#0d0914','--bg-alt':'#110c1a','--surface':'#160f20','--surface2':'#1b1228','--surface3':'#201530','--surface4':'#261838','--border':'#221630','--border-mid':'#2c1e3d','--border-bright':'#3a284e','--accent':'#a855f7','--accent-bright':'#c084fc','--accent-dim':'#7c3aed','--accent-subtle':'rgba(168,85,247,0.08)','--accent-glow':'rgba(168,85,247,0.18)','--accent-glow-lg':'rgba(168,85,247,0.30)','--text':'#ffffff','--text-soft':'#eee2fb','--text-muted':'#d8c3ef','--text-dim':'#bda2dd' }
  },
  {
    id: 'branco_contraste',
    nome: 'Branco (Alto Contraste)',
    preview: ['#ffffff','#000000'],
    vars: { '--bg':'#ffffff','--bg-alt':'#ffffff','--surface':'#ffffff','--surface2':'#fafafa','--surface3':'#f1f1f1','--surface4':'#e7e7e7','--border':'#c9c9c9','--border-mid':'#a8a8a8','--border-bright':'#6e6e6e','--accent':'#111111','--accent-bright':'#2e2e2e','--accent-dim':'#000000','--accent-subtle':'rgba(0,0,0,0.05)','--accent-glow':'rgba(0,0,0,0.10)','--accent-glow-lg':'rgba(0,0,0,0.18)','--text':'#000000','--text-soft':'#161616','--text-muted':'#2e2e2e','--text-dim':'#474747','--green':'#0a6b32','--green-dim':'#085528','--green-glow':'rgba(10,107,50,0.12)','--red':'#a40e26','--red-dim':'#84091d','--red-glow':'rgba(164,14,38,0.10)','--amber':'#8a4b00','--blue':'#0d3fb3','--blue-dim':'#0a2f86','--shadow-sm':'0 1px 3px rgba(0,0,0,0.12)','--shadow':'0 4px 14px rgba(0,0,0,0.12)','--shadow-lg':'0 16px 40px rgba(0,0,0,0.16)' }
  },
  {
    id: 'slate_light',
    nome: 'Slate (Claro)',
    preview: ['#f8fafc','#2563eb'],
    vars: { '--bg':'#f8fafc','--bg-alt':'#f1f5f9','--surface':'#ffffff','--surface2':'#f8fafc','--surface3':'#f1f5f9','--surface4':'#e2e8f0','--border':'#e2e8f0','--border-mid':'#cbd5e1','--border-bright':'#94a3b8','--accent':'#2563eb','--accent-bright':'#3b82f6','--accent-dim':'#1d4ed8','--accent-subtle':'rgba(37,99,235,0.08)','--accent-glow':'rgba(37,99,235,0.15)','--accent-glow-lg':'rgba(37,99,235,0.25)','--text':'#0a0f1a','--text-soft':'#1f2a3d','--text-muted':'#3c4a60','--text-dim':'#5a6880','--green':'#15803d','--green-dim':'#166534','--green-glow':'rgba(21,128,61,0.12)','--red':'#b91c1c','--red-dim':'#991b1b','--red-glow':'rgba(185,28,28,0.10)','--amber':'#b45309','--blue':'#1d4ed8','--blue-dim':'#1e40af','--shadow-sm':'0 1px 3px rgba(15,23,42,0.10)','--shadow':'0 4px 14px rgba(15,23,42,0.10)','--shadow-lg':'0 16px 40px rgba(15,23,42,0.14)' }
  },
];

function trocarAbaEditor(aba) {
  const abas = { widgets: 'abaConteudoWidgets', tema: 'abaConteudoTema' };
  const btns = { widgets: 'abaEditorWidgets', tema: 'abaEditorTema' };
  Object.entries(abas).forEach(([k, id]) => {
    const el = document.getElementById(id);
    if (el) el.style.display = k === aba ? '' : 'none';
  });
  Object.entries(btns).forEach(([k, id]) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (k === aba) {
      el.style.color = 'var(--accent)';
      el.style.borderBottom = '2px solid var(--accent)';
    } else {
      el.style.color = 'var(--text-muted)';
      el.style.borderBottom = '2px solid transparent';
    }
  });
  if (aba === 'tema') renderizarTemasEditor();
}

function renderizarTemasEditor() {
  const grid = document.getElementById('gridTemasPredefinidos');
  if (!grid) return;
  const temaAtual = _temaAtual?.id || 'padrao';
  grid.innerHTML = TEMAS_PREDEFINIDOS.map(t => {
    const ativo = t.id === temaAtual;
    return `<div onclick="aplicarTema('${t.id}')" style="cursor:pointer;border:2px solid ${ativo ? 'var(--accent)' : 'var(--border-mid)'};border-radius:10px;overflow:hidden;transition:border-color .2s;" title="${t.nome}">
      <div style="height:36px;background:${t.preview[0]};display:flex;align-items:center;justify-content:center;gap:6px;">
        <div style="width:12px;height:12px;border-radius:50%;background:${t.preview[1]};"></div>
        <div style="width:20px;height:4px;border-radius:2px;background:${t.preview[1]};opacity:.7;"></div>
      </div>
      <div style="padding:6px 8px;background:var(--surface2);">
        <div style="font-size:11px;font-weight:600;color:var(--text);">${t.nome}</div>
        ${ativo ? '<div style="font-size:10px;color:var(--accent);">✓ Ativo</div>' : ''}
      </div>
    </div>`;
  }).join('');

  // Preencher cor de acento atual
  const corInput = document.getElementById('corAcentoPersonalizado');
  if (corInput && _temaAtual?.vars?.['--accent']) {
    corInput.value = _temaAtual.vars['--accent'];
  }
}

let _temaAtual = null;

function aplicarVariaveisCSS(vars) {
  const root = document.documentElement;
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
}

function aplicarTema(idTema) {
  const tema = TEMAS_PREDEFINIDOS.find(t => t.id === idTema);
  if (!tema) return;
  _temaAtual = tema;
  aplicarVariaveisCSS(tema.vars);
  renderizarTemasEditor();
}

function aplicarCorAcentoPersonalizado() {
  const cor = document.getElementById('corAcentoPersonalizado')?.value;
  if (!cor) return;
  // Converter hex para rgb para calcular variações
  const r = parseInt(cor.slice(1,3),16);
  const g = parseInt(cor.slice(3,5),16);
  const b = parseInt(cor.slice(5,7),16);
  const vars = {
    '--accent': cor,
    '--accent-bright': ajustarBrilho(r,g,b,30),
    '--accent-dim': ajustarBrilho(r,g,b,-30),
    '--accent-subtle': `rgba(${r},${g},${b},0.08)`,
    '--accent-glow': `rgba(${r},${g},${b},0.18)`,
    '--accent-glow-lg': `rgba(${r},${g},${b},0.30)`,
  };
  aplicarVariaveisCSS(vars);
  if (_temaAtual) {
    _temaAtual = { ..._temaAtual, id: 'custom', nome: 'Personalizado', vars: { ..._temaAtual.vars, ...vars } };
  }
}

function ajustarBrilho(r, g, b, delta) {
  const clamp = v => Math.max(0, Math.min(255, v + delta));
  return `#${[clamp(r),clamp(g),clamp(b)].map(v => v.toString(16).padStart(2,'0')).join('')}`;
}

function resetarTema() {
  aplicarTema('padrao');
  const corInput = document.getElementById('corAcentoPersonalizado');
  if (corInput) corInput.value = '#f0a500';
}

function chaveTemaPorLoja() {
  const lojaId = obterLojaIdSessao?.() || usuarioSistemaLogado?.loja_id || 'global';
  return 'tema_interface_' + lojaId;
}

async function salvarTema() {
  if (!_temaAtual) return;
  await salvarPreferenciaMeuPainel(chaveTemaPorLoja(), _temaAtual);
}

async function carregarTemaUsuario() {
  try {
    // Tentar carregar tema específico da loja atual
    const chave = chaveTemaPorLoja();
    let tema = await carregarPreferenciaMeuPainel(chave, null);
    // Fallback: tema global (compatibilidade com dados antigos)
    if (!tema) tema = await carregarPreferenciaMeuPainel('tema_interface', null);
    if (!tema) return;
    _temaAtual = tema;
    if (tema.vars) aplicarVariaveisCSS(tema.vars);
  } catch(e) { console.warn('Erro ao carregar tema:', e); }
}
// ══════════════════════════════════════════════════════════════════
async function carregarMeuPainel() {
  const grid = document.getElementById('meuPainelGrid');
  if (!grid) return;
  grid.innerHTML = '<div class="empty" style="grid-column:1/-1;">Carregando⬦</div>';

  // Carregar config salva
  const config = await carregarPreferenciaMeuPainel('meu_painel_widgets');
  _meuPainelConfig = Array.isArray(config) ? config : ['saldo_cofre', 'falta_quitar', 'recebiveis_futuros', 'atalho_cofre', 'atalho_contas_pagar', 'atalho_checklist'];

  await renderizarMeuPainel();
}

async function renderizarMeuPainel() {
  const grid = document.getElementById('meuPainelGrid');
  if (!grid) return;

  if (!_meuPainelConfig.length) {
    grid.innerHTML = '<div class="empty" style="grid-column:1/-1;padding:40px;text-align:center;">Seu painel está vazio.<br><button class="btn btn-green" style="margin-top:12px;" onclick="abrirEditorMeuPainel()">+ Adicionar widgets</button></div>';
    return;
  }

  // Renderizar esqueleto com drag & drop
  const DA = 'draggable="true" ondragstart="widgetDragStart(event)" ondragover="widgetDragOver(event)" ondrop="widgetDrop(event)" ondragend="widgetDragEnd(event)"';
  grid.innerHTML = _meuPainelConfig.map(wid => {
    const def = MEU_PAINEL_WIDGETS_DISPONIVEIS.find(w => w.id === wid);
    if (!def) return '';
    if (def.tipo === 'atalho') {
      return `<div class="meu-painel-widget meu-painel-atalho" data-wid="${wid}" ${DA}
        onclick="abrirPaginaAtalhoMeuPainel('${def.pagina}')" title="Ir para ${def.label}">
        <button class="meu-painel-widget-remover" onclick="event.stopPropagation();removerWidgetMeuPainel('${wid}')" title="Remover">✕</button>
        <div style="font-size:28px;margin-bottom:6px;">${def.ico}</div>
        <div class="meu-painel-widget-label">Atalho</div>
        <div style="font-size:14px;font-weight:700;color:var(--text);">${escaparHtmlBasico(def.label)}</div>
      </div>`;
    }
    return `<div class="meu-painel-widget" id="widget_${wid}" data-wid="${wid}" ${DA}>
      <button class="meu-painel-widget-remover" onclick="event.stopPropagation();removerWidgetMeuPainel('${wid}')" title="Remover">✕</button>
      <div class="meu-painel-widget-label">${def.ico} ${escaparHtmlBasico(def.label)}</div>
      <div class="meu-painel-widget-valor" id="wval_${wid}">⬦</div>
      <div class="meu-painel-widget-desc" id="wdesc_${wid}"></div>
    </div>`;
  }).join('');

  // Carregar dados dos indicadores em paralelo
  const indicadores = _meuPainelConfig.filter(wid => {
    const def = MEU_PAINEL_WIDGETS_DISPONIVEIS.find(w => w.id === wid);
    return def?.tipo === 'indicador';
  });
  await Promise.allSettled(indicadores.map(wid => carregarDadosWidgetMeuPainel(wid)));
}

// Navegação a partir dos cards de atalho do Meu Painel.
// Resolve o botão da navegação lateral (se existir) e abre a página.
function abrirPaginaAtalhoMeuPainel(pagina) {
  if (!pagina) return;
  const botaoNav = document.querySelector('.nav-btn[data-page="' + pagina + '"]');
  abrirPagina(pagina, botaoNav || null);
}

function aplicarLojaAtualDashboardQuery(query) {
  const lojaId = (typeof obterLojaAtualParaIsolamento === 'function' ? obterLojaAtualParaIsolamento() : '') || '';
  return lojaId && query && typeof query.eq === 'function' ? query.eq('loja_id', lojaId) : query;
}

async function carregarDadosWidgetMeuPainel(wid) {
  const elVal = document.getElementById('wval_' + wid);
  const elDesc = document.getElementById('wdesc_' + wid);
  if (!elVal) return;

  try {
    switch(wid) {
      case 'saldo_cofre': {
        const { data: contas } = await aplicarLojaAtualDashboardQuery(sb.from('contas_financeiras').select('saldo_atual').eq('ativo', true));
        const total = (contas || []).reduce((s, c) => s + Number(c.saldo_atual || 0), 0);
        elVal.textContent = formatarMoedaBRFinanceiro(total);
        elVal.style.color = total >= 0 ? 'var(--green,#22c55e)' : 'var(--red,#ef4444)';
        if (elDesc) elDesc.textContent = `${(contas||[]).length} conta(s) financeira(s)`;
        break;
      }
      case 'falta_quitar': {
        const hoje = new Date().toISOString().slice(0,10);
        const [{ data: contas }, { data: capagar }] = await Promise.all([
          aplicarLojaAtualDashboardQuery(sb.from('contas_financeiras').select('saldo_atual').eq('ativo', true)),
          aplicarLojaAtualDashboardQuery(sb.from('contasapagar').select('valor_compra').is('data_pagamento', null).is('excluido_em', null).lte('data_vencimento', hoje)),
        ]);
        const saldo = (contas||[]).reduce((s,c) => s + Number(c.saldo_atual||0), 0);
        const devendo = (capagar||[]).reduce((s,c) => s + Number(c.valor_compra||0), 0);
        const falta = Math.max(0, devendo - saldo);
        elVal.textContent = formatarMoedaBRFinanceiro(falta);
        elVal.style.color = falta > 0 ? 'var(--red,#ef4444)' : 'var(--green,#22c55e)';
        if (elDesc) elDesc.textContent = falta === 0 ? 'Saldo cobre as contas' : `Devendo: ${formatarMoedaBRFinanceiro(devendo)}`;
        break;
      }
      case 'recebiveis_futuros': {
        const { data } = await aplicarLojaAtualDashboardQuery(sb.from('recebiveis_futuros').select('valor').eq('ativo', true).is('confirmado_em', null));
        const total = (data||[]).reduce((s,f) => s + Number(f.valor||0), 0);
        elVal.textContent = formatarMoedaBRFinanceiro(total);
        elVal.style.color = 'var(--amber,#f59e0b)';
        if (elDesc) elDesc.textContent = `${(data||[]).length} recebimento(s) pendente(s)`;
        break;
      }
      case 'contas_vencer_7':
      case 'contas_vencer_30': {
        const dias = wid === 'contas_vencer_7' ? 7 : 30;
        const hoje = new Date().toISOString().slice(0,10);
        const ate = new Date(Date.now() + dias * 86400000).toISOString().slice(0,10);
        const { data } = await aplicarLojaAtualDashboardQuery(sb.from('contasapagar').select('valor_compra').is('data_pagamento', null).is('excluido_em', null).gte('data_vencimento', hoje).lte('data_vencimento', ate));
        const total = (data||[]).reduce((s,c) => s + Number(c.valor_compra||0), 0);
        elVal.textContent = formatarMoedaBRFinanceiro(total);
        elVal.style.color = dias === 7 ? 'var(--red,#ef4444)' : 'var(--amber,#f59e0b)';
        if (elDesc) elDesc.textContent = `${(data||[]).length} título(s) nos próximos ${dias} dias`;
        break;
      }
      case 'total_recebido_mes': {
        const ini = new Date(); ini.setDate(1);
        const inicio = ini.toISOString().slice(0,10);
        const fim = new Date().toISOString().slice(0,10);
        const { data } = await aplicarLojaAtualDashboardQuery(sb.from('contas_financeiras_movimentacoes').select('valor').eq('tipo','entrada').gte('created_at', inicio).lte('created_at', fim + 'T23:59:59Z'));
        const total = (data||[]).reduce((s,m) => s + Number(m.valor||0), 0);
        elVal.textContent = formatarMoedaBRFinanceiro(total);
        elVal.style.color = 'var(--green,#22c55e)';
        if (elDesc) elDesc.textContent = `Entradas em ${ini.toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}`;
        break;
      }
    }
  } catch(e) {
    if (elVal) elVal.textContent = 'Erro';
    console.warn('Erro widget', wid, e);
  }
}

function abrirEditorMeuPainel() {
  const modal = document.getElementById('modalMeuPainel');
  if (!modal) return;

  const renderGrupo = (containerId, grupo) => {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = MEU_PAINEL_WIDGETS_DISPONIVEIS.filter(w => w.grupo === grupo).map(w => {
      const ativo = _meuPainelConfig.includes(w.id);
      return `<div class="meu-painel-editor-item${ativo ? ' ativo' : ''}" id="editor_${w.id}" onclick="toggleWidgetEditor('${w.id}')" style="font-size:11px;padding:6px 8px;">
        <span style="font-size:14px;width:20px;text-align:center;flex-shrink:0;">${w.ico}</span>
        <span style="flex:1;line-height:1.3;">${escaparHtmlBasico(w.label)}</span>
        ${ativo ? '<span style="flex-shrink:0;color:var(--green,#22c55e);font-size:11px;">✓</span>' : ''}
      </div>`;
    }).join('');
  };

  renderGrupo('editorWidgetsFinanceiro', 'financeiro');
  renderGrupo('editorWidgetsAtalhosFinanceiro', 'fin');
  renderGrupo('editorWidgetsAtalhosOp', 'op');
  renderGrupo('editorWidgetsAtalhosAdm', 'adm');
  modal.style.display = 'flex';
}

function toggleWidgetEditor(wid) {
  const el = document.getElementById('editor_' + wid);
  const idx = _meuPainelConfig.indexOf(wid);
  if (idx === -1) {
    _meuPainelConfig.push(wid);
    if (el) {
      el.classList.add('ativo');
      el.innerHTML = el.innerHTML.replace(/<\/div>$/, '') + '<span style="margin-left:auto;color:var(--green,#22c55e);font-size:12px;">✓</span></div>';
    }
  } else {
    _meuPainelConfig.splice(idx, 1);
    if (el) {
      el.classList.remove('ativo');
      // remover o ✓
      el.querySelector('span[style*="green"]')?.remove();
    }
  }
}

function fecharEditorMeuPainel() {
  const modal = document.getElementById('modalMeuPainel');
  if (modal) modal.style.display = 'none';
}

async function salvarMeuPainel() {
  fecharEditorMeuPainel();
  await salvarPreferenciaMeuPainel('meu_painel_widgets', _meuPainelConfig);
  setMsg('msgMeuPainel', 'Painel salvo.', 'ok');
  await renderizarMeuPainel();
  setTimeout(() => setMsg('msgMeuPainel', '', ''), 3000);
}


// ── Drag & Drop nos widgets do Meu Painel ────────────────────────
let _widgetDragSrc = null;

function widgetDragStart(e) {
  _widgetDragSrc = e.currentTarget.closest('[data-wid]');
  setTimeout(() => { if (_widgetDragSrc) _widgetDragSrc.classList.add('dragging-widget'); }, 0);
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', _widgetDragSrc?.dataset?.wid || '');
  e.stopPropagation();
}

function widgetDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  const alvo = e.currentTarget.closest('[data-wid]');
  if (alvo && alvo !== _widgetDragSrc) {
    document.querySelectorAll('[data-wid]').forEach(el => el.classList.remove('drag-over-widget'));
    alvo.classList.add('drag-over-widget');
  }
}

function widgetDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  const alvo = e.currentTarget.closest('[data-wid]');
  document.querySelectorAll('[data-wid]').forEach(el => {
    el.classList.remove('drag-over-widget');
    el.classList.remove('dragging-widget');
  });
  if (!_widgetDragSrc || !alvo || alvo === _widgetDragSrc) return;
  const widSrc = _widgetDragSrc.dataset.wid;
  const widAlvo = alvo.dataset.wid;
  const iSrc = _meuPainelConfig.indexOf(widSrc);
  const iAlvo = _meuPainelConfig.indexOf(widAlvo);
  if (iSrc === -1 || iAlvo === -1) return;
  // Reordenar
  _meuPainelConfig.splice(iSrc, 1);
  _meuPainelConfig.splice(iAlvo, 0, widSrc);
  // Salvar e re-renderizar
  salvarPreferenciaMeuPainel('meu_painel_widgets', _meuPainelConfig);
  renderizarMeuPainel();
}

// ── Gráficos financeiros do Dashboard (modo B.I. com filtros cruzados) ──
let _dashGfAno = new Date().getFullYear();
let _dashGfDados = [];          // contas do ano carregadas
let _dashGfCarregadoAno = null; // ano já carregado no cache
let _dashGfCategoriasMapa = {}; // id -> { nome, cor, icone }
// Filtros ativos (cross-filter estilo B.I.): clique nos gráficos liga/desliga.
let _dashGfFiltro = { mes: null, status: 'todos', fornecedorIds: new Set(), categoriaIds: new Set() };
let _dashGfOpcoesFornecedores = []; // [[id, nome], ...] do ano carregado
let _dashGfOpcoesCategorias = [];
let _dashGfConsultaDropdown = { forn: '', cat: '' };
let _dashGfOrdenacaoDetalhe = 'valor';
let _dashGfDirecaoDetalhe = 'desc';
// Modo de data dos gráficos: 'vencimento' (padrão — espelha a fatura) ou 'compra'.
let _dashGfModoData = (() => {
  try { return localStorage.getItem('dashGfModoData') === 'compra' ? 'compra' : 'vencimento'; }
  catch (_) { return 'vencimento'; }
})();
function _dashGfCampoData() { return _dashGfModoData === 'compra' ? 'data_compra' : 'data_vencimento'; }
function dashGfMudarModoData(modo) {
  const novo = modo === 'compra' ? 'compra' : 'vencimento';
  if (novo === _dashGfModoData) return;
  _dashGfModoData = novo;
  try { localStorage.setItem('dashGfModoData', novo); } catch (_) { /* opcional */ }
  _dashGfCarregadoAno = null; // a janela do ano muda de campo → recarrega do banco
  carregarGraficosFinanceirosDashboard();
}
function _dashGfAtualizarBotoesModo() {
  const on = 'background:rgba(59,130,246,0.25);color:#fff;font-weight:700;';
  const off = 'background:transparent;color:var(--text-muted,#888);font-weight:400;';
  const bV = document.getElementById('dashGfModoVenc');
  const bC = document.getElementById('dashGfModoCompra');
  if (bV) bV.style.cssText = 'border-radius:0;border:none;' + (_dashGfModoData === 'vencimento' ? on : off);
  if (bC) bC.style.cssText = 'border-radius:0;border:none;' + (_dashGfModoData === 'compra' ? on : off);
}

const _dashGfCores = ['#22c55e','#3b82f6','#f59e0b','#a855f7','#ef4444','#06b6d4','#ec4899','#84cc16','#f97316','#14b8a6','#eab308','#6366f1'];
const _dashGfNomesMes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function _dashGfSanitizarChave(v) { return String(v ?? '').replace(/[^a-zA-Z0-9_-]/g, ''); }

async function carregarGraficosFinanceirosDashboard() {
  const ano = _dashGfAno;
  const inicio = `${ano}-01-01`;
  const fim = `${ano}-12-31`;
  const msg = document.getElementById('dashGfMsg');
  if (msg) { msg.textContent = ''; msg.className = 'msg'; }
  try {
    // Carrega todas as contas do ano (pela data escolhida: vencimento ou compra)
    // + categorias de compra em paralelo.
    const campoData = _dashGfCampoData();
    const lojaAtualDash = (typeof obterLojaAtualParaIsolamento === 'function' ? obterLojaAtualParaIsolamento() : '') || '';
    const consultarContasDash = async (incluirCor) => {
      let query = sb.from('contasapagar')
        .select(`id, fornecedor_id, categoria_id, loja_id, empresa_id, valor_compra, valor_pago, data_compra, data_vencimento, data_pagamento, pago_confirmado_em, observacao, created_at, fornecedores(nome${incluirCor ? ', cor' : ''})`)
        .is('excluido_em', null)
        .gte(campoData, inicio)
        .lte(campoData, fim);
      if (lojaAtualDash) query = query.eq('loja_id', lojaAtualDash);
      return query;
    };
    const resContasTentativa = await consultarContasDash(true);
    // Fallback: banco ainda sem a coluna fornecedores.cor (ALTER não rodado).
    let resContas = resContasTentativa;
    if (resContas.error && /\bcor\b|column/i.test(String(resContas.error.message || ''))) {
      console.warn('fornecedores.cor ausente no banco — carregando dashboard sem cores personalizadas. Rode: ALTER TABLE fornecedores ADD COLUMN cor text;');
      resContas = await consultarContasDash(false);
    }
    if (resContas.error) throw resContas.error;
    _dashGfDados = resContas.data || [];
    _dashGfCarregadoAno = ano;

    // Busca somente as categorias efetivamente referenciadas pelas contas visíveis.
    // Categorias históricas podem ter loja_id nulo/diferente e desaparecer com o
    // filtro automático, embora a conta continue apontando corretamente para elas.
    const categoriaIdsDash = [...new Set(_dashGfDados
      .map(c => String(c.categoria_id || '').trim())
      .filter(Boolean))];
    let categoriasDash = [];
    if (categoriaIdsDash.length) {
      const consultaNormal = await sb.from('categorias_compra')
        .select('id, nome, cor, icone')
        .in('id', categoriaIdsDash);
      categoriasDash = consultaNormal.data || [];

      const idsEncontrados = new Set(categoriasDash.map(c => String(c.id)));
      const idsFaltantes = categoriaIdsDash.filter(id => !idsEncontrados.has(id));
      if (consultaNormal.error || idsFaltantes.length) {
        const consultaHistorica = await executarSemFiltrosTenantTemporario(() => sb
          .from('categorias_compra')
          .select('id, nome, cor, icone')
          .in('id', idsFaltantes.length ? idsFaltantes : categoriaIdsDash));
        if (consultaHistorica.error) {
          console.warn('Não foi possível recuperar categorias históricas do dashboard:', consultaHistorica.error);
        } else {
          categoriasDash = [...new Map([...categoriasDash, ...(consultaHistorica.data || [])]
            .map(c => [String(c.id), c])).values()];
        }
      }
    }

    _dashGfCategoriasMapa = {};
    categoriasDash.forEach(c => {
      _dashGfCategoriasMapa[String(c.id)] = { nome: c.nome || 'Categoria', cor: c.cor || null, icone: c.icone || null };
    });

    // Ao trocar de ano, limpa filtro de mês mas preserva fornecedores/categorias que ainda existirem.
    const fornecedoresAno = new Set(_dashGfDados.map(c => c.fornecedor_id ? String(c.fornecedor_id) : 'sem'));
    _dashGfFiltro.fornecedorIds = new Set([..._dashGfFiltro.fornecedorIds].filter(id => fornecedoresAno.has(id)));
    const categoriasAno = new Set(_dashGfDados.map(c => c.categoria_id ? String(c.categoria_id) : 'sem'));
    _dashGfFiltro.categoriaIds = new Set([..._dashGfFiltro.categoriaIds].filter(id => categoriasAno.has(id)));

    // Opções dos dropdowns: fornecedores e categorias que aparecem no ano.
    _dashGfOpcoesFornecedores = [...new Map(_dashGfDados
      .filter(c => c.fornecedor_id)
      .map(c => [String(c.fornecedor_id), c.fornecedores?.nome || 'Fornecedor'])).entries()]
      .sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
    if (_dashGfDados.some(c => !c.fornecedor_id)) _dashGfOpcoesFornecedores.push(['sem', '— Sem fornecedor —']);
    _dashGfOpcoesCategorias = [...categoriasAno].filter(id => id !== 'sem')
      .map(id => [id, _dashGfCategoriasMapa[id]?.nome || 'Categoria'])
      .sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
    if (categoriasAno.has('sem')) _dashGfOpcoesCategorias.push(['sem', '— Sem categoria —']);
    dashGfRenderDropdowns();
    renderizarGraficosFinanceirosDashboard();
  } catch (e) {
    console.warn('Falha ao carregar gráficos financeiros:', e?.message || e);
    if (msg) { msg.textContent = 'Não foi possível carregar os dados financeiros.'; msg.className = 'msg err'; }
  }
}

function mudarAnoGraficoFinanceiroDashboard(delta) {
  _dashGfAno += delta;
  _dashGfFiltro.mes = null; // mês pertence ao ano exibido
  carregarGraficosFinanceirosDashboard();
}

// ── Ações de filtro (cross-filter) ────────────────────────────────
function dashGfToggleMes(m) {
  _dashGfFiltro.mes = (_dashGfFiltro.mes === m) ? null : m;
  renderizarGraficosFinanceirosDashboard();
}
// Toggle multi-seleção: clicar na rosca, na legenda, no chip ou na checkbox
// adiciona/remove o item do conjunto — dá para montar relatório com vários.
function dashGfToggleFornecedor(id) {
  const chave = String(id || '');
  if (_dashGfFiltro.fornecedorIds.has(chave)) _dashGfFiltro.fornecedorIds.delete(chave);
  else _dashGfFiltro.fornecedorIds.add(chave);
  dashGfRenderDropdowns();
  renderizarGraficosFinanceirosDashboard();
}
function dashGfToggleCategoria(id) {
  const chave = String(id || '');
  if (_dashGfFiltro.categoriaIds.has(chave)) _dashGfFiltro.categoriaIds.delete(chave);
  else _dashGfFiltro.categoriaIds.add(chave);
  dashGfRenderDropdowns();
  renderizarGraficosFinanceirosDashboard();
}
function dashGfLimparFiltros() {
  _dashGfFiltro = { mes: null, status: 'todos', fornecedorIds: new Set(), categoriaIds: new Set() };
  _dashGfConsultaDropdown = { forn: '', cat: '' };
  dashGfRenderDropdowns();
  renderizarGraficosFinanceirosDashboard();
}

function dashGfAlterarOrdenacao(valor = 'valor') {
  _dashGfOrdenacaoDetalhe = ['categoria', 'fornecedor', 'data'].includes(valor) ? valor : 'valor';
  _dashGfDirecaoDetalhe = _dashGfOrdenacaoDetalhe === 'valor' ? 'desc' : 'asc';
  renderizarGraficosFinanceirosDashboard();
}

function dashGfOrdenarColuna(chave) {
  const permitidas = ['vencimento','valor','lancamento','fornecedor','categoria','compra','observacao','status'];
  if (!permitidas.includes(chave)) return;
  if (_dashGfOrdenacaoDetalhe === chave) _dashGfDirecaoDetalhe = _dashGfDirecaoDetalhe === 'asc' ? 'desc' : 'asc';
  else {
    _dashGfOrdenacaoDetalhe = chave;
    _dashGfDirecaoDetalhe = ['valor','vencimento','lancamento','compra'].includes(chave) ? 'desc' : 'asc';
  }
  renderizarGraficosFinanceirosDashboard();
}

function dashGfAlterarStatus(status = 'todos') {
  _dashGfFiltro.status = ['pendente', 'pago'].includes(status) ? status : 'todos';
  renderizarGraficosFinanceirosDashboard();
}

// ── Dropdowns de filtro com checkbox (fornecedores e categorias) ──
function posicionarDropdownFlutuanteNaViewport(dropdown, ancora, largura = 240, alturaMaxima = 300) {
  if (!dropdown || !ancora) return;
  const margem = 12;
  const espaco = 4;
  const viewportLargura = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
  const viewportAltura = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
  const rect = ancora.getBoundingClientRect();
  const larguraFinal = Math.max(180, Math.min(largura, viewportLargura - (margem * 2)));
  let esquerda = Math.min(Math.max(margem, rect.left), viewportLargura - larguraFinal - margem);
  const espacoAbaixo = viewportAltura - rect.bottom - margem - espaco;
  const espacoAcima = rect.top - margem - espaco;
  const abrirAcima = espacoAbaixo < 160 && espacoAcima > espacoAbaixo;
  const alturaFinal = Math.max(100, Math.min(alturaMaxima, abrirAcima ? espacoAcima : espacoAbaixo));
  const topo = abrirAcima
    ? Math.max(margem, rect.top - alturaFinal - espaco)
    : Math.min(viewportAltura - margem - alturaFinal, rect.bottom + espaco);

  Object.assign(dropdown.style, {
    position: 'fixed',
    left: `${esquerda}px`,
    right: 'auto',
    top: `${Math.max(margem, topo)}px`,
    width: `${larguraFinal}px`,
    minWidth: '0',
    maxWidth: `calc(100vw - ${margem * 2}px)`,
    maxHeight: `${alturaFinal}px`,
    zIndex: '9000',
  });
}

function dashGfToggleDropdown(tipo, forcarFechar) {
  const dd = document.getElementById(tipo === 'forn' ? 'dashGfDropdownForn' : 'dashGfDropdownCat');
  const outro = document.getElementById(tipo === 'forn' ? 'dashGfDropdownCat' : 'dashGfDropdownForn');
  if (!dd) return;
  if (outro) outro.style.display = 'none';
  const abrir = forcarFechar === true ? false : dd.style.display === 'none';
  dd.style.display = abrir ? 'block' : 'none';
  if (abrir) {
    const ancora = document.getElementById(tipo === 'forn' ? 'btnDashGfFornecedores' : 'btnDashGfCategorias');
    posicionarDropdownFlutuanteNaViewport(dd, ancora);
    setTimeout(() => document.addEventListener('click', dashGfFecharDropdownsFora), 0);
  }
  else document.removeEventListener('click', dashGfFecharDropdownsFora);
}
function dashGfFecharDropdownsFora(ev) {
  const w1 = document.getElementById('dashGfFornWrap');
  const w2 = document.getElementById('dashGfCatWrap');
  if ((w1 && w1.contains(ev.target)) || (w2 && w2.contains(ev.target))) return;
  ['dashGfDropdownForn', 'dashGfDropdownCat'].forEach(id => {
    const dd = document.getElementById(id); if (dd) dd.style.display = 'none';
  });
  document.removeEventListener('click', dashGfFecharDropdownsFora);
}
function dashGfRenderDropdowns() {
  const montar = (tipo, opcoes, selecionados, fnToggle, titulo, fnLimpar) => {
    const consulta = String(_dashGfConsultaDropdown[tipo] || '');
    const termo = normalizarConsultaContem(consulta);
    const quantidade = opcoes.filter(([, nome]) => !termo || normalizarConsultaContem(nome).includes(termo)).length;
    return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
      <span style="font-size:10px;letter-spacing:.5px;color:var(--text-muted);font-weight:700;">${titulo}</span>
      <button class="btn btn-ghost btn-sm" type="button" style="font-size:10px;padding:2px 8px;" onclick="${fnLimpar}()">Limpar</button>
    </div>
    <input type="search" value="${escaparHtmlBasico(consulta)}" placeholder="Consultar por nome..." autocomplete="off" oninput="dashGfFiltrarDropdown(this, '${tipo}')" style="width:100%;height:32px;margin-bottom:6px;padding:5px 8px;font-size:12px;">
    <label style="display:flex;align-items:center;gap:7px;padding:5px 6px;margin-bottom:4px;border-bottom:1px solid var(--border);font-size:11px;font-weight:700;cursor:pointer;">
      <input type="checkbox" onchange="dashGfMarcarResultadosDropdown('${tipo}', this.checked)" style="width:13px;height:13px;flex:0 0 auto;">
      <span data-dashgf-resultados>Selecionar resultados (${quantidade})</span>
    </label>
    <div data-dashgf-opcoes>` + (opcoes.length ? opcoes.map(([id, nome]) => `
    <label data-dashgf-opcao data-nome="${escaparHtmlBasico(normalizarConsultaContem(nome))}" style="display:${!termo || normalizarConsultaContem(nome).includes(termo) ? 'flex' : 'none'};align-items:center;gap:8px;padding:5px 6px;border-radius:7px;cursor:pointer;font-size:12px;color:var(--text);min-width:0;">
      <input type="checkbox" style="width:13px;height:13px;flex-shrink:0;" ${selecionados.has(id) ? 'checked' : ''}
        onchange="${fnToggle}('${_dashGfSanitizarChave(id)}')"><span title="${escaparHtmlBasico(nome)}" style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escaparHtmlBasico(nome)}</span>
    </label>`).join('') : '<div class="empty" style="padding:8px;">Nada neste ano.</div>') + '</div>';
  };
  const ddF = document.getElementById('dashGfDropdownForn');
  if (ddF) ddF.innerHTML = montar('forn', _dashGfOpcoesFornecedores, _dashGfFiltro.fornecedorIds, 'dashGfToggleFornecedor', 'FORNECEDORES', 'dashGfLimparFornecedores');
  const ddC = document.getElementById('dashGfDropdownCat');
  if (ddC) ddC.innerHTML = montar('cat', _dashGfOpcoesCategorias, _dashGfFiltro.categoriaIds, 'dashGfToggleCategoria', 'CATEGORIAS', 'dashGfLimparCategorias');
  const btnF = document.getElementById('btnDashGfFornecedores');
  if (btnF) {
    const n = _dashGfFiltro.fornecedorIds.size;
    btnF.textContent = n ? `Fornecedores (${n}) ▾` : 'Fornecedores ▾';
    btnF.style.fontWeight = n ? '700' : '';
  }
  const btnC = document.getElementById('btnDashGfCategorias');
  if (btnC) {
    const n = _dashGfFiltro.categoriaIds.size;
    btnC.textContent = n ? `Categorias (${n}) ▾` : 'Categorias ▾';
    btnC.style.fontWeight = n ? '700' : '';
  }
}
function dashGfFiltrarDropdown(input, tipo) {
  const chave = tipo === 'forn' ? 'forn' : 'cat';
  const dropdown = input?.closest?.('[id^="dashGfDropdown"]');
  const termo = normalizarConsultaContem(input?.value || '');
  _dashGfConsultaDropdown[chave] = String(input?.value || '');
  let quantidade = 0;
  dropdown?.querySelectorAll('[data-dashgf-opcao]').forEach(label => {
    const corresponde = !termo || String(label.dataset.nome || '').includes(termo);
    label.style.display = corresponde ? 'flex' : 'none';
    if (corresponde) quantidade += 1;
  });
  const resumo = dropdown?.querySelector('[data-dashgf-resultados]');
  if (resumo) resumo.textContent = `Selecionar resultados (${quantidade})`;
}
function dashGfMarcarResultadosDropdown(tipo, marcado) {
  const chave = tipo === 'forn' ? 'forn' : 'cat';
  const opcoes = chave === 'forn' ? _dashGfOpcoesFornecedores : _dashGfOpcoesCategorias;
  const selecionados = chave === 'forn' ? _dashGfFiltro.fornecedorIds : _dashGfFiltro.categoriaIds;
  const termo = normalizarConsultaContem(_dashGfConsultaDropdown[chave] || '');
  opcoes.forEach(([id, nome]) => {
    if (termo && !normalizarConsultaContem(nome).includes(termo)) return;
    if (marcado) selecionados.add(String(id)); else selecionados.delete(String(id));
  });
  dashGfRenderDropdowns();
  renderizarGraficosFinanceirosDashboard();
}
function dashGfLimparFornecedores() {
  _dashGfFiltro.fornecedorIds = new Set();
  dashGfRenderDropdowns();
  renderizarGraficosFinanceirosDashboard();
}
function dashGfLimparCategorias() {
  _dashGfFiltro.categoriaIds = new Set();
  dashGfRenderDropdowns();
  renderizarGraficosFinanceirosDashboard();
}

// ── Helpers de agregação ──────────────────────────────────────────
function _dashGfChaveFornecedor(c) { return c.fornecedor_id ? String(c.fornecedor_id) : 'sem'; }
function _dashGfChaveCategoria(c) { return c.categoria_id ? String(c.categoria_id) : 'sem'; }
function _dashGfMesDe(c) { return parseInt(String(c[_dashGfCampoData()] || '').slice(5, 7), 10) - 1; }
function _dashGfEhPago(c) { return !!c.pago_confirmado_em || !!c.data_pagamento; }
function _dashGfValorDe(c) { return Number(c.valor_pago ?? c.valor_compra ?? 0) || Number(c.valor_compra || 0); }

function _dashGfValorCompacto(valor = 0) {
  const numero = Number(valor || 0);
  if (!numero) return 'R$ 0';
  try {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(numero).replace(/\s+/g, ' ');
  } catch (_) {
    return formatarMoedaBRFinanceiro(numero);
  }
}

// Desenha uma rosca SVG clicável. itens: [{chave, nome, valor, cor, selecionado}]
function _dashGfDesenharRosca(itens, total, fnToggleNome, temSelecao) {
  const fmt = (n) => formatarMoedaBRFinanceiro(n);
  const cx = 80, cy = 80, rExt = 76, rInt = 44;
  let angulo = -90;
  const arcos = itens.map((it) => {
    const frac = it.valor / total;
    const a0 = angulo;
    const a1 = angulo + Math.min(359.98, frac * 360);
    angulo = a0 + frac * 360;
    const rad = (g) => (g * Math.PI) / 180;
    const p = (r, g) => `${(cx + r * Math.cos(rad(g))).toFixed(2)} ${(cy + r * Math.sin(rad(g))).toFixed(2)}`;
    const grande = (a1 - a0) > 180 ? 1 : 0;
    const dim = temSelecao && !it.selecionado;
    const d = `M ${p(rExt, a0)} A ${rExt} ${rExt} 0 ${grande} 1 ${p(rExt, a1)} L ${p(rInt, a1)} A ${rInt} ${rInt} 0 ${grande} 0 ${p(rInt, a0)} Z`;
    return `<path d="${d}" fill="${it.cor}" opacity="${dim ? 0.28 : 1}" style="cursor:pointer;" stroke="${it.selecionado ? 'var(--text,#fff)' : 'transparent'}" stroke-width="${it.selecionado ? 2 : 0}" onclick="${fnToggleNome}('${_dashGfSanitizarChave(it.chave)}')"><title>${escaparHtmlBasico(it.nome)}: ${fmt(it.valor)} (${Math.round((it.valor / total) * 100)}%)</title></path>`;
  }).join('');
  return `
    <svg viewBox="0 0 160 160" width="146" height="146" style="flex-shrink:0;">
      ${arcos}
      <circle cx="${cx}" cy="${cy}" r="${rInt - 2}" fill="var(--surface,#0f0f1a)"/>
      <text x="${cx}" y="${cy - 6}" text-anchor="middle" font-size="10" fill="var(--text-muted,#888)">Total</text>
      <text x="${cx}" y="${cy + 12}" text-anchor="middle" font-size="12" font-weight="bold" fill="var(--text,#eee)">${fmt(total)}</text>
    </svg>`;
}

function _dashGfLegendaRosca(itens, total, fnToggleNome, temSelecao) {
  const fmt = (n) => formatarMoedaBRFinanceiro(n);
  return itens.map((it) => `
    <div onclick="${fnToggleNome}('${_dashGfSanitizarChave(it.chave)}')"
         style="display:flex;align-items:center;gap:6px;font-size:12px;margin-bottom:3px;cursor:pointer;border-radius:6px;padding:2px 6px;${it.selecionado ? 'background:rgba(255,255,255,0.08);outline:1px solid rgba(255,255,255,0.25);' : ''}${temSelecao && !it.selecionado ? 'opacity:0.45;' : ''}">
      <span style="width:11px;height:11px;border-radius:2px;background:${it.cor};display:inline-block;flex-shrink:0;"></span>
      <span style="flex:1;display:flex;align-items:center;gap:7px;min-width:0;">${it.icone ? htmlIconeCategoriaCompra(it.icone, 24) : ''}<span>${escaparHtmlBasico(it.nome)}</span></span>
      <strong>${fmt(it.valor)}</strong>
      <span style="color:var(--text-muted);">${Math.round((it.valor / total) * 100)}%</span>
    </div>`).join('');
}

function renderizarGraficosFinanceirosDashboard() {
  _dashGfAtualizarBotoesModo();
  const labelAno = document.getElementById('dashGfAnoLabel');
  if (labelAno) labelAno.textContent = String(_dashGfAno);

  const fmt = (n) => formatarMoedaBRFinanceiro(n);
  const F = _dashGfFiltro;
  const filtraForn = (c) => !F.fornecedorIds.size || F.fornecedorIds.has(_dashGfChaveFornecedor(c));
  const filtraCat = (c) => !F.categoriaIds.size || F.categoriaIds.has(_dashGfChaveCategoria(c));
  const filtraMes = (c) => F.mes === null || _dashGfMesDe(c) === F.mes;
  const filtraStatus = (c) => F.status === 'todos' || (F.status === 'pago' ? _dashGfEhPago(c) : !_dashGfEhPago(c));
  const temFiltro = F.mes !== null || F.status !== 'todos' || F.fornecedorIds.size > 0 || F.categoriaIds.size > 0;
  document.querySelectorAll('[data-dashgf-status]').forEach(botao => {
    const ativo = botao.dataset.dashgfStatus === F.status;
    botao.style.background = ativo ? 'rgba(59,130,246,.28)' : 'transparent';
    botao.style.color = ativo ? '#fff' : 'var(--text-muted)';
    botao.style.fontWeight = ativo ? '800' : '500';
  });

  // ── Chips de filtros ativos + botão limpar ──
  const chips = document.getElementById('dashGfChips');
  const btnLimpar = document.getElementById('dashGfLimparBtn');
  if (btnLimpar) btnLimpar.style.display = temFiltro ? '' : 'none';
  if (chips) {
    if (!temFiltro) { chips.style.display = 'none'; chips.innerHTML = ''; }
    else {
      const partes = [];
      const chip = (rotulo, acao) => `<span style="display:inline-flex;align-items:center;gap:6px;font-size:12px;background:rgba(59,130,246,0.15);border:1px solid rgba(59,130,246,0.4);border-radius:99px;padding:3px 10px;">${rotulo}<span onclick="${acao}" style="cursor:pointer;font-weight:bold;opacity:.8;">✕</span></span>`;
      if (F.mes !== null) partes.push(chip(`📅 ${_dashGfNomesMes[F.mes]}/${_dashGfAno}`, `dashGfToggleMes(${F.mes})`));
      if (F.status !== 'todos') partes.push(chip(F.status === 'pago' ? '✅ Pagos' : '⏳ Pendentes', `dashGfAlterarStatus('todos')`));
      F.fornecedorIds.forEach(idF => {
        const nomeF = idF === 'sem' ? 'Sem fornecedor' : (_dashGfDados.find(c => String(c.fornecedor_id) === idF)?.fornecedores?.nome || 'Fornecedor');
        partes.push(chip(`🏢 ${escaparHtmlBasico(nomeF)}`, `dashGfToggleFornecedor('${_dashGfSanitizarChave(idF)}')`));
      });
      F.categoriaIds.forEach(idC => {
        const cat = idC === 'sem' ? null : _dashGfCategoriasMapa[idC];
        partes.push(chip(`🏷️ ${escaparHtmlBasico(cat?.nome || 'Sem categoria')}`, `dashGfToggleCategoria('${_dashGfSanitizarChave(idC)}')`));
      });
      chips.style.display = 'flex';
      chips.innerHTML = '<span style="font-size:12px;color:var(--text-muted);align-self:center;">Filtros ativos:</span>' + partes.join('');
    }
  }

  // ── Resumo (todos os filtros aplicados) ──
  const contasResumo = _dashGfDados.filter(c => filtraForn(c) && filtraCat(c) && filtraMes(c) && filtraStatus(c));
  let totalPago = 0, totalPendente = 0;
  contasResumo.forEach(c => {
    const v = _dashGfValorDe(c);
    if (_dashGfEhPago(c)) totalPago += v; else totalPendente += v;
  });
  const elPago = document.getElementById('dashGfTotalPago');
  const elPend = document.getElementById('dashGfTotalPendente');
  const elGeral = document.getElementById('dashGfTotalGeral');
  const elQtd = document.getElementById('dashGfTotalQtd');
  const elTicket = document.getElementById('dashGfTicketMedio');
  if (elPago) elPago.textContent = fmt(totalPago);
  if (elPend) elPend.textContent = fmt(totalPendente);
  if (elGeral) elGeral.textContent = fmt(totalPago + totalPendente);
  if (elQtd) elQtd.textContent = String(contasResumo.length);
  if (elTicket) elTicket.textContent = fmt(contasResumo.length ? (totalPago + totalPendente) / contasResumo.length : 0);

  // ── Gráfico de barras mensal (filtrado por fornecedor + categoria; clique filtra o mês) ──
  const contasBarras = _dashGfDados.filter(c => filtraForn(c) && filtraCat(c) && filtraStatus(c));
  const meses = Array.from({ length: 12 }, () => ({ pago: 0, pendente: 0 }));
  contasBarras.forEach(c => {
    const m = _dashGfMesDe(c);
    if (m < 0 || m > 11) return;
    const v = _dashGfValorDe(c);
    if (_dashGfEhPago(c)) meses[m].pago += v; else meses[m].pendente += v;
  });
  const maxValor = Math.max(1, ...meses.map(m => Math.max(m.pago, m.pendente)));
  const elBarras = document.getElementById('dashGfBarras');
  const modoMesesCompacto = window.matchMedia('(max-width: 1100px)').matches;
  let barrasSvg = '';

  if (modoMesesCompacto) {
    barrasSvg = `<div class="dash-gf-meses-mobile">${meses.map((m, i) => {
      const selecionado = F.mes === i;
      const dim = F.mes !== null && !selecionado;
      const pagoPct = Math.max(m.pago > 0 ? 4 : 0, (m.pago / maxValor) * 100);
      const pendPct = Math.max(m.pendente > 0 ? 4 : 0, (m.pendente / maxValor) * 100);
      return `<button type="button" class="dash-gf-mes-card${selecionado ? ' selecionado' : ''}" style="opacity:${dim ? '.42' : '1'}" onclick="dashGfToggleMes(${i})">
        <strong>${_dashGfNomesMes[i]}</strong>
        <span class="dash-gf-mini-barras" aria-hidden="true"><i style="width:${pagoPct.toFixed(1)}%;background:#22c55e"></i><i style="width:${pendPct.toFixed(1)}%;background:#f59e0b"></i></span>
        <span class="dash-gf-mes-valor pago"><b>Pago</b>${fmt(m.pago)}</span>
        <span class="dash-gf-mes-valor pendente"><b>Pendente</b>${fmt(m.pendente)}</span>
      </button>`;
    }).join('')}</div>`;
  } else {
    const larguraDisponivel = Math.max(600, Math.floor(elBarras?.clientWidth || 960));
    const larguraMes = larguraDisponivel / 12;
    const alturaGraf = 190, baseY = alturaGraf + 28, larguraTotal = larguraDisponivel;
    const escala = alturaGraf / maxValor;
    const larBarra = Math.max(12, Math.min(25, (larguraMes - 12) / 2));
    const gap = Math.max(3, Math.min(6, larguraMes * .06));
    const totalLar = larBarra * 2 + gap;
    barrasSvg = `<svg viewBox="0 0 ${larguraTotal} ${baseY + 24}" width="100%" height="${baseY + 24}" preserveAspectRatio="xMidYMid meet" style="display:block;max-width:100%;font-family:inherit;">`;
    meses.forEach((m, i) => {
      const x = i * larguraMes;
      const hPago = Math.round(m.pago * escala);
      const hPend = Math.round(m.pendente * escala);
      const offsetX = (larguraMes - totalLar) / 2;
      const selecionado = F.mes === i;
      const dim = F.mes !== null && !selecionado;
      const op = dim ? 0.3 : 1;
      const totalMes = m.pago + m.pendente;
      const topoMaiorBarra = baseY - Math.max(hPago, hPend);
      barrasSvg += `<rect x="${x + 2}" y="0" width="${Math.max(1, larguraMes - 4)}" height="${baseY + 20}" fill="transparent" style="cursor:pointer;" onclick="dashGfToggleMes(${i})"><title>${_dashGfNomesMes[i]} — Pago: ${fmt(m.pago)} · Pendente: ${fmt(m.pendente)} · Total: ${fmt(totalMes)}</title></rect>`;
      if (selecionado) barrasSvg += `<rect x="${x + 2}" y="0" width="${Math.max(1, larguraMes - 4)}" height="${baseY + 20}" rx="6" fill="rgba(59,130,246,0.12)" stroke="rgba(59,130,246,0.5)" pointer-events="none"/>`;
      if (totalMes > 0) barrasSvg += `<text x="${x + larguraMes / 2}" y="${Math.max(10, topoMaiorBarra - 7)}" text-anchor="middle" font-size="8" font-weight="700" fill="var(--text,#fff)" opacity="${op}">${_dashGfValorCompacto(totalMes)}</text>`;
      if (hPago > 0) barrasSvg += `<rect x="${x + offsetX}" y="${baseY - hPago}" width="${larBarra}" height="${hPago}" rx="3" fill="#22c55e" opacity="${op}" style="cursor:pointer;" onclick="dashGfToggleMes(${i})"><title>${_dashGfNomesMes[i]} — Pago: ${fmt(m.pago)}</title></rect>`;
      if (hPend > 0) barrasSvg += `<rect x="${x + offsetX + larBarra + gap}" y="${baseY - hPend}" width="${larBarra}" height="${hPend}" rx="3" fill="#f59e0b" opacity="${op}" style="cursor:pointer;" onclick="dashGfToggleMes(${i})"><title>${_dashGfNomesMes[i]} — Pendente: ${fmt(m.pendente)}</title></rect>`;
      barrasSvg += `<text x="${x + larguraMes / 2}" y="${baseY + 16}" text-anchor="middle" font-size="10" font-weight="${selecionado ? 'bold' : 'normal'}" fill="${selecionado ? 'var(--text,#fff)' : 'var(--text-muted,#888)'}" style="cursor:pointer;" onclick="dashGfToggleMes(${i})">${_dashGfNomesMes[i]}</text>`;
    });
    barrasSvg += '</svg>';
  }
  barrasSvg += `<div class="dash-gf-legenda-barras" style="display:flex;gap:16px;font-size:11px;margin-top:6px;">
    <span style="display:flex;align-items:center;gap:5px;"><span style="width:11px;height:11px;background:#22c55e;border-radius:2px;display:inline-block;"></span>Pago</span>
    <span style="display:flex;align-items:center;gap:5px;"><span style="width:11px;height:11px;background:#f59e0b;border-radius:2px;display:inline-block;"></span>Pendente</span>
  </div>`;
  if (elBarras) elBarras.innerHTML = barrasSvg;

  // ── Rosca por fornecedor (filtrada por mês + categoria; clique filtra fornecedor) ──
  const contasForn = _dashGfDados.filter(c => filtraMes(c) && filtraCat(c) && filtraStatus(c));
  const porForn = {};
  contasForn.forEach(c => {
    const chave = _dashGfChaveFornecedor(c);
    if (!porForn[chave]) porForn[chave] = { nome: c.fornecedores?.nome || 'Sem fornecedor', cor: c.fornecedores?.cor || null, valor: 0 };
    porForn[chave].valor += _dashGfValorDe(c);
  });
  const ordForn = Object.entries(porForn).filter(([, o]) => o.valor > 0).sort((a, b) =>
    _dashGfOrdenacaoDetalhe === 'fornecedor'
      ? a[1].nome.localeCompare(b[1].nome, 'pt-BR')
      : b[1].valor - a[1].valor
  ).slice(0, 12);
  const totalForn = ordForn.reduce((s, [, o]) => s + o.valor, 0);
  const elRosca = document.getElementById('dashGfRosca');
  if (elRosca) {
    if (!totalForn) {
      elRosca.innerHTML = '<div class="empty" style="padding:20px;">Sem dados para o período/filtros.</div>';
    } else {
      const itens = ordForn.map(([chave, o], i) => ({
        chave, nome: o.nome, valor: o.valor,
        cor: o.cor || _dashGfCores[i % _dashGfCores.length], // cor cadastrada no fornecedor tem prioridade
        selecionado: F.fornecedorIds.has(chave)
      }));
      elRosca.innerHTML =
        _dashGfDesenharRosca(itens, totalForn, 'dashGfToggleFornecedor', F.fornecedorIds.size > 0) +
        `<div style="flex:1;min-width:200px;">${_dashGfLegendaRosca(itens, totalForn, 'dashGfToggleFornecedor', F.fornecedorIds.size > 0)}</div>`;
    }
  }

  // ── Rosca por categoria (filtrada por mês + fornecedor; clique filtra categoria) ──
  const contasCat = _dashGfDados.filter(c => filtraMes(c) && filtraForn(c) && filtraStatus(c));
  const porCat = {};
  contasCat.forEach(c => {
    const chave = _dashGfChaveCategoria(c);
    if (!porCat[chave]) {
      const cat = chave === 'sem' ? null : _dashGfCategoriasMapa[chave];
      porCat[chave] = { nome: cat?.nome || 'Sem categoria', cor: cat?.cor || null, icone: cat?.icone || null, valor: 0 };
    }
    porCat[chave].valor += _dashGfValorDe(c);
  });
  const ordCat = Object.entries(porCat).filter(([, o]) => o.valor > 0).sort((a, b) =>
    _dashGfOrdenacaoDetalhe === 'categoria'
      ? a[1].nome.localeCompare(b[1].nome, 'pt-BR')
      : b[1].valor - a[1].valor
  ).slice(0, 12);
  const totalCat = ordCat.reduce((s, [, o]) => s + o.valor, 0);
  const elRoscaCat = document.getElementById('dashGfRoscaCategoria');
  if (elRoscaCat) {
    if (!totalCat) {
      elRoscaCat.innerHTML = '<div class="empty" style="padding:20px;">Sem dados para o período/filtros.</div>';
    } else {
      const itens = ordCat.map(([chave, o], i) => ({
        chave, nome: o.nome, valor: o.valor, icone: o.icone,
        cor: o.cor || _dashGfCores[i % _dashGfCores.length],
        selecionado: F.categoriaIds.has(chave)
      }));
      elRoscaCat.innerHTML =
        _dashGfDesenharRosca(itens, totalCat, 'dashGfToggleCategoria', F.categoriaIds.size > 0) +
        `<div style="flex:1;min-width:200px;">${_dashGfLegendaRosca(itens, totalCat, 'dashGfToggleCategoria', F.categoriaIds.size > 0)}</div>`;
    }
  }

  // Todas as categorias com valor
const topCategorias = ordCat.filter(([, item]) => Number(item.valor || 0) > 0);
  const elTopCategorias = document.getElementById('dashGfTopCategorias');
  const elTopCategoriasTitulo = document.getElementById('dashGfTopCategoriasTitulo');
  if (elTopCategoriasTitulo) elTopCategoriasTitulo.innerHTML = _dashGfOrdenacaoDetalhe === 'categoria'
    ? 'Categorias em ordem A–Z · <span style="opacity:.8;">clique para filtrar</span>'
    : 'Categorias com gasto · <span style="opacity:.8;">clique para filtrar</span>';
  if (elTopCategorias) {
    if (!topCategorias.length) {
      elTopCategorias.innerHTML = '<div class="empty" style="padding:20px;">Sem categorias no período/filtros.</div>';
    } else {
      const maior = Math.max(1, ...topCategorias.map(([, item]) => Number(item.valor || 0)));
      elTopCategorias.innerHTML = topCategorias.map(([chave, item], indice) => {
        const percentual = Math.max(3, (item.valor / maior) * 100);
        return `<button type="button" class="dash-gf-category-rank${F.categoriaIds.has(chave) ? ' is-selected' : ''}" onclick="dashGfToggleCategoria('${_dashGfSanitizarChave(chave)}')" title="Filtrar por ${escaparHtmlBasico(item.nome)}">
          <strong class="dash-gf-category-position${indice < 3 ? ' is-top' : ''}">${indice + 1}º</strong>
          <span class="dash-gf-category-name">${htmlIconeCategoriaCompra(item.icone, 28)}<span>${escaparHtmlBasico(item.nome)}</span></span>
          <span class="dash-gf-category-track"><span style="width:${percentual.toFixed(1)}%;background:linear-gradient(90deg,${item.cor || '#3b82f6'},#22c55e);"></span></span>
          <strong class="dash-gf-category-value">${fmt(item.valor)}</strong>
        </button>`;
      }).join('');
    }
  }

  const elCurva = document.getElementById('dashGfCurvaCategoria');
  const elCurvaTitulo = document.getElementById('dashGfCurvaTitulo');
  if (elCurva) {
    if (!topCategorias.length) {
      elCurva.innerHTML = '<div class="empty" style="padding:20px;">Sem dados para desenhar a curva.</div>';
    } else {
      const [categoriaLiderId, categoriaLider] = topCategorias[0];
      const valoresMes = Array(12).fill(0);
      _dashGfDados.filter(c => filtraForn(c) && filtraStatus(c) && _dashGfChaveCategoria(c) === categoriaLiderId).forEach(c => {
        const mes = _dashGfMesDe(c);
        if (mes >= 0 && mes < 12) valoresMes[mes] += _dashGfValorDe(c);
      });
      const curvaMobile = window.matchMedia('(max-width: 1100px)').matches;
      const largura = curvaMobile ? 300 : 620;
      const altura = curvaMobile ? 132 : 190;
      const margemX = curvaMobile ? 14 : 28;
      const margemY = curvaMobile ? 16 : 20;
      const maximo = Math.max(1, ...valoresMes);
      const pontos = valoresMes.map((valor, indice) => ({
        x: margemX + indice * ((largura - margemX * 2) / 11),
        y: altura - margemY - (valor / maximo) * (altura - margemY * 2),
        valor,
      }));
      const ultimoMesComValor = Math.max(0, valoresMes.reduce((ultimo, valor, indice) => valor > 0 ? indice : ultimo, 0));
      const pontosCurva = pontos.slice(0, ultimoMesComValor + 1);
      const linha = pontosCurva.map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
      const ultimoPonto = pontosCurva[pontosCurva.length - 1];
      const area = `${linha} L ${ultimoPonto.x.toFixed(1)} ${altura - margemY} L ${pontosCurva[0].x.toFixed(1)} ${altura - margemY} Z`;
      const cor = categoriaLider.cor || '#3b82f6';
      elCurvaTitulo.textContent = `Curva mensal: ${categoriaLider.nome} · seta indica o mês mais recente`;
      elCurva.innerHTML = `<svg viewBox="0 0 ${largura} ${altura + 20}" width="100%" style="font-family:inherit;display:block;">
        <defs>
          <linearGradient id="dashGfCurvaArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${cor}" stop-opacity=".38"/><stop offset="1" stop-color="${cor}" stop-opacity=".02"/></linearGradient>
          <marker id="dashGfCurvaSeta" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="${cor}"/></marker>
        </defs>
        <path d="${area}" fill="url(#dashGfCurvaArea)"/>
        <path d="${linha}" fill="none" stroke="${cor}" stroke-width="${curvaMobile ? 2.5 : 3}" stroke-linecap="round" stroke-linejoin="round" marker-end="url(#dashGfCurvaSeta)"/>
        ${pontos.map((p, i) => `<circle cx="${p.x}" cy="${p.y}" r="${p.valor ? (curvaMobile ? 3 : 4) : 2}" fill="${p.valor ? cor : 'var(--text-muted)'}"><title>${_dashGfNomesMes[i]}: ${fmt(p.valor)}</title></circle><text x="${p.x}" y="${altura + 10}" text-anchor="middle" font-size="${curvaMobile ? 8 : 10}" fill="var(--text-muted)">${_dashGfNomesMes[i]}</text>`).join('')}
      </svg>`;
    }
  }

  // ── Detalhamento dos lançamentos quando há filtro ativo (cruzamento de informações) ──
  const elDetalhe = document.getElementById('dashGfDetalhe');
  if (elDetalhe) {
    if (!temFiltro || !contasResumo.length) {
      elDetalhe.innerHTML = temFiltro
        ? '<div class="empty" style="padding:14px;">Nenhum lançamento para os filtros selecionados.</div>'
        : '';
    } else {
      const LIMITE = 60;
      const textoOrdenacao = (c, chave) => {
        if (chave === 'fornecedor') return c.fornecedores?.nome || '';
        if (chave === 'categoria') return c.categoria_id ? _dashGfCategoriasMapa[String(c.categoria_id)]?.nome || '' : 'Sem categoria';
        if (chave === 'observacao') return c.observacao || '';
        if (chave === 'status') return _dashGfEhPago(c) ? 'Pago' : 'Pendente';
        return '';
      };
      const ordenadas = [...contasResumo].sort((a, b) => {
        const chave = _dashGfOrdenacaoDetalhe === 'data' ? (_dashGfModoData === 'compra' ? 'compra' : 'vencimento') : _dashGfOrdenacaoDetalhe;
        let cmp = 0;
        if (chave === 'valor') cmp = _dashGfValorDe(a) - _dashGfValorDe(b);
        else if (chave === 'vencimento') cmp = String(a.data_vencimento || '').localeCompare(String(b.data_vencimento || ''));
        else if (chave === 'compra') cmp = String(a.data_compra || '').localeCompare(String(b.data_compra || ''));
        else if (chave === 'lancamento') cmp = String(a.created_at || '').localeCompare(String(b.created_at || ''));
        else cmp = textoOrdenacao(a, chave).localeCompare(textoOrdenacao(b, chave), 'pt-BR', { sensitivity:'base', numeric:true });
        if (cmp === 0) cmp = String(a.id || '').localeCompare(String(b.id || ''));
        return _dashGfDirecaoDetalhe === 'asc' ? cmp : -cmp;
      });
      const cabecalhoOrdenavel = (chave, rotulo, classe) => {
        const ativa = (_dashGfOrdenacaoDetalhe === 'data' ? (_dashGfModoData === 'compra' ? 'compra' : 'vencimento') : _dashGfOrdenacaoDetalhe) === chave;
        const seta = ativa ? (_dashGfDirecaoDetalhe === 'asc' ? '▲' : '▼') : '↕';
        return `<th class="${classe} ${ativa ? 'ordenacao-ativa' : ''}" aria-sort="${ativa ? (_dashGfDirecaoDetalhe === 'asc' ? 'ascending' : 'descending') : 'none'}"><button type="button" onclick="dashGfOrdenarColuna('${chave}')">${escaparHtmlBasico(rotulo)} <span>${seta}</span></button></th>`;
      };
      const linhas = ordenadas.slice(0, LIMITE).map(c => {
        const pago = _dashGfEhPago(c);
        const cat = c.categoria_id ? _dashGfCategoriasMapa[String(c.categoria_id)] : null;
        const dv = String(c.data_vencimento || '').slice(0, 10).split('-').reverse().join('/');
        const dc = String(c.data_compra || '').slice(0, 10).split('-').reverse().join('/');
        let dlanca = '—';
        const dataLancamento = c.created_at || c.data_compra || '';
        if (dataLancamento) {
          try {
            const d = new Date(String(dataLancamento).includes('T') ? dataLancamento : `${dataLancamento}T12:00:00`);
            dlanca = d.toLocaleDateString('pt-BR') + (c.created_at ? ' ' + d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) : '');
          } catch(e) { dlanca = String(dataLancamento).slice(0,10).split('-').reverse().join('/'); }
        }
        const fornecedorDetalhe = escaparHtmlBasico(c.fornecedores?.nome || 'Sem fornecedor');
        const categoriaDetalhe = escaparHtmlBasico(cat?.nome || 'Sem categoria');
        const observacaoDetalhe = escaparHtmlBasico(String(c.observacao || '—').slice(0, 80));
        return `<tr class="dash-gf-detail-row">
          <td class="dash-gf-col-data" data-label="Vencimento">${escaparHtmlBasico(dv)}</td>
          <td class="dash-gf-col-valor" data-label="Valor"><strong>${fmt(_dashGfValorDe(c))}</strong></td>
          <td class="dash-gf-col-lancado" data-label="Lançado em">${escaparHtmlBasico(dlanca)}</td>
          <td class="dash-gf-col-fornecedor" data-label="Fornecedor" title="${fornecedorDetalhe}">${fornecedorDetalhe}</td>
          <td class="dash-gf-col-categoria" data-label="Categoria" title="${categoriaDetalhe}">${categoriaDetalhe}</td>
          <td class="dash-gf-col-compra" data-label="Compra">${escaparHtmlBasico(dc||'—')}</td>
          <td class="dash-gf-col-observacao" data-label="Observação" title="${observacaoDetalhe}">${observacaoDetalhe}</td>
          <td class="dash-gf-col-status" data-label="Status"><span class="dash-gf-status ${pago ? 'pago' : 'pendente'}">${pago ? 'Pago' : 'Pendente'}</span></td>
        </tr>`;
      }).join('');
      elDetalhe.innerHTML = `
        <div class="dash-gf-detail-title">Detalhamento dos lançamentos filtrados (${contasResumo.length}${contasResumo.length > LIMITE ? `, exibindo ${LIMITE}` : ''})</div>
        <div class="dash-gf-detail-hint">No celular ou tablet, arraste a tabela para os lados para ver todas as colunas.</div>
        <div class="dash-gf-detail-wrap">
          <table class="dash-gf-detail-table">
            <thead>
              <tr>
                ${cabecalhoOrdenavel('vencimento','Vencimento','dash-gf-col-data')}
                ${cabecalhoOrdenavel('valor','Valor','dash-gf-col-valor')}
                ${cabecalhoOrdenavel('lancamento','Lançado em','dash-gf-col-lancado')}
                ${cabecalhoOrdenavel('fornecedor','Fornecedor','dash-gf-col-fornecedor')}
                ${cabecalhoOrdenavel('categoria','Categoria','dash-gf-col-categoria')}
                ${cabecalhoOrdenavel('compra','Compra','dash-gf-col-compra')}
                ${cabecalhoOrdenavel('observacao','Observação','dash-gf-col-observacao')}
                ${cabecalhoOrdenavel('status','Status','dash-gf-col-status')}
              </tr>
            </thead>
            <tbody>${linhas}</tbody>
          </table>
        </div>`;
    }
  }
}

let _dashGfResizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(_dashGfResizeTimer);
  _dashGfResizeTimer = setTimeout(() => {
    if (_dashGfDados.length && document.getElementById('dashboard')?.classList.contains('ativa')) {
      renderizarGraficosFinanceirosDashboard();
    }
  }, 180);
}, { passive: true });

function widgetDragEnd(e) {
  document.querySelectorAll('[data-wid]').forEach(el => {
    el.classList.remove('dragging-widget');
    el.classList.remove('drag-over-widget');
  });
  _widgetDragSrc = null;
}
// ─────────────────────────────────────────────────────────────────
async function removerWidgetMeuPainel(wid) {
  _meuPainelConfig = _meuPainelConfig.filter(w => w !== wid);
  await salvarPreferenciaMeuPainel('meu_painel_widgets', _meuPainelConfig);
  await renderizarMeuPainel();
}
// ══════════════════════════════════════════════════════════════════

async function carregarDashboard() {
  carregarNotificacoes();
  carregarGraficosFinanceirosDashboard();

  const el = document.getElementById('dash-execucoes');
  if (!el) return;
  el.innerHTML = '<div class="empty">Carregando...</div>';
  const [funcionariosRes, execucoesRecentesRes] = await Promise.all([
    sb.from('funcionarios').select('id, nome').eq('ativo', true),
    sb.from('checklist_execucoes')
      .select('id, status, funcionario_id, iniciado_em, inicio_confirmado_em, finalizado_em, finalizacao_confirmada_em, tarefas(nome, descricao, horario_limite), checklists(nome)')
      .order('iniciado_em', { ascending: false })
      .limit(12),
  ]);
  const funcionariosMap = Object.fromEntries((funcionariosRes?.data || []).map(item => [String(item.id), item.nome || 'Funcionário']));
  const execucoesRecentes = execucoesRecentesRes?.data || [];
  if (execucoesRecentesRes?.error || !execucoesRecentes.length) {
    el.innerHTML = '<div class="empty">Nenhuma execução encontrada</div>';
    return;
  }
  el.innerHTML = `<table class="recent-table">
    <thead><tr><th>Tarefa</th><th>Funcionário</th><th>Início</th><th>Fim</th><th>Status</th><th></th></tr></thead>
    <tbody>${execucoesRecentes.map(e => {
      const inicio = e.inicio_confirmado_em || e.iniciado_em || null;
      const fim = e.finalizacao_confirmada_em || e.finalizado_em || null;
      const nomeTarefa = e.tarefas?.nome ?? e.checklists?.nome ?? '-';
      const nomeFuncionario = funcionariosMap[String(e.funcionario_id)] ?? '-';
      return `<tr><td>${nomeTarefa}</td><td>${nomeFuncionario}</td><td>${fmtDate(inicio)}</td><td>${fmtDate(fim)}</td><td>${tagStatus(e.status)}</td><td>${e.status === 'aberto' || e.status === 'pausado' ? `<button class="btn btn-amber btn-sm" onclick="abrirModal('${e.id}')">Abrir</button>` : ''}</td></tr>`;
    }).join('')}</tbody>
  </table>`;
}

function trocarPeriodoProdutividade(periodo, botao = null) {
  dashboardProdutividadePeriodo = periodo;
  document.querySelectorAll('.dashboard-period-btn[data-prod-periodo]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.prodPeriodo === periodo);
  });
  if (botao) botao.classList.add('active');
  carregarProdutividadeDashboard();
}

const PRODUTIVIDADE_PIE_CORES = [
  '#22c55e',
  '#84cc16',
  '#0ea5e9',
  '#f59e0b',
  '#14b8a6',
  '#a78bfa',
  '#f97316',
  '#ef4444',
  '#64748b',
  '#16a34a',
];

function distribuirPercentuaisFuncionarios(lista = [], total = 0) {
  if (!lista.length || total <= 0) {
    return (lista || []).map((item, index) => ({ ...item, percentual: 0, percentualPizza: 0, cor: PRODUTIVIDADE_PIE_CORES[index % PRODUTIVIDADE_PIE_CORES.length] }));
  }

  const base = lista.map((item, index) => {
    const bruto = (item.quantidade / total) * 100;
    const inteiro = Math.floor(bruto);
    return {
      ...item,
      _index: index,
      _fracao: bruto - inteiro,
      percentualPizza: inteiro,
      cor: PRODUTIVIDADE_PIE_CORES[index % PRODUTIVIDADE_PIE_CORES.length],
    };
  });

  let faltante = 100 - base.reduce((acc, item) => acc + item.percentualPizza, 0);
  const prioridade = [...base].sort((a, b) => b._fracao - a._fracao || b.quantidade - a.quantidade);

  for (let i = 0; i < faltante; i += 1) {
    prioridade[i % prioridade.length].percentualPizza += 1;
  }

  return base
    .sort((a, b) => a._index - b._index)
    .map(item => ({
      nome: item.nome,
      quantidade: item.quantidade,
      percentual: item.percentualPizza,
      percentualPizza: item.percentualPizza,
      cor: item.cor,
    }));
}

function atualizarPizzaProdutividade(participacao = [], totalFinalizadas = 0) {
  const pie = document.getElementById('prodPieDia');
  const valor = document.getElementById('prodPieValorDia');
  const label = document.getElementById('prodPieLabelDia');
  if (!pie || !valor) return;

  if (!totalFinalizadas || !participacao.length) {
    pie.style.background = 'conic-gradient(rgba(107,143,112,0.25) 0deg 360deg)';
    valor.textContent = '0%';
    if (label) label.textContent = 'Sem finalizadas';
    return;
  }

  let acumulado = 0;
  const faixas = participacao.map((item, idx) => {
    const inicio = acumulado;
    acumulado += item.percentualPizza;
    const fim = idx === participacao.length - 1 ? 100 : acumulado;
    return `${item.cor} ${inicio}% ${fim}%`;
  });

  pie.style.background = `conic-gradient(${faixas.join(', ')})`;
  valor.textContent = '100%';
  if (label) label.textContent = 'Finalizadas';
}

function obterIntervaloProdutividade(periodo = 'dia') {
  const agora = new Date();
  const diaAtual = dataLocalISO(agora);

  if (periodo === 'mes') {
    const inicio = dataLocalISO(new Date(agora.getFullYear(), agora.getMonth(), 1));
    const fim = dataLocalISO(new Date(agora.getFullYear(), agora.getMonth() + 1, 0));
    return { inicio, fim, info: `Periodo: ${inicio} ate ${fim}.`, labelTotal: 'Total no mes' };
  }

  if (periodo === 'semana') {
    const diaSemana = agora.getDay();
    const deslocamentoSegunda = diaSemana === 0 ? -6 : 1 - diaSemana;
    const inicioData = new Date(agora);
    inicioData.setDate(agora.getDate() + deslocamentoSegunda);
    const fimData = new Date(inicioData);
    fimData.setDate(inicioData.getDate() + 6);
    const inicio = dataLocalISO(inicioData);
    const fim = dataLocalISO(fimData);
    return { inicio, fim, info: `Periodo: ${inicio} ate ${fim}.`, labelTotal: 'Total na semana' };
  }

  return { inicio: diaAtual, fim: diaAtual, info: `Periodo: ${diaAtual}.`, labelTotal: 'Total no dia' };
}

function renderizarParticipacaoFuncionarios(participacao = []) {
  const el = document.getElementById('prodFuncionariosLista');
  if (!el) return;

  if (!participacao.length) {
    el.innerHTML = '<div class="empty">Sem dados para o periodo.</div>';
    return;
  }

  el.innerHTML = participacao.map(item => `
    <div class="prod-func-row">
      <div class="prod-func-left">
        <span class="prod-func-dot" style="background:${item.cor || 'var(--green)'}"></span>
        <div class="prod-func-name">${item.nome}</div>
      </div>
      <div class="prod-func-pct">${item.percentual}%</div>
    </div>
  `).join('');
}

function preencherResumoProdutividade({ total = 0, finalizadas = 0, abertas = 0, pausadas = 0, info = 'Periodo: hoje.', labelTotal = 'Total no dia' } = {}) {
  const totalEl = document.getElementById('prodDiaTotal');
  const finalizadasEl = document.getElementById('prodDiaFinalizadas');
  const abertasEl = document.getElementById('prodDiaAbertas');
  const pausadasEl = document.getElementById('prodDiaPausadas');
  const infoEl = document.getElementById('prodDiaInfo');
  const totalLabelEl = document.getElementById('prodTotalLabel');

  if (totalEl) totalEl.textContent = String(total);
  if (finalizadasEl) finalizadasEl.textContent = String(finalizadas);
  if (abertasEl) abertasEl.textContent = String(abertas);
  if (pausadasEl) pausadasEl.textContent = String(pausadas);
  if (infoEl) infoEl.textContent = info;
  if (totalLabelEl) totalLabelEl.textContent = labelTotal;
}

async function carregarProdutividadeDiaDashboard(periodo = 'dia') {
  const { inicio, fim, info, labelTotal } = obterIntervaloProdutividade(periodo);
  const [totalRes, finalizadasRes, abertasRes, pausadasRes] = await Promise.all([
    sb.from('checklist_execucoes').select('*', { count: 'exact', head: true }).gte('data_execucao', inicio).lte('data_execucao', fim),
    sb.from('checklist_execucoes').select('*', { count: 'exact', head: true }).gte('data_execucao', inicio).lte('data_execucao', fim).eq('status', 'finalizado'),
    sb.from('checklist_execucoes').select('*', { count: 'exact', head: true }).gte('data_execucao', inicio).lte('data_execucao', fim).eq('status', 'aberto'),
    sb.from('checklist_execucoes').select('*', { count: 'exact', head: true }).gte('data_execucao', inicio).lte('data_execucao', fim).eq('status', 'pausado'),
  ]);

  if (totalRes.error || finalizadasRes.error || abertasRes.error || pausadasRes.error) {
    throw totalRes.error || finalizadasRes.error || abertasRes.error || pausadasRes.error;
  }

  // Tenta buscar participação com usuario_fim_id; cai para funcionario_id se coluna não existir.
  let participacaoRows = [];
  const participacaoResCompleta = await sb
    .from('checklist_execucoes')
    .select('funcionario_id, usuario_fim_id')
    .gte('data_execucao', inicio)
    .lte('data_execucao', fim)
    .eq('status', 'finalizado');

  if (participacaoResCompleta.error) {
    const msgErr = String(participacaoResCompleta.error?.message || '').toLowerCase();
    const codigoErr = participacaoResCompleta.error?.code;
    if (codigoErr === '42703' && msgErr.includes('usuario_fim_id')) {
      // Coluna ainda não existe no banco — usa apenas funcionario_id
      const fallback = await sb
        .from('checklist_execucoes')
        .select('funcionario_id')
        .gte('data_execucao', inicio)
        .lte('data_execucao', fim)
        .eq('status', 'finalizado');
      participacaoRows = (fallback.data || []).map(r => ({ funcionario_id: r.funcionario_id, usuario_fim_id: null }));
    } else {
      throw participacaoResCompleta.error;
    }
  } else {
    participacaoRows = participacaoResCompleta.data || [];
  }
  const totalFinalizadas = finalizadasRes.count || 0;
  const contadorPorFuncionario = {};

  participacaoRows.forEach(item => {
    const chave = String(item.usuario_fim_id || item.funcionario_id || 'sem-funcionario');
    contadorPorFuncionario[chave] = (contadorPorFuncionario[chave] || 0) + 1;
  });

  const funcionarioIds = Object.keys(contadorPorFuncionario).filter(id => id !== 'sem-funcionario');
  let funcionariosMap = {};
  if (funcionarioIds.length) {
    const { data: funcionariosData } = await sb.from('funcionarios').select('id, nome').in('id', funcionarioIds);
    funcionariosMap = Object.fromEntries((funcionariosData || []).map(item => [String(item.id), item.nome]));
  }

  const participacaoBase = Object.entries(contadorPorFuncionario)
    .map(([id, quantidade]) => {
      const nome = id === 'sem-funcionario' ? 'Nao identificado' : (funcionariosMap[id] || 'Funcionario');
      return { nome, quantidade };
    })
    .sort((a, b) => b.quantidade - a.quantidade);

  const participacaoOrdenada = distribuirPercentuaisFuncionarios(participacaoBase, totalFinalizadas);
  atualizarPizzaProdutividade(participacaoOrdenada, totalFinalizadas);
  renderizarParticipacaoFuncionarios(participacaoOrdenada);

  preencherResumoProdutividade({
    total: totalRes.count || 0,
    finalizadas: finalizadasRes.count || 0,
    abertas: abertasRes.count || 0,
    pausadas: pausadasRes.count || 0,
    info,
    labelTotal,
  });
}

async function carregarProdutividadeDashboard() {
  const msgId = 'dash-produtividade-msg';
  setMsg(msgId, '', '');

  try {
    await carregarProdutividadeDiaDashboard(dashboardProdutividadePeriodo || 'dia');
  } catch (error) {
    console.error('Erro ao carregar produtividade do dashboard:', error);
    renderizarParticipacaoFuncionarios([]);
    preencherResumoProdutividade({
      total: 0,
      finalizadas: 0,
      abertas: 0,
      pausadas: 0,
      info: 'Periodo: indisponivel.',
    });
    setMsg(msgId, 'Nao foi possivel carregar o relatorio de produtividade.', 'err');
  }
}

function tagStatus(s) {
  if (s === 'finalizado') return '<span class="tag tag-green">Finalizado</span>';
  if (s === 'aberto') return '<span class="tag tag-amber">Em andamento</span>';
  if (s === 'pausado') return '<span class="tag tag-gray">Pausado</span>';
  return `<span class="tag tag-gray">${s}</span>`;
}

// 
