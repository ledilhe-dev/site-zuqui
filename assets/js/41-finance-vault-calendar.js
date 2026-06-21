// CALENDÁRIO FINANCEIRO DO COFRE
// ══════════════════════════════════════════════════════════════════
let _calendarioCofre = { ano: new Date().getFullYear(), mes: new Date().getMonth() };
let _calendarioDados = { recebiveis: [], futuros: [], contasApagar: [] };

function navegarCalendarioCofre(delta) {
  _calendarioCofre.mes += delta;
  if (_calendarioCofre.mes > 11) { _calendarioCofre.mes = 0; _calendarioCofre.ano++; }
  if (_calendarioCofre.mes < 0)  { _calendarioCofre.mes = 11; _calendarioCofre.ano--; }
  renderizarCalendarioCofre();
}

async function carregarDadosCalendarioCofre() {
  const lojasPermitidasIds = obterIdsLojasSelecionadasFiltroFinanceiroPage('filtroLojasCofreFinanceiro');
  try {
    // Buscar recebíveis confirmados (movimentações de entrada)
    // Sem suspender filtros: cada tabela já filtra por loja/empresa da sessão,
    // garantindo que o calendário do cofre mostre só dados da loja logada.
    const [resMovs, resFuturos, resContas] = await Promise.all([
      sb.from('contas_financeiras_movimentacoes')
        .select('id, tipo, valor, created_at, descricao')
        .eq('tipo', 'entrada')
        .order('created_at', { ascending: true }),
      sb.from('recebiveis_futuros')
        .select('id, valor, data_prevista, confirmado_em, fornecedores(nome)')
        .eq('ativo', true)
        .is('confirmado_em', null)
        .order('data_prevista', { ascending: true }),
      sb.from('contasapagar')
        .select('id, valor_compra, data_vencimento, data_pagamento, fornecedores(nome)')
        .is('data_pagamento', null)
        .order('data_vencimento', { ascending: true }),
    ]);
    _calendarioDados.recebiveis = (resMovs.data || []).map(m => ({
      data: String(m.created_at || '').slice(0, 10),
      valor: Number(m.valor || 0),
      descricao: m.descricao || 'Entrada',
      tipo: 'recebido',
    }));
    _calendarioDados.futuros = (resFuturos.data || []).map(f => ({
      data: String(f.data_prevista || '').slice(0, 10),
      valor: Number(f.valor || 0),
      descricao: f.fornecedores?.nome || 'Recebimento futuro',
      tipo: 'futuro',
    }));
    _calendarioDados.contasApagar = (resContas.data || []).map(c => ({
      data: String(c.data_vencimento || '').slice(0, 10),
      valor: Number(c.valor_compra || 0),
      descricao: c.fornecedores?.nome || 'Conta a pagar',
      tipo: 'pagar',
    }));
  } catch(e) { console.warn('Erro ao carregar dados do calendário:', e); }
  renderizarCalendarioCofre();
}

function renderizarCalendarioCofre() {
  const container = document.getElementById('calendarioCofre');
  const labelMes = document.getElementById('labelMesCalendarioCofre');
  if (!container) return;

  const { ano, mes } = _calendarioCofre;
  const nomesMes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const diasSemana = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  if (labelMes) labelMes.textContent = `${nomesMes[mes]} ${ano}`;

  // Agrupar eventos por data
  const todos = [..._calendarioDados.recebiveis, ..._calendarioDados.futuros, ..._calendarioDados.contasApagar];
  const porDia = {};
  todos.forEach(ev => {
    if (!ev.data) return;
    const [y, m, d] = ev.data.split('-').map(Number);
    if (y !== ano || m - 1 !== mes) return;
    if (!porDia[d]) porDia[d] = { recebido: 0, futuro: 0, pagar: 0, itens: [] };
    porDia[d][ev.tipo] += ev.valor;
    porDia[d].itens.push(ev);
  });

  const primeiroDia = new Date(ano, mes, 1).getDay();
  const totalDias = new Date(ano, mes + 1, 0).getDate();
  const hoje = new Date().toISOString().slice(0, 10);
  const diaHoje = new Date().getDate();
  const mesHoje = new Date().getMonth();
  const anoHoje = new Date().getFullYear();

  let html = diasSemana.map(d => 
    `<div style="text-align:center;font-size:10px;font-weight:600;color:var(--text-muted);padding:4px 0;">${d}</div>`
  ).join('');

  // Células vazias antes do dia 1
  for (let i = 0; i < primeiroDia; i++) {
    html += `<div></div>`;
  }

  for (let dia = 1; dia <= totalDias; dia++) {
    const ev = porDia[dia];
    const ehHoje = dia === diaHoje && mes === mesHoje && ano === anoHoje;
    const temRecebido = ev?.recebido > 0;
    const temFuturo = ev?.futuro > 0;
    const temPagar = ev?.pagar > 0;

    let dotHtml = '';
    if (temRecebido || temFuturo) dotHtml += `<div style="width:5px;height:5px;border-radius:50%;background:var(--green,#22c55e);margin:0 1px;"></div>`;
    if (temPagar) dotHtml += `<div style="width:5px;height:5px;border-radius:50%;background:var(--red,#ef4444);margin:0 1px;"></div>`;
    if (temFuturo && !temRecebido) dotHtml = `<div style="width:5px;height:5px;border-radius:50%;background:var(--amber,#f59e0b);margin:0 1px;"></div>` + (temPagar ? dotHtml.replace('<div style="width:5px','<div style="width:5px') : '');

    const border = ehHoje ? '2px solid var(--accent)' : '1px solid var(--border)';
    const bg = ehHoje ? 'var(--surface2)' : 'transparent';

    html += `<div onclick="abrirDetalheDiaCofre(${dia})" style="cursor:pointer;border:${border};border-radius:6px;padding:4px 3px;background:${bg};min-height:44px;display:flex;flex-direction:column;align-items:center;gap:2px;transition:background .15s;" 
      onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background='${bg}'">
      <div style="font-size:11px;font-weight:${ehHoje ? '700' : '400'};color:${ehHoje ? 'var(--accent)' : 'var(--text)'};">${dia}</div>
      ${ev ? `<div style="display:flex;justify-content:center;flex-wrap:wrap;">${dotHtml}</div>
      ${temRecebido ? `<div style="font-size:9px;color:var(--green,#22c55e);white-space:nowrap;">${formatarMoedaBRFinanceiro(ev.recebido).replace('R$','')}</div>` : ''}
      ${temFuturo ? `<div style="font-size:9px;color:var(--amber,#f59e0b);white-space:nowrap;">+${formatarMoedaBRFinanceiro(ev.futuro).replace('R$','')}</div>` : ''}
      ${temPagar ? `<div style="font-size:9px;color:var(--red,#ef4444);white-space:nowrap;">-${formatarMoedaBRFinanceiro(ev.pagar).replace('R$','')}</div>` : ''}` : ''}
    </div>`;
  }

  container.innerHTML = html;
}

