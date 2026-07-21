/* ══ NOVA CONTA A PAGAR SHEET ══ */

// NC.modo: 'parcela' = usuário digita valor de cada parcela
//          'total'   = usuário digita o total e o sistema divide
const NC = {
  fornId: null, fornNome: null, catId: null,
  dataCompra: null, dataVenc: null,
  valor: null,
  obs: '',
  parcelas: 1, intervalo: 30,
  parcelado: false,
  modoEdicao: false,
  modo: 'total',
  lojaId: null,
  salvando: false,
  aplicarVencimentoGrupo: false,
};
window.NC = NC;

// ── Helpers de valor ────────────────────────────────────────────
function ncParseValor(txt) {
  const s = String(txt || '').replace(/[R$\s]/g, '').trim();
  if (!s) return null;
  const norm = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(norm);
  return (isFinite(n) && n >= 0) ? Math.round(n * 100) / 100 : null;
}

function ncFmtBR(n) {
  if (!isFinite(n) || n == null) return '';
  return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Campo Valor ──────────────────────────────────────────────────
function ncValorFocus(inp) {
  inp.value = inp.value.replace(/[R$\s]/g, '').trim();
  setTimeout(() => inp.select(), 0);
}
function ncValorInput(inp) { NC.valor = ncParseValor(inp.value); ncAtuParcelasInfo(); }
function ncValorBlur(inp) {
  const v = ncParseValor(inp.value);
  NC.valor = v;
  inp.value = (v != null) ? ncFmtBR(v) : '';
  ncAtuParcelasInfo();
}

// ── Modo: valor da parcela ou valor total ────────────────────────
function ncSetModo(modo) {
  NC.modo = modo;
  document.getElementById('ncModoParc')?.classList.toggle('nc-pill-sel', modo === 'parcela');
  document.getElementById('ncModoTotal')?.classList.toggle('nc-pill-sel', modo === 'total');
  ncAtuParcelasInfo();
}

function ncSyncParceladoUI() {
  const pc = document.getElementById('ncParcCustom');
  const btn = document.getElementById('ncToggleParcelado');
  const ativo = !!NC.parcelado;
  if (pc) {
    pc.disabled = !ativo;
    // Nao reescreve o campo enquanto o usuario esta digitando. Isso permite
    // apagar o valor atual e informar outro numero normalmente.
    if (document.activeElement !== pc) {
      pc.value = ativo ? String(Math.max(2, NC.parcelas || 2)) : '1';
    }
    pc.style.opacity = ativo ? '1' : '0.65';
  }
  if (btn) {
    btn.textContent = ativo ? 'Parcelado' : 'Parcelar';
    btn.className = `btn ${ativo ? 'btn-green' : 'btn-ghost'} btn-sm`;
    btn.setAttribute('aria-pressed', String(ativo));
  }
  const mw = document.getElementById('ncModoParcelasWrap');
  if (mw) mw.style.opacity = ativo ? '1' : '0.55';
  ncAtuParcelasInfo();
}

function ncSetParcelado(ativo) {
  NC.parcelado = !!ativo;
  if (!NC.parcelado) {
    NC.parcelas = 1;
    NC.modo = 'total';
    document.getElementById('ncModoTotal')?.classList.add('nc-pill-sel');
    document.getElementById('ncModoParc')?.classList.remove('nc-pill-sel');
  } else if (!NC.parcelas || NC.parcelas < 2) {
    NC.parcelas = 2;
  }
  ncSyncParceladoUI();
}

// ── Parcelas (input direto) ──────────────────────────────────────
function ncParcCust() {
  const pc = document.getElementById('ncParcCustom');
  const v = parseInt((pc && pc.value) || '0', 10) || 0;
  if (v > 1) NC.parcelado = true;
  if (v >= 1) NC.parcelas = v;
  const e = document.getElementById('ncParcErr');
  if (e) e.style.display = (v < 1) ? '' : 'none';
  // Atualiza somente os elementos dependentes; ncSyncParceladoUI alteraria o
  // proprio input no meio da edicao.
  const mw = document.getElementById('ncModoParcelasWrap');
  if (mw) mw.style.opacity = NC.parcelado ? '1' : '0.55';
  ncAtuParcelasInfo();
}

function ncParcBlur() {
  const pc = document.getElementById('ncParcCustom');
  const v = parseInt(pc?.value || '0', 10);
  if (!Number.isFinite(v) || v < 1) {
    NC.parcelas = NC.parcelado ? 2 : 1;
  }
  ncSyncParceladoUI();
}

// ── Vencimento ──────────────────────────────────────────────────
// ncVencDia: calcula dataVenc somando X dias a partir de hoje
function ncVencDiaInput(val) {
  const dias = parseInt(val, 10);
  const e = document.getElementById('ncVencDiaErr');
  if (isNaN(dias) || dias < 0) {
    if (e) e.style.display = '';
    return;
  }
  if (e) e.style.display = 'none';
  const base = new Date((NC.dataCompra || new Date().toISOString().split('T')[0]) + 'T00:00:00');
  base.setDate(base.getDate() + dias);
  NC.dataVenc = base.toISOString().split('T')[0];
  // Atualiza o calendário visualmente
  const vc = document.getElementById('ncVencCustom');
  if (vc) vc.value = NC.dataVenc;
}

// ncVencCust: usuário escolhe data direto no calendário
function ncVencCust() {
  const vc = document.getElementById('ncVencCustom');
  if (vc && vc.value) {
    NC.dataVenc = vc.value;
    // Na edição parcelada, a data escolhida é a nova âncora mensal e o
    // intervalo original deve permanecer 30; não pode virar a diferença
    // entre hoje e o vencimento selecionado.
    if (NC.modoEdicao && NC.parcelado) {
      const vdEl = document.getElementById('ncVencDia');
      if (vdEl) vdEl.value = String(NC.intervalo || 30);
      const e = document.getElementById('ncVencDiaErr');
      if (e) e.style.display = 'none';
      return;
    }
    // Em cadastro simples, calcula em relação à data da compra.
    const base = new Date((NC.dataCompra || new Date().toISOString().split('T')[0]) + 'T00:00:00');
    const venc = new Date(vc.value + 'T00:00:00');
    const diff = Math.round((venc - base) / (1000 * 60 * 60 * 24));
    const vdEl = document.getElementById('ncVencDia');
    if (vdEl) vdEl.value = diff >= 0 ? diff : '';
    const e = document.getElementById('ncVencDiaErr');
    if (e) e.style.display = 'none';
  }
}

// ── Info de parcelas calculado ───────────────────────────────────
function ncFornecedorSelecionado() {
  const id = String(NC.fornId || document.getElementById('contaFornecedorId')?.value || '').trim();
  if (!id) return null;
  return (fornecedoresFinanceiroCache || []).find(f => String(f.id) === id) || null;
}

function ncDataNoMesAtualPorDia(dia) {
  const n = parseInt(dia, 10);
  if (!Number.isFinite(n) || n < 1) return '';
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth();
  const ultimoDia = new Date(ano, mes + 1, 0).getDate();
  const diaFinal = Math.min(n, ultimoDia);
  return `${ano}-${String(mes + 1).padStart(2, '0')}-${String(diaFinal).padStart(2, '0')}`;
}

function ncDataVencimentoFornecedor(fornecedor, dataCompraISO = '') {
  const dia = parseInt(fornecedor?.dia_vencimento, 10);
  if (!Number.isFinite(dia) || dia < 1 || dia > 31) return '';

  const dataCompra = /^\d{4}-\d{2}-\d{2}$/.test(String(dataCompraISO || ''))
    ? dataCompraISO
    : new Date().toISOString().split('T')[0];

  if (fornecedor?.is_cartao && typeof faturaCalcularVencimentoPorDia === 'function') {
    return faturaCalcularVencimentoPorDia(dataCompra, dia, fornecedor?.dia_fechamento) || '';
  }

  const [ano, mes, diaCompra] = dataCompra.split('-').map(Number);
  let anoV = ano;
  let mesV = mes;
  if (diaCompra > dia) mesV += 1;
  while (mesV > 12) { mesV -= 12; anoV += 1; }
  const ultimoDia = new Date(anoV, mesV, 0).getDate();
  const diaFinal = Math.min(dia, ultimoDia);
  return `${anoV}-${String(mesV).padStart(2, '0')}-${String(diaFinal).padStart(2, '0')}`;
}

function ncAtualizarBotaoVencFornecedor() {
  const btn = document.getElementById('ncBtnUsarVencFornecedor');
  if (!btn) return;
  const fornecedor = ncFornecedorSelecionado();
  const dia = parseInt(fornecedor?.dia_vencimento, 10);
  const podeUsar = !!fornecedor && Number.isFinite(dia) && dia >= 1 && dia <= 31;
  btn.disabled = !podeUsar;
  btn.style.display = podeUsar ? '' : 'none';
  btn.textContent = podeUsar ? `${NC.modoEdicao && NC.parcelado ? 'Todos ' : 'Vence '}dia ${dia}` : 'Usar venc. fornecedor';
}

function ncUsarVencimentoFornecedor() {
  const msg = document.getElementById('ncMsg');
  const fornecedor = ncFornecedorSelecionado();
  const dia = parseInt(fornecedor?.dia_vencimento, 10);
  if (!fornecedor || !Number.isFinite(dia) || dia < 1 || dia > 31) {
    if (msg) { msg.textContent = 'Fornecedor sem dia de vencimento cadastrado.'; msg.className = 'msg err'; }
    return;
  }
  const campoDataCompra = document.getElementById('ncDataCompra');
  if (campoDataCompra?.value) NC.dataCompra = campoDataCompra.value;
  const vencimento = ncDataVencimentoFornecedor(fornecedor, NC.dataCompra);
  if (!vencimento) return;
  NC.dataVenc = vencimento;
  const vc = document.getElementById('ncVencCustom');
  if (vc) vc.value = vencimento;
  ncVencCust();
  if (NC.modoEdicao && NC.parcelado) {
    NC.aplicarVencimentoGrupo = confirm(`Aplicar o vencimento no dia ${dia} a todas as parcelas vinculadas ao salvar?`);
  }
  if (msg) {
    msg.textContent = NC.aplicarVencimentoGrupo
      ? `Dia ${dia} definido para todas as parcelas. Clique em Salvar alterações.`
      : `Vencimento aplicado nesta parcela: dia ${dia}.`;
    msg.className = 'msg ok';
  }
}

function ncAtuParcelasInfo() {
  const pi = document.getElementById('ncParcelasInfo');
  const vt = document.getElementById('ncValorTipo');
  if (NC.parcelas <= 1) {
    if (pi) { pi.textContent = ''; pi.style.display = 'none'; }
    if (vt) vt.style.display = 'none';
    return;
  }
  if (NC.valor != null && NC.valor > 0) {
    const valorParcela = NC.modo === 'total' ? NC.valor / NC.parcelas : NC.valor;
    const valorTotal   = NC.modo === 'total' ? NC.valor : NC.valor * NC.parcelas;
    if (pi) {
      pi.textContent = NC.parcelas + 'x de ' + ncFmtBR(valorParcela) + ' · Total: ' + ncFmtBR(valorTotal);
      pi.style.display = '';
    }
    if (vt) {
      vt.textContent = NC.modo === 'total' ? '↕ Valor total da compra' : '↕ Valor de cada parcela';
      vt.style.display = '';
    }
  } else {
    if (pi) { pi.textContent = ''; pi.style.display = 'none'; }
    if (vt) vt.style.display = 'none';
  }
}

// ── Observação ───────────────────────────────────────────────────
function ncObsInput(inp) {
  const e = document.getElementById('ncObsErr');
  if (e) e.style.display = inp.value.trim() ? 'none' : '';
}

// ── Categorias ──────────────────────────────────────────────────
function ncMontarCategorias() {
  const grid = document.getElementById('ncCatGrid'); if (!grid) return;
  const porChave = new Map();
  (categoriasCompraCache || []).forEach(categoria => {
    const chave = typeof chaveCategoriaCompraEquivalente === 'function'
      ? chaveCategoriaCompraEquivalente(categoria.nome)
      : String(categoria.nome || '').trim().toUpperCase();
    const atual = porChave.get(chave);
    const ehSelecionada = String(categoria.id) === String(NC.catId || '');
    const atualSelecionada = String(atual?.id || '') === String(NC.catId || '');
    const pontuacao = (categoria.icone ? 2 : 0) + (categoria.descricao ? 1 : 0);
    const pontuacaoAtual = atual ? ((atual.icone ? 2 : 0) + (atual.descricao ? 1 : 0)) : -1;
    if (!atual || ehSelecionada || (!atualSelecionada && pontuacao > pontuacaoAtual)) porChave.set(chave, categoria);
  });
  const cats = Array.from(porChave.values());
  grid.innerHTML = cats.map(c => {
    const sel = NC.catId && String(c.id) === String(NC.catId);
    return `<div class="nc-cat-card${sel ? ' nc-sel' : ''}" data-id="${c.id}" onclick="ncSelCat(this)" style="padding:10px;font-size:13px;">${htmlIconeCategoriaCompra(c.icone, 28)}<span>${escaparHtmlBasico(c.nome || '')}</span></div>`;
  }).join('');
}

function ncSelCat(el) {
  document.querySelectorAll('#ncCatGrid .nc-cat-card').forEach(o => o.classList.remove('nc-sel'));
  el.classList.add('nc-sel'); NC.catId = el.dataset.id || null;
  const cs = document.getElementById('contaCategoriaId'); if (cs) cs.value = NC.catId || '';
}

// ── Fornecedor ──────────────────────────────────────────────────
function ncBuscarForn(t) {
  const res = document.getElementById('ncFornRes'); if (!res) return;
  if (!t || t.trim().length < 1) { res.innerHTML = ''; return; }
  const tU = t.trim().toUpperCase();
  const m = (fornecedoresFinanceiroCache || []).filter(f => (f.nome || '').toUpperCase().includes(tU) || (f.cnpj || '').includes(tU)).slice(0, 6);
  if (!m.length) { res.innerHTML = '<div style="font-size:13px;color:var(--text-muted);padding:6px 0;">Nenhum encontrado.</div>'; return; }
  res.innerHTML = m.map(f => `<div class="nc-forn-card" onclick="ncSelForn('${f.id}','${escaparHtmlBasico(f.nome || '')}')"><div style="font-size:15px;font-weight:700;color:var(--text);">${escaparHtmlBasico(f.nome || '')}</div><span style="color:var(--text-muted);font-size:22px;">›</span></div>`).join('');
}

function ncSelForn(id, nome) {
  NC.fornId = String(id); NC.fornNome = nome || '';
  const fb = document.getElementById('contaFornecedorBusca'); if (fb) fb.value = nome;
  const fi = document.getElementById('contaFornecedorId'); if (fi) fi.value = id;
  const res = document.getElementById('ncFornRes'); if (res) res.innerHTML = '';
  const bi = document.getElementById('ncFornBusca'); if (bi) bi.style.display = 'none';
  const sel = document.getElementById('ncFornSel'), nm = document.getElementById('ncFornSelNome');
  if (sel && nm) { nm.textContent = nome; sel.style.display = 'flex'; }
  ncAtualizarBotaoVencFornecedor();
}

function ncLimparForn() {
  NC.fornId = null; NC.fornNome = '';
  const fb = document.getElementById('contaFornecedorBusca'); if (fb) fb.value = '';
  const fi = document.getElementById('contaFornecedorId'); if (fi) fi.value = '';
  const bi = document.getElementById('ncFornBusca'); if (bi) { bi.style.display = ''; bi.value = ''; }
  const sel = document.getElementById('ncFornSel'); if (sel) sel.style.display = 'none';
  const res = document.getElementById('ncFornRes'); if (res) res.innerHTML = '';
  ncAtualizarBotaoVencFornecedor();
}

// ── Abrir / Fechar ──────────────────────────────────────────────
function ncAbrir(editar) {
  if (!editar) {
    Object.assign(NC, { fornId: null, fornNome: null, catId: null, dataCompra: null, dataVenc: null, valor: null, obs: '', parcelas: 1, intervalo: 30, parcelado: false, modoEdicao: false, modo: 'total', lojaId: null, salvando: false, aplicarVencimentoGrupo: false });
    // Limpa campos visuais
    const fi = document.getElementById('ncFornBusca'); if (fi) { fi.value = ''; fi.style.display = ''; }
    const fsr = document.getElementById('ncFornRes'); if (fsr) fsr.innerHTML = '';
    const fsel = document.getElementById('ncFornSel'); if (fsel) fsel.style.display = 'none';
    const vi = document.getElementById('ncValor'); if (vi) vi.value = '';
    const oi = document.getElementById('ncObs'); if (oi) { oi.value = ''; oi.style.borderColor = ''; }
    // Modo padrão = total
    document.getElementById('ncModoTotal')?.classList.add('nc-pill-sel');
    document.getElementById('ncModoParc')?.classList.remove('nc-pill-sel');
    // Data compra = hoje
    const hoje = new Date().toISOString().split('T')[0];
    const dc = document.getElementById('ncDataCompra'); if (dc) dc.value = hoje;
    NC.dataCompra = hoje; NC.dataVenc = hoje;
    // Vencimento default = 30 dias
    const vdEl = document.getElementById('ncVencDia'); if (vdEl) vdEl.value = '30';
    ncVencDiaInput('30');
    // Parcelas default = 1
    const pc = document.getElementById('ncParcCustom'); if (pc) pc.value = '1';
    NC.parcelas = 1;
    ncSyncParceladoUI();
    // Limpar erros
    ['ncVencDiaErr','ncParcErr','ncObsErr'].forEach(id => {
      const el = document.getElementById(id); if (el) el.style.display = 'none';
    });
    // Título
    const tt = document.getElementById('ncTitulo'); if (tt) tt.textContent = 'Nova conta';
    const bc = document.getElementById('ncBtnCancelar'); if (bc) bc.style.display = 'none';
    const bs = document.getElementById('ncBtnSalvar');
    if (bs) { bs.disabled = false; bs.style.gridColumn = ''; bs.textContent = 'Salvar'; }
    const bsn = document.getElementById('ncBtnSalvarNovo');
    if (bsn) { bsn.disabled = false; bsn.style.display = ''; bsn.textContent = 'Salvar e novo'; }
    const msg = document.getElementById('ncMsg'); if (msg) { msg.textContent = ''; msg.className = 'msg'; }
    const vt = document.getElementById('ncValorTipo'); if (vt) vt.style.display = 'none';
    const pi = document.getElementById('ncParcelasInfo'); if (pi) { pi.textContent = ''; pi.style.display = 'none'; }
  }
  if (typeof carregarFornecedoresFinanceiro === 'function') carregarFornecedoresFinanceiro().then(() => ncAtualizarBotaoVencFornecedor()).catch(() => {});
  if (!(categoriasCompraCache || []).length && typeof carregarCategoriasCompra === 'function') {
    carregarCategoriasCompra().then(() => ncMontarCategorias()).catch(() => {});
  }
  ncMontarCategorias();
  ncAtualizarBotaoVencFornecedor();
  const ov = document.getElementById('ncOverlay'); if (!ov) return;
  ov.style.display = 'flex';
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const sh = document.getElementById('ncSheet'); if (sh) sh.style.transform = 'translateY(0)';
  }));
}

