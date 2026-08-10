// TELA PREFERIDA DE LOGIN
// ══════════════════════════════════════════════════════════════════
const PAGINAS_TELA_PREFERIDA = [
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'checklists', label: 'Checklist' },
  { value: 'bater_ponto', label: 'Bater Ponto' },
  { value: 'tarefas_rapidas', label: 'Alertas Rápidos' },
  { value: 'escala_plantoes', label: 'Agenda' },
  { value: 'relatorio_financeiro', label: 'Contas a pagar' },
  { value: 'relatorio_recebimentos', label: 'Recebimentos' },
  { value: 'financeiro_cofre', label: 'Cofre' },
  { value: 'financeiro_recebiveis', label: 'Recebíveis' },
  { value: 'funcionarios', label: 'Funcionários' },
];

async function iniciarTelaPreferidaLogin() {
  const selLoja = document.getElementById('telaPreferidaLojaId');
  const selPageLoja = document.getElementById('telaPreferidaLojaPage');
  const selPageUser = document.getElementById('telaPreferidaUsuarioPage');
  const opcoesHtml = PAGINAS_TELA_PREFERIDA.map(p => `<option value="${p.value}">${p.label}</option>`).join('');
  if (selPageLoja) selPageLoja.innerHTML = '<option value="">Padrão do sistema</option>' + opcoesHtml;
  if (selPageUser) selPageUser.innerHTML = '<option value="">Usar configuração da loja</option>' + opcoesHtml;

  // Carregar lojas disponíveis
  try {
    const { data: lojas } = await executarSemFiltroLojaTemporario(() =>
      sb.from('lojas').select('id, nome').eq('ativo', true).order('nome')
    );
    if (selLoja && lojas) {
      selLoja.innerHTML = '<option value="">Selecione a loja</option>' +
        lojas.map(l => `<option value="${l.id}">${escaparHtmlBasico(l.nome)}</option>`).join('');
    }
  } catch(e) {}

  // Carregar preferência do usuário
  try {
    const prefUser = localStorage.getItem('tela_preferida_usuario_' + (usuarioSistemaLogado?.id || ''));
    if (prefUser && selPageUser) selPageUser.value = prefUser;
  } catch(e) {}
}

async function carregarTelaPreferidaLoja() {
  const lojaId = document.getElementById('telaPreferidaLojaId')?.value;
  const selPage = document.getElementById('telaPreferidaLojaPage');
  if (!lojaId || !selPage) return;
  try {
    const { data } = await executarSemFiltroLojaTemporario(() =>
      sb.from('lojas').select('tela_inicial').eq('id', lojaId).single()
    );
    if (data?.tela_inicial) selPage.value = data.tela_inicial;
    else selPage.value = '';
  } catch(e) { selPage.value = ''; }
}

async function salvarTelaPreferidaLoja() {
  const lojaId = document.getElementById('telaPreferidaLojaId')?.value;
  const page = document.getElementById('telaPreferidaLojaPage')?.value || null;
  if (!lojaId) { setMsg('msgTelaPreferidaLoja', 'Selecione uma loja.', 'err'); return; }
  try {
    const { error } = await executarSemFiltroLojaTemporario(() =>
      sb.from('lojas').update({ tela_inicial: page }).eq('id', lojaId)
    );
    if (error) throw error;
    setMsg('msgTelaPreferidaLoja', 'Tela inicial da loja salva.', 'ok');
  } catch(e) { setMsg('msgTelaPreferidaLoja', 'Erro: ' + (e?.message||''), 'err'); }
}

function salvarTelaPreferidaUsuario() {
  const page = document.getElementById('telaPreferidaUsuarioPage')?.value || '';
  try {
    const key = 'tela_preferida_usuario_' + (usuarioSistemaLogado?.id || '');
    if (page) localStorage.setItem(key, page);
    else localStorage.removeItem(key);
    setMsg('msgTelaPreferidaUsuario', page ? `Sua tela inicial: ${PAGINAS_TELA_PREFERIDA.find(p=>p.value===page)?.label||page}` : 'Preferência removida.', 'ok');
  } catch(e) { setMsg('msgTelaPreferidaUsuario', 'Erro ao salvar.', 'err'); }
}

function limparTelaPreferidaUsuario() {
  const sel = document.getElementById('telaPreferidaUsuarioPage');
  if (sel) sel.value = '';
  salvarTelaPreferidaUsuario();
}

function obterTelaPreferidaAoLogin() {
  // Verificar preferência do usuário primeiro, depois da loja
  try {
    const keyUser = 'tela_preferida_usuario_' + (usuarioSistemaLogado?.id || '');
    const prefUser = localStorage.getItem(keyUser);
    if (prefUser) return prefUser;
  } catch(e) {}
  return usuarioSistemaLogado?.loja_tela_inicial || null;
}
// ══════════════════════════════════════════════════════════════════
async function excluirRecebivelFinanceiro(id) {
  const confirmacao = await confirmarAcaoComPin({
    funcionario: obterFuncionarioOperadorAtual(), titulo: 'Excluir recebível',
    subtitulo: 'Confirme sua senha para excluir este recebível e estornar o saldo correspondente.',
    textoAcao: 'Excluir recebível', escopo: 'empresa',
  });
  if (!confirmacao) return;

  let item = recebiveisFinanceiroCache.find(recebivel => String(recebivel.id) === String(id)) || null;
  if (!item) {
    const { data: recebidoBanco, error: erroBuscaRecebivel } = await executarSemFiltroLojaTemporario(() => sb
      .from('recebiveis')
      .select('id, conta_financeira_id, valor')
      .eq('id', id)
      .maybeSingle());
    if (erroBuscaRecebivel) {
      setMsg('msgRecebivelFinanceiro', `Não foi possível carregar o recebível para exclusão: ${mensagemErroSupabase(erroBuscaRecebivel, 'erro desconhecido')}`, 'err');
      return;
    }
    item = recebidoBanco || null;
  }

  const saldoGerenciadoNoBanco = await recebiveisSaldoGerenciadoNoBanco();
  if (!saldoGerenciadoNoBanco && item?.conta_financeira_id && Number(item.valor || 0) > 0) {
    const { error: erroEstorno } = await registrarMovimentacaoContaFinanceira({
      contaFinanceiraId: item.conta_financeira_id,
      recebivelId: id,
      tipo: 'estorno',
      valor: Number(item.valor || 0),
      descricao: 'Estorno por exclusão de recebível',
    });
    if (erroEstorno) {
      setMsg('msgRecebivelFinanceiro', `Não foi possível estornar a conta financeira: ${mensagemErroSupabase(erroEstorno, 'erro desconhecido')}`, 'err');
      return;
    }
  }

  const { error } = await executarSemFiltroLojaTemporario(() => sb.from('recebiveis').delete().eq('id', id));
  if (error) {
    if (!saldoGerenciadoNoBanco && item?.conta_financeira_id && Number(item.valor || 0) > 0) {
      const { error: erroRollbackEstorno } = await registrarMovimentacaoContaFinanceira({
        contaFinanceiraId: item.conta_financeira_id,
        recebivelId: id,
        tipo: 'entrada',
        valor: Number(item.valor || 0),
        descricao: 'Desfaz estorno: exclusão de recebível não concluída',
      });
      if (erroRollbackEstorno) {
        console.warn('Falha ao desfazer estorno apos erro na exclusao de recebivel:', erroRollbackEstorno);
      }
    }
    if (isMissingRecebiveisTableError(error)) {
      setMsg('msgRecebivelFinanceiro', 'Rode o SQL de recebíveis antes de usar esta tela.', 'err');
      return;
    }
    setMsg('msgRecebivelFinanceiro', `Não foi possível excluir: ${mensagemErroSupabase(error, 'erro desconhecido')}`, 'err');
    return;
  }

  if (String(recebivelFinanceiroEmEdicaoId || '') === String(id)) limparFormularioRecebivelFinanceiro();
  setMsg('msgRecebivelFinanceiro', 'Recebível excluído.', 'ok');
  recebiveisFinanceiroListaVisivel = true;
  await carregarContasFinanceiras({ render: false, silencioso: true });
  await carregarRecebiveisFinanceiro();
  if (document.getElementById('financeiro_cofre')?.classList.contains('ativa')) {
    await carregarCofreFinanceiro();
  }
}