function abrirDetalheDiaCofre(dia) {
  const detalhe = document.getElementById('detalheDiaCofre');
  const titulo = document.getElementById('tituloDiaCofre');
  const lista = document.getElementById('listaDiaCofre');
  if (!detalhe || !lista) return;

  const { ano, mes } = _calendarioCofre;
  const nomesMes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  if (titulo) titulo.textContent = `${String(dia).padStart(2,'0')} de ${nomesMes[mes]} de ${ano}`;

  const dataStr = `${ano}-${String(mes+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
  const todos = [..._calendarioDados.recebiveis, ..._calendarioDados.futuros, ..._calendarioDados.contasApagar]
    .filter(ev => ev.data === dataStr);

  if (!todos.length) {
    lista.innerHTML = '<div style="font-size:12px;color:var(--text-muted);">Nenhum evento neste dia.</div>';
  } else {
    lista.innerHTML = todos.map(ev => {
      const cor = ev.tipo === 'recebido' ? 'var(--green,#22c55e)' : ev.tipo === 'futuro' ? 'var(--amber,#f59e0b)' : 'var(--red,#ef4444)';
      const icone = ev.tipo === 'recebido' ? '↑' : ev.tipo === 'futuro' ? '○' : '↓';
      const label = ev.tipo === 'recebido' ? 'Recebido' : ev.tipo === 'futuro' ? 'A receber' : 'A pagar';
      return `<div style="display:flex;align-items:center;justify-content:space-between;padding:5px 8px;border-radius:6px;background:var(--surface2);border-left:3px solid ${cor};">
        <div>
          <span style="font-size:11px;color:${cor};font-weight:700;margin-right:6px;">${icone} ${label}</span>
          <span style="font-size:11px;color:var(--text);">${escaparHtmlBasico(ev.descricao)}</span>
        </div>
        <span style="font-size:12px;font-weight:700;color:${cor};">${formatarMoedaBRFinanceiro(ev.valor)}</span>
      </div>`;
    }).join('');
  }
  detalhe.style.display = '';
}
// ══════════════════════════════════════════════════════════════════
async function carregarCofreFinanceiro() {
  const lista = document.getElementById('listaCofreFinanceiro');
  if (lista) lista.innerHTML = '';
  atualizarEstadoExtratoCofre();
  atualizarResumoCofreFinanceiro({ saldoTotal: 0, movimentos: [] });
  renderizarCardsCofreContas([]);
  renderizarPizzaCofreContas([]);

  // Período padrão: se as duas datas estiverem vazias na primeira abertura,
  // preenche com o mês atual para o indicador "falta para cobrir" não somar
  // todas as contas em aberto de todos os tempos (parcelas de anos futuros).
  const campoCofreInicio = document.getElementById('filtroCofreDataInicio');
  const campoCofreFim = document.getElementById('filtroCofreDataFim');
  if (!window.__cofrePeriodoInicializado && campoCofreInicio && campoCofreFim
      && !String(campoCofreInicio.value || '').trim() && !String(campoCofreFim.value || '').trim()) {
    const agora = new Date();
    const pad2 = (n) => String(n).padStart(2, '0');
    const ano = agora.getFullYear();
    const mes = agora.getMonth();
    campoCofreInicio.value = `${ano}-${pad2(mes + 1)}-01`;
    campoCofreFim.value = `${ano}-${pad2(mes + 1)}-${pad2(new Date(ano, mes + 1, 0).getDate())}`;
  }
  window.__cofrePeriodoInicializado = true;

  const lojasPermitidasIds = obterIdsLojasSelecionadasFiltroFinanceiroPage('filtroLojasCofreFinanceiro');
  const filtroInicio = String(document.getElementById('filtroCofreDataInicio')?.value || '').trim();
  const filtroFim = String(document.getElementById('filtroCofreDataFim')?.value || '').trim();
  const { data: contas, error: erroContas } = await executarSemFiltroLojaTemporario(() => {
    let query = sb
      .from('contas_financeiras')
      .select('id, nome, saldo_atual, ativo, loja_id, empresa_id');
    query = aplicarFiltroLojasFinanceirasPermitidas(query, lojasPermitidasIds);
    return query;
  });

  if (erroContas) {
    if (isMissingContasFinanceirasTableError(erroContas)) {
      lista.innerHTML = '<div class="empty">Rode o SQL de contas financeiras para habilitar o cofre.</div>';
      renderizarCardsCofreContas([]);
      renderizarPizzaCofreContas([]);
      setMsg('msgCofreFinanceiro', 'Estrutura de contas financeiras ainda não está disponível no banco.', 'err');
      return;
    }
    lista.innerHTML = '<div class="empty">Erro ao carregar cofre.</div>';
    renderizarCardsCofreContas([]);
    renderizarPizzaCofreContas([]);
    setMsg('msgCofreFinanceiro', `Não foi possível carregar contas financeiras: ${mensagemErroSupabase(erroContas, 'erro desconhecido')}`, 'err');
    return;
  }

  let saldoTotal = (contas || []).reduce((acc, item) => {
    if (item?.ativo === false) return acc;
    return acc + (Number(item.saldo_atual || 0) || 0);
  }, 0);

  // Somar recebimentos futuros pendentes se checkbox marcado
  const somarFuturos = document.getElementById('cofreSomarFuturos')?.checked === true;
  let totalFuturosPendentes = 0;
  if (somarFuturos) {
    try {
      const dataFimFiltro = filtroFim || null;
      let qFut = sb.from('recebiveis_futuros').select('valor').eq('ativo', true).is('confirmado_em', null);
      if (dataFimFiltro) qFut = qFut.lte('data_prevista', dataFimFiltro);
      const { data: futuros } = await qFut;
      totalFuturosPendentes = (futuros || []).reduce((s, f) => s + Number(f.valor || 0), 0);
      saldoTotal += totalFuturosPendentes;
    } catch(e) { /* tabela pode não existir ainda */ }
  }

  const contasAbertasPeriodo = await carregarContasAbertasPeriodoCofre(filtroInicio, filtroFim, lojasPermitidasIds);
  renderizarCardsCofreContas(contas || []);
  renderizarPizzaCofreContas(contas || [], {
    saldoTotal,
    saldoReal: saldoTotal - totalFuturosPendentes,
    totalFuturos: totalFuturosPendentes,
    somarFuturos,
    totalContasAbertas: contasAbertasPeriodo.total,
    qtdContasAbertas: contasAbertasPeriodo.itens.length,
    filtroInicio,
    filtroFim,
  });

  const { data, error } = await executarSemFiltroLojaTemporario(() => {
    let query = sb
      .from('contas_financeiras_movimentacoes')
      .select('id, conta_financeira_id, recebivel_id, conta_apagar_id, tipo, valor, descricao, saldo_apos, created_at, loja_id, empresa_id, contas_financeiras(nome), recebiveis(id, fornecedores(nome), formas_pagamento(nome)), contasapagar(id, fornecedores(nome), formas_pagamento(nome))')
      .order('created_at', { ascending: false });
    query = aplicarFiltroLojasFinanceirasPermitidas(query, lojasPermitidasIds);
    if (filtroInicio) query = query.gte('created_at', `${filtroInicio}T00:00:00`);
    if (filtroFim) query = query.lte('created_at', `${filtroFim}T23:59:59`);
    return query;
  });

  if (error) {
    if (isMissingContasFinanceirasMovimentacoesTableError(error) || isMissingColumnError(error)) {
      lista.innerHTML = '<div class="empty">Rode o SQL mais recente de contas financeiras para habilitar o extrato do cofre.</div>';
      setMsg('msgCofreFinanceiro', 'Estrutura de movimentações ainda não está completa no banco.', 'err');
      atualizarResumoCofreFinanceiro({ saldoTotal, movimentos: [] });
      return;
    }
    lista.innerHTML = '<div class="empty">Erro ao carregar extrato do cofre.</div>';
    setMsg('msgCofreFinanceiro', `Não foi possível carregar o extrato do cofre: ${mensagemErroSupabase(error, 'erro desconhecido')}`, 'err');
    return;
  }

  const todos = await anexarAuditoriaAjustesCofre(data || [], filtroInicio, filtroFim);
  cofreMovimentacoesCache = todos;
  atualizarResumoCofreFinanceiro({ saldoTotal, movimentos: todos });
  renderizarExtratoCofre(todos);
  const msgFuturos = somarFuturos && totalFuturosPendentes > 0
    ? ` (+${formatarMoedaBRFinanceiro(totalFuturosPendentes)} em recebimentos futuros pendentes)`
    : '';
  setMsg('msgCofreFinanceiro', `Saldo atual do cofre: ${formatarMoedaBRFinanceiro(somarFuturos ? saldoTotal - totalFuturosPendentes : saldoTotal)}${msgFuturos}.`, 'ok');
  // Carregar dados do calendário em paralelo
  carregarDadosCalendarioCofre();
}

async function carregarFornecedoresFinanceiro() {
  const lista = document.getElementById('listaFornecedoresFinanceiro');
  if (lista) lista.innerHTML = '<div class="empty">Carregando...</div>';

  const lojasPermitidasIds = obterLojasDisponiveisParaFiltroMultiLoja().map(loja => String(loja.id || '').trim()).filter(Boolean);
  const { data, error } = await executarSemFiltroLojaTemporario(() => {
    let query = sb.from('fornecedores').select('*').order('nome');
    if (lojasPermitidasIds.length) query = query.in('loja_id', lojasPermitidasIds);
    return query;
  });
  if (error) {
    fornecedoresFinanceiroCache = [];
    atualizarDatalistFornecedoresFinanceiro();
    if (lista) {
      if (isMissingFornecedoresTableError(error)) {
        lista.innerHTML = '<div class="empty">Rode o SQL da tabela fornecedores para habilitar este cadastro.</div>';
      } else {
        lista.innerHTML = '<div class="empty">Erro ao carregar fornecedores.</div>';
      }
    }
    return;
  }

  fornecedoresFinanceiroCache = data || [];
  atualizarDatalistFornecedoresFinanceiro();

  if (!lista) return;
  if (!fornecedoresFinanceiroCache.length) {
    lista.innerHTML = '<div class="empty">Nenhum fornecedor cadastrado.</div>';
    return;
  }

  // Limpar filtro ao recarregar
  const filtroBusca = document.getElementById('filtroBuscaFornecedores');
  if (filtroBusca) filtroBusca.value = '';
  renderizarListaFornecedoresFinanceiro(fornecedoresFinanceiroCache);
}

function filtrarListaFornecedoresFinanceiro() {
  const termo = (document.getElementById('filtroBuscaFornecedores')?.value || '')
    .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const lista = document.getElementById('listaFornecedoresFinanceiro');
  if (!lista) return;
  if (!termo) {
    // Re-renderizar tudo
    renderizarListaFornecedoresFinanceiro(fornecedoresFinanceiroCache);
    return;
  }
  const filtrados = (fornecedoresFinanceiroCache || []).filter(f => {
    const alvo = [f.nome, f.cnpj, f.telefone, f.email].join(' ')
      .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    return alvo.includes(termo);
  });
  renderizarListaFornecedoresFinanceiro(filtrados);
}

function renderizarListaFornecedoresFinanceiro(itens) {
  const lista = document.getElementById('listaFornecedoresFinanceiro');
  if (!lista) return;
  if (!itens.length) {
    lista.innerHTML = '<div class="empty">Nenhum fornecedor encontrado.</div>';
    return;
  }
  lista.innerHTML = '<div class="lista">' + itens.map(item => {
    const nomeLoja = obterNomeLojaFiltroMultiLoja(item.loja_id);
    const grupoNome = gruposFornecedorCache.find(g => g.id === item.grupo_id)?.nome || null;
    return `
    <div class="item">
      <div class="item-info">
        <div class="item-nome">${item.cor ? `<span style="display:inline-block;width:11px;height:11px;border-radius:99px;background:${escaparHtmlBasico(item.cor)};margin-right:6px;vertical-align:baseline;" title="Cor nos gráficos"></span>` : ''}${escaparHtmlBasico(item.nome || '-')}${grupoNome ? ` <span style="font-size:10px;color:var(--text-muted);font-weight:400;">· ${escaparHtmlBasico(grupoNome)}</span>` : ''}</div>
        <div class="item-detalhe">Loja: ${escaparHtmlBasico(nomeLoja || '-')} · CPF/CNPJ: ${item.cnpj ? formatarCpfCnpjFinanceiro(item.cnpj) : '-'} · Telefone: ${item.telefone || '-'} · E-mail: ${item.email || '-'}${item.is_cartao ? ' · <span class="tag tag-green" style="font-size:10px;">💳 Cartão</span>' : ''}</div>
      </div>
      <div class="item-actions">
        <button class="btn btn-ghost btn-sm" onclick="editarFornecedorFinanceiro('${item.id}')">Editar</button>
        <button class="btn btn-red btn-sm" onclick="excluirFornecedorFinanceiro('${item.id}')">Excluir</button>
      </div>
    </div>`;
  }).join('') + '</div>';
}

function fornecedorCorAoEscolher(hex) {
  const hid = document.getElementById('fornecedorCorValor');
  if (hid) hid.value = String(hex || '').trim();
  const pick = document.getElementById('fornecedorCor');
  if (pick) pick.style.opacity = '1';
}

function fornecedorCorLimpar() {
  const hid = document.getElementById('fornecedorCorValor');
  if (hid) hid.value = '';
  const pick = document.getElementById('fornecedorCor');
  if (pick) { pick.value = '#3b82f6'; pick.style.opacity = '.4'; }
}

function limparFormularioFornecedorFinanceiro() {
  fornecedorFinanceiroEmEdicaoId = null;
  ['fornecedorNome','fornecedorCnpj','fornecedorTelefone','fornecedorEmail','fornecedorDiaVencimento','fornecedorDiaFechamento'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  fornecedorCorLimpar();
  const grp = document.getElementById('fornecedorGrupoId');
  if (grp) grp.value = '';
  const chkCartao = document.getElementById('fornecedorIsCartao');
  if (chkCartao) chkCartao.checked = false;
  const btnSalvar = document.getElementById('btnSalvarFornecedorFinanceiro');
  const btnCancelar = document.getElementById('btnCancelarFornecedorFinanceiro');
  if (btnSalvar) btnSalvar.textContent = 'Cadastrar';
  if (btnCancelar) btnCancelar.style.display = 'none';
  setMsg('msgFornecedorFinanceiro', '', '');
}

async function resolverTenantFornecedorFinanceiro() {
  let lojaId = String(obterLojaIdSessao?.() || usuarioSistemaLogado?.loja_id || window.lojaAtualId || '').trim();
  let empresaId = String(obterEmpresaIdSessao?.() || usuarioSistemaLogado?.empresa_id || '').trim();

  if (!lojaId) {
    const lojasPermitidas = typeof obterLojasPermitidasSessao === 'function' ? obterLojasPermitidasSessao() : [];
    if (lojasPermitidas.length === 1) {
      lojaId = String(lojasPermitidas[0]?.id || lojasPermitidas[0]?.loja_id || '').trim();
      empresaId = String(lojasPermitidas[0]?.empresa_id || empresaId || '').trim();
    }
  }

  if (lojaId && !empresaId) {
    const { data: lojaAtual, error } = await executarSemFiltroLojaTemporario(() => sb
      .from('lojas')
      .select('id, empresa_id')
      .eq('id', lojaId)
      .maybeSingle());
    if (!error && lojaAtual?.empresa_id) empresaId = String(lojaAtual.empresa_id || '').trim();
  }

  if (!lojaId || !empresaId) {
    const { data: lojaPadrao, error } = await executarSemFiltroLojaTemporario(() => sb
      .from('lojas')
      .select('id, empresa_id')
      .eq('ativo', true)
      .order('criado_em', { ascending: true })
      .limit(1)
      .maybeSingle());
    if (!error && lojaPadrao?.id && lojaPadrao?.empresa_id) {
      lojaId = String(lojaPadrao.id || '').trim();
      empresaId = String(lojaPadrao.empresa_id || '').trim();
    }
  }

  if (!lojaId || !empresaId) {
    throw new Error('Não foi possível identificar a loja/empresa para cadastrar o fornecedor. Faça login novamente ou selecione uma loja ativa.');
  }

  return { loja_id: lojaId, empresa_id: empresaId };
}

async function salvarFornecedorFinanceiro() {
  const nome = String(document.getElementById('fornecedorNome')?.value || '').trim();
  const cnpjInformado = String(document.getElementById('fornecedorCnpj')?.value || '').trim();
  const telefone = String(document.getElementById('fornecedorTelefone')?.value || '').trim();
  const email = String(document.getElementById('fornecedorEmail')?.value || '').trim().toLowerCase();

  if (!nome) {
    setMsg('msgFornecedorFinanceiro', 'Digite o nome do fornecedor.', 'err');
    return;
  }

  const documentoValidado = validarCpfCnpjFinanceiro(cnpjInformado);
  if (!documentoValidado.ok) {
    setMsg('msgFornecedorFinanceiro', `${documentoValidado.tipo} inválido. Informe um documento válido.`, 'err');
    return;
  }

  const campoDocumento = document.getElementById('fornecedorCnpj');
  if (campoDocumento) campoDocumento.value = documentoValidado.valor || '';

  let tenantFornecedor = null;
  try {
    tenantFornecedor = await resolverTenantFornecedorFinanceiro();
  } catch (erroTenant) {
    setMsg('msgFornecedorFinanceiro', erroTenant?.message || 'Não foi possível identificar a loja/empresa para cadastrar o fornecedor.', 'err');
    return;
  }

  const grupoId = String(document.getElementById('fornecedorGrupoId')?.value || '').trim() || null;
  const diaVencTexto = String(document.getElementById('fornecedorDiaVencimento')?.value || '').trim();
  let diaVencimento = null;
  if (diaVencTexto) {
    const d = Number.parseInt(diaVencTexto, 10);
    if (!Number.isFinite(d) || d < 1 || d > 31) {
      setMsg('msgFornecedorFinanceiro', 'Dia de vencimento deve ser entre 1 e 31.', 'err');
      return;
    }
    diaVencimento = d;
  }
  const diaFechTexto = String(document.getElementById('fornecedorDiaFechamento')?.value || '').trim();
  let diaFechamento = null;
  if (diaFechTexto) {
    const f = Number.parseInt(diaFechTexto, 10);
    if (!Number.isFinite(f) || f < 1 || f > 31) {
      setMsg('msgFornecedorFinanceiro', 'Dia de fechamento deve ser entre 1 e 31.', 'err');
      return;
    }
    diaFechamento = f;
  }
  const corHex = String(document.getElementById('fornecedorCorValor')?.value || '').trim();
  const corFornecedor = /^#[0-9a-fA-F]{6}$/.test(corHex) ? corHex.toLowerCase() : null;
  const payload = {
    nome,
    cnpj: documentoValidado.valor || null,
    telefone: telefone || null,
    email: email || null,
    grupo_id: grupoId,
    dia_vencimento: diaVencimento,
    dia_fechamento: diaFechamento,
    cor: corFornecedor,
    is_cartao: document.getElementById('fornecedorIsCartao')?.checked ?? false,
    loja_id: tenantFornecedor.loja_id,
    empresa_id: tenantFornecedor.empresa_id,
  };

  const editando = !!fornecedorFinanceiroEmEdicaoId;
  const query = editando
    ? sb.from('fornecedores').update(payload).eq('id', fornecedorFinanceiroEmEdicaoId)
    : sb.from('fornecedores').insert([payload]);

  const { error } = await query;
  if (error) {
    if (isMissingFornecedoresTableError(error)) {
      setMsg('msgFornecedorFinanceiro', 'Rode o SQL da tabela fornecedores antes de usar esta tela.', 'err');
      return;
    }
    setMsg('msgFornecedorFinanceiro', `Não foi possível salvar: ${mensagemErroSupabase(error, 'erro desconhecido')}`, 'err');
    return;
  }

  limparFormularioFornecedorFinanceiro();
  setMsg('msgFornecedorFinanceiro', editando ? 'Fornecedor atualizado.' : 'Fornecedor cadastrado.', 'ok');
  await carregarFornecedoresFinanceiro();
  if (document.getElementById('financeiro_contasapagar')?.classList.contains('ativa')) {
    carregarContasAPagarFinanceiro();
  }
  if (document.getElementById('financeiro_recebiveis')?.classList.contains('ativa')) {
    carregarRecebiveisFinanceiro();
  }
}

function editarFornecedorFinanceiro(id) {
  const item = fornecedoresFinanceiroCache.find(f => String(f.id) === String(id));
  if (!item) {
    setMsg('msgFornecedorFinanceiro', 'Fornecedor não encontrado.', 'err');
    return;
  }
  // Limpar tudo antes de preencher o novo
  limparFormularioFornecedorFinanceiro();
  fornecedorFinanceiroEmEdicaoId = id;
  document.getElementById('fornecedorNome').value = item.nome || '';
  document.getElementById('fornecedorCnpj').value = item.cnpj ? formatarCpfCnpjParcialFinanceiro(item.cnpj) : '';
  document.getElementById('fornecedorTelefone').value = item.telefone || '';
  document.getElementById('fornecedorEmail').value = item.email || '';
  const campoDiaVenc = document.getElementById('fornecedorDiaVencimento');
  if (campoDiaVenc) campoDiaVenc.value = item.dia_vencimento != null ? item.dia_vencimento : '';
  const campoDiaFech = document.getElementById('fornecedorDiaFechamento');
  if (campoDiaFech) campoDiaFech.value = item.dia_fechamento != null ? item.dia_fechamento : '';
  if (item.cor && /^#[0-9a-fA-F]{6}$/.test(String(item.cor))) {
    const pick = document.getElementById('fornecedorCor');
    if (pick) pick.value = item.cor;
    fornecedorCorAoEscolher(item.cor);
  } else {
    fornecedorCorLimpar();
  }
  const grp = document.getElementById('fornecedorGrupoId');
  if (grp) grp.value = item.grupo_id || '';
  const chkCartao = document.getElementById('fornecedorIsCartao');
  if (chkCartao) chkCartao.checked = !!item.is_cartao;
  const btnSalvar = document.getElementById('btnSalvarFornecedorFinanceiro');
  const btnCancelar = document.getElementById('btnCancelarFornecedorFinanceiro');
  if (btnSalvar) btnSalvar.textContent = 'Salvar';
  if (btnCancelar) btnCancelar.style.display = 'inline-flex';
  setMsg('msgFornecedorFinanceiro', `Editando fornecedor: ${item.nome}.`, 'ok');
  document.getElementById('fornecedorNome')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function cancelarEdicaoFornecedorFinanceiro() {
  limparFormularioFornecedorFinanceiro();
  setMsg('msgFornecedorFinanceiro', 'Edição cancelada.', 'ok');
}

async function excluirFornecedorFinanceiro(id) {
  if (!confirm('Excluir este fornecedor?')) return;

  const { count, error: erroVinculo } = await executarSemFiltroLojaTemporario(() => {
    return sb
      .from('contasapagar')
      .select('*', { count: 'exact', head: true })
      .eq('fornecedor_id', id)
      .is('excluido_em', null);
  });

  if (erroVinculo && !isMissingContasAPagarTableError(erroVinculo)) {
    setMsg('msgFornecedorFinanceiro', `Não foi possível validar vínculos: ${mensagemErroSupabase(erroVinculo, 'erro desconhecido')}`, 'err');
    return;
  }

  if (!erroVinculo && Number(count || 0) > 0) {
    setMsg('msgFornecedorFinanceiro', 'Não é possível excluir este fornecedor porque ele possui contas cadastradas.', 'err');
    return;
  }

  const { count: countRecebiveis, error: erroVinculoRecebiveis } = await executarSemFiltroLojaTemporario(() => {
    return sb
      .from('recebiveis')
      .select('*', { count: 'exact', head: true })
      .eq('pagador_id', id);
  });

  if (erroVinculoRecebiveis && !isMissingRecebiveisTableError(erroVinculoRecebiveis)) {
    setMsg('msgFornecedorFinanceiro', `Não foi possível validar recebíveis: ${mensagemErroSupabase(erroVinculoRecebiveis, 'erro desconhecido')}`, 'err');
    return;
  }

  if (!erroVinculoRecebiveis && Number(countRecebiveis || 0) > 0) {
    setMsg('msgFornecedorFinanceiro', 'Não é possível excluir este fornecedor porque ele possui recebíveis cadastrados.', 'err');
    return;
  }

  const { error: erroLimparHistorico } = await executarSemFiltroLojaTemporario(() => {
    return sb
      .from('contasapagar')
      .delete()
      .eq('fornecedor_id', id)
      .not('excluido_em', 'is', null);
  });

  if (erroLimparHistorico && !isMissingContasAPagarAuditoriaColumnsError(erroLimparHistorico) && !isMissingContasAPagarTableError(erroLimparHistorico)) {
    setMsg('msgFornecedorFinanceiro', `Não foi possível limpar contas excluídas vinculadas: ${mensagemErroSupabase(erroLimparHistorico, 'erro desconhecido')}`, 'err');
    return;
  }

  const { error } = await executarSemFiltroLojaTemporario(() => {
    return sb.from('fornecedores').delete().eq('id', id);
  });
  if (error) {
    setMsg('msgFornecedorFinanceiro', `Não foi possível excluir: ${mensagemErroSupabase(error, 'erro desconhecido')}`, 'err');
    return;
  }

  if (fornecedorFinanceiroEmEdicaoId === id) limparFormularioFornecedorFinanceiro();
  setMsg('msgFornecedorFinanceiro', 'Fornecedor excluído com sucesso.', 'ok');
  await carregarFornecedoresFinanceiro();
}

function atualizarModoEdicaoContaAPagarFinanceiro(editando = false) {
  const titulo = document.getElementById('tituloContaAPagarFinanceiro');
  const btnSalvar = document.getElementById('btnSalvarContaAPagarFinanceiro');
  const btnCancelar = document.getElementById('btnCancelarContaAPagarFinanceiro');
  const campoQtdParcelas = document.getElementById('contaQtdParcelas');
  const campoIntervaloParcelas = document.getElementById('contaIntervaloParcelasDias');
  const campoLoja = document.getElementById('contaLojaId');
  const avisoEdicao = document.getElementById('msgModoEdicaoContaAPagarFinanceiro');

  if (titulo) titulo.textContent = editando ? 'Editando conta a pagar' : 'Nova conta';
  if (btnSalvar) btnSalvar.textContent = editando ? 'Salvar edição' : 'Cadastrar';
  if (btnCancelar) btnCancelar.style.display = editando ? 'inline-flex' : 'none';

  [campoQtdParcelas, campoIntervaloParcelas, campoLoja].forEach(campo => {
    if (!campo) return;
    campo.disabled = !!editando;
    campo.style.opacity = editando ? '0.55' : '';
    campo.title = editando ? 'Modo edição: este campo não altera a loja nem gera novas parcelas.' : '';
  });

  if (avisoEdicao) {
    avisoEdicao.style.display = editando ? 'block' : 'none';
    avisoEdicao.className = editando ? 'msg ok' : 'msg';
    avisoEdicao.textContent = editando ? 'Modo edição: este salvamento não criará novas parcelas.' : '';
  }
}

function limparFormularioContaAPagarFinanceiro() {
  contaAPagarFinanceiroEmEdicaoId = null;
  const campoFornecedor = document.getElementById('contaFornecedorBusca');
  const campoFornecedorId = document.getElementById('contaFornecedorId');
  const campoCompra = document.getElementById('contaDataCompra');
  const campoVencimento = document.getElementById('contaDataVencimento');
  const campoValor = document.getElementById('contaValorCompra');
  const campoQtdParcelas = document.getElementById('contaQtdParcelas');
  const campoIntervaloParcelas = document.getElementById('contaIntervaloParcelasDias');
  const campoObservacao = document.getElementById('contaObservacao');

  preencherSelectLojaContaAPagarFinanceiro();
  if (campoFornecedor) campoFornecedor.value = '';
  if (campoFornecedorId) campoFornecedorId.value = '';
  if (campoCompra) configurarCampoDataContaAPagarFinanceiro('contaDataCompra', hoje());
  if (campoVencimento) configurarCampoDataContaAPagarFinanceiro('contaDataVencimento', hoje());
  configurarCampoValorCompraFinanceiro(true);
  if (campoQtdParcelas) campoQtdParcelas.value = '';
  if (campoIntervaloParcelas) campoIntervaloParcelas.value = '';
  if (campoObservacao) campoObservacao.value = '';

  atualizarModoEdicaoContaAPagarFinanceiro(false);
}

function gerarGrupoParcelasIdFinanceiro() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function obterParcelasRelacionadasContaAPagarFinanceiro(item = {}) {
  if (!item?.id) return [];
  const grupoParcelasId = String(item.grupo_parcelas_id || '').trim();
  const qtdParcelas = Number.parseInt(String(item.qtd_parcelas || 1), 10) || 1;
  const cache = Array.isArray(contasAPagarFinanceiroCache) ? contasAPagarFinanceiroCache : [];

  if (grupoParcelasId) {
    return cache
      .filter(conta => String(conta.grupo_parcelas_id || '').trim() === grupoParcelasId)
      .sort((a, b) => (Number(a.numero_parcela || 0) - Number(b.numero_parcela || 0)) || String(a.data_vencimento || '').localeCompare(String(b.data_vencimento || '')));
  }

  if (qtdParcelas <= 1) return [item];

  const fornecedorId = String(item.fornecedor_id || '').trim();
  const lojaId = String(item.loja_id || '').trim();
  const dataCompra = String(item.data_compra || '').trim();
  const observacao = textoFinanceiroNormalizado(item.observacao || '');
  const valor = Number(item.valor_compra || 0).toFixed(2);
  return cache
    .filter(conta => {
      if ((Number.parseInt(String(conta.qtd_parcelas || 1), 10) || 1) !== qtdParcelas) return false;
      if (String(conta.fornecedor_id || '').trim() !== fornecedorId) return false;
      if (String(conta.loja_id || '').trim() !== lojaId) return false;
      if (String(conta.data_compra || '').trim() !== dataCompra) return false;
      if (Number(conta.valor_compra || 0).toFixed(2) !== valor) return false;
      return textoFinanceiroNormalizado(conta.observacao || '') === observacao;
    })
    .sort((a, b) => (Number(a.numero_parcela || 0) - Number(b.numero_parcela || 0)) || String(a.data_vencimento || '').localeCompare(String(b.data_vencimento || '')));
}

// Empurra um vencimento que caia em sábado, domingo ou feriado nacional
// para o PRÓXIMO DIA ÚTIL. Reaproveita o calendário de feriados das escalas
// (nacionais + móveis: Carnaval, Sexta-feira Santa, Corpus Christi).
function ajustarVencimentoParaDiaUtilFinanceiro(dataISO) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dataISO || ''))) return dataISO;
  const d = new Date(`${dataISO}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dataISO;
  const isoDe = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  const ehFeriado = (dt) => {
    try {
      if (typeof obterFeriadosNacionaisEscala !== 'function') return false;
      return !!obterFeriadosNacionaisEscala(dt.getFullYear())[isoDe(dt)];
    } catch (_) { return false; }
  };
  let protecao = 0; // nunca itera mais que 15 dias (segurança)
  while (protecao < 15 && (d.getDay() === 0 || d.getDay() === 6 || ehFeriado(d))) {
    d.setDate(d.getDate() + 1);
    protecao++;
  }
  return isoDe(d);
}

// Vencimento da parcela idx (0-based) a partir do vencimento base.
// Intervalo vazio ou 30 = MENSAL: mantém o DIA do vencimento base mês a mês
// (ex.: base 08/07 → 08/08, 08/09... ajustando meses curtos como fevereiro).
// Qualquer outro intervalo (15, 45...) continua somando dias exatos.
// idx pode ser negativo (recálculo de parcelas anteriores na edição).
function calcularVencimentoParcelaFinanceiro(baseISO, idx, intervaloDias) {
  const n = Number.parseInt(String(intervaloDias ?? ''), 10);
  const ehMensal = !Number.isFinite(n) || n <= 0 || n === 30;
  if (!ehMensal) {
    return ajustarVencimentoParaDiaUtilFinanceiro(adicionarDiasDataISOFinanceiro(baseISO, idx * n) || baseISO);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(baseISO || ''))) return baseISO;
  const [ano, mes, dia] = baseISO.split('-').map(Number);
  const alvo = (mes - 1) + idx;
  const anoV = ano + Math.floor(alvo / 12);
  const mesV = ((alvo % 12) + 12) % 12 + 1;
  const ultimo = new Date(anoV, mesV, 0).getDate();
  const diaV = Math.min(dia, ultimo);
  // O dia âncora vem SEMPRE do vencimento base (ex.: dia 10), mês a mês —
  // o ajuste de fim de semana de um mês não desloca os meses seguintes.
  return ajustarVencimentoParaDiaUtilFinanceiro(`${anoV}-${String(mesV).padStart(2, '0')}-${String(diaV).padStart(2, '0')}`);
}