function ncFechar() {
  const sh = document.getElementById('ncSheet'), ov = document.getElementById('ncOverlay');
  if (!sh || !ov) return;
  sh.style.transform = 'translateY(100%)';
  setTimeout(() => { ov.style.display = 'none'; }, 300);
}

// ── Salvar ──────────────────────────────────────────────────────
async function ncConferirContaSalva(resumo = {}, resultado = {}) {
  if (typeof abrirConfirmacaoSistema !== 'function') return { acao: 'ok' };
  const linhas = [
    ['FORNECEDOR', resumo.fornNome || '-'],
    ['VALOR', ncFmtBR(resumo.valorParcela || resumo.valor || 0)],
    ['VENCIMENTO', resumo.dataVencBR || '-'],
    ['CATEGORIA', resumo.catNome || '-'],
    ['PARCELAS', `${resumo.parcelas || 1}x`],
    ['OBSERVACAO', resumo.obs || '-'],
  ];
  const body = `
    <div class="nc-confirm-lines">
      ${linhas.map(([label, valor]) => `
        <div class="nc-confirm-line">
          <span>${label}</span>
          <strong>${escaparHtmlBasico(String(valor || '-'))}</strong>
        </div>
      `).join('')}
    </div>
  `;
  const decisao = await abrirConfirmacaoSistema({
    title: 'Conferir lançamento',
    subtitle: 'Confira os dados antes de finalizar.',
    body,
    cancelText: 'CORRIGIR',
    cancelClass: 'btn-red',
    confirmText: 'OK',
    confirmClass: 'btn-green',
  });
  if (decisao?.confirmado === false && resultado?.ids?.[0]) return { acao: 'corrigir', id: resultado.ids[0] };
  return { acao: 'ok' };
}