function atualizarResumoCofreFinanceiro({ saldoTotal = 0, movimentos = [] } = {}) {
  const totalRecebimentos = document.getElementById('cofreTotalRecebimentos');
  if (totalRecebimentos) totalRecebimentos.textContent = formatarMoedaBRFinanceiro(saldoTotal);
}

function renderizarCardsCofreContas(contas = []) {
  const container = document.getElementById('cardsCofreContas');
  if (!container) return;
  const contasAtivas = (contas || []).filter(item => item?.ativo !== false);
  if (!contasAtivas.length) {
    container.innerHTML = '<div class="empty">Nenhuma conta financeira ativa cadastrada.</div>';
    return;
  }
  const identidadeConta = (nome, idx) => {
    const value=String(nome||'').toUpperCase();
    if(value.includes('INTER'))return 'inter';if(value.includes('BRADESCO'))return 'bradesco';if(value.includes('NUBANK'))return 'nubank';
    if(value.includes('MERCADO PAGO'))return 'mercado-pago';if(value.includes('ITAU')||value.includes('ITAÚ'))return 'itau';return `cor-${idx%6}`;
  };
  container.innerHTML = contasAtivas.map((item, idx) => `
    <div class="stat-card conta-financeira-${identidadeConta(item.nome,idx)}">
      <div class="stat-label" style="color:rgba(255,255,255,0.82)">Conta financeira</div>
      <div class="stat-value" style="color:#fff">${escaparHtmlBasico(item.nome || '-')}</div>
      <div class="s-value" style="color:#fff;margin-top:8px">${escaparHtmlBasico(formatarMoedaBRFinanceiro(item.saldo_atual || 0))}</div>
    </div>
  `).join('');
}