async function salvarContaAPagarFinanceiro() {
  const campoFornecedor = document.getElementById('contaFornecedorBusca');
  const campoFornecedorId = document.getElementById('contaFornecedorId');
  preencherSelectLojaContaAPagarFinanceiro(document.getElementById('contaLojaId')?.value || '');
  const lojaSelecionada = obterLojaSelecionadaContaAPagarFinanceiro();
  const dataCompraTexto = String(document.getElementById('contaDataCompra')?.value || '').trim();
  const dataVencimentoTexto = String(document.getElementById('contaDataVencimento')?.value || '').trim();
  const dataCompra = converterDataBRParaISOFinanceiro(dataCompraTexto);
  const dataVencimento = converterDataBRParaISOFinanceiro(dataVencimentoTexto);
  const valorTexto = String(document.getElementById('contaValorCompra')?.value || '').trim();
  const observacao = String(document.getElementById('contaObservacao')?.value || '').trim();
  const qtdParcelasTexto = String(document.getElementById('contaQtdParcelas')?.value || '').trim();
  const intervaloParcelasTexto = String(document.getElementById('contaIntervaloParcelasDias')?.value || '').trim();
  const qtdParcelas = Number.parseInt(qtdParcelasTexto, 10);
  const intervaloParcelasDias = Number.parseInt(intervaloParcelasTexto, 10);
  const editando = !!contaAPagarFinanceiroEmEdicaoId;

  atualizarFornecedorSelecionadoContaAPagar();
  const fornecedorId = String(campoFornecedorId?.value || '').trim();
  if (!lojaSelecionada?.id) {
    setMsg('msgContaAPagarFinanceiro', 'Selecione a loja do lançamento.', 'err');
    return;
  }
  if (!fornecedorId) {
    setMsg('msgContaAPagarFinanceiro', 'Selecione um fornecedor válido na busca.', 'err');
    return;
  }
  const categoriaId = String(document.getElementById('contaCategoriaId')?.value || '').trim();
  if (!categoriaId) {
    setMsg('msgContaAPagarFinanceiro', 'Selecione uma categoria de compra.', 'err');
    return;
  }
  if (!dataCompra) {
    setMsg('msgContaAPagarFinanceiro', 'Informe a data da compra.', 'err');
    return;
  }
  if (!dataVencimento) {
    setMsg('msgContaAPagarFinanceiro', 'Informe a data de vencimento.', 'err');
    return;
  }
  if (!valorTexto) {
    setMsg('msgContaAPagarFinanceiro', 'Informe o valor da compra.', 'err');
    return;
  }
  if (!observacao) {
    setMsg('msgContaAPagarFinanceiro', 'A observação do lançamento é obrigatória.', 'err');
    return;
  }

  const valorCompra = lerValorMonetarioFinanceiro(valorTexto);
  if (!Number.isFinite(valorCompra) || valorCompra <= 0) {
    setMsg('msgContaAPagarFinanceiro', 'Informe um valor de compra válido.', 'err');
    return;
  }

  const atorAuditoria = obterAtorAuditoriaAtual();

  if (editando) {
    const contaAnterior = contasAPagarFinanceiroCache.find(item => String(item.id) === String(contaAPagarFinanceiroEmEdicaoId));
    if (!contaAnterior) {
      console.error('Modo edição sem conta anterior carregada. Salvamento cancelado para evitar duplicação de parcelas.', { contaAPagarFinanceiroEmEdicaoId });
      setMsg('msgContaAPagarFinanceiro', 'Não foi possível localizar a conta em edição. Recarregue a lista antes de salvar.', 'err');
      return;
    }

    const payloadEdicaoAtual = {
      fornecedor_id: fornecedorId,
      categoria_id: categoriaId || null,
      data_compra: dataCompra,
      data_vencimento: dataVencimento,
      valor_compra: Number(valorCompra.toFixed(2)),
      observacao,
      qtd_parcelas: Number.parseInt(String(contaAnterior?.qtd_parcelas || 1), 10) || 1,
      intervalo_parcelas_dias: contaAnterior?.intervalo_parcelas_dias || null,
      numero_parcela: Number.parseInt(String(contaAnterior?.numero_parcela || 1), 10) || 1,
      updated_at: new Date().toISOString(),
    };

    let aplicarAlteracaoEmTodasParcelas = false;
    const houveAlteracao = valoresContaAPagarAlterados(contaAnterior, payloadEdicaoAtual);
    const grupoParcelasId = String(contaAnterior?.grupo_parcelas_id || '').trim();
    const parcelasRelacionadas = grupoParcelasId
      ? contasAPagarFinanceiroCache
        .filter(item => String(item.grupo_parcelas_id || '') === grupoParcelasId && !item.excluido_em)
        .sort((a, b) => (Number(a.numero_parcela || 0) - Number(b.numero_parcela || 0)) || String(a.data_vencimento || '').localeCompare(String(b.data_vencimento || '')))
      : [];

    if (houveAlteracao && grupoParcelasId && parcelasRelacionadas.length > 1) {
      const nomeFornecedor = contaAnterior?.fornecedores?.nome || String(campoFornecedor?.value || '').trim() || 'Fornecedor';
      const nomeLancamento = observacao || contaAnterior?.observacao || 'Lançamento sem observação';
      const detalhesAlteracoes = descreverAlteracoesContaAPagar(contaAnterior, payloadEdicaoAtual);
      const decisaoParcelas = await abrirModalConfirmacaoFinanceira({
        titulo: 'DESEJA ALTERAR EM TODOS LANÇAMENTOS?',
        subtitulo: 'Este título possui parcelas relacionadas',
        fornecedor: nomeFornecedor,
        lancamento: nomeLancamento,
        detalhes: [
          `Parcelas relacionadas: ${parcelasRelacionadas.length}`,
          ...detalhesAlteracoes,
        ],
        textoSim: 'Sim, alterar todos',
        textoNao: 'Não, alterar só este',
      });
      if (decisaoParcelas === 'cancelar') {
        setMsg('msgContaAPagarFinanceiro', 'Edição cancelada. Escolha Sim ou Não para salvar a alteração.', 'err');
        return;
      }
      aplicarAlteracaoEmTodasParcelas = decisaoParcelas === 'sim';
    }

    if (aplicarAlteracaoEmTodasParcelas) {
      const numeroParcelaAtual = Number.parseInt(String(contaAnterior?.numero_parcela || 1), 10) || 1;
      let intervaloBase = Number.parseInt(String(contaAnterior?.intervalo_parcelas_dias || 0), 10) || 0;
      if (intervaloBase <= 0 && parcelasRelacionadas.length > 1) {
        const parcelaReferencia = parcelasRelacionadas.find(item => Number.parseInt(String(item.numero_parcela || 1), 10) === numeroParcelaAtual + 1)
          || parcelasRelacionadas.find(item => Number.parseInt(String(item.numero_parcela || 1), 10) === numeroParcelaAtual - 1)
          || null;
        if (parcelaReferencia?.data_vencimento && contaAnterior?.data_vencimento) {
          const diff = Math.abs(diferencaDiasDataFinanceiro(parcelaReferencia.data_vencimento, contaAnterior.data_vencimento) || 0);
          intervaloBase = diff > 0 ? diff : 30;
        } else {
          intervaloBase = 30;
        }
      }

      const payloadGrupoBase = {
        fornecedor_id: fornecedorId,
        data_compra: dataCompra,
        valor_compra: Number(valorCompra.toFixed(2)),
        observacao,
        qtd_parcelas: Number.parseInt(String(contaAnterior?.qtd_parcelas || 1), 10) || 1,
        intervalo_parcelas_dias: contaAnterior?.intervalo_parcelas_dias || null,
        updated_at: new Date().toISOString(),
      };

      for (const parcela of parcelasRelacionadas) {
        const numeroParcela = Number.parseInt(String(parcela.numero_parcela || 1), 10) || 1;
        const payloadParcela = {
          ...payloadGrupoBase,
          data_vencimento: calcularVencimentoParcelaFinanceiro(dataVencimento, numeroParcela - numeroParcelaAtual, intervaloBase) || dataVencimento,
        };
        const { error: erroParcela } = await sb
          .from('contasapagar')
          .update(payloadParcela)
          .eq('id', parcela.id)
          .is('excluido_em', null);

        if (erroParcela) {
          setMsg('msgContaAPagarFinanceiro', `Não foi possível atualizar as parcelas relacionadas: ${mensagemErroSupabase(erroParcela, 'erro desconhecido')}`, 'err');
          return;
        }
      }
    }

    const { error } = await sb
      .from('contasapagar')
      .update(payloadEdicaoAtual)
      .eq('id', contaAPagarFinanceiroEmEdicaoId)
      .is('excluido_em', null);

    if (error) {
      if (isMissingContasAPagarTableError(error) || isMissingFornecedoresTableError(error) || isMissingContasAPagarPagamentoColumnsError(error) || isMissingContasAPagarAuditoriaColumnsError(error) || isMissingColumnError(error)) {
        setMsg('msgContaAPagarFinanceiro', 'Rode o SQL mais recente do financeiro antes de usar esta tela.', 'err');
        return;
      }
      setMsg('msgContaAPagarFinanceiro', `Não foi possível salvar a edição: ${mensagemErroSupabase(error, 'erro desconhecido')}`, 'err');
      return;
    }

    limparFormularioContaAPagarFinanceiro();
    if (campoFornecedor) campoFornecedor.blur();
    setMsg('msgContaAPagarFinanceiro', aplicarAlteracaoEmTodasParcelas ? 'Parcelas relacionadas atualizadas com vencimentos recalculados.' : 'Conta atualizada sem criar novas parcelas.', 'ok');
    resetarFiltrosContasAPagarFinanceiro({ manterListaVisivel: true });
    carregarContasAPagarFinanceiro();
    return;
  }

  const qtdParcelasInformada = qtdParcelasTexto.length > 0;
  if (qtdParcelasInformada && (!Number.isFinite(qtdParcelas) || qtdParcelas <= 0)) {
    setMsg('msgContaAPagarFinanceiro', 'Informe uma quantidade de parcelas válida.', 'err');
    return;
  }
  const qtdParcelasValidada = qtdParcelasInformada ? qtdParcelas : 1;
  const intervaloInformado = intervaloParcelasTexto.length > 0;
  if (intervaloInformado && (!Number.isFinite(intervaloParcelasDias) || intervaloParcelasDias <= 0)) {
    setMsg('msgContaAPagarFinanceiro', 'Informe um intervalo em dias válido.', 'err');
    return;
  }
  let intervaloParcelasDiasFinal = null;
  if (qtdParcelasValidada > 1) {
    if (intervaloInformado) {
      intervaloParcelasDiasFinal = intervaloParcelasDias;
    } else {
      const dtCompra = new Date(`${dataCompra}T00:00:00`);
      const dtVenc = new Date(`${dataVencimento}T00:00:00`);
      const diffDias = Math.round((dtVenc.getTime() - dtCompra.getTime()) / (24 * 60 * 60 * 1000));
      intervaloParcelasDiasFinal = diffDias > 0 ? diffDias : 30;
    }
  }

  if (contaAPagarFinanceiroEmEdicaoId) {
    console.error('Proteção anti-duplicação: tentativa de inserir novas parcelas durante edição.', { contaAPagarFinanceiroEmEdicaoId });
    setMsg('msgContaAPagarFinanceiro', 'Salvamento cancelado para evitar duplicação de parcelas. Cancele a edição e tente novamente.', 'err');
    return;
  }

  const grupoParcelasId = gerarGrupoParcelasIdFinanceiro();
  const payloadBase = {
    fornecedor_id: fornecedorId,
    categoria_id: categoriaId || null,
    loja_id: lojaSelecionada.id,
    empresa_id: lojaSelecionada.empresa_id || obterEmpresaIdSessao?.() || usuarioSistemaLogado?.empresa_id || null,
    data_compra: dataCompra,
    data_vencimento: dataVencimento,
    valor_compra: Number(valorCompra.toFixed(2)),
    observacao,
    qtd_parcelas: qtdParcelasValidada,
    intervalo_parcelas_dias: intervaloParcelasDiasFinal,
  };
  const linhas = Array.from({ length: qtdParcelasValidada }).map((_, idx) => ({
    ...payloadBase,
    data_pagamento: null,
    data_vencimento: calcularVencimentoParcelaFinanceiro(dataVencimento, idx, intervaloParcelasDiasFinal),
    numero_parcela: idx + 1,
    grupo_parcelas_id: grupoParcelasId,
    criado_por_id: atorAuditoria.funcionarioId || null,
    criado_por_nome: atorAuditoria.nome || 'Sistema',
  }));
  const { error } = await sb.from('contasapagar').insert(linhas);

  if (error) {
    if (isMissingContasAPagarTableError(error) || isMissingFornecedoresTableError(error) || isMissingContasAPagarPagamentoColumnsError(error) || isMissingContasAPagarAuditoriaColumnsError(error) || isMissingColumnError(error)) {
      setMsg('msgContaAPagarFinanceiro', 'Rode o SQL mais recente do financeiro antes de usar esta tela.', 'err');
      return;
    }
    setMsg('msgContaAPagarFinanceiro', `Não foi possível salvar: ${mensagemErroSupabase(error, 'erro desconhecido')}`, 'err');
    return;
  }

  limparFormularioContaAPagarFinanceiro();
  if (campoFornecedor) campoFornecedor.blur();
  setMsg('msgContaAPagarFinanceiro', `${qtdParcelasValidada} conta(s) cadastrada(s) com sucesso.`, 'ok');
  resetarFiltrosContasAPagarFinanceiro({ manterListaVisivel: true });
  carregarContasAPagarFinanceiro();
}

function cancelarEdicaoContaAPagarFinanceiro() {
  limparFormularioContaAPagarFinanceiro();
  setMsg('msgContaAPagarFinanceiro', 'Edição cancelada.', 'ok');
}

function atualizarEstadoListaContasAPagarFinanceiro() {
  const lista = document.getElementById('listaContasAPagarFinanceiro');
  const btn = document.getElementById('btnToggleContasAPagarLista');
  const filtroBusca = String(document.getElementById('filtroContaAPagarBusca')?.value || '').trim();
  const filtroCadastroInicio = String(document.getElementById('filtroContaAPagarCadastroInicio')?.value || '').trim();
  const filtroCadastroFim = String(document.getElementById('filtroContaAPagarCadastroFim')?.value || '').trim();
  const filtroVencimentoInicio = String(document.getElementById('filtroContaAPagarVencimentoInicio')?.value || '').trim();
  const filtroVencimentoFim = String(document.getElementById('filtroContaAPagarVencimentoFim')?.value || '').trim();
  const filtroFornecedor = String(document.getElementById('filtroContaAPagarFornecedor')?.value || '').trim();
  const visivel = contasAPagarListaVisivel || !!filtroBusca || !!filtroCadastroInicio || !!filtroCadastroFim || !!filtroVencimentoInicio || !!filtroVencimentoFim || !!filtroFornecedor;
  if (lista) lista.hidden = !visivel;
  if (btn) {
    btn.textContent = visivel ? 'Ocultar contas' : 'Mostrar contas';
    btn.setAttribute('aria-expanded', String(visivel));
  }
}

function toggleListaContasAPagarFinanceiro() {
  contasAPagarListaVisivel = !contasAPagarListaVisivel;
  atualizarEstadoListaContasAPagarFinanceiro();
}

function obterDataISOFiltroContaAPagar(id) {
  const valor = String(document.getElementById(id)?.value || '').trim();
  if (!valor) return '';
  return converterDataBRParaISOFinanceiro(valor) || valor.slice(0, 10);
}

function dentroDoPeriodoCadastroContaAPagar(item, dataInicio = '', dataFim = '') {
  if (!dataInicio && !dataFim) return true;
  // Converte created_at UTC para data local brasileira (UTC-3)
  let dataCadastro = '';
  if (item?.created_at) {
    try {
      const d = new Date(item.created_at);
      // Ajusta para UTC-3 (Brasil)
      d.setHours(d.getHours() - 3);
      dataCadastro = d.toISOString().slice(0, 10);
    } catch(e) {
      dataCadastro = String(item.created_at).slice(0, 10);
    }
  }
  // Fallback: usa data_compra se created_at não disponível
  if (!dataCadastro) dataCadastro = String(item?.data_compra || '').slice(0, 10);
  if (!dataCadastro) return false;
  if (dataInicio && dataCadastro < dataInicio) return false;
  if (dataFim && dataCadastro > dataFim) return false;
  return true;
}

function dentroDoPeriodoVencimentoContaAPagar(item, dataInicio = '', dataFim = '') {
  if (!dataInicio && !dataFim) return true;
  const dataVencimento = String(item?.data_vencimento || '').trim().slice(0, 10);
  if (!dataVencimento) return false;
  if (dataInicio && dataVencimento < dataInicio) return false;
  if (dataFim && dataVencimento > dataFim) return false;
  return true;
}

function limparFiltroContasAPagarFinanceiro() {
  resetarFiltrosContasAPagarFinanceiro({ manterListaVisivel: false });
  carregarContasAPagarFinanceiro();
}

// ── Filtro de categorias (multi-seleção por checkbox) das contas a pagar ──
let filtroContaAPagarCategoriasSelecionadas = new Set();

function toggleDropdownCategoriasContaAPagar(forcarFechar) {
  const dd = document.getElementById('dropdownCategoriasContaAPagar');
  if (!dd) return;
  const abrir = forcarFechar === true ? false : dd.style.display === 'none';
  if (abrir) {
    renderizarDropdownCategoriasContaAPagar();
    dd.style.display = 'block';
    posicionarDropdownFlutuanteNaViewport(dd, document.getElementById('btnFiltroContaAPagarCategorias'));
    setTimeout(() => document.addEventListener('click', fecharDropdownCategoriasForaContaAPagar), 0);
  } else {
    dd.style.display = 'none';
    document.removeEventListener('click', fecharDropdownCategoriasForaContaAPagar);
  }
}

function fecharDropdownCategoriasForaContaAPagar(ev) {
  const wrap = document.getElementById('filtroContaAPagarCategoriasWrap');
  if (wrap && !wrap.contains(ev.target)) toggleDropdownCategoriasContaAPagar(true);
}