async function ncSalvar(salvarENovo = false) {
  if (NC.salvando) return;
  const msg = document.getElementById('ncMsg');
  const btn = document.getElementById('ncBtnSalvar');
  const btnNovo = document.getElementById('ncBtnSalvarNovo');
  if (msg) { msg.textContent = ''; msg.className = 'msg'; }

  // 1. Coleta e valida valor
  const vi = document.getElementById('ncValor');
  if (vi && document.activeElement === vi) vi.blur();
  NC.valor = ncParseValor(vi ? vi.value : '');

  // 2. Coleta dias para vencimento e recalcula data
  const dc = document.getElementById('ncDataCompra');
  if (dc && dc.value) NC.dataCompra = dc.value;
  const vc = document.getElementById('ncVencCustom');
  if (vc && vc.value) {
    NC.dataVenc = vc.value;
  } else {
    const vdEl = document.getElementById('ncVencDia');
    if (vdEl && vdEl.value !== '') ncVencDiaInput(vdEl.value);
  }
  // Se o usuário alterou direto no calendário, ncVencCust() já atualizou NC.dataVenc

  // 3. Coleta parcelas
  const pcc = document.getElementById('ncParcCustom');
  if (!NC.parcelado) {
    NC.parcelas = 1;
    NC.modo = 'total';
    if (pcc) pcc.value = '1';
  } else if (pcc && pcc.value) {
    const pv = parseInt(pcc.value, 10) || 0;
    if (pv >= 1) NC.parcelas = pv;
  }

  // 4. Coleta data de compra e observação
  const oi = document.getElementById('ncObs'); NC.obs = String((oi && oi.value) || '').trim();

  // 5. Validações com erros inline
  let temErro = false;

  const vdErr = document.getElementById('ncVencDiaErr');
  if (!NC.dataVenc) {
    if (vdErr) vdErr.style.display = '';
    temErro = true;
  } else { if (vdErr) vdErr.style.display = 'none'; }

  const parcErr = document.getElementById('ncParcErr');
  if (!NC.parcelas || NC.parcelas < 1) {
    if (parcErr) parcErr.style.display = '';
    temErro = true;
  } else { if (parcErr) parcErr.style.display = 'none'; }

  const obsErr = document.getElementById('ncObsErr');
  if (!NC.obs) {
    if (obsErr) obsErr.style.display = '';
    if (oi) oi.style.borderColor = 'var(--red)';
    temErro = true;
  } else {
    if (obsErr) obsErr.style.display = 'none';
    if (oi) oi.style.borderColor = '';
  }

  if (!NC.fornId) { if (msg) { msg.textContent = 'Selecione um fornecedor.'; msg.className = 'msg err'; } return; }
  if (NC.valor == null || NC.valor <= 0) { if (msg) { msg.textContent = 'Informe o valor corretamente.'; msg.className = 'msg err'; } return; }
  if (!NC.catId) { if (msg) { msg.textContent = 'Selecione uma categoria.'; msg.className = 'msg err'; } return; }
  if (temErro) { if (msg) { msg.textContent = 'Preencha os campos obrigatórios.'; msg.className = 'msg err'; } return; }

  if (!NC.dataVenc) NC.dataVenc = NC.dataCompra || new Date().toISOString().split('T')[0];
  if (NC.parcelas > 1 && (!NC.intervalo || NC.intervalo <= 0)) NC.intervalo = 30;

  // 6. Calcula valor correto por parcela
  const valorParcela = NC.modo === 'total' ? Math.round((NC.valor / NC.parcelas) * 100) / 100 : NC.valor;
  const categoriaSelecionada = (categoriasCompraCache || []).find(c => String(c.id) === String(NC.catId)) || null;
  const resumoConferencia = {
    fornNome: NC.fornNome,
    valor: NC.valor,
    valorParcela,
    dataVencBR: toddmmaaaa(NC.dataVenc),
    catNome: categoriaSelecionada?.nome || '',
    parcelas: NC.parcelas,
    obs: NC.obs,
  };

  // 7. Sincroniza campos hidden
  function toddmmaaaa(iso) { if (!iso) return ''; const [y, m, d] = iso.split('-'); return d + '/' + m + '/' + y; }
  const fb = document.getElementById('contaFornecedorBusca'); if (fb) fb.value = NC.fornNome;
  const fi = document.getElementById('contaFornecedorId'); if (fi) fi.value = NC.fornId;
  const cv = document.getElementById('contaValorCompra'); if (cv) cv.value = valorParcela.toFixed(2).replace('.', ',');
  const cs = document.getElementById('contaCategoriaId'); if (cs) cs.value = NC.catId || '';
  const co = document.getElementById('contaObservacao'); if (co) co.value = NC.obs || 'Lançamento manual';
  const cqp = document.getElementById('contaQtdParcelas'); if (cqp) cqp.value = NC.parcelas > 1 ? NC.parcelas : '';
  const cip = document.getElementById('contaIntervaloParcelasDias'); if (cip) cip.value = NC.parcelas > 1 ? NC.intervalo : '';
  const cdc = document.getElementById('contaDataCompra'); if (cdc) cdc.value = toddmmaaaa(NC.dataCompra);
  const cdv = document.getElementById('contaDataVencimento'); if (cdv) cdv.value = toddmmaaaa(NC.dataVenc);
  if (NC.lojaId) preencherSelectLojaContaAPagarFinanceiro(NC.lojaId);
  else preencherSelectLojaContaAPagarFinanceiro('');

  // 8. Salva
  NC.salvando = true;
  if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }
  if (btnNovo) { btnNovo.disabled = true; btnNovo.textContent = 'Salvando...'; }
  const msgOrig = document.getElementById('msgContaAPagarFinanceiro');
  if (msgOrig) { msgOrig.textContent = ''; msgOrig.className = 'msg'; }

  try {
    const resultadoSalvar = await salvarContaAPagarFinanceiro();
    if (resultadoSalvar?.ignorado) {
      if (msg) { msg.textContent = msgOrig?.textContent || 'Lançamento ignorado por duplicidade.'; msg.className = 'msg ok'; }
      NC.salvando = false;
      if (btn) { btn.disabled = false; btn.textContent = NC.modoEdicao ? 'Salvar alterações' : 'Salvar'; }
      if (btnNovo) { btnNovo.disabled = false; btnNovo.textContent = 'Salvar e novo'; }
      return;
    }
    if (resultadoSalvar?.cancelado) {
      if (msg) { msg.textContent = msgOrig?.textContent || 'Revise o lançamento antes de salvar.'; msg.className = 'msg err'; }
      NC.salvando = false;
      if (btn) { btn.disabled = false; btn.textContent = NC.modoEdicao ? 'Salvar alterações' : 'Salvar'; }
      if (btnNovo) { btnNovo.disabled = false; btnNovo.textContent = 'Salvar e novo'; }
      return;
    }
    if (resultadoSalvar?.canceladoTotal) {
      NC.salvando = false;
      if (btn) { btn.disabled = false; btn.textContent = NC.modoEdicao ? 'Salvar alterações' : 'Salvar'; }
      if (btnNovo) { btnNovo.disabled = false; btnNovo.textContent = 'Salvar e novo'; }
      ncFechar();
      if (typeof abrirPagina === 'function') {
        abrirPagina('financeiro_contasapagar', document.querySelector('.nav-btn[data-page="financeiro_contasapagar"]'));
      }
      return;
    }
    if (msgOrig && msgOrig.textContent && msgOrig.classList.contains('err')) {
      if (msg) { msg.textContent = msgOrig.textContent; msg.className = 'msg err'; }
      NC.salvando = false;
      if (btn) { btn.disabled = false; btn.textContent = NC.modoEdicao ? 'Salvar alterações' : 'Salvar'; }
      if (btnNovo) { btnNovo.disabled = false; btnNovo.textContent = 'Salvar e novo'; }
      return;
    }
    const estavaEditando = NC.modoEdicao;
    if (salvarENovo && !estavaEditando) {
      NC.salvando = false;
      if (btn) { btn.disabled = false; btn.textContent = 'Salvar'; }
      if (btnNovo) { btnNovo.disabled = false; btnNovo.textContent = 'Salvar e novo'; }
      const conferencia = await ncConferirContaSalva(resumoConferencia, resultadoSalvar || {});
      if (conferencia.acao === 'corrigir' && typeof editarContaAPagarFinanceiro === 'function') {
        editarContaAPagarFinanceiro(conferencia.id);
        return;
      }
      ncAbrir();
      const msgNovo = document.getElementById('ncMsg');
      if (msgNovo) { msgNovo.textContent = 'Conta salva. Preencha os dados da próxima conta.'; msgNovo.className = 'msg ok'; }
      document.getElementById('ncFornBusca')?.focus();
    } else {
      NC.salvando = false;
      if (btn) { btn.disabled = false; btn.textContent = NC.modoEdicao ? 'Salvar alterações' : 'Salvar'; }
      if (btnNovo) { btnNovo.disabled = false; btnNovo.textContent = 'Salvar e novo'; }
      const conferencia = await ncConferirContaSalva(resumoConferencia, resultadoSalvar || {});
      if (conferencia.acao === 'corrigir' && typeof editarContaAPagarFinanceiro === 'function') {
        editarContaAPagarFinanceiro(conferencia.id);
        return;
      }
      ncFechar();
      if (typeof abrirPagina === 'function') {
        abrirPagina('financeiro_contasapagar', document.querySelector('.nav-btn[data-page="financeiro_contasapagar"]'));
      }
    }
  } catch (e) {
    if (msg) { msg.textContent = 'Erro: ' + ((e && e.message) || 'tente novamente'); msg.className = 'msg err'; }
    NC.salvando = false;
    if (btn) { btn.disabled = false; btn.textContent = NC.modoEdicao ? 'Salvar alterações' : 'Salvar'; }
    if (btnNovo) { btnNovo.disabled = false; btnNovo.textContent = 'Salvar e novo'; }
  }
}