function renderizarPizzaCofreContas(contas = [], contexto = {}) {
  const grafico = document.getElementById('graficoPizzaCofreContas');
  const legenda = document.getElementById('legendaPizzaCofreContas');
  if (!grafico || !legenda) return;

  const cores = ['#22c55e', '#3b82f6', '#f97316', '#14b8a6', '#ec4899', '#8b5cf6', '#eab308', '#ef4444'];
  const saldoTotal = Number(contexto.saldoTotal || 0);
  const saldoReal = Number(contexto.saldoReal ?? saldoTotal);  // saldo sem futuros
  const totalFuturos = Number(contexto.totalFuturos || 0);
  const somarFuturos = !!contexto.somarFuturos;
  const totalContasAbertas = Number(contexto.totalContasAbertas || 0);
  const qtdContasAbertas = Number(contexto.qtdContasAbertas || 0);
  const periodoInicio = contexto.filtroInicio ? formatarDataBRFinanceiro(contexto.filtroInicio) : 'início';
  const periodoFim = contexto.filtroFim ? formatarDataBRFinanceiro(contexto.filtroFim) : 'fim';

  // Cálculo correto:
  // faltaBase = quanto falta HOJE com o saldo real (sem futuros)
  //   se saldo real cobre tudo: faltaBase = 0
  //   se saldo real não cobre: faltaBase = contas - saldo (ou abs(saldo) + contas se negativo)
  const saldoNegativo = Math.max(0, -saldoReal);
  const faltaBase = saldoReal >= 0
    ? Math.max(0, Number((totalContasAbertas - saldoReal).toFixed(2)))
    : Number((saldoNegativo + totalContasAbertas).toFixed(2));

  // Com futuros: falta reduz pelos recebimentos futuros pendentes
  const faltaComFuturos = Math.max(0, Number((faltaBase - totalFuturos).toFixed(2)));
  const faltaTotal = somarFuturos ? faltaComFuturos : faltaBase;
  const sobra = somarFuturos ? Math.max(0, Number((totalFuturos - faltaBase).toFixed(2))) : 0;

  // Mostra o card sempre que há contas abertas no período
  if (totalContasAbertas > 0) {
    // Gráfico: vermelho = falta, âmbar = cobre parcialmente, verde = cobre tudo com futuros
    if (faltaTotal > 0) {
      const pesoNeg = saldoNegativo;
      const pesoAb = totalContasAbertas;
      const total = Math.max(0.01, pesoNeg + pesoAb);
      const fimNeg = (pesoNeg / total) * 100;
      grafico.style.background = pesoNeg > 0
        ? `conic-gradient(#ef4444 0% ${fimNeg}%, #f59e0b ${fimNeg}% 100%)`
        : '#f59e0b';
      grafico.title = `Falta no período: ${formatarMoedaBRFinanceiro(faltaTotal)}`;
    } else {
      grafico.style.background = somarFuturos ? '#22c55e' : '#3b82f6';
      grafico.title = somarFuturos ? 'Coberto com recebimentos futuros' : 'Saldo cobre o período';
    }

    const labelTitulo = faltaTotal > 0
      ? 'Falta para cobrir período'
      : somarFuturos ? 'Período coberto (c/ futuros)' : 'Período coberto';
    const corTotal = faltaTotal > 0 ? 'var(--red,#ef4444)' : 'var(--green,#22c55e)';
    const valorExibido = faltaTotal > 0 ? faltaTotal : sobra || (saldoReal - totalContasAbertas);
    const sinalExibido = faltaTotal > 0 ? '-' : '+';

    legenda.innerHTML = `
      <div class="cofre-necessidade-resumo">
        <div>
          <div class="cofre-necessidade-label">${escaparHtmlBasico(labelTitulo)}</div>
          <div class="cofre-necessidade-total" style="color:${corTotal}">
            ${sinalExibido}${formatarMoedaBRFinanceiro(Math.abs(valorExibido))}
          </div>
        </div>
        <div class="cofre-necessidade-detalhe">
          <span>Saldo atual</span>
          <strong style="color:${saldoReal >= 0 ? 'var(--green,#22c55e)' : 'var(--red,#ef4444)'}">
            ${formatarMoedaBRFinanceiro(saldoReal)}
          </strong>
        </div>
        <div class="cofre-necessidade-detalhe">
          <span>Contas em aberto (${qtdContasAbertas})</span>
          <strong style="color:var(--amber,#f59e0b)">-${formatarMoedaBRFinanceiro(totalContasAbertas)}</strong>
        </div>
        ${somarFuturos && totalFuturos > 0 ? `
        <div class="cofre-necessidade-detalhe">
          <span>Recebimentos futuros</span>
          <strong style="color:var(--green,#22c55e)">+${formatarMoedaBRFinanceiro(totalFuturos)}</strong>
        </div>` : ''}
        <div class="item-detalhe" style="margin-top:4px;font-size:10px;">
          ${(!contexto.filtroInicio && !contexto.filtroFim)
            ? 'Período: todas as contas em aberto (sem filtro de datas — inclui parcelas futuras)'
            : `Período: ${escaparHtmlBasico(periodoInicio)} até ${escaparHtmlBasico(periodoFim)}`}
        </div>
      </div>
    `;
    return;
  }

  const contasAtivas = (contas || [])
    .filter(item => item?.ativo !== false && Number(item.saldo_atual || 0) > 0)
    .sort((a, b) => Number(b.saldo_atual || 0) - Number(a.saldo_atual || 0));
  const total = contasAtivas.reduce((acc, item) => acc + Number(item.saldo_atual || 0), 0);

  if (!contasAtivas.length || total <= 0) {
    grafico.style.background = 'var(--surface2)';
    grafico.title = 'Sem saldo em contas financeiras';
    legenda.innerHTML = '<div class="empty">Sem saldo para montar o gráfico.</div>';
    return;
  }

  let cursor = 0;
  const fatias = contasAtivas.map((item, idx) => {
    const valor = Number(item.saldo_atual || 0);
    const inicio = cursor;
    const fim = cursor + (valor / total) * 100;
    cursor = fim;
    const cor = cores[idx % cores.length];
    return { item, valor, inicio, fim, cor };
  });

  grafico.style.background = `conic-gradient(${fatias.map(f => `${f.cor} ${f.inicio}% ${f.fim}%`).join(', ')})`;
  grafico.title = fatias.map(f => `${f.item.nome || '-'}: ${formatarMoedaBRFinanceiro(f.valor)}`).join('\n');
  legenda.innerHTML = fatias.map(f => `
    <div class="cofre-pizza-legenda-item" title="${escaparHtmlBasico(f.item.nome || '-')}: ${escaparHtmlBasico(formatarMoedaBRFinanceiro(f.valor))}">
      <span class="cofre-pizza-swatch" style="background:${f.cor}"></span>
      <span class="cofre-pizza-nome">${escaparHtmlBasico(f.item.nome || '-')}</span>
      <span class="cofre-pizza-valor">${escaparHtmlBasico(formatarMoedaBRFinanceiro(f.valor))}</span>
    </div>
  `).join('');
}

function obterPessoaMovimentacaoCofre(item = {}) {
  return item.ajuste_saldo?.funcionario_nome
    || item.recebiveis?.fornecedores?.nome
    || item.contasapagar?.fornecedores?.nome
    || '-';
}

function obterFormaMovimentacaoCofre(item = {}) {
  if (item.ajuste_saldo?.id) return 'Ajuste de saldo';
  return item.recebiveis?.formas_pagamento?.nome || item.contasapagar?.formas_pagamento?.nome || '-';
}

function criarChavePareamentoAjusteCofre(item = {}) {
  return [
    String(item.conta_financeira_id || ''),
    String(item.tipo || '').toLowerCase(),
    Number(item.valor || 0).toFixed(2),
    Number(item.saldo_apos ?? item.saldo_atual ?? 0).toFixed(2),
  ].join('|');
}

async function anexarAuditoriaAjustesCofre(movimentacoes = [], filtroInicio = '', filtroFim = '') {
  const ajustesMov = (movimentacoes || []).filter(item => String(item.descricao || '').toLowerCase().startsWith('ajuste manual de saldo:'));
  if (!ajustesMov.length) return movimentacoes || [];

  let query = sb
    .from('contas_financeiras_ajustes_saldo')
    .select('id, conta_financeira_id, tipo, valor, saldo_anterior, saldo_atual, observacao, funcionario_id, funcionario_nome, created_at')
    .order('created_at', { ascending: false });
  if (filtroInicio) query = query.gte('created_at', `${filtroInicio}T00:00:00`);
  if (filtroFim) query = query.lte('created_at', `${filtroFim}T23:59:59`);

  const { data, error } = await query;
  if (error) {
    console.warn('Não foi possível carregar auditoria de ajustes do cofre:', error);
    return movimentacoes || [];
  }

  const ajustesPorChave = new Map();
  (data || []).forEach(item => {
    const chave = criarChavePareamentoAjusteCofre(item);
    const lista = ajustesPorChave.get(chave) || [];
    lista.push(item);
    ajustesPorChave.set(chave, lista);
  });

  return (movimentacoes || []).map(item => {
    if (!String(item.descricao || '').toLowerCase().startsWith('ajuste manual de saldo:')) return item;
    const chave = criarChavePareamentoAjusteCofre(item);
    const lista = ajustesPorChave.get(chave) || [];
    const ajuste = lista.shift() || null;
    return ajuste ? { ...item, ajuste_saldo: ajuste } : item;
  });
}