function renderizarDropdownCategoriasContaAPagar() {
  const dd = document.getElementById('dropdownCategoriasContaAPagar');
  if (!dd) return;
  const categorias = [...(categoriasCompraCache || [])].sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'));
  const linha = (valor, nome, titulo = '') => `
    <label style="display:flex;align-items:center;gap:8px;padding:5px 6px;border-radius:7px;cursor:pointer;font-size:12px;color:var(--text);min-width:0;">
      <input type="checkbox" style="width:13px;height:13px;flex-shrink:0;" ${filtroContaAPagarCategoriasSelecionadas.has(valor) ? 'checked' : ''}
        onchange="alternarCategoriaFiltroContaAPagar('${valor}', this.checked)"><span title="${escaparHtmlBasico(titulo)}" style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${nome}</span>
    </label>`;
  dd.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
      <span style="font-size:10px;letter-spacing:.5px;color:var(--text-muted);font-weight:700;">CATEGORIAS</span>
      <button class="btn btn-ghost btn-sm" type="button" style="font-size:10px;padding:2px 8px;" onclick="limparCategoriasFiltroContaAPagar()">Limpar</button>
    </div>
    ${linha('__sem__', '<i>— Sem categoria</i>', 'Sem categoria')}
    ${categorias.map(c => linha(String(c.id), escaparHtmlBasico(c.nome || '-'), String(c.nome || '-'))).join('') || '<div class="empty" style="padding:8px;">Nenhuma categoria cadastrada.</div>'}`;
}

function alternarCategoriaFiltroContaAPagar(valor, marcado) {
  if (marcado) filtroContaAPagarCategoriasSelecionadas.add(valor);
  else filtroContaAPagarCategoriasSelecionadas.delete(valor);
  atualizarBotaoCategoriasContaAPagar();
  carregarContasAPagarFinanceiro();
}

function limparCategoriasFiltroContaAPagar() {
  filtroContaAPagarCategoriasSelecionadas.clear();
  renderizarDropdownCategoriasContaAPagar();
  atualizarBotaoCategoriasContaAPagar();
  carregarContasAPagarFinanceiro();
}

function atualizarBotaoCategoriasContaAPagar() {
  const btn = document.getElementById('btnFiltroContaAPagarCategorias');
  if (!btn) return;
  const n = filtroContaAPagarCategoriasSelecionadas.size;
  btn.textContent = n ? `Categorias (${n}) ▾` : 'Categorias ▾';
  btn.style.fontWeight = n ? '700' : '';
}

function resetarFiltrosContasAPagarFinanceiro({ manterListaVisivel = false } = {}) {
  filtroContaAPagarCategoriasSelecionadas.clear();
  atualizarBotaoCategoriasContaAPagar();
  toggleDropdownCategoriasContaAPagar(true);
  const busca = document.getElementById('filtroContaAPagarBusca');
  const cadastroInicio = document.getElementById('filtroContaAPagarCadastroInicio');
  const cadastroFim = document.getElementById('filtroContaAPagarCadastroFim');
  const vencimentoInicio = document.getElementById('filtroContaAPagarVencimentoInicio');
  const vencimentoFim = document.getElementById('filtroContaAPagarVencimentoFim');
  const fornecedor = document.getElementById('filtroContaAPagarFornecedor');
  const status = document.getElementById('filtroContaAPagarStatus');
  if (busca) busca.value = '';
  if (cadastroInicio) cadastroInicio.value = '';
  if (cadastroFim) cadastroFim.value = '';
  if (vencimentoInicio) vencimentoInicio.value = '';
  if (vencimentoFim) vencimentoFim.value = '';
  if (fornecedor) fornecedor.value = '';
  if (status) {
    status.value = '';
    status.selectedIndex = 0;
  }
  contasAPagarListaVisivel = !!manterListaVisivel;
  contasAPagarFinanceiroSelecionadasIds.clear();
  contasAPagarFinanceiroVisiveisIds = [];
  atualizarResumoSelecaoContasAPagarFinanceiro();
}

function atualizarResumoSelecaoContasAPagarFinanceiro() {
  const totalVisiveis = contasAPagarFinanceiroVisiveisIds.length;
  const selecionadosVisiveis = contasAPagarFinanceiroVisiveisIds.filter(id => contasAPagarFinanceiroSelecionadasIds.has(String(id)));
  const qtdSelecionados = selecionadosVisiveis.length;
  const btnSelecionar = document.getElementById('btnSelecionarTodasContasAPagarFinanceiro');
  const btnExcluir = document.getElementById('btnExcluirContasAPagarSelecionadasFinanceiro');
  const resumo = document.getElementById('resumoSelecaoContasAPagarFinanceiro');
  if (btnSelecionar) {
    btnSelecionar.textContent = totalVisiveis && qtdSelecionados === totalVisiveis ? 'Desmarcar todos' : 'Marcar todos';
    btnSelecionar.disabled = !totalVisiveis;
  }
  if (btnExcluir) btnExcluir.disabled = !qtdSelecionados;
  if (resumo) {
    resumo.textContent = qtdSelecionados
      ? `${qtdSelecionados} conta(s) selecionada(s) de ${totalVisiveis}.`
      : (totalVisiveis ? `${totalVisiveis} conta(s) no filtro. Nenhuma selecionada.` : 'Nenhuma conta selecionada.');
  }
}

function atualizarSelecaoContaAPagarFinanceiro(id, marcado) {
  const chave = String(id || '');
  if (!chave) return;
  if (marcado) contasAPagarFinanceiroSelecionadasIds.add(chave);
  else contasAPagarFinanceiroSelecionadasIds.delete(chave);
  atualizarResumoSelecaoContasAPagarFinanceiro();
}

function toggleSelecionarTodasContasAPagarFinanceiro() {
  if (!contasAPagarFinanceiroVisiveisIds.length) return;
  const todosSelecionados = contasAPagarFinanceiroVisiveisIds.every(id => contasAPagarFinanceiroSelecionadasIds.has(String(id)));
  contasAPagarFinanceiroVisiveisIds.forEach(id => {
    const chave = String(id);
    if (todosSelecionados) contasAPagarFinanceiroSelecionadasIds.delete(chave);
    else contasAPagarFinanceiroSelecionadasIds.add(chave);
  });
  document.querySelectorAll('.checkbox-conta-apagar-financeiro').forEach(input => {
    const id = input.getAttribute('data-conta-id');
    input.checked = contasAPagarFinanceiroSelecionadasIds.has(String(id));
  });
  atualizarResumoSelecaoContasAPagarFinanceiro();
}

async function excluirContasAPagarSelecionadasFinanceiro() {
  const idsSelecionados = contasAPagarFinanceiroVisiveisIds
    .filter(id => contasAPagarFinanceiroSelecionadasIds.has(String(id)))
    .map(String);

  if (!idsSelecionados.length) {
    setMsg('msgContaAPagarFinanceiro', 'Selecione pelo menos uma conta para excluir.', 'err');
    return;
  }

  const confirmacaoTela = confirm(`Excluir ${idsSelecionados.length} conta(s) selecionada(s)? Esta ação ficará registrada no relatório.`);
  if (!confirmacaoTela) return;

  const operador = obterFuncionarioOperadorAtual();
  const confirmacao = await confirmarAcaoComPin({
    funcionario: operador,
    titulo: 'Excluir contas selecionadas',
    subtitulo: `Confirme o PIN para excluir ${idsSelecionados.length} conta(s) a pagar selecionada(s).`,
    textoAcao: 'Excluir selecionadas',
    escopo: 'empresa',
  });

  if (!confirmacao) return;

  const { data, error } = await sb
    .from('contasapagar')
    .update({
      excluido_em: confirmacao.confirmadoEm,
      excluido_por_id: confirmacao.funcionarioId,
      excluido_por_nome: confirmacao.nomeFuncionario,
    })
    .in('id', idsSelecionados)
    .is('excluido_em', null)
    .select('id');

  if (error) {
    if (isMissingContasAPagarAuditoriaColumnsError(error)) {
      setMsg('msgContaAPagarFinanceiro', 'Rode a migration de auditoria do contas a pagar antes de excluir.', 'err');
      return;
    }
    setMsg('msgContaAPagarFinanceiro', `Não foi possível excluir as selecionadas: ${mensagemErroSupabase(error, 'erro desconhecido')}`, 'err');
    return;
  }

  const excluidas = Array.isArray(data) ? data.length : 0;
  if (contaAPagarFinanceiroEmEdicaoId && idsSelecionados.includes(String(contaAPagarFinanceiroEmEdicaoId))) {
    limparFormularioContaAPagarFinanceiro();
  }
  idsSelecionados.forEach(id => contasAPagarFinanceiroSelecionadasIds.delete(String(id)));
  setMsg('msgContaAPagarFinanceiro', `${excluidas} conta(s) excluída(s) com sucesso.`, 'ok');
  carregarContasAPagarFinanceiro();
}

let contasAPagarAgruparParcelas = false;

function toggleAgruparParcelasContaAPagar() {
  contasAPagarAgruparParcelas = !contasAPagarAgruparParcelas;
  const btn = document.getElementById('btnAgruparParcelas');
  if (btn) {
    btn.textContent = contasAPagarAgruparParcelas ? '📂 Desagrupar' : '📦 Agrupar';
    btn.style.color = contasAPagarAgruparParcelas ? 'var(--accent)' : '';
    btn.style.borderColor = contasAPagarAgruparParcelas ? 'var(--accent)' : '';
  }
  carregarContasAPagarFinanceiro();
}

async function carregarContasAPagarFinanceiro() {
  const lista = document.getElementById('listaContasAPagarFinanceiro');
  if (!lista) return;
  renderizarFiltroLojasCheckbox('filtroLojasContasAPagarFinanceiro', 'carregarContasAPagarFinanceiro()');
  const filtroBuscaBruto = String(document.getElementById('filtroContaAPagarBusca')?.value || '').trim();
  const filtroFornecedorBruto = String(document.getElementById('filtroContaAPagarFornecedor')?.value || '').trim();
  const filtroCadastroInicio = obterDataISOFiltroContaAPagar('filtroContaAPagarCadastroInicio');
  const filtroCadastroFim = obterDataISOFiltroContaAPagar('filtroContaAPagarCadastroFim');
  const filtroVencimentoInicio = obterDataISOFiltroContaAPagar('filtroContaAPagarVencimentoInicio');
  const filtroVencimentoFim = obterDataISOFiltroContaAPagar('filtroContaAPagarVencimentoFim');
  const lojasSelecionadas = obterIdsLojasSelecionadasFiltroMultiLoja('filtroLojasContasAPagarFinanceiro');
  if (filtroBuscaBruto || filtroFornecedorBruto || filtroCadastroInicio || filtroCadastroFim || filtroVencimentoInicio || filtroVencimentoFim || filtroContaAPagarCategoriasSelecionadas.size) contasAPagarListaVisivel = true;
  atualizarEstadoListaContasAPagarFinanceiro();
  lista.innerHTML = '<div class="empty">Carregando...</div>';

  // Garante a lista de categorias para exibir o nome no card.
  if (!(categoriasCompraCache || []).length && typeof carregarCategoriasCompra === 'function') {
    try { await carregarCategoriasCompra(); } catch (_) { /* segue sem nome de categoria */ }
  }

  const filtroBusca = textoFinanceiroNormalizado(filtroBuscaBruto);
  const filtroFornecedor = textoFinanceiroNormalizado(filtroFornecedorBruto);
  const filtroBuscaDigitos = filtroBuscaBruto.replace(/\D/g, '');
  const filtroStatus = String(document.getElementById('filtroContaAPagarStatus')?.value || '').trim();

  // Recorte padrão ao abrir a tela (sem nenhum filtro do usuário): mostra
  // vencidas em aberto + vencimentos de hoje até +30 dias, em ordem de vencimento.
  const semFiltroUsuario = !filtroBuscaBruto && !filtroFornecedorBruto && !filtroCadastroInicio
    && !filtroCadastroFim && !filtroVencimentoInicio && !filtroVencimentoFim && !filtroStatus
    && !filtroContaAPagarCategoriasSelecionadas.size;
  const aplicarPadrao30Dias = semFiltroUsuario;
  const hojeISOPadrao = hoje();
  const limite30DiasISO = (() => {
    const d = new Date(`${hojeISOPadrao}T12:00:00`);
    if (Number.isNaN(d.getTime())) return hojeISOPadrao;
    d.setDate(d.getDate() + 30);
    return dataLocalISO(d);
  })();

  const { data, error } = await executarSemFiltroLojaTemporario(() => {
    let query = sb
      .from('contasapagar')
      .select('id, fornecedor_id, categoria_id, forma_pagamento, forma_pagamento_id, conta_financeira_id, data_compra, data_vencimento, data_pagamento, valor_compra, observacao, qtd_parcelas, intervalo_parcelas_dias, numero_parcela, grupo_parcelas_id, created_at, criado_por_nome, loja_id, fornecedores(nome), formas_pagamento(nome), contas_financeiras(nome)')
      .is('excluido_em', null)
      .order('data_vencimento', { ascending: true });
    if (lojasSelecionadas.length) query = query.in('loja_id', lojasSelecionadas);
    return query;
  });

  if (error) {
    contasAPagarFinanceiroCache = [];
    if (isMissingContasAPagarTableError(error)) {
      lista.innerHTML = '<div class="empty">Rode o SQL da tabela contasapagar para habilitar este cadastro.</div>';
      return;
    }
    if (isMissingContasAPagarAuditoriaColumnsError(error)) {
      lista.innerHTML = '<div class="empty">Rode a migration de auditoria do contas a pagar para habilitar este cadastro.</div>';
      return;
    }
    if (isMissingFornecedoresTableError(error)) {
      lista.innerHTML = '<div class="empty">Rode o SQL da tabela fornecedores para vincular contas.</div>';
      return;
    }
    lista.innerHTML = '<div class="empty">Erro ao carregar contas a pagar.</div>';
    return;
  }

  contasAPagarFinanceiroCache = data || [];
  const itensFiltrados = contasAPagarFinanceiroCache.filter(item => {
    const nomeFornecedor = String(item.fornecedores?.nome || '').trim();
    const observacaoConta = String(item.observacao || '').trim();
    const valorConta = Number(item.valor_compra || 0);
    const valorFormatado = formatarMoedaBRFinanceiro(valorConta);
    const valorDecimal = Number.isFinite(valorConta) ? valorConta.toFixed(2).replace('.', ',') : '';
    const valorInteiro = Number.isFinite(valorConta) ? String(Math.trunc(valorConta)) : '';
    const valorCentavos = Number.isFinite(valorConta) ? String(Math.round(valorConta * 100)) : '';
    const dataCompraBR = formatarDataBRFinanceiro(item.data_compra);
    const dataVencimentoBR = formatarDataBRFinanceiro(item.data_vencimento);
    const dataPagamentoBR = formatarDataBRFinanceiro(item.data_pagamento);
    const parcelaTexto = `${item.numero_parcela || 1}/${item.qtd_parcelas || 1}`;
    const intervaloTexto = item.intervalo_parcelas_dias ? `${item.intervalo_parcelas_dias} dias` : '';
    const status = item.data_pagamento ? 'pago' : 'pendente';
    // Campos exibidos no card também entram na busca: categoria, forma, conta, quem cadastrou.
    const nomeCategoria = item.categoria_id
      ? String((categoriasCompraCache || []).find(c => String(c.id) === String(item.categoria_id))?.nome || '')
      : '';
    const nomeForma = String(item.formas_pagamento?.nome || item.forma_pagamento || '').trim();
    const nomeContaFin = String(item.contas_financeiras?.nome || '').trim();
    const nomeCriadoPor = String(item.criado_por_nome || '').trim();
    const textoBuscaConta = [
      nomeCategoria,
      nomeForma,
      nomeContaFin,
      nomeCriadoPor,
      nomeFornecedor,
      observacaoConta,
      valorFormatado,
      valorDecimal,
      valorInteiro,
      valorCentavos,
      String(valorConta || ''),
      dataCompraBR,
      dataVencimentoBR,
      dataPagamentoBR,
      item.data_compra || '',
      item.data_vencimento || '',
      item.data_pagamento || '',
      parcelaTexto,
      intervaloTexto,
      status,
    ].join(' ');
    const textoNormalizadoConta = textoFinanceiroNormalizado(textoBuscaConta);
    const bateBuscaTexto = !filtroBusca || textoNormalizadoConta.includes(filtroBusca);
    const bateBuscaNumero = !!filtroBuscaDigitos && [valorInteiro, valorCentavos, valorDecimal.replace(/\D/g, ''), valorFormatado.replace(/\D/g, '')]
      .some(valor => String(valor || '').includes(filtroBuscaDigitos));
    const bateBusca = !filtroBusca || bateBuscaTexto || bateBuscaNumero;
    const bateFornecedor = !filtroFornecedor || textoFinanceiroNormalizado(nomeFornecedor).includes(filtroFornecedor);
    const bateCategoria = !filtroContaAPagarCategoriasSelecionadas.size
      || (item.categoria_id
        ? filtroContaAPagarCategoriasSelecionadas.has(String(item.categoria_id))
        : filtroContaAPagarCategoriasSelecionadas.has('__sem__'));
    const bateStatus = !filtroStatus || filtroStatus === status;
    const bateCadastro = dentroDoPeriodoCadastroContaAPagar(item, filtroCadastroInicio, filtroCadastroFim);
    const bateVencimento = dentroDoPeriodoVencimentoContaAPagar(item, filtroVencimentoInicio, filtroVencimentoFim);
    let batePadrao30Dias = true;
    if (aplicarPadrao30Dias) {
      const vencISO = String(item.data_vencimento || '').trim();
      if (!vencISO) {
        batePadrao30Dias = false;
      } else if (vencISO > limite30DiasISO) {
        // Vence depois da janela de 30 dias: não traz.
        batePadrao30Dias = false;
      } else if (vencISO < hojeISOPadrao && status === 'pago') {
        // Já venceu e já está paga: não é pendente em aberto, não traz.
        batePadrao30Dias = false;
      }
      // Demais casos: vencidas em aberto (pendentes) ou dentro dos próximos 30 dias -> traz.
    }
    return bateBusca && bateFornecedor && bateCategoria && bateStatus && bateCadastro && bateVencimento && batePadrao30Dias;
  });

  const lojaAtualIdSelecao = String(obterLojaIdSessao?.() || usuarioSistemaLogado?.loja_id || '').trim();
  contasAPagarFinanceiroVisiveisIds = itensFiltrados
    .filter(item => !item.loja_id || String(item.loja_id) === lojaAtualIdSelecao)
    .map(item => String(item.id));
  contasAPagarFinanceiroSelecionadasIds = new Set(
    Array.from(contasAPagarFinanceiroSelecionadasIds).filter(id => contasAPagarFinanceiroVisiveisIds.includes(String(id)))
  );

  if (!itensFiltrados.length) {
    lista.innerHTML = '<div class="empty">Nenhuma conta encontrada para o filtro informado.</div>';
    atualizarEstadoListaContasAPagarFinanceiro();
    atualizarResumoSelecaoContasAPagarFinanceiro();
    return;
  }

  const lojaAtualId = lojaAtualIdSelecao;

  // ── Função auxiliar: renderizar card individual ──
  function renderCardContaAPagar(item) {
    const nomeFornecedor = item.fornecedores?.nome || 'Fornecedor não encontrado';
    const statusPago = !!item.data_pagamento;
    const nomeLoja = obterNomeLojaFiltroMultiLoja(item.loja_id);
    const podeEditar = !item.loja_id || String(item.loja_id) === lojaAtualId;
    return `
      <div class="item">
        <div class="item-info">
          <label class="item-nome" style="display:flex;align-items:center;gap:8px;cursor:pointer">
            ${podeEditar ? `<input class="checkbox-conta-apagar-financeiro" data-conta-id="${item.id}" type="checkbox" ${contasAPagarFinanceiroSelecionadasIds.has(String(item.id)) ? 'checked' : ''} onchange="atualizarSelecaoContaAPagarFinanceiro('${item.id}', this.checked)">` : ''}
            <span>${nomeFornecedor}</span>
          </label>
          <div class="item-detalhe">Loja: ${nomeLoja || '-'} · Compra: ${formatarDataBRFinanceiro(item.data_compra)} · Vencimento: ${formatarDataBRFinanceiro(item.data_vencimento)} · Pagamento: ${formatarDataBRFinanceiro(item.data_pagamento)}</div>
          <div class="item-detalhe">Valor: ${formatarMoedaBRFinanceiro(item.valor_compra)} · Parcela: ${item.numero_parcela || 1}/${item.qtd_parcelas || 1}${item.intervalo_parcelas_dias ? ` · intervalo ${item.intervalo_parcelas_dias} dia(s)` : ''}</div>
          <div class="item-detalhe">Categoria: ${escaparHtmlBasico((categoriasCompraCache || []).find(c => String(c.id) === String(item.categoria_id))?.nome || 'Sem categoria')} · Forma: ${escaparHtmlBasico(item.formas_pagamento?.nome || item.forma_pagamento || '-')} · Conta: ${escaparHtmlBasico(item.contas_financeiras?.nome || '-')}</div>
          <div class="item-detalhe">Cadastro: ${escaparHtmlBasico(String(item.criado_por_nome || '').trim() || '-')}${item.created_at ? ' · ' + fmtDate(item.created_at) : ''}</div>
          <div class="item-detalhe">Obs.: ${escaparHtmlBasico(item.observacao || '-')}</div>
        </div>
        <div class="item-destaque" style="display:flex;flex-direction:column;justify-content:center;align-items:center;gap:6px;flex:1;min-width:260px;padding:8px 16px;">
          <div style="display:flex;flex-direction:column;align-items:center;line-height:1;">
            <span style="font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#fca5a5;">Vencimento</span>
            <span style="font-size:30px;font-weight:900;color:#ff5b5b;text-shadow:0 0 12px rgba(255,91,91,.45);">${formatarDataBRFinanceiro(item.data_vencimento)}</span>
          </div>
          <div style="display:flex;flex-direction:column;align-items:center;line-height:1;">
            <span style="font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#fde047;">Valor</span>
            <span style="font-size:34px;font-weight:900;color:#ffd400;text-shadow:0 0 12px rgba(255,212,0,.45);">${formatarMoedaBRFinanceiro(item.valor_compra)}</span>
          </div>
        </div>
        <div class="item-actions">
          ${statusPago ? '<span class="tag tag-green">Pago</span>' : '<span class="tag tag-amber">Pendente</span>'}
          ${podeEditar ? `
            <button class="btn btn-ghost btn-sm" onclick="editarContaAPagarFinanceiro('${item.id}')">Editar</button>
            <button class="btn btn-red" onclick="excluirContaAPagarFinanceiro('${item.id}')">Excluir</button>
          ` : '<span class="tag tag-gray">Troque a loja para editar</span>'}
        </div>
      </div>`;
  }

  // ── Função auxiliar: renderizar card agrupado (grupo de parcelas) ──
  function renderCardAgrupado(parcelas) {
    const primeiro = parcelas[0];
    const nomeFornecedor = primeiro.fornecedores?.nome || 'Fornecedor não encontrado';
    const totalValor = parcelas.reduce((s, p) => s + Number(p.valor_compra || 0), 0);
    const qtdTotal = Number(primeiro.qtd_parcelas || parcelas.length);
    const qtdNaLista = parcelas.length;
    const pagas = parcelas.filter(p => !!p.data_pagamento).length;
    const pendentes = qtdNaLista - pagas;
    const nomeLoja = obterNomeLojaFiltroMultiLoja(primeiro.loja_id);
    const podeEditar = !primeiro.loja_id || String(primeiro.loja_id) === lojaAtualId;
    const nomeCategoria = escaparHtmlBasico((categoriasCompraCache || []).find(c => String(c.id) === String(primeiro.categoria_id))?.nome || 'Sem categoria');
    const proxPendente = parcelas.find(p => !p.data_pagamento);
    const proxVenc = proxPendente ? formatarDataBRFinanceiro(proxPendente.data_vencimento) : '-';
    const proxVencISO = proxPendente ? proxPendente.data_vencimento : '';
    const corVenc = pagas === qtdNaLista ? '#34d399' : '#ff5b5b';
    const grupoId = String(primeiro.grupo_parcelas_id || '');
    const aberto = (window._ncGruposAbertos || new Set()).has(grupoId);

    const linhasParcelas = parcelas.map(p => {
      const pPago = !!p.data_pagamento;
      return `<div style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:7px;background:${pPago ? 'rgba(52,211,153,.07)' : 'rgba(255,91,91,.05)'};border:1px solid ${pPago ? 'rgba(52,211,153,.18)' : 'rgba(255,91,91,.15)'};">
        <span style="font-size:11px;font-weight:700;color:var(--text-muted);min-width:32px;">${p.numero_parcela || 1}/${qtdTotal}</span>
        <span style="font-size:12px;font-weight:700;color:${pPago ? '#34d399' : '#ffd400'};">${formatarMoedaBRFinanceiro(p.valor_compra)}</span>
        <span style="font-size:11px;color:var(--text-muted);">venc ${formatarDataBRFinanceiro(p.data_vencimento)}</span>
        <span style="margin-left:auto;font-size:10px;font-weight:700;padding:2px 7px;border-radius:5px;background:${pPago ? 'rgba(52,211,153,.15)' : 'rgba(255,165,0,.15)'};color:${pPago ? '#34d399' : '#f0a500'};">${pPago ? 'Pago' : 'Pendente'}</span>
        ${podeEditar ? `<button style="border:none;background:none;font-size:11px;color:var(--text-muted);cursor:pointer;padding:2px 6px;" onclick="editarContaAPagarFinanceiro('${p.id}')">Editar</button>` : ''}
      </div>`;
    }).join('');

    return `<div class="item" style="flex-direction:column;gap:0;padding:0;overflow:hidden;">
      <div style="display:flex;align-items:stretch;width:100%;">
        <div class="item-info" style="flex:1;">
          <label class="item-nome" style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:18px;">📦</span>
            <span>${nomeFornecedor}</span>
            <span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:6px;background:rgba(240,165,0,.15);color:var(--accent);">${qtdNaLista}/${qtdTotal} parcelas</span>
          </label>
          <div class="item-detalhe">Loja: ${nomeLoja || '-'} · Compra: ${formatarDataBRFinanceiro(primeiro.data_compra)} · Intervalo: ${primeiro.intervalo_parcelas_dias ? primeiro.intervalo_parcelas_dias + 'd' : '-'}</div>
          <div class="item-detalhe">Total: <strong style="color:var(--text)">${formatarMoedaBRFinanceiro(totalValor)}</strong> · ${pagas} pagas · ${pendentes} pendentes</div>
          <div class="item-detalhe">Categoria: ${nomeCategoria} · Obs.: ${escaparHtmlBasico(primeiro.observacao || '-')}</div>
        </div>
        <div class="item-destaque" style="display:flex;flex-direction:column;justify-content:center;align-items:center;gap:4px;min-width:200px;padding:8px 14px;">
          ${pendentes > 0 ? `
          <div style="display:flex;flex-direction:column;align-items:center;line-height:1.1;">
            <span style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#fca5a5;">Próx. vencimento</span>
            <span style="font-size:22px;font-weight:900;color:${corVenc};text-shadow:0 0 10px rgba(255,91,91,.35);">${proxVenc}</span>
          </div>` : `<span style="font-size:13px;font-weight:700;color:#34d399;">✓ Todas pagas</span>`}
          <div style="display:flex;flex-direction:column;align-items:center;line-height:1.1;">
            <span style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#fde047;">Total</span>
            <span style="font-size:26px;font-weight:900;color:#ffd400;text-shadow:0 0 10px rgba(255,212,0,.35);">${formatarMoedaBRFinanceiro(totalValor)}</span>
          </div>
        </div>
        <div class="item-actions" style="flex-direction:column;justify-content:center;gap:6px;">
          ${pagas === qtdNaLista ? '<span class="tag tag-green">Tudo pago</span>' : pendentes === qtdNaLista ? '<span class="tag tag-amber">Pendente</span>' : '<span class="tag tag-amber">Parcial</span>'}
          <button class="btn btn-ghost btn-sm" onclick="(function(){window._ncGruposAbertos=window._ncGruposAbertos||new Set();window._ncGruposAbertos.has('${grupoId}')?window._ncGruposAbertos.delete('${grupoId}'):window._ncGruposAbertos.add('${grupoId}');carregarContasAPagarFinanceiro();})()" style="font-size:12px;">${aberto ? '▲ Ocultar' : '▼ Ver parcelas'}</button>
        </div>
      </div>
      ${aberto ? `<div style="padding:10px 14px;border-top:1px solid var(--border);display:flex;flex-direction:column;gap:6px;">${linhasParcelas}</div>` : ''}
    </div>`;
  }

  // ── Renderização: agrupada ou individual ──
  let htmlItens;
  if (contasAPagarAgruparParcelas) {
    // Agrupa por grupo_parcelas_id; itens sem grupo ficam sozinhos
    const grupos = new Map();
    const semGrupo = [];
    itensFiltrados.forEach(item => {
      const gid = String(item.grupo_parcelas_id || '').trim();
      if (gid) {
        if (!grupos.has(gid)) grupos.set(gid, []);
        grupos.get(gid).push(item);
      } else {
        semGrupo.push(item);
      }
    });
    const partes = [];
    grupos.forEach(parcelas => {
      parcelas.sort((a, b) => Number(a.numero_parcela || 0) - Number(b.numero_parcela || 0));
      if (parcelas.length === 1) {
        partes.push(renderCardContaAPagar(parcelas[0]));
      } else {
        partes.push(renderCardAgrupado(parcelas));
      }
    });
    semGrupo.forEach(item => partes.push(renderCardContaAPagar(item)));
    htmlItens = partes.join('');
  } else {
    htmlItens = itensFiltrados.map(renderCardContaAPagar).join('');
  }

  lista.innerHTML = '<div class="lista">' + htmlItens + '</div>';
  atualizarEstadoListaContasAPagarFinanceiro();
  atualizarResumoSelecaoContasAPagarFinanceiro();
}

function editarContaAPagarFinanceiro(id) {
  const item = contasAPagarFinanceiroCache.find(conta => String(conta.id) === String(id));
  if (!item) {
    setMsg('msgContaAPagarFinanceiro', 'Conta não encontrada.', 'err');
    return;
  }

  contaAPagarFinanceiroEmEdicaoId = id;
  preencherSelectLojaContaAPagarFinanceiro(item.loja_id || '');
  document.getElementById('contaFornecedorBusca').value = item.fornecedores?.nome || '';
  document.getElementById('contaFornecedorId').value = item.fornecedor_id || '';
  configurarCampoDataContaAPagarFinanceiro('contaDataCompra', item.data_compra || '');
  configurarCampoDataContaAPagarFinanceiro('contaDataVencimento', item.data_vencimento || '');
  configurarCampoValorCompraFinanceiro(true);
  configurarCampoValorCompraFinanceiro(false);
  const campoValor = document.getElementById('contaValorCompra');
  if (campoValor) campoValor.value = formatarMoedaBRFinanceiro(item.valor_compra || 0);
  document.getElementById('contaObservacao').value = item.observacao || '';
  document.getElementById('contaQtdParcelas').value = item.qtd_parcelas ? String(item.qtd_parcelas) : '';
  document.getElementById('contaIntervaloParcelasDias').value = item.intervalo_parcelas_dias ? String(item.intervalo_parcelas_dias) : '';
  atualizarModoEdicaoContaAPagarFinanceiro(true);
  setMsg('msgContaAPagarFinanceiro', `Editando conta de ${item.fornecedores?.nome || 'fornecedor'}.`, 'ok');
}

async function excluirContaAPagarFinanceiro(id) {
  const item = contasAPagarFinanceiroCache.find(conta => String(conta.id) === String(id));
  if (!item) {
    setMsg('msgContaAPagarFinanceiro', 'Conta não encontrada.', 'err');
    return;
  }

  const parcelasRelacionadas = obterParcelasRelacionadasContaAPagarFinanceiro(item);
  const possuiParcelasRelacionadas = parcelasRelacionadas.length > 1;
  let idsParaExcluir = [String(id)];

  if (possuiParcelasRelacionadas) {
    const decisaoParcelas = await abrirModalConfirmacaoFinanceira({
      titulo: 'Excluir parcelas vinculadas?',
      subtitulo: 'Este título faz parte de um lançamento parcelado',
      fornecedor: item.fornecedores?.nome || 'Fornecedor',
      lancamento: String(item.observacao || '').trim() || 'Conta a pagar',
      detalhes: [
        `Parcela atual: ${item.numero_parcela || 1} de ${item.qtd_parcelas || parcelasRelacionadas.length}`,
        `Títulos vinculados ativos: ${parcelasRelacionadas.length}`,
        `Vencimento deste título: ${formatarDataBRFinanceiro(item.data_vencimento)}`,
      ],
      textoSim: 'Excluir todos vinculados',
      textoNao: 'Excluir só este título',
      textoAjuda: 'Escolha se deseja excluir somente esta parcela ou todos os títulos vinculados ao mesmo lançamento parcelado.',
    });
    if (decisaoParcelas === 'cancelar') return;
    if (decisaoParcelas === 'sim') idsParaExcluir = parcelasRelacionadas.map(conta => String(conta.id));
  }

  const operador = obterFuncionarioOperadorAtual();
  const confirmacao = await confirmarAcaoComPin({
    funcionario: operador,
    titulo: possuiParcelasRelacionadas && idsParaExcluir.length > 1 ? 'Excluir parcelas vinculadas' : 'Excluir conta a pagar',
    subtitulo: idsParaExcluir.length > 1
      ? `Confirme o PIN para excluir ${idsParaExcluir.length} título(s) vinculados de ${item.fornecedores?.nome || 'fornecedor'}. A exclusão ficará registrada no relatório.`
      : `Confirme o PIN para excluir a conta de ${item.fornecedores?.nome || 'fornecedor'}. A exclusão ficará registrada no relatório.`,
    textoAcao: idsParaExcluir.length > 1 ? 'Excluir vinculados' : 'Excluir conta',
    escopo: 'empresa',
  });

  if (!confirmacao) return;

  const { data, error } = await sb
    .from('contasapagar')
    .update({
      excluido_em: confirmacao.confirmadoEm,
      excluido_por_id: confirmacao.funcionarioId,
      excluido_por_nome: confirmacao.nomeFuncionario,
    })
    .in('id', idsParaExcluir)
    .is('excluido_em', null)
    .select('id');

  if (error) {
    if (isMissingContasAPagarAuditoriaColumnsError(error)) {
      setMsg('msgContaAPagarFinanceiro', 'Rode a migration de auditoria do contas a pagar antes de excluir.', 'err');
      return;
    }
    setMsg('msgContaAPagarFinanceiro', `Não foi possível excluir: ${mensagemErroSupabase(error, 'erro desconhecido')}`, 'err');
    return;
  }
  const excluidas = Array.isArray(data) ? data.length : 0;
  if (!excluidas) {
    setMsg('msgContaAPagarFinanceiro', 'Esta conta já foi excluída ou não está mais disponível.', 'err');
    carregarContasAPagarFinanceiro();
    return;
  }
  idsParaExcluir.forEach(idExcluido => contasAPagarFinanceiroSelecionadasIds.delete(String(idExcluido)));
  if (idsParaExcluir.includes(String(contaAPagarFinanceiroEmEdicaoId))) limparFormularioContaAPagarFinanceiro();
  setMsg('msgContaAPagarFinanceiro', `${excluidas} conta(s) excluída(s) com sucesso.`, 'ok');
  carregarContasAPagarFinanceiro();
}

function obterStatusContaBaixaFinanceiro(item) {
  return item?.pago_confirmado_em ? 'pago' : 'pendente';
}

function obterStatusContaRelatorioFinanceiro(item) {
  if (item?.excluido_em) return 'excluido';
  return obterStatusContaBaixaFinanceiro(item);
}

function obterDataReferenciaContaRelatorioFinanceiro(item) {
  if (item?.excluido_em) return String(item.excluido_em || '').trim().slice(0, 10);
  return String(item?.data_vencimento || item?.data_pagamento || item?.data_compra || '').trim();
}

function tagStatusContaRelatorioFinanceiro(status = '') {
  if (status === 'pago') return '<span class="tag tag-green">Pago</span>';
  if (status === 'excluido') return '<span class="tag tag-red">Excluído</span>';
  return '<span class="tag tag-amber">Pendente</span>';
}

async function obterSaldoTotalContasFinanceiras() {
  const { data, error } = await sb
    .from('contas_financeiras')
    .select('saldo_atual, ativo');
  if (error) {
    if (isMissingContasFinanceirasTableError(error)) return 0;
    throw error;
  }
  return (data || []).reduce((acc, item) => {
    if (item?.ativo === false) return acc;
    return acc + (Number(item.saldo_atual || 0) || 0);
  }, 0);
}

function contaBaixadaSemMovimentacaoSaldo(item = null) {
  return String(item?.observacao || '').includes(OBS_BAIXA_SEM_MOVIMENTACAO_TAG);
}

async function solicitarContaFinanceiraObrigatoriaBaixaFinanceiro(contaAtualId = '', { valor = 0, titulo = '', movimentarSaldo = true } = {}) {
  const contas = await carregarContasFinanceiras({ render: false, silencioso: true });
  const ativas = (contas || []).filter(item => item?.ativo !== false);
  if (!ativas.length) {
    setMsg('msgBaixarContasFinanceiro', 'Cadastre e ative uma conta financeira antes de baixar titulos.', 'err');
    return null;
  }

  const selecionada = await abrirModalContaFinanceiraBaixaFinanceiro({
    contas: ativas,
    contaAtualId,
    valor,
    titulo,
    movimentarSaldo,
  });
  if (!selecionada) {
    return null;
  }
  return selecionada;
}

const OBS_BAIXA_SEM_MOVIMENTACAO_TAG = '[BAIXA SEM MOVIMENTACAO DE SALDO]';

function ajustarObservacaoBaixaSemMovimentacao(observacaoAtual = '', semMovimentacao = false) {
  const base = String(observacaoAtual || '').replace(OBS_BAIXA_SEM_MOVIMENTACAO_TAG, '').trim();
  if (!semMovimentacao) return base;
  if (!base) return OBS_BAIXA_SEM_MOVIMENTACAO_TAG;
  return `${base} ${OBS_BAIXA_SEM_MOVIMENTACAO_TAG}`;
}

function diferencaDiasDataFinanceiro(dataIso = '', referenciaIso = hoje()) {
  const data = String(dataIso || '').trim();
  const referencia = String(referenciaIso || hoje()).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !/^\d{4}-\d{2}-\d{2}$/.test(referencia)) return null;
  const dataMs = new Date(`${data}T12:00:00`).getTime();
  const refMs = new Date(`${referencia}T12:00:00`).getTime();
  if (!Number.isFinite(dataMs) || !Number.isFinite(refMs)) return null;
  return Math.round((dataMs - refMs) / 86400000);
}

function obterAlertaVencimentoBaixarConta(item = {}) {
  if (obterStatusContaBaixaFinanceiro(item) === 'pago') {
    return { classe: 'tag-green', texto: 'Pago', prioridade: 0 };
  }
  const diff = diferencaDiasDataFinanceiro(item.data_vencimento, hoje());
  if (diff === null) return { classe: 'tag-gray', texto: 'Sem vencimento', prioridade: 0 };
  if (diff <= -2) return { classe: 'tag-red', texto: `Vencido há ${Math.abs(diff)} dias`, prioridade: 4 };
  if (diff === -1) return { classe: 'tag-red', texto: 'Vencido ontem', prioridade: 3 };
  if (diff === 0) return { classe: 'tag-amber', texto: 'Vence hoje', prioridade: 2 };
  if (diff === 1) return { classe: 'tag-blue', texto: 'Vence amanhã', prioridade: 1 };
  return { classe: 'tag-gray', texto: `Vence em ${diff} dias`, prioridade: 0 };
}

function obterValorTotalizadorBaixarConta(item = {}) {
  const valorPago = Number(item.valor_pago || 0);
  const valorCompra = Number(item.valor_compra || 0);
  return valorPago > 0 ? valorPago : valorCompra;
}

function atualizarAtalhosBaixarContasFinanceiro() {
  document.querySelectorAll('#atalhosBaixarContasFinanceiro .baixar-contas-atalho').forEach(btn => {
    btn.classList.toggle('ativo', String(btn.dataset.tipo || '') === String(baixarContasFiltroRapidoAtivo || ''));
  });
}

function atualizarResumoBaixarContasFinanceiro(itens = [], { titulo = 'Filtro atual' } = {}) {
  const container = document.getElementById('resumoBaixarContasFinanceiro');
  if (!container) return;
  const total = (itens || []).reduce((acc, item) => acc + obterValorTotalizadorBaixarConta(item), 0);
  const pendentes = (itens || []).filter(item => obterStatusContaBaixaFinanceiro(item) !== 'pago').length;
  container.innerHTML = `
    <div class="baixar-contas-resumo-card">
      <div class="label">${escaparHtmlBasico(titulo)}</div>
      <div class="valor">${formatarMoedaBRFinanceiro(total)}</div>
    </div>
    <div class="baixar-contas-resumo-card">
      <div class="label">Contas no filtro</div>
      <div class="valor">${itens.length}</div>
    </div>
    <div class="baixar-contas-resumo-card">
      <div class="label">Pendentes</div>
      <div class="valor">${pendentes}</div>
    </div>
  `;
}

function obterTituloFiltroBaixarContas() {
  if (baixarContasFiltroRapidoAtivo === 'hoje') return 'Total vence hoje';
  if (baixarContasFiltroRapidoAtivo === 'vencido2') return 'Total vencido há 2+ dias';
  if (baixarContasFiltroRapidoAtivo === 'amanha') return 'Total vence amanhã';
  const inicio = String(document.getElementById('filtroBaixarContaVencimentoInicio')?.value || '').trim();
  const fim = String(document.getElementById('filtroBaixarContaVencimentoFim')?.value || '').trim();
  if (inicio || fim) return 'Total por vencimento';
  return 'Total do filtro';
}

function limparAtalhoBaixarContas() {
  baixarContasFiltroRapidoAtivo = '';
  atualizarAtalhosBaixarContasFinanceiro();
}

function aplicarAtalhoBaixarContasFinanceiro(tipo = '') {
  baixarContasFiltroRapidoAtivo = String(tipo || '').trim();
  // Atalhos filtram por critério de vencimento próprio; limpa os campos de
  // data manuais para não conflitar e fixa status em pendentes.
  const campoInicio = document.getElementById('filtroBaixarContaVencimentoInicio');
  const campoFim = document.getElementById('filtroBaixarContaVencimentoFim');
  const campoStatus = document.getElementById('filtroBaixarContaStatus');
  if (campoInicio) campoInicio.value = '';
  if (campoFim) campoFim.value = '';
  if (campoStatus) campoStatus.value = 'pendente';
  atualizarAtalhosBaixarContasFinanceiro();
  carregarBaixarContasFinanceiro();
}

function limparFiltrosBaixarContasFinanceiro() {
  const campoBusca = document.getElementById('filtroBaixarContaBusca');
  const campoInicio = document.getElementById('filtroBaixarContaVencimentoInicio');
  const campoFim = document.getElementById('filtroBaixarContaVencimentoFim');
  const campoStatus = document.getElementById('filtroBaixarContaStatus');
  if (campoBusca) campoBusca.value = '';
  if (campoInicio) campoInicio.value = '';
  if (campoFim) campoFim.value = '';
  if (campoStatus) campoStatus.value = 'pendente';
  baixarContasFiltroRapidoAtivo = '';
  atualizarAtalhosBaixarContasFinanceiro();
  carregarBaixarContasFinanceiro();
}

async function carregarBaixarContasFinanceiro() {
  const lista = document.getElementById('listaBaixarContasFinanceiro');
  if (!lista) return;
  lista.innerHTML = '<div class="empty">Carregando...</div>';

  if (!(categoriasCompraCache || []).length && typeof carregarCategoriasCompra === 'function') {
    try { await carregarCategoriasCompra(); } catch (_) {}
  }

  const filtroBusca = textoFinanceiroNormalizado(document.getElementById('filtroBaixarContaBusca')?.value || '');
  const filtroStatus = String(document.getElementById('filtroBaixarContaStatus')?.value || '').trim();
  const filtroVencimentoInicio = String(document.getElementById('filtroBaixarContaVencimentoInicio')?.value || '').trim();
  const filtroVencimentoFim = String(document.getElementById('filtroBaixarContaVencimentoFim')?.value || '').trim();
  atualizarAtalhosBaixarContasFinanceiro();

  const { data, error } = await executarSemFiltrosTenantTemporario(() => sb
    .from('contasapagar')
    .select('id, fornecedor_id, categoria_id, conta_financeira_id, loja_id, empresa_id, data_compra, data_vencimento, data_pagamento, valor_compra, valor_pago, forma_pagamento, forma_pagamento_id, observacao, pago_confirmado_em, qtd_parcelas, intervalo_parcelas_dias, numero_parcela, grupo_parcelas_id, fornecedores(nome), formas_pagamento(id, nome, ativo), contas_financeiras(id, nome)')
    .is('excluido_em', null)
    .order('data_vencimento', { ascending: true }));

  if (error) {
    contasBaixarFinanceiroCache = [];
    if (isMissingContasAPagarTableError(error)) {
      lista.innerHTML = '<div class="empty">Rode o SQL da tabela contasapagar para habilitar esta aba.</div>';
      return;
    }
    if (isMissingContasAPagarAuditoriaColumnsError(error)) {
      lista.innerHTML = '<div class="empty">Rode a migration de auditoria do contas a pagar para habilitar esta aba.</div>';
      return;
    }
    if (isMissingFormasPagamentoTableError(error)) {
      lista.innerHTML = '<div class="empty">Rode o SQL da tabela formas_pagamento para habilitar a seleção obrigatória na baixa.</div>';
      return;
    }
    if (isMissingContasAPagarPagamentoColumnsError(error)) {
      lista.innerHTML = '<div class="empty">Rode o SQL da migração de baixa de contas para habilitar valor pago, forma de pagamento e confirmação.</div>';
      return;
    }
    if (isMissingContasFinanceirasTableError(error) || isMissingColumnError(error)) {
      lista.innerHTML = '<div class="empty">Rode o SQL mais recente de contas financeiras para habilitar a baixa por conta.</div>';
      return;
    }
    lista.innerHTML = '<div class="empty">Erro ao carregar contas para baixa.</div>';
    return;
  }

  contasBaixarFinanceiroCache = data || [];

  // Isolamento de tenant em memória (a query suspendeu os filtros de tenant).
  // Aplica empresa e loja logadas quando disponíveis, sem nunca zerar a lista.
  try {
    const empresaSessao = String(obterEmpresaIdSessao?.() || usuarioSistemaLogado?.empresa_id || '').trim();
    if (empresaSessao) {
      const porEmpresa = contasBaixarFinanceiroCache.filter(c => String(c.empresa_id || '').trim() === empresaSessao);
      if (porEmpresa.length) contasBaixarFinanceiroCache = porEmpresa;
    }
    const lojaSessao = String(obterLojaIdSessao?.() || usuarioSistemaLogado?.loja_id || '').trim();
    if (lojaSessao) {
      const porLoja = contasBaixarFinanceiroCache.filter(c => String(c.loja_id || '').trim() === lojaSessao);
      if (porLoja.length) contasBaixarFinanceiroCache = porLoja;
    }
  } catch (e) { /* mantém todas */ }

  const atalho = String(baixarContasFiltroRapidoAtivo || '').trim();
  const itens = contasBaixarFinanceiroCache.filter(item => {
    const nomeFornecedor = String(item.fornecedores?.nome || '').trim();
    const observacaoConta = String(item.observacao || '').trim();
    const formaConta = String(item.formas_pagamento?.nome || item.forma_pagamento || '').trim();
    const status = obterStatusContaBaixaFinanceiro(item);
    const vencimento = String(item.data_vencimento || '').slice(0, 10);
    const bateBusca = !filtroBusca || textoFinanceiroNormalizado(`${nomeFornecedor} ${observacaoConta} ${formaConta}`).includes(filtroBusca);
    const bateStatus = !filtroStatus || filtroStatus === status;

    // Quando um atalho rápido está ativo, usa o MESMO critério do selo de
    // vencimento mostrado em cada conta, garantindo que o que é contado e o que
    // aparece na lista sejam idênticos.
    if (atalho) {
      const diff = diferencaDiasDataFinanceiro(item.data_vencimento, hoje());
      const bateAtalho = diff !== null && (
        (atalho === 'vencido2' && diff <= -2) ||
        (atalho === 'hoje' && diff === 0) ||
        (atalho === 'amanha' && diff === 1)
      );
      return bateBusca && bateStatus && bateAtalho;
    }

    // Sem atalho: filtro normal por intervalo de datas.
    const bateInicio = !filtroVencimentoInicio || (vencimento && vencimento >= filtroVencimentoInicio);
    const bateFim = !filtroVencimentoFim || (vencimento && vencimento <= filtroVencimentoFim);
    return bateBusca && bateStatus && bateInicio && bateFim;
  });

  atualizarResumoBaixarContasFinanceiro(itens, { titulo: obterTituloFiltroBaixarContas() });

  if (!itens.length) {
    // Diagnóstico visível: mostra o que realmente existe no banco para esta loja,
    // em vez de só "nada encontrado". Ajuda a distinguir "não há contas" de "filtro escondeu".
    const totalCarregado = contasBaixarFinanceiroCache.length;
    const pendentes = contasBaixarFinanceiroCache.filter(c => obterStatusContaBaixaFinanceiro(c) !== 'pago').length;
    const pagas = totalCarregado - pendentes;
    const vencidas2 = contasBaixarFinanceiroCache.filter(c => {
      if (obterStatusContaBaixaFinanceiro(c) === 'pago') return false;
      const d = diferencaDiasDataFinanceiro(c.data_vencimento, hoje());
      return d !== null && d <= -2;
    }).length;
    let msg;
    if (totalCarregado === 0) {
      msg = 'Não há contas a pagar cadastradas para esta loja. Lance ou importe contas para vê-las aqui.';
    } else {
      msg = `Nenhuma conta neste filtro. No banco há ${totalCarregado} conta(s): ${pendentes} pendente(s), ${pagas} paga(s), ${vencidas2} vencida(s) há 2+ dias. Use "Limpar" para ver todas.`;
    }
    lista.innerHTML = `<div class="empty">${escaparHtmlBasico(msg)}</div>`;
    return;
  }

  const pendentesIds = itens.filter(i => obterStatusContaBaixaFinanceiro(i) !== 'pago').map(i => i.id);
  // Limpa seleção de itens que não estão mais na lista visível
  _baixaSelecionadasIds = _baixaSelecionadasIds.filter(id => pendentesIds.includes(id));

  const pagasIds = itens.filter(i => obterStatusContaBaixaFinanceiro(i) === 'pago').map(i => i.id);

  const barraSelecao = (pendentesIds.length || pagasIds.length)
    ? `<div class="baixa-multipla-barra" style="display:flex;align-items:center;gap:12px;margin-bottom:10px;flex-wrap:wrap;">
        ${pendentesIds.length ? `<label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;">
          <input type="checkbox" id="baixaSelecionarTodos" onchange="faturaToggleSelecionarTodosBaixa(this.checked)">
          Selecionar todas (${pendentesIds.length})
        </label>` : ''}
        <span id="baixaSelecaoInfo" style="font-size:12px;color:var(--text-muted);"></span>
        ${pendentesIds.length ? `<button class="btn btn-green btn-sm" id="btnBaixarMultiplas" onclick="abrirBaixaMultiplaFinanceiro()" style="display:none;">Baixar selecionadas</button>` : ''}
        ${pagasIds.length ? `<button class="btn btn-ghost btn-sm" onclick="reabrirTodasContasFinanceiro()" style="margin-left:auto;">Reabrir todas (${pagasIds.length} pagas)</button>` : ''}
      </div>`
    : '';

  lista.innerHTML = barraSelecao + '<div class="lista">' + itens.map(item => {
    const nomeFornecedor = item.fornecedores?.nome || 'Fornecedor não encontrado';
    const status = obterStatusContaBaixaFinanceiro(item);
    const valorPago = Number(item.valor_pago || 0);
    const existePagamento = !!item.data_pagamento;
    const alertaVencimento = obterAlertaVencimentoBaixarConta(item);
    const podeSelecionar = status !== 'pago';
    const marcado = _baixaSelecionadasIds.includes(item.id);
    return `
      <div class="item">
        <div class="item-info" style="display:flex;gap:10px;align-items:flex-start;">
          ${podeSelecionar ? `<input type="checkbox" class="baixa-check" data-id="${item.id}" ${marcado ? 'checked' : ''} style="margin-top:3px;flex-shrink:0;" onchange="faturaToggleSelecaoBaixa('${item.id}', this.checked)">` : '<span style="width:13px;flex-shrink:0;"></span>'}
          <div style="flex:1;min-width:0;">
            <div class="item-nome">${escaparHtmlBasico(nomeFornecedor)}</div>
            <div class="item-detalhe">Compra: ${formatarDataBRFinanceiro(item.data_compra)} · Vencimento: ${formatarDataBRFinanceiro(item.data_vencimento)} · Pagamento: ${formatarDataBRFinanceiro(item.data_pagamento)}</div>
            <div class="item-detalhe">Valor compra: ${formatarMoedaBRFinanceiro(item.valor_compra)} · Valor pago: ${formatarMoedaBRFinanceiro(valorPago)} · Forma: ${escaparHtmlBasico(item.formas_pagamento?.nome || item.forma_pagamento || '-')}</div>
            <div class="item-detalhe">Conta financeira: ${escaparHtmlBasico(item.contas_financeiras?.nome || '-')} · Categoria: ${escaparHtmlBasico((categoriasCompraCache || []).find(c => String(c.id) === String(item.categoria_id))?.nome || 'Sem categoria')}</div>
            <div class="item-detalhe">Parcela: ${item.numero_parcela || 1}/${item.qtd_parcelas || 1}${item.intervalo_parcelas_dias ? ` · intervalo ${item.intervalo_parcelas_dias} dia(s)` : ''}</div>
            <div class="item-detalhe">Obs.: ${escaparHtmlBasico(item.observacao || '-')}</div>
          </div>
        </div>
        <div class="item-destaque" style="display:flex;flex-direction:column;justify-content:center;align-items:center;gap:6px;flex:1;min-width:260px;padding:8px 16px;">
          <div style="display:flex;flex-direction:column;align-items:center;line-height:1;">
            <span style="font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#fca5a5;">Vencimento</span>
            <span style="font-size:30px;font-weight:900;color:#ff5b5b;text-shadow:0 0 12px rgba(255,91,91,.45);">${formatarDataBRFinanceiro(item.data_vencimento)}</span>
          </div>
          <div style="display:flex;flex-direction:column;align-items:center;line-height:1;">
            <span style="font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#fde047;">Valor</span>
            <span style="font-size:34px;font-weight:900;color:#ffd400;text-shadow:0 0 12px rgba(255,212,0,.45);">${formatarMoedaBRFinanceiro(item.valor_compra)}</span>
          </div>
        </div>
        <div class="item-actions">
          <span class="tag ${alertaVencimento.classe}">${escaparHtmlBasico(alertaVencimento.texto)}</span>
          ${status === 'pago' ? '<span class="tag tag-green">Pago confirmado</span>' : '<span class="tag tag-amber">Pendente</span>'}
          <button class="btn btn-ghost btn-sm" onclick="editarPagamentoContaFinanceiro('${item.id}')">Editar pagamento</button>
          ${status !== 'pago'
            ? `<button class="btn btn-green btn-sm" onclick="confirmarPagamentoContaFinanceiro('${item.id}')">${existePagamento ? 'Confirmar' : 'Pagar e confirmar'}</button>`
            : '<button class="btn btn-ghost btn-sm" onclick="desconfirmarPagamentoContaFinanceiro(\'' + item.id + '\')">Reabrir</button>'
          }
        </div>
      </div>
    `;
  }).join('') + '</div>';

  faturaAtualizarBarraSelecaoBaixa();
}

function obterParcelasRelacionadasBaixarContasFinanceiro(item = {}) {
  if (!item?.id) return [];
  const grupoParcelasId = String(item.grupo_parcelas_id || '').trim();
  const cache = Array.isArray(contasBaixarFinanceiroCache) ? contasBaixarFinanceiroCache : [];
  if (grupoParcelasId) {
    return cache
      .filter(conta => String(conta.grupo_parcelas_id || '').trim() === grupoParcelasId && !conta.excluido_em)
      .sort((a, b) => (Number(a.numero_parcela || 0) - Number(b.numero_parcela || 0)) || String(a.data_vencimento || '').localeCompare(String(b.data_vencimento || '')));
  }
  return [item];
}

function valorMoedaInputFinanceiro(valor = 0) {
  return Number(valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function preencherSelectEditarTituloFinanceiro(selectId, itens = [], valorAtual = '', { placeholder = '- Selecione -', campoNome = 'nome' } = {}) {
  const select = document.getElementById(selectId);
  if (!select) return;
  const valor = String(valorAtual || '');
  const ativos = (itens || []).filter(item => item && (item.ativo !== false || String(item.id) === valor));
  select.innerHTML = `<option value="">${escaparHtmlBasico(placeholder)}</option>` + ativos.map(item => `
    <option value="${escaparHtmlBasico(String(item.id || ''))}" ${String(item.id) === valor ? 'selected' : ''}>${escaparHtmlBasico(item[campoNome] || '-')}</option>
  `).join('');
}

function fecharModalEditarTituloFinanceiro() {
  const overlay = document.getElementById('editarTituloFinanceiroOverlay');
  const msg = document.getElementById('editarTituloFinanceiroMsg');
  if (overlay) overlay.classList.remove('show');
  if (msg) {
    msg.textContent = '';
    msg.className = 'msg';
  }
  editarTituloFinanceiroId = null;
}

async function editarPagamentoContaFinanceiro(id) {
  const item = contasBaixarFinanceiroCache.find(conta => String(conta.id) === String(id));
  if (!item) {
    setMsg('msgBaixarContasFinanceiro', 'Conta não encontrada.', 'err');
    return;
  }
  if (obterStatusContaBaixaFinanceiro(item) === 'pago') {
    setMsg('msgBaixarContasFinanceiro', 'Reabra a conta antes de editar o pagamento, para manter o extrato da conta financeira correto.', 'err');
    return;
  }

  await carregarFormasPagamentoFinanceiro({ render: false, silencioso: true });
  await carregarContasFinanceiras({ render: false, silencioso: true });
  if (!(categoriasCompraCache || []).length && typeof carregarCategoriasCompra === 'function') {
    try { await carregarCategoriasCompra(); } catch (_) {}
  }

  editarTituloFinanceiroId = String(id);
  const overlay = document.getElementById('editarTituloFinanceiroOverlay');
  const title = document.getElementById('editarTituloFinanceiroTitle');
  const subtitle = document.getElementById('editarTituloFinanceiroSubtitle');
  const resumo = document.getElementById('editarTituloFinanceiroResumo');
  const alerta = document.getElementById('editarTituloFinanceiroAlerta');
  const msg = document.getElementById('editarTituloFinanceiroMsg');
  if (!overlay || !resumo) return;

  const parcelasRelacionadas = obterParcelasRelacionadasBaixarContasFinanceiro(item);
  const possuiGrupo = parcelasRelacionadas.length > 1;
  if (title) title.textContent = 'Editar título';
  if (subtitle) subtitle.textContent = item.fornecedores?.nome || 'Fornecedor não encontrado';
  if (alerta) {
    alerta.style.display = possuiGrupo ? 'block' : 'none';
    alerta.textContent = possuiGrupo
      ? `Este título faz parte de um parcelamento com ${parcelasRelacionadas.length} títulos. Ao salvar, o sistema vai perguntar se os dados do título devem ser aplicados ao grupo.`
      : '';
  }
  resumo.innerHTML = `
    <div class="editar-titulo-kpi"><span>Fornecedor</span><strong>${escaparHtmlBasico(item.fornecedores?.nome || '-')}</strong></div>
    <div class="editar-titulo-kpi"><span>Parcela</span><strong>${escaparHtmlBasico(`${item.numero_parcela || 1}/${item.qtd_parcelas || 1}`)}</strong></div>
    <div class="editar-titulo-kpi"><span>Vencimento atual</span><strong>${escaparHtmlBasico(formatarDataBRFinanceiro(item.data_vencimento))}</strong></div>
    <div class="editar-titulo-kpi"><span>Status</span><strong>${escaparHtmlBasico(obterStatusContaBaixaFinanceiro(item) === 'pago' ? 'Pago confirmado' : 'Pendente')}</strong></div>
  `;

  document.getElementById('editarTituloDataCompra').value = String(item.data_compra || '').slice(0, 10);
  document.getElementById('editarTituloDataVencimento').value = String(item.data_vencimento || '').slice(0, 10);
  document.getElementById('editarTituloValorCompra').value = valorMoedaInputFinanceiro(item.valor_compra || 0);
  document.getElementById('editarTituloValorPago').value = valorMoedaInputFinanceiro(item.valor_pago ?? item.valor_compra ?? 0);
  prepararCampoMoedaFinanceiro(document.getElementById('editarTituloValorCompra'));
  prepararCampoMoedaFinanceiro(document.getElementById('editarTituloValorPago'));
  document.getElementById('editarTituloDataPagamento').value = String(item.data_pagamento || '').slice(0, 10);
  document.getElementById('editarTituloObservacao').value = String(item.observacao || '').replace(OBS_BAIXA_SEM_MOVIMENTACAO_TAG, '').trim();
  document.getElementById('editarTituloMovimentarSaldo').checked = !contaBaixadaSemMovimentacaoSaldo(item);
  preencherSelectEditarTituloFinanceiro('editarTituloFormaPagamento', formasPagamentoFinanceiroCache, item.forma_pagamento_id || '', { placeholder: '- Sem forma definida -' });
  preencherSelectEditarTituloFinanceiro('editarTituloContaFinanceira', contasFinanceirasCache, item.conta_financeira_id || '', { placeholder: '- Sem conta definida -' });
  preencherSelectEditarTituloFinanceiro('editarTituloCategoria', categoriasCompraCache, item.categoria_id || '', { placeholder: '- Sem categoria -' });
  if (msg) {
    msg.textContent = '';
    msg.className = 'msg';
  }
  overlay.classList.add('show');
}

async function salvarModalEditarTituloFinanceiro() {
  const id = String(editarTituloFinanceiroId || '').trim();
  const item = contasBaixarFinanceiroCache.find(conta => String(conta.id) === id);
  const msg = document.getElementById('editarTituloFinanceiroMsg');
  const setModalMsg = (texto, tipo = 'err') => {
    if (!msg) return;
    msg.textContent = texto;
    msg.className = `msg ${tipo}`;
  };

  if (!item) {
    setModalMsg('Título não encontrado. Recarregue a lista e tente novamente.');
    return;
  }
  if (obterStatusContaBaixaFinanceiro(item) === 'pago') {
    setModalMsg('Reabra a conta antes de editar o título, para manter o extrato correto.');
    return;
  }

  const dataCompra = String(document.getElementById('editarTituloDataCompra')?.value || '').trim();
  const dataVencimento = String(document.getElementById('editarTituloDataVencimento')?.value || '').trim();
  const valorCompra = lerValorMonetarioFinanceiro(document.getElementById('editarTituloValorCompra')?.value || '');
  const valorPago = lerValorMonetarioFinanceiro(document.getElementById('editarTituloValorPago')?.value || '0');
  const dataPagamento = String(document.getElementById('editarTituloDataPagamento')?.value || '').trim();
  const observacaoBase = String(document.getElementById('editarTituloObservacao')?.value || '').trim();
  const formaPagamentoId = String(document.getElementById('editarTituloFormaPagamento')?.value || '').trim();
  const contaFinanceiraId = String(document.getElementById('editarTituloContaFinanceira')?.value || '').trim();
  const categoriaId = String(document.getElementById('editarTituloCategoria')?.value || '').trim();
  const movimentarSaldo = document.getElementById('editarTituloMovimentarSaldo')?.checked !== false;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataCompra)) {
    setModalMsg('Informe uma data de compra válida.');
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataVencimento)) {
    setModalMsg('Informe uma data de vencimento válida.');
    return;
  }
  if (!Number.isFinite(valorCompra) || valorCompra <= 0) {
    setModalMsg('Informe um valor do título válido.');
    return;
  }
  if (!Number.isFinite(valorPago) || valorPago < 0) {
    setModalMsg('Informe um valor pago válido.');
    return;
  }
  if (dataPagamento && !/^\d{4}-\d{2}-\d{2}$/.test(dataPagamento)) {
    setModalMsg('Informe uma data de pagamento válida.');
    return;
  }
  if (!observacaoBase) {
    setModalMsg('A observação do título é obrigatória.');
    return;
  }

  const formaSelecionada = formasPagamentoFinanceiroCache.find(forma => String(forma.id) === formaPagamentoId) || null;
  const contaSelecionada = contasFinanceirasCache.find(conta => String(conta.id) === contaFinanceiraId) || null;
  const observacao = ajustarObservacaoBaixaSemMovimentacao(observacaoBase, !movimentarSaldo);
  const payloadTituloAtual = {
    data_compra: dataCompra,
    data_vencimento: dataVencimento,
    valor_compra: Number(valorCompra.toFixed(2)),
    observacao,
    valor_pago: Number(valorPago.toFixed(2)),
    data_pagamento: dataPagamento || null,
    forma_pagamento_id: formaSelecionada?.id || null,
    forma_pagamento: formaSelecionada?.nome || null,
    conta_financeira_id: contaSelecionada?.id || null,
    categoria_id: categoriaId || null,
    updated_at: new Date().toISOString(),
  };

  const dadosTituloMudaram = (
    String(item.data_compra || '') !== dataCompra ||
    String(item.data_vencimento || '') !== dataVencimento ||
    Number(item.valor_compra || 0).toFixed(2) !== Number(valorCompra).toFixed(2) ||
    String(item.observacao || '').replace(OBS_BAIXA_SEM_MOVIMENTACAO_TAG, '').trim() !== observacaoBase
  );
  const parcelasRelacionadas = obterParcelasRelacionadasBaixarContasFinanceiro(item);
  let aplicarNoGrupo = false;

  if (dadosTituloMudaram && parcelasRelacionadas.length > 1) {
    const decisaoParcelas = await abrirModalConfirmacaoFinanceira({
      titulo: 'Alterar títulos vinculados?',
      subtitulo: 'Este título faz parte de um lançamento parcelado',
      fornecedor: item.fornecedores?.nome || 'Fornecedor',
      lancamento: observacaoBase || item.observacao || 'Conta a pagar',
      detalhes: [
        `Parcela atual: ${item.numero_parcela || 1} de ${item.qtd_parcelas || parcelasRelacionadas.length}`,
        `Títulos vinculados ativos: ${parcelasRelacionadas.length}`,
        `Novo vencimento desta parcela: ${formatarDataBRFinanceiro(dataVencimento)}`,
      ],
      textoSim: 'Alterar títulos vinculados',
      textoNao: 'Alterar só este título',
      textoAjuda: 'Ao alterar os vinculados, compra, valor e observação serão aplicados ao grupo. O vencimento das demais parcelas será recalculado pela parcela atual e pelo intervalo do lançamento.',
    });
    if (decisaoParcelas === 'cancelar') {
      setModalMsg('Edição cancelada. Escolha se deseja alterar só este título ou os vinculados.');
      return;
    }
    aplicarNoGrupo = decisaoParcelas === 'sim';
  }

  if (aplicarNoGrupo) {
    const numeroParcelaAtual = Number.parseInt(String(item.numero_parcela || 1), 10) || 1;
    const intervalo = Number.parseInt(String(item.intervalo_parcelas_dias || 0), 10) || 0;
    const payloadGrupoBase = {
      data_compra: dataCompra,
      valor_compra: Number(valorCompra.toFixed(2)),
      observacao: observacaoBase,
      updated_at: new Date().toISOString(),
    };
    for (const parcela of parcelasRelacionadas) {
      const numeroParcela = Number.parseInt(String(parcela.numero_parcela || 1), 10) || 1;
      const deslocamento = (numeroParcela - numeroParcelaAtual) * intervalo;
      const payloadParcela = {
        ...payloadGrupoBase,
        data_vencimento: intervalo ? adicionarDiasDataISOFinanceiro(dataVencimento, deslocamento) : dataVencimento,
      };
      const { error: erroParcela } = await sb
        .from('contasapagar')
        .update(payloadParcela)
        .eq('id', parcela.id)
        .is('excluido_em', null);
      if (erroParcela) {
        setModalMsg(`Não foi possível atualizar as parcelas vinculadas: ${mensagemErroSupabase(erroParcela, 'erro desconhecido')}`);
        return;
      }
    }
  }

  const { error } = await sb.from('contasapagar').update(payloadTituloAtual).eq('id', id).is('excluido_em', null);
  if (error) {
    if (isMissingContasAPagarPagamentoColumnsError(error) || isMissingContasAPagarAuditoriaColumnsError(error)) {
      setModalMsg('Rode o SQL da migração de baixa de contas para habilitar esses campos.');
      return;
    }
    if (isMissingContasFinanceirasTableError(error) || isMissingColumnError(error)) {
      setModalMsg('Rode o SQL mais recente de contas financeiras para habilitar a conta da baixa.');
      return;
    }
    setModalMsg(`Não foi possível salvar edição: ${mensagemErroSupabase(error, 'erro desconhecido')}`);
    return;
  }

  fecharModalEditarTituloFinanceiro();
  setMsg('msgBaixarContasFinanceiro', aplicarNoGrupo ? 'Título e parcelas vinculadas atualizados.' : 'Título atualizado.', 'ok');
  carregarBaixarContasFinanceiro();
  carregarContasAPagarFinanceiro();
}

async function confirmarPagamentoContaFinanceiro(id) {
  const item = contasBaixarFinanceiroCache.find(conta => String(conta.id) === String(id));
  if (!item) {
    setMsg('msgBaixarContasFinanceiro', 'Conta não encontrada.', 'err');
    return;
  }

  let formaSelecionada = null;
  const formasAtivas = await carregarFormasPagamentoFinanceiro({ render: false, silencioso: true });
  const listaAtivas = obterFormasPagamentoAtivasFinanceiro();
  if (!formasAtivas.length || !listaAtivas.length) {
    setMsg('msgBaixarContasFinanceiro', 'Cadastre e ative ao menos uma forma de pagamento antes de confirmar a baixa.', 'err');
    return;
  }

  if (item.forma_pagamento_id) {
    formaSelecionada = listaAtivas.find(f => String(f.id) === String(item.forma_pagamento_id)) || null;
  }

  if (!formaSelecionada) {
    const formaBase = String(item.formas_pagamento?.nome || item.forma_pagamento || '').trim();
    formaSelecionada = await solicitarFormaPagamentoObrigatoriaFinanceiro(formaBase);
    if (!formaSelecionada) return;
  }
  const valorBase = Number(item.valor_pago ?? item.valor_compra ?? 0);
  const valorPagoFinal = Number((Number.isFinite(valorBase) ? valorBase : 0).toFixed(2));
  const contaSelecionada = await solicitarContaFinanceiraObrigatoriaBaixaFinanceiro(item.conta_financeira_id || '', {
    valor: valorPagoFinal,
    titulo: item.fornecedores?.nome || 'fornecedor',
    movimentarSaldo: !contaBaixadaSemMovimentacaoSaldo(item),
  });
  if (!contaSelecionada) return;
  const movimentarSaldo = contaSelecionada.movimentarSaldo === true;

  const operador = obterFuncionarioOperadorAtual();
  const confirmacaoPin = await confirmarAcaoComPin({
    funcionario: operador,
    titulo: 'Confirmar baixa financeira',
    subtitulo: movimentarSaldo
      ? `Confirme o PIN para pagar ${formatarMoedaBRFinanceiro(valorPagoFinal)} pela conta ${contaSelecionada.nome || '-'}.`
      : `Confirme o PIN para baixar ${formatarMoedaBRFinanceiro(valorPagoFinal)} sem movimentar saldo da conta financeira.`,
    textoAcao: 'Confirmar baixa',
    escopo: 'empresa',
  });
  if (!confirmacaoPin) return;

  const payload = {
    data_pagamento: item.data_pagamento || hoje(),
    valor_pago: valorPagoFinal,
    forma_pagamento_id: formaSelecionada.id,
    forma_pagamento: formaSelecionada.nome,
    conta_financeira_id: contaSelecionada.id,
    observacao: ajustarObservacaoBaixaSemMovimentacao(item.observacao, !movimentarSaldo),
    pago_confirmado_em: new Date().toISOString(),
  };

  const { error } = await sb.from('contasapagar').update(payload).eq('id', id).is('excluido_em', null);
  if (error) {
    if (isMissingContasAPagarPagamentoColumnsError(error) || isMissingContasAPagarAuditoriaColumnsError(error)) {
      setMsg('msgBaixarContasFinanceiro', 'Rode o SQL da migração de baixa de contas para habilitar confirmação de pagamento.', 'err');
      return;
    }
    if (isMissingContasFinanceirasTableError(error) || isMissingColumnError(error)) {
      setMsg('msgBaixarContasFinanceiro', 'Rode o SQL mais recente de contas financeiras para habilitar a baixa por conta.', 'err');
      return;
    }
    setMsg('msgBaixarContasFinanceiro', `Não foi possível confirmar pagamento: ${mensagemErroSupabase(error, 'erro desconhecido')}`, 'err');
    return;
  }

  if (movimentarSaldo === true) {
    const { error: erroMovimentacao } = await registrarMovimentacaoContaFinanceira({
      contaFinanceiraId: contaSelecionada.id,
      contaApagarId: id,
      tipo: 'saida',
      valor: valorPagoFinal,
      descricao: `Pagamento de título para ${item.fornecedores?.nome || 'fornecedor'}`,
    });
    if (erroMovimentacao) {
      setMsg('msgBaixarContasFinanceiro', `Pagamento confirmado, mas não foi possível atualizar o saldo da conta: ${mensagemErroSupabase(erroMovimentacao, 'erro desconhecido')}`, 'err');
      return;
    }
  }

  setMsg('msgBaixarContasFinanceiro', movimentarSaldo
    ? 'Pagamento confirmado com sucesso.'
    : 'Pagamento confirmado sem movimentar saldo da conta financeira.', 'ok');
  await carregarContasFinanceiras({ render: false, silencioso: true });
  if (document.getElementById('financeiro_cofre')?.classList.contains('ativa')) {
    await carregarCofreFinanceiro();
  }
  if (document.getElementById('relatorio_financeiro')?.classList.contains('ativa')) {
    await carregarRelatorioFinanceiro();
  }
  carregarBaixarContasFinanceiro();
  carregarContasAPagarFinanceiro();
}

// ── Seleção múltipla e baixa em lote ───────────────────────────────
let _baixaSelecionadasIds = [];

function faturaToggleSelecaoBaixa(id, marcado) {
  if (marcado) {
    if (!_baixaSelecionadasIds.includes(id)) _baixaSelecionadasIds.push(id);
  } else {
    _baixaSelecionadasIds = _baixaSelecionadasIds.filter(x => x !== id);
  }
  faturaAtualizarBarraSelecaoBaixa();
}

function faturaToggleSelecionarTodosBaixa(marcado) {
  const checks = document.querySelectorAll('.baixa-check');
  checks.forEach(chk => { chk.checked = marcado; });
  _baixaSelecionadasIds = marcado
    ? Array.from(checks).map(chk => chk.getAttribute('data-id')).filter(Boolean)
    : [];
  faturaAtualizarBarraSelecaoBaixa();
}

function faturaAtualizarBarraSelecaoBaixa() {
  const info = document.getElementById('baixaSelecaoInfo');
  const btn = document.getElementById('btnBaixarMultiplas');
  const qtd = _baixaSelecionadasIds.length;
  const total = _baixaSelecionadasIds.reduce((s, id) => {
    const item = contasBaixarFinanceiroCache.find(c => String(c.id) === String(id));
    return s + Number(item?.valor_pago ?? item?.valor_compra ?? 0);
  }, 0);
  if (info) info.textContent = qtd ? `${qtd} selecionada(s) · ${formatarMoedaBRFinanceiro(total)}` : '';
  if (btn) btn.style.display = qtd ? 'inline-flex' : 'none';
}

async function abrirBaixaMultiplaFinanceiro() {
  const ids = [..._baixaSelecionadasIds];
  if (!ids.length) return;
  const itens = ids.map(id => contasBaixarFinanceiroCache.find(c => String(c.id) === String(id))).filter(Boolean);
  if (!itens.length) return;

  // Forma de pagamento (uma vez para o lote)
  const formasAtivas = await carregarFormasPagamentoFinanceiro({ render: false, silencioso: true });
  const listaAtivas = obterFormasPagamentoAtivasFinanceiro();
  if (!formasAtivas.length || !listaAtivas.length) {
    setMsg('msgBaixarContasFinanceiro', 'Cadastre e ative ao menos uma forma de pagamento antes de baixar.', 'err');
    return;
  }
  const formaSelecionada = await solicitarFormaPagamentoObrigatoriaFinanceiro('');
  if (!formaSelecionada) return;

  // Modal com valores editáveis por item (preenchidos com o valor da compra)
  const valores = await abrirModalValoresBaixaMultipla(itens);
  if (!valores) return;
  const totalFinal = Number(Object.values(valores).reduce((s, v) => s + Number(v || 0), 0).toFixed(2));
  if (!(totalFinal > 0)) {
    setMsg('msgBaixarContasFinanceiro', 'Informe valores maiores que zero para baixar.', 'err');
    return;
  }

  // Contas financeiras (uma ou mais) para compor o pagamento agrupado
  await carregarContasFinanceiras({ render: false, silencioso: true });
  const selecaoContas = await abrirModalContasBaixaMultipla(totalFinal, `${itens.length} título(s)`);
  if (!selecaoContas || !Array.isArray(selecaoContas.contas) || !selecaoContas.contas.length) return;
  const movimentarSaldo = selecaoContas.movimentarSaldo === true;
  const contasEscolhidas = selecaoContas.contas;

  // PIN uma vez para o lote
  const operador = obterFuncionarioOperadorAtual();
  const resumoContas = contasEscolhidas.map(c => `${c.nome || '-'} (${formatarMoedaBRFinanceiro(c.valor || 0)})`).join(' + ');
  const confirmacaoPin = await confirmarAcaoComPin({
    funcionario: operador,
    titulo: 'Confirmar baixa em lote',
    subtitulo: `Confirme o PIN para baixar ${itens.length} título(s) · ${formatarMoedaBRFinanceiro(totalFinal)} · ${resumoContas}.`,
    textoAcao: 'Confirmar baixa',
    escopo: 'empresa',
  });
  if (!confirmacaoPin) return;

  // Distribui o valor de cada título entre as contas escolhidas, na ordem,
  // até esgotar o valor alocado em cada uma.
  const bucketsContasBaixa = contasEscolhidas.map(c => ({
    id: c.id,
    nome: c.nome || '-',
    restante: Number(Number(c.valor || 0).toFixed(2)),
  }));
  let bucketContaAtual = 0;
  const consumirContasBaixa = (valorTitulo) => {
    const partes = [];
    let resta = Number(Number(valorTitulo || 0).toFixed(2));
    while (resta > 0.004 && bucketContaAtual < bucketsContasBaixa.length) {
      const bucket = bucketsContasBaixa[bucketContaAtual];
      if (bucket.restante <= 0.004) { bucketContaAtual++; continue; }
      const usar = Math.min(bucket.restante, resta);
      partes.push({ contaId: bucket.id, contaNome: bucket.nome, valor: Number(usar.toFixed(2)) });
      bucket.restante = Number((bucket.restante - usar).toFixed(2));
      resta = Number((resta - usar).toFixed(2));
    }
    if (resta > 0.004 && bucketsContasBaixa.length) {
      // Diferença residual de arredondamento vai para a última conta escolhida.
      const ultima = bucketsContasBaixa[bucketsContasBaixa.length - 1];
      const partExistente = partes.find(p => String(p.contaId) === String(ultima.id));
      if (partExistente) partExistente.valor = Number((partExistente.valor + resta).toFixed(2));
      else partes.push({ contaId: ultima.id, contaNome: ultima.nome, valor: Number(resta.toFixed(2)) });
    }
    return partes;
  };

  let ok = 0, falhas = 0;
  for (const item of itens) {
    const valorPagoFinal = Number(Number(valores[item.id] || 0).toFixed(2));
    const partes = consumirContasBaixa(valorPagoFinal);
    const partePrincipal = partes.reduce((maior, parte) => (parte.valor > (maior?.valor || 0) ? parte : maior), null);
    const payload = {
      data_pagamento: item.data_pagamento || hoje(),
      valor_pago: valorPagoFinal,
      forma_pagamento_id: formaSelecionada.id,
      forma_pagamento: formaSelecionada.nome,
      conta_financeira_id: partePrincipal?.contaId || contasEscolhidas[0].id,
      observacao: ajustarObservacaoBaixaSemMovimentacao(item.observacao, !movimentarSaldo),
      pago_confirmado_em: new Date().toISOString(),
    };
    const { error } = await sb.from('contasapagar').update(payload).eq('id', item.id).is('excluido_em', null);
    if (error) { falhas++; continue; }
    if (movimentarSaldo) {
      for (const parte of partes) {
        if (!(parte.valor > 0)) continue;
        await registrarMovimentacaoContaFinanceira({
          contaFinanceiraId: parte.contaId,
          contaApagarId: item.id,
          tipo: 'saida',
          valor: parte.valor,
          descricao: `Pagamento de título para ${item.fornecedores?.nome || 'fornecedor'}`
            + (partes.length > 1 ? ` (parcial via ${parte.contaNome})` : ''),
        });
      }
    }
    ok++;
  }

  _baixaSelecionadasIds = [];
  setMsg('msgBaixarContasFinanceiro',
    falhas ? `${ok} baixada(s) · ${falhas} com erro.` : `${ok} título(s) baixado(s) com sucesso.`,
    falhas ? 'err' : 'ok');
  await carregarContasFinanceiras({ render: false, silencioso: true });
  carregarBaixarContasFinanceiro();
  carregarContasAPagarFinanceiro();
}

// Modal simples para ajustar o valor pago de cada título antes da baixa em lote.
function abrirModalValoresBaixaMultipla(itens) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px;';
    const linhas = itens.map(item => {
      const valor = Number(item.valor_pago ?? item.valor_compra ?? 0);
      return `<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border);">
        <div style="flex:1;min-width:0;">
          <div style="font-size:12px;font-weight:600;color:var(--text);">${escaparHtmlBasico(item.fornecedores?.nome || 'Fornecedor')}</div>
          <div style="font-size:10px;color:var(--text-muted);">Venc.: ${formatarDataBRFinanceiro(item.data_vencimento)} · ${escaparHtmlBasico(item.observacao || '-')}</div>
        </div>
        <input type="text" inputmode="decimal" data-bm-id="${item.id}" value="${valorMoedaInputFinanceiro(valor)}"
          style="width:110px;text-align:right;font-size:12px;height:30px;padding:0 8px;border-radius:8px;">
      </div>`;
    }).join('');
    overlay.innerHTML = `
      <div style="background:var(--surface);border:1px solid var(--border-mid);border-radius:14px;padding:18px;max-width:520px;width:100%;max-height:80vh;overflow:auto;">
        <div style="font-size:15px;font-weight:700;margin-bottom:4px;">Valores a pagar</div>
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:12px;">Confira ou ajuste o valor de cada título (ex.: juros). Já vêm preenchidos com o valor total.</div>
        ${linhas}
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px;">
          <button class="btn btn-ghost" id="bmCancelar">Cancelar</button>
          <button class="btn btn-green" id="bmConfirmar">Continuar</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const fechar = (resultado) => { overlay.remove(); resolve(resultado); };
    overlay.querySelector('#bmCancelar').onclick = () => fechar(null);
    overlay.querySelector('#bmConfirmar').onclick = () => {
      const valores = {};
      overlay.querySelectorAll('[data-bm-id]').forEach(inp => {
        const id = inp.getAttribute('data-bm-id');
        const num = parseFloat(String(inp.value).replace(/\./g, '').replace(',', '.')) || 0;
        valores[id] = num;
      });
      fechar(valores);
    };
    overlay.onclick = (e) => { if (e.target === overlay) fechar(null); };
  });
}