// ── Hook de edição ──────────────────────────────────────────────
const _ncOrigEditar = window.editarContaAPagarFinanceiro;
if (typeof _ncOrigEditar === 'function') {
  window.editarContaAPagarFinanceiro = function (id) {
    _ncOrigEditar.call(this, id);
    setTimeout(() => {
      const fb = document.getElementById('contaFornecedorBusca');
      const fi = document.getElementById('contaFornecedorId');
      const cv = document.getElementById('contaValorCompra');
      const dc = document.getElementById('contaDataCompra');
      const dv = document.getElementById('contaDataVencimento');
      const cs = document.getElementById('contaCategoriaId');
      const co = document.getElementById('contaObservacao');
      const cqp = document.getElementById('contaQtdParcelas');
      const cip = document.getElementById('contaIntervaloParcelasDias');

      NC.fornId = fi ? fi.value : '';
      NC.fornNome = fb ? fb.value : '';
      const _itemEdit = (contasAPagarFinanceiroCache || []).find(c => String(c.id) === String(id));
      NC.lojaId = (_itemEdit?.loja_id) ? String(_itemEdit.loja_id) : null;
      NC.valor = ncParseValor(cv ? cv.value : '');
      function toISO(s) { if (!s) return ''; const p = s.split('/'); if (p.length !== 3) return ''; return p[2] + '-' + p[1] + '-' + p[0]; }
      NC.dataCompra = toISO(dc ? dc.value : '');
      NC.dataVenc = toISO(dv ? dv.value : '');
      NC.catId = cs ? cs.value : '';
      NC.obs = co ? co.value : '';
      NC.parcelas = parseInt(cqp ? cqp.value : '1', 10) || 1;
      NC.intervalo = parseInt(cip ? cip.value : '30', 10) || 30;
      NC.parcelado = NC.parcelas > 1;
      NC.modoEdicao = true;
      NC.aplicarVencimentoGrupo = false;
      NC.modo = NC.parcelado ? 'parcela' : 'total';

      ncAbrir(true);

      const nvi = document.getElementById('ncValor');
      if (nvi && NC.valor != null) nvi.value = ncFmtBR(NC.valor);
      const ndc = document.getElementById('ncDataCompra'); if (ndc) ndc.value = NC.dataCompra;
      const noi = document.getElementById('ncObs'); if (noi) noi.value = NC.obs;

      if (NC.fornId && NC.fornNome) {
        const bi = document.getElementById('ncFornBusca'); if (bi) bi.style.display = 'none';
        const sel = document.getElementById('ncFornSel'), nm = document.getElementById('ncFornSelNome');
        if (sel && nm) { nm.textContent = NC.fornNome; sel.style.display = 'flex'; }
      }
      ncAtualizarBotaoVencFornecedor();

      ncMontarCategorias();

      // Preencher data de vencimento e dias
      if (NC.dataVenc) {
        const vc = document.getElementById('ncVencCustom'); if (vc) vc.value = NC.dataVenc;
        const vdEl = document.getElementById('ncVencDia');
        if (vdEl) vdEl.value = NC.parcelado ? String(NC.intervalo || 30) : (() => {
          const base = new Date((NC.dataCompra || new Date().toISOString().split('T')[0]) + 'T00:00:00');
          const venc = new Date(NC.dataVenc + 'T00:00:00');
          const diff = Math.round((venc - base) / (1000 * 60 * 60 * 24));
          return diff >= 0 ? String(diff) : '';
        })();
      }

      // Preencher parcelas
      const pcEl = document.getElementById('ncParcCustom'); if (pcEl) pcEl.value = NC.parcelas;
      ncSyncParceladoUI();

      // Modo parcela na edição
      document.getElementById('ncModoTotal')?.classList.remove('nc-pill-sel');
      document.getElementById('ncModoTotal')?.classList.toggle('nc-pill-sel', NC.modo === 'total');
      ncAtuParcelasInfo();

      const tt = document.getElementById('ncTitulo'); if (tt) tt.textContent = 'Editar conta';
      const bc = document.getElementById('ncBtnCancelar'); if (bc) bc.style.display = '';
      const bs = document.getElementById('ncBtnSalvar');
      if (bs) { bs.disabled = false; bs.style.gridColumn = '1 / -1'; bs.textContent = 'Salvar alterações'; }
      const bsn = document.getElementById('ncBtnSalvarNovo');
      if (bsn) bsn.style.display = 'none';
    }, 100);
  };
}

function ncCancelarEdicao() {
  if (typeof cancelarEdicaoContaAPagarFinanceiro === 'function') cancelarEdicaoContaAPagarFinanceiro();
  ncFechar();
}