function renderizarExtratoCofre(itens = []) {
  const lista = document.getElementById('listaCofreFinanceiro');
  if (!lista) return;

  if (!cofreExtratoVisivel) {
    lista.innerHTML = '';
    return;
  }

  if (!itens.length) {
    lista.innerHTML = '<div class="empty">Nenhuma movimentação encontrada no cofre.</div>';
    return;
  }

  lista.innerHTML = '<div class="lista">' + itens.map(item => {
    const tipo = String(item.tipo || 'entrada').toLowerCase();
    const ehSaida = tipo === 'saida' || tipo === 'estorno';
    const rotulo = tipo === 'saida'
      ? 'Saída'
      : (tipo === 'estorno' ? 'Estorno de entrada' : (tipo === 'estorno_saida' ? 'Estorno de saída' : 'Entrada'));
    const tag = ehSaida ? '<span class="tag tag-red">Saída</span>' : '<span class="tag tag-green">Entrada</span>';
    const sinal = ehSaida ? '-' : '+';
    const conta = escaparHtmlBasico(item.contas_financeiras?.nome || 'Conta não encontrada');
    const descricao = escaparHtmlBasico(item.descricao || rotulo);
    const pessoa = escaparHtmlBasico(obterPessoaMovimentacaoCofre(item));
    const forma = escaparHtmlBasico(obterFormaMovimentacaoCofre(item));
    const dataMov = formatarDataBRFinanceiro(String(item.created_at || '').slice(0, 10));
    const valor = `${sinal}${formatarMoedaBRFinanceiro(item.valor || 0)}`;
    return `
      <div class="item">
        <div class="item-info">
          <div class="item-nome">${conta}</div>
          <div class="item-detalhe">${dataMov} · ${descricao}</div>
          <div class="item-detalhe">Valor: ${valor} · Saldo após: ${formatarMoedaBRFinanceiro(item.saldo_apos || 0)}</div>
          <div class="item-detalhe">Pessoa: ${pessoa} · Forma: ${forma}</div>
        </div>
        <div class="item-actions">
          ${tag}
        </div>
      </div>
    `;
  }).join('') + '</div>';
}

function atualizarEstadoExtratoCofre() {
  const card = document.getElementById('cardExtratoCofre');
  const btn = document.getElementById('btnToggleExtratoCofre');
  if (card) card.hidden = !cofreExtratoVisivel;
  if (btn) {
    btn.innerHTML = `<span class="cofre-action-icon">▤</span><span>${cofreExtratoVisivel ? 'Ocultar extrato' : 'Exibir extrato'}</span>`;
    btn.setAttribute('aria-expanded', String(cofreExtratoVisivel));
  }
}

function toggleExtratoCofre() {
  cofreExtratoVisivel = !cofreExtratoVisivel;
  atualizarEstadoExtratoCofre();
  renderizarExtratoCofre(cofreMovimentacoesCache);
}

function aplicarAtalhoPeriodoCofreFinanceiro(dias = 7) {
  const intervalo = Math.max(1, Number(dias || 7));
  const campoInicio = document.getElementById('filtroCofreDataInicio');
  const campoFim = document.getElementById('filtroCofreDataFim');
  const hojeLocal = hoje();
  if (campoInicio) campoInicio.value = hojeLocal;
  if (campoFim) campoFim.value = somarDiasDataLocal(hojeLocal, intervalo);
  carregarCofreFinanceiro();
}

async function carregarContasAbertasPeriodoCofre(filtroInicio = '', filtroFim = '', lojasPermitidasIds = []) {
  const executarConsulta = () => {
    let query = sb
      .from('contasapagar')
      .select('id, valor_compra, valor_pago, data_vencimento, pago_confirmado_em, loja_id, empresa_id')
      .is('excluido_em', null)
      .is('pago_confirmado_em', null);
    query = aplicarFiltroLojasFinanceirasPermitidas(query, lojasPermitidasIds);
    if (filtroInicio) query = query.gte('data_vencimento', filtroInicio);
    if (filtroFim) query = query.lte('data_vencimento', filtroFim);
    return query;
  };

  const { data, error } = await executarSemFiltroLojaTemporario(executarConsulta);
  if (error) {
    if (!isMissingContasAPagarTableError(error) && !isMissingColumnError(error)) {
      console.warn('Não foi possível carregar contas em aberto para o cofre:', error);
    }
    return { itens: [], total: 0, error };
  }

  const itens = data || [];
  const total = itens.reduce((acc, item) => {
    const valorPago = Number(item.valor_pago || 0);
    const valorCompra = Number(item.valor_compra || 0);
    return acc + (valorPago > 0 ? valorPago : valorCompra);
  }, 0);
  return { itens, total: Number(total.toFixed(2)), error: null };
}

function preencherSelectAjusteSaldoCofre(valorAtual = '') {
  const select = document.getElementById('ajusteSaldoContaSelect');
  if (!select) return;
  const contas = (contasFinanceirasCache || []).filter(item => item?.ativo !== false || String(item.id) === String(valorAtual || ''));
  select.innerHTML = '<option value="">Selecione a conta</option>' + contas.map(item => (
    `<option value="${item.id}"${String(item.id) === String(valorAtual || '') ? ' selected' : ''}>${item.nome || '-'} (${formatarMoedaBRFinanceiro(item.saldo_atual || 0)})</option>`
  )).join('');
}

function preencherSelectTransferenciaSaldoCofre(valorAtual = '') {
  const select = document.getElementById('transferenciaSaldoContaDestinoSelect');
  if (!select) return;
  const origemId = String(document.getElementById('ajusteSaldoContaSelect')?.value || '').trim();
  const contas = (contasFinanceirasCache || [])
    .filter(item => item?.ativo !== false || String(item.id) === String(valorAtual || ''))
    .filter(item => String(item.id) !== origemId);
  select.innerHTML = '<option value="">Selecione a conta destino</option>' + contas.map(item => (
    `<option value="${item.id}"${String(item.id) === String(valorAtual || '') ? ' selected' : ''}>${item.nome || '-'} (${formatarMoedaBRFinanceiro(item.saldo_atual || 0)})</option>`
  )).join('');
}