// Modal para escolher uma ou mais contas financeiras na baixa em lote.
// Permite dividir o total entre contas; se faltar saldo alocado, pergunta
// qual conta vai cobrir a diferença e ficar negativa, com confirmação.
function abrirModalContasBaixaMultipla(totalLote = 0, tituloDescr = '') {
  return new Promise(resolve => {
    const contas = (contasFinanceirasCache || []).filter(c => c && c.ativo !== false);
    if (!contas.length) {
      setMsg('msgBaixarContasFinanceiro', 'Cadastre ao menos uma conta financeira ativa antes de baixar.', 'err');
      resolve(null);
      return;
    }

    const total = Number(Number(totalLote || 0).toFixed(2));
    const lerNumeroBR = (texto) => {
      const num = parseFloat(String(texto || '').replace(/\./g, '').replace(',', '.'));
      return Number.isFinite(num) ? Number(num.toFixed(2)) : 0;
    };

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px;';

    const linhas = contas.map((c, idx) => {
      const saldo = Number(c.saldo_atual || 0);
      const corSaldo = saldo < 0 ? 'var(--red, #ff6b6b)' : 'var(--text-muted)';
      return `<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border);">
        <label style="display:flex;align-items:center;gap:8px;flex:1;min-width:0;cursor:pointer;">
          <input type="checkbox" data-bcm-chk="${c.id}" style="width:14px;height:14px;flex-shrink:0;">
          <span style="min-width:0;">
            <span style="display:block;font-size:12px;font-weight:600;color:var(--text);">${escaparHtmlBasico(c.nome || '-')}</span>
            <span style="display:block;font-size:10px;color:${corSaldo};">Saldo: ${escaparHtmlBasico(formatarMoedaBRFinanceiro(saldo))}</span>
          </span>
        </label>
        <input type="text" inputmode="decimal" data-bcm-val="${c.id}" placeholder="R$ 0,00" disabled
          style="width:110px;text-align:right;font-size:12px;height:30px;padding:0 8px;border-radius:8px;opacity:.45;">
      </div>`;
    }).join('');

    overlay.innerHTML = `
      <div style="background:var(--surface);border:1px solid var(--border-mid);border-radius:14px;padding:18px;max-width:560px;width:100%;max-height:85vh;overflow:auto;">
        <div style="font-size:15px;font-weight:700;margin-bottom:4px;">Pagar com quais contas?</div>
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:12px;">
          Total da baixa: <b style="color:var(--text);">${escaparHtmlBasico(formatarMoedaBRFinanceiro(total))}</b>${tituloDescr ? ` · ${escaparHtmlBasico(tituloDescr)}` : ''}.
          Marque uma ou mais contas e informe quanto sai de cada uma. <span id="bcmDicaPreenchimento">Ao marcar, o valor é preenchido automaticamente com o saldo disponível.</span>
        </div>
        ${linhas}
        <div style="margin-top:12px;display:flex;flex-direction:column;gap:7px;border:1px solid var(--border);border-radius:10px;padding:10px;">
          <label style="display:flex;align-items:flex-start;gap:8px;font-size:11px;color:var(--text);cursor:pointer;">
            <input type="radio" name="bcmModo" id="bcmModoMov" checked style="width:13px;height:13px;margin-top:1px;flex-shrink:0;">
            <span><b>💸 Movimentar saldo das contas</b><br><span style="color:var(--text-muted);">Registra a saída no extrato e desconta do saldo de cada conta marcada.</span></span>
          </label>
          <label style="display:flex;align-items:flex-start;gap:8px;font-size:11px;color:var(--text);cursor:pointer;">
            <input type="radio" name="bcmModo" id="bcmModoReg" style="width:13px;height:13px;margin-top:1px;flex-shrink:0;">
            <span><b>📝 Não movimentar conta — apenas baixar</b><br><span style="color:var(--text-muted);">Muda o status para pago e guarda a conta marcada só como registro. O caixa/cofre e o extrato não são alterados.</span></span>
          </label>
        </div>
        <div id="bcmResumo" style="margin-top:12px;font-size:12px;font-weight:600;color:var(--text);"></div>
        <div id="bcmFaltaBox" style="display:none;margin-top:10px;padding:10px;border:1px solid var(--border-mid);border-radius:10px;">
          <div style="font-size:12px;font-weight:700;color:var(--red, #ff6b6b);margin-bottom:6px;" id="bcmFaltaTexto"></div>
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;">Escolha qual conta vai cobrir a diferença e ficar negativa:</div>
          <div id="bcmFaltaBotoes" style="display:flex;flex-wrap:wrap;gap:6px;"></div>
        </div>
        <div class="msg" id="bcmMsg" style="margin-top:8px;"></div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px;">
          <button class="btn btn-ghost" id="bcmCancelar" type="button">Cancelar</button>
          <button class="btn btn-green" id="bcmConfirmar" type="button">Continuar</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const fechar = (resultado) => { overlay.remove(); resolve(resultado); };
    const msgEl = overlay.querySelector('#bcmMsg');
    const setMsgModal = (texto, tipo) => {
      if (!msgEl) return;
      msgEl.textContent = texto || '';
      msgEl.className = 'msg' + (tipo ? ' ' + tipo : '');
    };

    const lerSelecionadas = () => contas
      .filter(c => overlay.querySelector(`[data-bcm-chk="${c.id}"]`)?.checked)
      .map(c => ({
        id: c.id,
        nome: c.nome || '-',
        saldo_atual: Number(c.saldo_atual || 0),
        valor: lerNumeroBR(overlay.querySelector(`[data-bcm-val="${c.id}"]`)?.value),
      }));

    const atualizarResumo = () => {
      const sel = lerSelecionadas();
      const alocado = Number(sel.reduce((s, c) => s + Number(c.valor || 0), 0).toFixed(2));
      const diferenca = Number((total - alocado).toFixed(2));
      const resumo = overlay.querySelector('#bcmResumo');
      if (resumo) {
        let extra = '';
        if (diferenca > 0.004) extra = ` · <span style="color:var(--red, #ff6b6b);">Falta ${escaparHtmlBasico(formatarMoedaBRFinanceiro(diferenca))}</span>`;
        else if (diferenca < -0.004) extra = ` · <span style="color:var(--red, #ff6b6b);">Excedente ${escaparHtmlBasico(formatarMoedaBRFinanceiro(Math.abs(diferenca)))}</span>`;
        else if (sel.length) extra = ' · <span style="color:var(--green, #2ecc71);">Valores conferem ✓</span>';
        resumo.innerHTML = `Alocado: ${escaparHtmlBasico(formatarMoedaBRFinanceiro(alocado))} de ${escaparHtmlBasico(formatarMoedaBRFinanceiro(total))}${extra}`;
      }
      const faltaBox = overlay.querySelector('#bcmFaltaBox');
      if (faltaBox && diferenca <= 0.004) faltaBox.style.display = 'none';
      return { sel, alocado, diferenca };
    };

    // Modo da baixa: movimentar saldo (padrão) ou apenas registrar.
    const modoMovimentar = () => overlay.querySelector('#bcmModoMov')?.checked !== false;

    // Sugestão de preenchimento ao marcar uma conta:
    //  - Movimentando saldo: limita ao saldo disponível (comportamento atual).
    //  - Apenas registro: preenche com TODO o valor faltante (o saldo não importa).
    const sugerirValorPara = (c, faltaAtual) => {
      if (!modoMovimentar()) return Number(Math.max(faltaAtual, 0).toFixed(2));
      const disponivel = Math.max(Number(c.saldo_atual || 0), 0);
      return Number(Math.min(disponivel, Math.max(faltaAtual, 0)).toFixed(2));
    };

    contas.forEach(c => {
      const chk = overlay.querySelector(`[data-bcm-chk="${c.id}"]`);
      const val = overlay.querySelector(`[data-bcm-val="${c.id}"]`);
      if (!chk || !val) return;
      chk.addEventListener('change', () => {
        if (chk.checked) {
          val.disabled = false;
          val.style.opacity = '1';
          const { diferenca } = atualizarResumo();
          val.value = valorMoedaInputFinanceiro(sugerirValorPara(c, diferenca));
        } else {
          val.value = '';
          val.disabled = true;
          val.style.opacity = '.45';
        }
        setMsgModal('');
        atualizarResumo();
      });
      val.addEventListener('input', () => { setMsgModal(''); atualizarResumo(); });
    });

    // Ao trocar o modo, refaz as sugestões das contas já marcadas
    // (no modo registro, a primeira conta marcada absorve o total faltante).
    const reSugerirValores = () => {
      const dica = overlay.querySelector('#bcmDicaPreenchimento');
      if (dica) dica.textContent = modoMovimentar()
        ? 'Ao marcar, o valor é preenchido automaticamente com o saldo disponível.'
        : 'Ao marcar, o valor é preenchido com o total faltante — é só registro, o saldo das contas não muda.';
      contas.forEach(c => {
        const chk = overlay.querySelector(`[data-bcm-chk="${c.id}"]`);
        const val = overlay.querySelector(`[data-bcm-val="${c.id}"]`);
        if (chk?.checked && val) val.value = '';
      });
      contas.forEach(c => {
        const chk = overlay.querySelector(`[data-bcm-chk="${c.id}"]`);
        const val = overlay.querySelector(`[data-bcm-val="${c.id}"]`);
        if (!chk?.checked || !val) return;
        const { diferenca } = atualizarResumo();
        val.value = valorMoedaInputFinanceiro(sugerirValorPara(c, diferenca));
      });
      setMsgModal('');
      atualizarResumo();
    };
    overlay.querySelector('#bcmModoMov')?.addEventListener('change', reSugerirValores);
    overlay.querySelector('#bcmModoReg')?.addEventListener('change', reSugerirValores);
    atualizarResumo();

    const mostrarEscolhaContaNegativa = (sel, falta) => {
      const box = overlay.querySelector('#bcmFaltaBox');
      const texto = overlay.querySelector('#bcmFaltaTexto');
      const botoes = overlay.querySelector('#bcmFaltaBotoes');
      if (!box || !texto || !botoes) return;
      const registroApenas = !modoMovimentar();
      texto.textContent = `Falta ${formatarMoedaBRFinanceiro(falta)} para cobrir o total.`;
      const dicaBox = box.querySelector('div:nth-child(2)');
      if (dicaBox) dicaBox.textContent = registroApenas
        ? 'Escolha em qual conta registrar a diferença (o saldo não será alterado):'
        : 'Escolha qual conta vai cobrir a diferença e ficar negativa:';
      botoes.innerHTML = '';
      sel.forEach(c => {
        const saldoFinal = Number((c.saldo_atual - c.valor - falta).toFixed(2));
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-ghost';
        btn.style.cssText = 'font-size:11px;padding:6px 10px;';
        btn.textContent = registroApenas
          ? c.nome
          : `${c.nome} (ficará em ${formatarMoedaBRFinanceiro(saldoFinal)})`;
        btn.onclick = () => {
          const val = overlay.querySelector(`[data-bcm-val="${c.id}"]`);
          if (val) val.value = valorMoedaInputFinanceiro(Number((c.valor + falta).toFixed(2)));
          box.style.display = 'none';
          setMsgModal(`Diferença adicionada à conta ${c.nome}. Confira e clique em Continuar.`, 'ok');
          atualizarResumo();
        };
        botoes.appendChild(btn);
      });
      box.style.display = 'block';
    };

    overlay.querySelector('#bcmCancelar').onclick = () => fechar(null);
    overlay.onclick = (e) => { if (e.target === overlay) fechar(null); };
    overlay.querySelector('#bcmConfirmar').onclick = () => {
      const { sel, alocado, diferenca } = atualizarResumo();
      if (!sel.length) {
        setMsgModal('Marque ao menos uma conta financeira.', 'err');
        return;
      }
      if (sel.some(c => !(c.valor > 0))) {
        setMsgModal('Informe um valor maior que zero em cada conta marcada (ou desmarque a conta).', 'err');
        return;
      }
      if (diferenca < -0.004) {
        setMsgModal(`O alocado supera o total da baixa em ${formatarMoedaBRFinanceiro(Math.abs(diferenca))}. Ajuste os valores.`, 'err');
        return;
      }
      if (diferenca > 0.004) {
        mostrarEscolhaContaNegativa(sel, diferenca);
        return;
      }
      // Só avisa sobre saldo negativo quando o saldo será de fato movimentado.
      if (modoMovimentar()) {
        const negativas = sel.filter(c => Number((c.valor - c.saldo_atual).toFixed(2)) > 0.004);
        if (negativas.length) {
          const lista = negativas
            .map(c => `• ${c.nome}: saldo ${formatarMoedaBRFinanceiro(c.saldo_atual)} → ficará em ${formatarMoedaBRFinanceiro(Number((c.saldo_atual - c.valor).toFixed(2)))}`)
            .join('\n');
          if (!confirm(`Atenção: a(s) conta(s) abaixo ficará(ão) NEGATIVA(S) após esta baixa:\n\n${lista}\n\nConfirmar mesmo assim?`)) return;
        }
      }
      fechar({
        contas: sel.map(c => ({ id: c.id, nome: c.nome, valor: Number(c.valor.toFixed(2)) })),
        movimentarSaldo: modoMovimentar(),
      });
    };
  });
}

async function desconfirmarPagamentoContaFinanceiro(id) {
  if (!confirm('Reabrir esta conta como pendente?')) return;
  const item = contasBaixarFinanceiroCache.find(conta => String(conta.id) === String(id)) || null;
  const movimentarSaldo = !contaBaixadaSemMovimentacaoSaldo(item);
  if (movimentarSaldo === true && item?.conta_financeira_id && Number(item.valor_pago || item.valor_compra || 0) > 0) {
    const { error: erroEstorno } = await registrarMovimentacaoContaFinanceira({
      contaFinanceiraId: item.conta_financeira_id,
      contaApagarId: id,
      tipo: 'estorno_saida',
      valor: Number(item.valor_pago || item.valor_compra || 0),
      descricao: `Reabertura de título de ${item.fornecedores?.nome || 'fornecedor'}`,
    });
    if (erroEstorno) {
      setMsg('msgBaixarContasFinanceiro', `Não foi possível devolver o saldo para a conta financeira: ${mensagemErroSupabase(erroEstorno, 'erro desconhecido')}`, 'err');
      return;
    }
  }

  const { error } = await sb
    .from('contasapagar')
    .update({ pago_confirmado_em: null })
    .eq('id', id)
    .is('excluido_em', null);

  if (error) {
    setMsg('msgBaixarContasFinanceiro', `Não foi possível reabrir a conta: ${mensagemErroSupabase(error, 'erro desconhecido')}`, 'err');
    return;
  }

  setMsg('msgBaixarContasFinanceiro', 'Conta reaberta como pendente.', 'ok');
  await carregarContasFinanceiras({ render: false, silencioso: true });
  if (document.getElementById('financeiro_cofre')?.classList.contains('ativa')) {
    await carregarCofreFinanceiro();
  }
  if (document.getElementById('relatorio_financeiro')?.classList.contains('ativa')) {
    await carregarRelatorioFinanceiro();
  }
  carregarBaixarContasFinanceiro();
  carregarContasAPagarFinanceiro();
}

// Reabre em lote todas as contas pagas atualmente visíveis no filtro.
async function reabrirTodasContasFinanceiro() {
  const pagas = (contasBaixarFinanceiroCache || []).filter(c => obterStatusContaBaixaFinanceiro(c) === 'pago');
  if (!pagas.length) {
    setMsg('msgBaixarContasFinanceiro', 'Não há contas pagas neste filtro para reabrir.', 'err');
    return;
  }
  if (!confirm(`Reabrir ${pagas.length} conta(s) paga(s) como pendente(s)?\n\nO saldo movimentado será estornado das contas financeiras.`)) return;

  let ok = 0, falhas = 0;
  for (const item of pagas) {
    try {
      const movimentarSaldo = !contaBaixadaSemMovimentacaoSaldo(item);
      if (movimentarSaldo === true && item?.conta_financeira_id && Number(item.valor_pago || item.valor_compra || 0) > 0) {
        await registrarMovimentacaoContaFinanceira({
          contaFinanceiraId: item.conta_financeira_id,
          contaApagarId: item.id,
          tipo: 'estorno_saida',
          valor: Number(item.valor_pago || item.valor_compra || 0),
          descricao: `Reabertura de título de ${item.fornecedores?.nome || 'fornecedor'}`,
        });
      }
      const { error } = await sb.from('contasapagar')
        .update({ pago_confirmado_em: null })
        .eq('id', item.id)
        .is('excluido_em', null);
      if (error) throw error;
      ok++;
    } catch (e) {
      console.error('Erro ao reabrir conta:', item.id, e);
      falhas++;
    }
  }

  setMsg('msgBaixarContasFinanceiro',
    falhas ? `${ok} reaberta(s) · ${falhas} com erro.` : `${ok} conta(s) reaberta(s) como pendente(s).`,
    falhas ? 'err' : 'ok');
  await carregarContasFinanceiras({ render: false, silencioso: true });
  if (document.getElementById('financeiro_cofre')?.classList.contains('ativa')) await carregarCofreFinanceiro();
  if (document.getElementById('relatorio_financeiro')?.classList.contains('ativa')) await carregarRelatorioFinanceiro();
  carregarBaixarContasFinanceiro();
  carregarContasAPagarFinanceiro();
}


function somenteDigitosCep(valor = '') {
  return String(valor || '').replace(/\D/g, '').slice(0, 8);
}

function formatarCepLoja(valor = '') {
  const digitos = somenteDigitosCep(valor);
  if (digitos.length <= 5) return digitos;
  return `${digitos.slice(0, 5)}-${digitos.slice(5)}`;
}

async function buscarCepLoja(cepInputId, cidadeInputId, estadoInputId, msgId = '') {
  const cepEl = document.getElementById(cepInputId);
  const cidadeEl = document.getElementById(cidadeInputId);
  const estadoEl = document.getElementById(estadoInputId);
  if (!cepEl || !cidadeEl || !estadoEl) return;

  const cep = somenteDigitosCep(cepEl.value);
  cepEl.value = formatarCepLoja(cep);
  if (!cep) return;
  if (cep.length !== 8) {
    if (msgId) setMsg(msgId, 'CEP inválido. Preencha cidade e estado manualmente.', 'err');
    return;
  }

  try {
    if (msgId) setMsg(msgId, 'Buscando cidade pelo CEP...', 'ok');
    const resp = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const dados = await resp.json();
    if (!resp.ok || dados?.erro) throw new Error('CEP não encontrado');
    if (cidadeEl) cidadeEl.value = String(dados.localidade || '').trim();
    if (estadoEl) estadoEl.value = String(dados.uf || '').trim().toUpperCase();
    if (msgId) setMsg(msgId, 'Cidade e estado preenchidos pelo CEP. Confira antes de salvar.', 'ok');
  } catch (e) {
    if (msgId) setMsg(msgId, 'Não foi possível buscar o CEP. Preencha cidade e estado manualmente.', 'err');
  }
}

// 
