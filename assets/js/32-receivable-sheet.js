/* ══ NOVO RECEBÍVEL SHEET ══ */

const NR = {
  pagadorId: null, pagadorNome: null,
  valor: null,
  modoEdicao: false,
  lojaId: null,
};

// ── Helpers valor ────────────────────────────────────────────────
function nrParseValor(txt) {
  const s = String(txt || '').replace(/[R$\s]/g, '').trim();
  if (!s) return null;
  const norm = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(norm);
  return (isFinite(n) && n >= 0) ? Math.round(n * 100) / 100 : null;
}
function nrFmtBR(n) {
  if (!isFinite(n) || n == null) return '';
  return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function nrValorFocus(inp) { inp.value = inp.value.replace(/[R$\s]/g, '').trim(); setTimeout(() => inp.select(), 0); }
function nrValorInput(inp) { NR.valor = nrParseValor(inp.value); }
function nrValorBlur(inp) {
  const v = nrParseValor(inp.value);
  NR.valor = v;
  inp.value = (v != null) ? nrFmtBR(v) : '';
}

// ── Busca de pagador ─────────────────────────────────────────────
function nrBuscarPagador(t) {
  const res = document.getElementById('nrPagadorRes'); if (!res) return;
  if (!t || t.trim().length < 1) { res.innerHTML = ''; return; }
  const tU = t.trim().toUpperCase();
  const m = (fornecedoresFinanceiroCache || []).filter(f => (f.nome || '').toUpperCase().includes(tU)).slice(0, 6);
  if (!m.length) { res.innerHTML = '<div style="font-size:13px;color:var(--text-muted);padding:6px 0;">Nenhum encontrado.</div>'; return; }
  res.innerHTML = m.map(f => `<div class="nc-forn-card" onclick="nrSelPagador('${f.id}','${escaparHtmlBasico(f.nome || '')}')"><div style="font-size:15px;font-weight:700;color:var(--text);">${escaparHtmlBasico(f.nome || '')}</div><span style="color:var(--text-muted);font-size:22px;">›</span></div>`).join('');
}
function nrSelPagador(id, nome) {
  NR.pagadorId = String(id); NR.pagadorNome = nome || '';
  const res = document.getElementById('nrPagadorRes'); if (res) res.innerHTML = '';
  const bi = document.getElementById('nrPagadorBusca'); if (bi) bi.style.display = 'none';
  const sel = document.getElementById('nrPagadorSel'), nm = document.getElementById('nrPagadorSelNome');
  if (sel) sel.style.display = 'flex';
  if (nm) nm.textContent = nome;
  const hi = document.getElementById('nrPagadorId'); if (hi) hi.value = id;
}
function nrLimparPagador() {
  NR.pagadorId = null; NR.pagadorNome = '';
  const bi = document.getElementById('nrPagadorBusca'); if (bi) { bi.style.display = ''; bi.value = ''; }
  const sel = document.getElementById('nrPagadorSel'); if (sel) sel.style.display = 'none';
  const res = document.getElementById('nrPagadorRes'); if (res) res.innerHTML = '';
  const hi = document.getElementById('nrPagadorId'); if (hi) hi.value = '';
}

// ── Validação inline obs ─────────────────────────────────────────
function nrObsInput(inp) {
  const e = document.getElementById('recebivelObsErr');
  if (e) e.style.display = inp.value.trim() ? 'none' : '';
  if (inp) inp.style.borderColor = inp.value.trim() ? '' : 'var(--red)';
}

// ── Abrir / Fechar ───────────────────────────────────────────────
function nrAbrir(editar = false) {
  // Abre primeiro: o cadastro não pode depender do término das consultas da página.
  const ov = document.getElementById('nrOverlay');
  if (!ov) {
    console.error('Não foi possível abrir o cadastro: nrOverlay não encontrado.');
    return;
  }
  ov.style.display = 'flex';
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const sh = document.getElementById('nrSheet'); if (sh) sh.style.transform = 'translateY(0)';
  }));

  try {
    if (!editar) {
      Object.assign(NR, { pagadorId: null, pagadorNome: null, valor: null, modoEdicao: false, lojaId: null });
      nrLimparPagador();
      const vEl = document.getElementById('recebivelValor'); if (vEl) vEl.value = '';
      const obsEl = document.getElementById('recebivelObservacao'); if (obsEl) { obsEl.value = ''; obsEl.style.borderColor = ''; }
      const qtdEl = document.getElementById('recebivelQtdParcelas'); if (qtdEl) qtdEl.value = '1';
    const diasEl = document.getElementById('recebivelDiasIntervalo'); if (diasEl) diasEl.value = '30';
    const dataPrevistaEl = document.getElementById('recebivelDataPrevista'); if (dataPrevistaEl) dataPrevistaEl.value = '';
      ['nrQtdErr','nrDiasErr','recebivelObsErr'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
      const tt = document.getElementById('nrTitulo'); if (tt) tt.textContent = 'Novo recebível';
      const bs = document.getElementById('btnSalvarRecebivelFinanceiro'); if (bs) bs.textContent = '✓ Cadastrar recebível';
      const bc = document.getElementById('btnCancelarRecebivelFinanceiro'); if (bc) bc.style.display = 'none';
      const msg = document.getElementById('msgRecebivelFinanceiro'); if (msg) { msg.textContent = ''; msg.className = 'msg'; }
      preencherSelectRecebivelFormasPagamentoFinanceiro();
      preencherSelectRecebivelContasFinanceiras();
    }
  } catch (erroPreparacao) {
    console.warn('Cadastro aberto, mas não foi possível preparar todos os campos:', erroPreparacao);
  }

  const formaAtual = String(document.getElementById('recebivelFormaPagamentoId')?.value || '');
  const contaAtual = String(document.getElementById('recebivelContaFinanceiraId')?.value || '');
  const cargas = [];
  if (typeof carregarFornecedoresFinanceiro === 'function') cargas.push(carregarFornecedoresFinanceiro());
  if (typeof carregarFormasPagamentoFinanceiro === 'function') cargas.push(carregarFormasPagamentoFinanceiro({ render: false, silencioso: true }));
  if (typeof carregarContasFinanceiras === 'function') cargas.push(carregarContasFinanceiras({ render: false, silencioso: true }));
  Promise.allSettled(cargas).then(() => {
    preencherSelectRecebivelFormasPagamentoFinanceiro(formaAtual);
    preencherSelectRecebivelContasFinanceiras(contaAtual);
  });
}
function nrFechar() {
  const sh = document.getElementById('nrSheet'), ov = document.getElementById('nrOverlay');
  if (!sh || !ov) return;
  sh.style.transform = 'translateY(100%)';
  setTimeout(() => { ov.style.display = 'none'; }, 300);
}

// ════════════════════════════════════════════════════════════════
// GUARD DE PERMISSÕES - a interface só aparece após validar a sessão no banco
// ════════════════════════════════════════════════════════════════
(function() {
  const temSessao = localStorage.getItem('zuqui_auth')
    || localStorage.getItem('check_diario_auth_persistente')
    || sessionStorage.getItem('zuqui_auth')
    || sessionStorage.getItem('check_diario_auth_persistente');
  if (!temSessao) document.documentElement.classList.remove('admin-fouc-pendente');
})();