function selecionarModoAjusteSaldoCofre(modo = 'ajuste') {
  const modoNormalizado = String(modo || '').toLowerCase();
  ajusteSaldoCofreModo = modoNormalizado === 'transferencia' ? 'transferencia' : (modoNormalizado === 'definir' ? 'definir' : 'ajuste');
  const ehTransferencia = ajusteSaldoCofreModo === 'transferencia';
  const ehDefinir = ajusteSaldoCofreModo === 'definir';
  const btnAjuste = document.getElementById('ajusteSaldoModoAjuste');
  const btnDefinir = document.getElementById('ajusteSaldoModoDefinir');
  const btnTransferencia = document.getElementById('ajusteSaldoModoTransferencia');
  const tiposGrupo = document.getElementById('ajusteSaldoTiposGrupo');
  const destinoGrupo = document.getElementById('transferenciaSaldoDestinoGrupo');
  const btnSaldoTotal = document.getElementById('btnTransferirSaldoTotalDisponivel');
  const contaLabel = document.getElementById('ajusteSaldoContaLabel');
  const valorLabel = document.getElementById('ajusteSaldoValorLabel');
  const valorInput = document.getElementById('ajusteSaldoValor');
  const motivo = document.getElementById('ajusteSaldoMotivo');
  if (btnAjuste) btnAjuste.className = (!ehTransferencia && !ehDefinir) ? 'btn btn-green' : 'btn btn-ghost';
  if (btnDefinir) btnDefinir.className = ehDefinir ? 'btn btn-green' : 'btn btn-ghost';
  if (btnTransferencia) btnTransferencia.className = ehTransferencia ? 'btn btn-green' : 'btn btn-ghost';
  if (tiposGrupo) tiposGrupo.style.display = (ehTransferencia || ehDefinir) ? 'none' : '';
  if (destinoGrupo) destinoGrupo.style.display = ehTransferencia ? '' : 'none';
  if (btnSaldoTotal) btnSaldoTotal.style.display = ehTransferencia ? 'inline-flex' : 'none';
  if (contaLabel) contaLabel.textContent = ehTransferencia ? 'Conta origem' : 'Conta financeira';
  if (valorLabel) valorLabel.textContent = ehDefinir ? 'Novo saldo atual' : 'Valor';
  if (valorInput) valorInput.placeholder = ehDefinir ? 'Ex: -2.673,58' : 'R$ 0,00';
  if (motivo) motivo.placeholder = ehTransferencia
    ? 'Descreva o motivo da transferência'
    : (ehDefinir ? 'Descreva o motivo da definição de saldo' : 'Descreva o motivo do ajuste');
  preencherSelectTransferenciaSaldoCofre(document.getElementById('transferenciaSaldoContaDestinoSelect')?.value || '');
}

function preencherTransferenciaSaldoTotalDisponivel() {
  const contaOrigemId = String(document.getElementById('ajusteSaldoContaSelect')?.value || '').trim();
  if (!contaOrigemId) {
    setMsg('ajusteSaldoMsg', 'Selecione a conta de origem para usar o saldo disponível.', 'err');
    return;
  }
  const contaOrigem = (contasFinanceirasCache || []).find(item => String(item.id) === contaOrigemId) || null;
  const saldo = Number(contaOrigem?.saldo_atual || 0);
  if (!Number.isFinite(saldo) || saldo <= 0) {
    setMsg('ajusteSaldoMsg', 'A conta origem não possui saldo positivo disponível para transferir.', 'err');
    return;
  }
  const campoValor = document.getElementById('ajusteSaldoValor');
  if (campoValor) campoValor.value = saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  setMsg('ajusteSaldoMsg', `Valor preenchido com o saldo disponível de ${formatarMoedaBRFinanceiro(saldo)}.`, 'ok');
}

function selecionarTipoAjusteSaldoCofre(tipo = 'entrada') {
  ajusteSaldoCofreTipo = String(tipo || 'entrada').toLowerCase() === 'saida' ? 'saida' : 'entrada';
  const btnEntrada = document.getElementById('ajusteSaldoTipoEntrada');
  const btnSaida = document.getElementById('ajusteSaldoTipoSaida');
  if (btnEntrada) btnEntrada.style.opacity = ajusteSaldoCofreTipo === 'entrada' ? '1' : '0.55';
  if (btnSaida) btnSaida.style.opacity = ajusteSaldoCofreTipo === 'saida' ? '1' : '0.55';
}

async function abrirModalAjusteSaldoCofre() {
  const overlay = document.getElementById('ajusteSaldoCofreOverlay');
  const valor = document.getElementById('ajusteSaldoValor');
  const motivo = document.getElementById('ajusteSaldoMotivo');
  const pin = document.getElementById('ajusteSaldoPin');
  const msg = document.getElementById('ajusteSaldoMsg');
  const btnSalvar = document.getElementById('btnSalvarAjusteSaldoCofre');
  if (!overlay) return;

  if (valor) valor.value = '';
  if (motivo) motivo.value = '';
  if (pin) pin.value = '';
  if (btnSalvar) btnSalvar.disabled = false;
  if (msg) {
    msg.textContent = '';
    msg.className = 'msg';
  }

  await carregarContasFinanceiras({ render: false, silencioso: true });
  preencherSelectAjusteSaldoCofre();
  preencherSelectTransferenciaSaldoCofre();
  selecionarTipoAjusteSaldoCofre('entrada');
  selecionarModoAjusteSaldoCofre('ajuste');
  overlay.classList.add('show');
  window.setTimeout(() => document.getElementById('ajusteSaldoContaSelect')?.focus(), 0);
}

function fecharModalAjusteSaldoCofre() {
  const overlay = document.getElementById('ajusteSaldoCofreOverlay');
  if (overlay) overlay.classList.remove('show');
}

async function salvarAjusteSaldoCofre() {
  if (ajusteSaldoCofreModo === 'transferencia') {
    await salvarTransferenciaSaldoCofre();
    return;
  }
  if (ajusteSaldoCofreModo === 'definir') {
    await salvarDefinicaoSaldoAtualCofre();
    return;
  }

  const btnSalvar = document.getElementById('btnSalvarAjusteSaldoCofre');
  if (btnSalvar?.disabled) return;

  const contaId = String(document.getElementById('ajusteSaldoContaSelect')?.value || '').trim();
  const valorTexto = String(document.getElementById('ajusteSaldoValor')?.value || '').trim();
  const motivo = String(document.getElementById('ajusteSaldoMotivo')?.value || '').trim();
  const pin = String(document.getElementById('ajusteSaldoPin')?.value || '').trim();

  const valor = lerValorMonetarioFinanceiro(valorTexto);
  if (!contaId) {
    setMsg('ajusteSaldoMsg', 'Selecione a conta financeira.', 'err');
    return;
  }
  if (!Number.isFinite(valor) || valor <= 0) {
    setMsg('ajusteSaldoMsg', 'Informe um valor maior que zero.', 'err');
    return;
  }
  if (!motivo) {
    setMsg('ajusteSaldoMsg', 'Informe o motivo do ajuste.', 'err');
    return;
  }
  if (!pin) {
    setMsg('ajusteSaldoMsg', 'Digite o PIN para confirmar.', 'err');
    return;
  }

  const funcionarioConfirmado = await obterFuncionarioAtivoPorPinEmpresa(pin);
  if (!funcionarioConfirmado?.id) {
    setMsg('ajusteSaldoMsg', 'PIN inválido ou funcionário inativo.', 'err');
    return;
  }

  if (btnSalvar) btnSalvar.disabled = true;
  setMsg('ajusteSaldoMsg', 'Salvando ajuste...', '');

  const tipoAjuste = ajusteSaldoCofreTipo === 'saida' ? 'saida' : 'entrada';
  const descricao = `Ajuste manual de saldo: ${motivo}`;
  const contaAjuste = (contasFinanceirasCache || []).find(item => String(item.id) === contaId) || null;
  const movimento = await registrarMovimentacaoContaFinanceira({
    contaFinanceiraId: contaId,
    tipo: tipoAjuste,
    valor,
    descricao,
  });

  if (movimento.error) {
    if (btnSalvar) btnSalvar.disabled = false;
    setMsg('ajusteSaldoMsg', `Não foi possível ajustar o saldo: ${mensagemErroSupabase(movimento.error, 'erro desconhecido')}`, 'err');
    return;
  }

  const { error: erroAuditoria } = await sb
    .from('contas_financeiras_ajustes_saldo')
    .insert([{
      conta_financeira_id: contaId,
      tipo: tipoAjuste,
      valor: Number(valor.toFixed(2)),
      saldo_anterior: Number(Number(movimento.saldoAnterior || 0).toFixed(2)),
      saldo_atual: Number(Number(movimento.saldoApos || 0).toFixed(2)),
      observacao: motivo,
      funcionario_id: funcionarioConfirmado.id,
      funcionario_nome: funcionarioConfirmado.nome || 'Funcionário',
      empresa_id: contaAjuste?.empresa_id || usuarioSistemaLogado?.empresa_id || null,
      loja_id: contaAjuste?.loja_id || usuarioSistemaLogado?.loja_id || null,
    }]);

  if (erroAuditoria) {
    if (btnSalvar) btnSalvar.disabled = false;
    setMsg('ajusteSaldoMsg', `Saldo alterado, mas não foi possível registrar a auditoria: ${mensagemErroSupabase(erroAuditoria, 'erro desconhecido')}`, 'err');
    return;
  }

  if (btnSalvar) btnSalvar.disabled = false;
  fecharModalAjusteSaldoCofre();
  abrirPagina('financeiro_cofre', document.querySelector('.nav-btn[data-page="financeiro_cofre"]'));
  await carregarContasFinanceiras({ render: false, silencioso: true });
  await carregarCofreFinanceiro();
  setMsg('msgCofreFinanceiro', `Ajuste salvo: ${tipoAjuste === 'saida' ? 'saída' : 'entrada'} de ${formatarMoedaBRFinanceiro(valor)} por ${funcionarioConfirmado.nome || 'funcionário'}.`, 'ok');
}

async function salvarDefinicaoSaldoAtualCofre() {
  const btnSalvar = document.getElementById('btnSalvarAjusteSaldoCofre');
  if (btnSalvar?.disabled) return;

  const contaId = String(document.getElementById('ajusteSaldoContaSelect')?.value || '').trim();
  const saldoTexto = String(document.getElementById('ajusteSaldoValor')?.value || '').trim();
  const motivo = String(document.getElementById('ajusteSaldoMotivo')?.value || '').trim();
  const pin = String(document.getElementById('ajusteSaldoPin')?.value || '').trim();
  const saldoDesejado = lerValorMonetarioFinanceiro(saldoTexto);

  if (!contaId) {
    setMsg('ajusteSaldoMsg', 'Selecione a conta financeira.', 'err');
    return;
  }
  if (!saldoTexto || !Number.isFinite(saldoDesejado)) {
    setMsg('ajusteSaldoMsg', 'Informe o novo saldo atual da conta.', 'err');
    return;
  }
  if (!motivo) {
    setMsg('ajusteSaldoMsg', 'Informe o motivo da definição de saldo.', 'err');
    return;
  }
  if (!pin) {
    setMsg('ajusteSaldoMsg', 'Digite o PIN para confirmar.', 'err');
    return;
  }

  const conta = (contasFinanceirasCache || []).find(item => String(item.id) === contaId) || null;
  const saldoAtual = Number(conta?.saldo_atual || 0);
  const diferenca = Number((saldoDesejado - saldoAtual).toFixed(2));
  if (Math.abs(diferenca) < 0.01) {
    setMsg('ajusteSaldoMsg', 'O saldo informado já é o saldo atual da conta.', 'err');
    return;
  }

  const funcionarioConfirmado = await obterFuncionarioAtivoPorPinEmpresa(pin);
  if (!funcionarioConfirmado?.id) {
    setMsg('ajusteSaldoMsg', 'PIN inválido ou funcionário inativo.', 'err');
    return;
  }

  const tipoAjuste = diferenca > 0 ? 'entrada' : 'saida';
  const valorAjuste = Math.abs(diferenca);
  if (btnSalvar) btnSalvar.disabled = true;
  setMsg('ajusteSaldoMsg', 'Definindo saldo atual...', '');

  const movimento = await registrarMovimentacaoContaFinanceira({
    contaFinanceiraId: contaId,
    tipo: tipoAjuste,
    valor: valorAjuste,
    descricao: `Definição de saldo atual: ${motivo}`,
  });

  if (movimento.error) {
    if (btnSalvar) btnSalvar.disabled = false;
    setMsg('ajusteSaldoMsg', `Não foi possível definir o saldo: ${mensagemErroSupabase(movimento.error, 'erro desconhecido')}`, 'err');
    return;
  }

  const { error: erroAuditoria } = await sb
    .from('contas_financeiras_ajustes_saldo')
    .insert([{
      conta_financeira_id: contaId,
      tipo: tipoAjuste,
      valor: Number(valorAjuste.toFixed(2)),
      saldo_anterior: Number(Number(movimento.saldoAnterior || 0).toFixed(2)),
      saldo_atual: Number(Number(movimento.saldoApos || 0).toFixed(2)),
      observacao: `Definir saldo atual para ${formatarMoedaBRFinanceiro(saldoDesejado)}: ${motivo}`,
      funcionario_id: funcionarioConfirmado.id,
      funcionario_nome: funcionarioConfirmado.nome || 'Funcionário',
      empresa_id: conta?.empresa_id || usuarioSistemaLogado?.empresa_id || null,
      loja_id: conta?.loja_id || usuarioSistemaLogado?.loja_id || null,
    }]);

  if (erroAuditoria) {
    if (btnSalvar) btnSalvar.disabled = false;
    setMsg('ajusteSaldoMsg', `Saldo alterado, mas não foi possível registrar a auditoria: ${mensagemErroSupabase(erroAuditoria, 'erro desconhecido')}`, 'err');
    return;
  }

  if (btnSalvar) btnSalvar.disabled = false;
  fecharModalAjusteSaldoCofre();
  abrirPagina('financeiro_cofre', document.querySelector('.nav-btn[data-page="financeiro_cofre"]'));
  await carregarContasFinanceiras({ render: false, silencioso: true });
  await carregarCofreFinanceiro();
  setMsg('msgCofreFinanceiro', `Saldo definido: ${conta?.nome || 'conta'} agora está em ${formatarMoedaBRFinanceiro(saldoDesejado)}.`, 'ok');
}

async function salvarTransferenciaSaldoCofre() {
  const btnSalvar = document.getElementById('btnSalvarAjusteSaldoCofre');
  if (btnSalvar?.disabled) return;

  const contaOrigemId = String(document.getElementById('ajusteSaldoContaSelect')?.value || '').trim();
  const contaDestinoId = String(document.getElementById('transferenciaSaldoContaDestinoSelect')?.value || '').trim();
  const valorTexto = String(document.getElementById('ajusteSaldoValor')?.value || '').trim();
  const motivo = String(document.getElementById('ajusteSaldoMotivo')?.value || '').trim();
  const pin = String(document.getElementById('ajusteSaldoPin')?.value || '').trim();
  const valor = lerValorMonetarioFinanceiro(valorTexto);

  if (!contaOrigemId) {
    setMsg('ajusteSaldoMsg', 'Selecione a conta de origem.', 'err');
    return;
  }
  if (!contaDestinoId) {
    setMsg('ajusteSaldoMsg', 'Selecione a conta de destino.', 'err');
    return;
  }
  if (contaOrigemId === contaDestinoId) {
    setMsg('ajusteSaldoMsg', 'Origem e destino precisam ser contas diferentes.', 'err');
    return;
  }
  if (!Number.isFinite(valor) || valor <= 0) {
    setMsg('ajusteSaldoMsg', 'Informe um valor maior que zero.', 'err');
    return;
  }
  if (!motivo) {
    setMsg('ajusteSaldoMsg', 'Informe o motivo da transferência.', 'err');
    return;
  }
  if (!pin) {
    setMsg('ajusteSaldoMsg', 'Digite o PIN para confirmar.', 'err');
    return;
  }

  const funcionarioConfirmado = await obterFuncionarioAtivoPorPinEmpresa(pin);
  if (!funcionarioConfirmado?.id) {
    setMsg('ajusteSaldoMsg', 'PIN inválido ou funcionário inativo.', 'err');
    return;
  }

  const contaOrigem = (contasFinanceirasCache || []).find(item => String(item.id) === contaOrigemId) || null;
  const contaDestino = (contasFinanceirasCache || []).find(item => String(item.id) === contaDestinoId) || null;
  const nomeOrigem = contaOrigem?.nome || 'conta origem';
  const nomeDestino = contaDestino?.nome || 'conta destino';

  if (btnSalvar) btnSalvar.disabled = true;
  setMsg('ajusteSaldoMsg', 'Transferindo saldo...', '');

  const saida = await registrarMovimentacaoContaFinanceira({
    contaFinanceiraId: contaOrigemId,
    tipo: 'saida',
    valor,
    descricao: `Transferência para ${nomeDestino}: ${motivo}`,
  });
  if (saida.error) {
    if (btnSalvar) btnSalvar.disabled = false;
    setMsg('ajusteSaldoMsg', `Não foi possível debitar a origem: ${mensagemErroSupabase(saida.error, 'erro desconhecido')}`, 'err');
    return;
  }

  const entrada = await registrarMovimentacaoContaFinanceira({
    contaFinanceiraId: contaDestinoId,
    tipo: 'entrada',
    valor,
    descricao: `Transferência de ${nomeOrigem}: ${motivo}`,
  });
  if (entrada.error) {
    await registrarMovimentacaoContaFinanceira({
      contaFinanceiraId: contaOrigemId,
      tipo: 'entrada',
      valor,
      descricao: `Desfaz transferência para ${nomeDestino}: falha ao creditar destino`,
    });
    if (btnSalvar) btnSalvar.disabled = false;
    setMsg('ajusteSaldoMsg', `Não foi possível creditar o destino: ${mensagemErroSupabase(entrada.error, 'erro desconhecido')}`, 'err');
    return;
  }

  const auditoria = [
    {
      conta_financeira_id: contaOrigemId,
      tipo: 'saida',
      valor: Number(valor.toFixed(2)),
      saldo_anterior: Number(Number(saida.saldoAnterior || 0).toFixed(2)),
      saldo_atual: Number(Number(saida.saldoApos || 0).toFixed(2)),
      observacao: `Transferência para ${nomeDestino}: ${motivo}`,
      funcionario_id: funcionarioConfirmado.id,
      funcionario_nome: funcionarioConfirmado.nome || 'Funcionário',
      empresa_id: contaOrigem?.empresa_id || usuarioSistemaLogado?.empresa_id || null,
      loja_id: contaOrigem?.loja_id || usuarioSistemaLogado?.loja_id || null,
    },
    {
      conta_financeira_id: contaDestinoId,
      tipo: 'entrada',
      valor: Number(valor.toFixed(2)),
      saldo_anterior: Number(Number(entrada.saldoAnterior || 0).toFixed(2)),
      saldo_atual: Number(Number(entrada.saldoApos || 0).toFixed(2)),
      observacao: `Transferência de ${nomeOrigem}: ${motivo}`,
      funcionario_id: funcionarioConfirmado.id,
      funcionario_nome: funcionarioConfirmado.nome || 'Funcionário',
      empresa_id: contaDestino?.empresa_id || usuarioSistemaLogado?.empresa_id || null,
      loja_id: contaDestino?.loja_id || usuarioSistemaLogado?.loja_id || null,
    },
  ];

  const { error: erroAuditoria } = await sb
    .from('contas_financeiras_ajustes_saldo')
    .insert(auditoria);

  if (erroAuditoria) {
    if (btnSalvar) btnSalvar.disabled = false;
    setMsg('ajusteSaldoMsg', `Transferência feita, mas não foi possível registrar auditoria: ${mensagemErroSupabase(erroAuditoria, 'erro desconhecido')}`, 'err');
    return;
  }

  if (btnSalvar) btnSalvar.disabled = false;
  fecharModalAjusteSaldoCofre();
  abrirPagina('financeiro_cofre', document.querySelector('.nav-btn[data-page="financeiro_cofre"]'));
  await carregarContasFinanceiras({ render: false, silencioso: true });
  await carregarCofreFinanceiro();
  setMsg('msgCofreFinanceiro', `Transferência salva: ${formatarMoedaBRFinanceiro(valor)} de ${nomeOrigem} para ${nomeDestino}.`, 'ok');
}

function exportarExtratoCofreCsv() {
  const itens = Array.isArray(cofreMovimentacoesCache) ? cofreMovimentacoesCache : [];
  if (!itens.length) {
    setMsg('msgCofreFinanceiro', 'Não há movimentações no cofre para exportar.', 'err');
    return;
  }

  const cabecalho = ['Data', 'Conta', 'Tipo', 'Descricao', 'Pessoa', 'Forma', 'Valor', 'Saldo apos'];
  const linhas = itens.map(item => {
    const tipo = String(item.tipo || 'entrada').toLowerCase();
    const ehSaida = tipo === 'saida' || tipo === 'estorno';
    const pessoa = obterPessoaMovimentacaoCofre(item);
    const forma = obterFormaMovimentacaoCofre(item);
    const valor = (ehSaida ? -1 : 1) * (Number(item.valor || 0) || 0);
    return [
      String(item.created_at || '').slice(0, 10),
      item.contas_financeiras?.nome || '-',
      tipo,
      item.descricao || '-',
      pessoa,
      forma,
      valor.toFixed(2),
      (Number(item.saldo_apos || 0) || 0).toFixed(2),
    ].map(escaparCsvRelatorioFinanceiro).join(';');
  });

  const blob = new Blob([[cabecalho.map(escaparCsvRelatorioFinanceiro).join(';'), ...linhas].join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `extrato-cofre-${hoje()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  setMsg('msgCofreFinanceiro', 'Extrato do cofre exportado.', 'ok');
}

function exportarExtratoCofrePdf() {
  const itens = Array.isArray(cofreMovimentacoesCache) ? cofreMovimentacoesCache : [];
  if (!itens.length) {
    setMsg('msgCofreFinanceiro', 'Não há movimentações no cofre para exportar.', 'err');
    return;
  }

  const linhas = itens.map(item => {
    const tipo = String(item.tipo || 'entrada').toLowerCase();
    const ehSaida = tipo === 'saida' || tipo === 'estorno';
    const pessoa = obterPessoaMovimentacaoCofre(item);
    const forma = obterFormaMovimentacaoCofre(item);
    const valor = `${ehSaida ? '-' : '+'}${formatarMoedaBRFinanceiro(item.valor || 0)}`;
    return `
      <tr>
        <td>${escaparHtmlBasico(formatarDataBRFinanceiro(String(item.created_at || '').slice(0, 10)))}</td>
        <td>${escaparHtmlBasico(item.contas_financeiras?.nome || '-')}</td>
        <td>${escaparHtmlBasico(tipo)}</td>
        <td>${escaparHtmlBasico(item.descricao || '-')}</td>
        <td>${escaparHtmlBasico(pessoa)}</td>
        <td>${escaparHtmlBasico(forma)}</td>
        <td>${escaparHtmlBasico(valor)}</td>
        <td>${escaparHtmlBasico(formatarMoedaBRFinanceiro(item.saldo_apos || 0))}</td>
      </tr>
    `;
  }).join('');

  const inicio = document.getElementById('filtroCofreDataInicio')?.value || '-';
  const fim = document.getElementById('filtroCofreDataFim')?.value || '-';
  const janela = window.open('', '_blank', 'width=1100,height=760');
  if (!janela) {
    setMsg('msgCofreFinanceiro', 'O navegador bloqueou a janela de impressão. Libere pop-ups para exportar o PDF.', 'err');
    return;
  }

  janela.document.write(`
    <html>
      <head>
        <title>Extrato do Cofre</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; color: #111; }
          h1 { margin: 0 0 8px; font-size: 22px; }
          .meta { margin-bottom: 14px; font-size: 12px; color: #444; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #ddd; padding: 6px; text-align: left; vertical-align: top; }
          th { background: #f5f5f5; }
        </style>
      </head>
      <body>
        <h1>Extrato do Cofre</h1>
        <div class="meta">Período: ${escaparHtmlBasico(inicio)} até ${escaparHtmlBasico(fim)} · Gerado em ${escaparHtmlBasico(new Date().toLocaleString('pt-BR'))}</div>
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Conta</th>
              <th>Tipo</th>
              <th>Descrição</th>
              <th>Pessoa</th>
              <th>Forma</th>
              <th>Valor</th>
              <th>Saldo após</th>
            </tr>
          </thead>
          <tbody>${linhas}</tbody>
        </table>
      


</body>
    </html>
  `);
  janela.document.close();
  janela.focus();
  janela.print();
  setMsg('msgCofreFinanceiro', 'PDF do cofre preparado para impressão.', 'ok');
}


// ══════════════════════════════════════════════════════════════════
