// MULTI-LOJA SEGURO PARA PONTO / AJUSTES
// Regra: qualquer lista/validação de funcionário usada no ponto precisa respeitar a loja logada.
// Isso evita que funcionários de loja desativada/de teste apareçam no Zuqui Café.
//
function obterLojaIdAtualParaPontoSeguro() {
  try {
    const idSessao = String((typeof obterLojaIdSessao === 'function' ? obterLojaIdSessao() : '') || '').trim();
    if (idSessao) return idSessao;
  } catch (_) {}
  try {
    const idUsuario = String(usuarioSistemaLogado?.loja_id || usuarioSistemaLogado?.lojaId || '').trim();
    if (idUsuario) return idUsuario;
  } catch (_) {}
  try {
    if (typeof lojaIdAtual === 'function') {
      const idLojaAtual = String(lojaIdAtual() || '').trim();
      if (idLojaAtual) return idLojaAtual;
    }
  } catch (_) {}
  try {
    const raw = localStorage.getItem('zuqui_usuario_logado') || localStorage.getItem('usuarioSistemaLogado') || localStorage.getItem('usuario_logado') || 'null';
    const sessao = JSON.parse(raw);
    const idStorage = String(sessao?.loja_id || sessao?.lojaId || '').trim();
    if (idStorage) return idStorage;
  } catch (_) {}
  return '';
}

function aplicarFiltroLojaAtualPontoQuery(query) {
  const lojaId = obterLojaIdAtualParaPontoSeguro();
  if (lojaId && query && typeof query.eq === 'function') {
    return query.eq('loja_id', lojaId);
  }
  return query;
}

function criarConsultaPontoComLojaExplicita(criadorConsulta) {
  if (typeof criadorConsulta !== 'function') return null;
  if (typeof filtroLojaSuspensoTemporariamente === 'undefined') return criadorConsulta();
  const estadoAnterior = filtroLojaSuspensoTemporariamente;
  filtroLojaSuspensoTemporariamente = true;
  try {
    // Apenas a criação do builder ocorre sem o filtro automático. O estado é
    // restaurado antes de qualquer requisição assíncrona e a loja será aplicada
    // uma única vez, explicitamente, pelo chamador.
    return criadorConsulta();
  } finally {
    filtroLojaSuspensoTemporariamente = estadoAnterior;
  }
}

function funcionarioPertenceLojaAtualPonto(funcionario) {
  const lojaId = obterLojaIdAtualParaPontoSeguro();
  if (!lojaId) return true;
  return String(funcionario?.loja_id || '').trim() === lojaId;
}

//
// PONTO ELETRÔNICO
//
async function carregarFuncionariosAtivosPonto() {
  let query = sb
    .from('funcionarios')
    .select('id, nome, tempo_intervalo_minutos, horario_trabalho_inicio, horario_trabalho_fim, loja_id, empresa_id')
    .eq('ativo', true);

  query = aplicarFiltroLojaAtualPontoQuery(query);
  const { data, error } = await query.order('nome');

  if (error) throw error;
  const funcionarios = (data || []).filter(funcionarioPertenceLojaAtualPonto);
  relatorioPontoFuncionarioCache = Object.fromEntries(funcionarios.map(item => [String(item.id), item.nome]));
  return funcionarios;
}

function obterChaveAlertaEntradaPonto(funcionarioId = '', dataIso = hoje()) {
  return `zuqui_alerta_entrada_ponto:${dataIso}:${String(funcionarioId || '').trim()}`;
}

function alertaEntradaPontoFoiFechado(funcionarioId = '', dataIso = hoje()) {
  try {
    return sessionStorage.getItem(obterChaveAlertaEntradaPonto(funcionarioId, dataIso)) === '1';
  } catch (_) {
    return false;
  }
}

function marcarAlertaEntradaPontoFechado(funcionarioId = '', dataIso = hoje()) {
  try {
    sessionStorage.setItem(obterChaveAlertaEntradaPonto(funcionarioId, dataIso), '1');
  } catch (_) {}
}

function abrirAlertaEntradaPonto(pendentes = []) {
  const overlay = document.getElementById('pontoEntradaAlertaOverlay');
  const lista = document.getElementById('pontoEntradaAlertaLista');
  if (!overlay || !lista || !pendentes.length) return;

  alertasEntradaPontoPendentesAtuais = pendentes;
  lista.innerHTML = pendentes.map(item => {
    const nome = escaparHtmlBasico(item.nome || 'Funcionário').toUpperCase();
    const horario = escaparHtmlBasico(horaCurta(item.horario_trabalho_inicio || '') || '--:--');
    return `<div class="ponto-entrada-alerta-item">${nome} BATER PONTO <span style="font-size:13px;font-weight:700;color:#fecaca">(${horario})</span></div>`;
  }).join('');
  overlay.hidden = false;
}

function fecharAlertaEntradaPonto() {
  const dataHoje = hoje();
  alertasEntradaPontoPendentesAtuais.forEach(item => {
    if (item?.id) marcarAlertaEntradaPontoFechado(item.id, dataHoje);
  });
  alertasEntradaPontoPendentesAtuais = [];
  const overlay = document.getElementById('pontoEntradaAlertaOverlay');
  if (overlay) overlay.hidden = true;
}

async function verificarAlertaEntradaPonto() {
  if (!usuarioSistemaLogado || obterPaginaAtivaAtual() !== 'bater_ponto') return;

  const agoraMinutos = horarioParaMinutos(agoraHoraMinuto());
  if (agoraMinutos === null) return;

  const funcionarioRestritoId = obterFuncionarioRestritoLogadoIdParaPonto();
  let queryFuncionarios = sb
    .from('funcionarios')
    .select('id, nome, horario_trabalho_inicio, loja_id')
    .eq('ativo', true)
    .not('horario_trabalho_inicio', 'is', null);

  queryFuncionarios = aplicarFiltroLojaAtualPontoQuery(queryFuncionarios);

  if (funcionarioRestritoId) {
    queryFuncionarios = queryFuncionarios.eq('id', funcionarioRestritoId);
  }

  const { data: funcionarios, error: erroFuncionarios } = await queryFuncionarios.order('nome');
  if (erroFuncionarios) {
    if (!isMissingWorkShiftColumnsError(erroFuncionarios)) {
      console.warn('Não foi possível verificar alerta de entrada do ponto:', erroFuncionarios);
    }
    return;
  }

  const candidatos = (funcionarios || []).filter(funcionario => {
    const inicio = horarioParaMinutos(funcionario.horario_trabalho_inicio);
    if (inicio === null) return false;
    if (agoraMinutos < Math.max(0, inicio - 5)) return false;
    return !alertaEntradaPontoFoiFechado(funcionario.id);
  });
  if (!candidatos.length) return;

  const dataHoje = hoje();
  const { data: registros, error: erroRegistros } = await sb
    .from('ponto_registros')
    .select('funcionario_id, entrada_em')
    .eq('data_ponto', dataHoje)
    .in('funcionario_id', candidatos.map(item => item.id));

  if (erroRegistros) {
    if (!isMissingTimeClockTableError(erroRegistros)) {
      console.warn('Não foi possível verificar entradas registradas no ponto:', erroRegistros);
    }
    return;
  }

  const comEntrada = new Set((registros || [])
    .filter(item => item.entrada_em)
    .map(item => String(item.funcionario_id || '')));
  const pendentes = candidatos.filter(item => !comEntrada.has(String(item.id)));

  if (pendentes.length) {
    abrirAlertaEntradaPonto(pendentes);
  }
}

function preencherSelectFuncionariosPonto(selectEl, funcionarios = [], {
  placeholder = '- Selecione o funcionário -',
  incluirTodos = false,
} = {}) {
  if (!selectEl) return;
  if (selectEl.classList?.contains('relatorio-check-filter')) {
    const selecionadosAtuais = obterValoresCheckboxFiltroRelatorioFinanceiro(selectEl.id);
    const opcoes = (funcionarios || [])
      .map(item => ({ valor: String(item.id || '').trim(), rotulo: String(item.nome || 'Funcionário').trim() || 'Funcionário' }))
      .filter(item => item.valor);
    renderizarCheckboxFiltroRelatorioFinanceiro(selectEl.id, opcoes, selecionadosAtuais);
    return;
  }
  const valorAtual = String(selectEl.value || '');
  selectEl.innerHTML = '';

  const opcaoInicial = document.createElement('option');
  opcaoInicial.value = '';
  opcaoInicial.textContent = incluirTodos ? '- Todos os funcionários -' : placeholder;
  selectEl.appendChild(opcaoInicial);

  funcionarios.forEach(item => {
    const opt = document.createElement('option');
    opt.value = item.id;
    opt.textContent = item.nome;
    opt.dataset.lojaId = String(item.loja_id || '').trim();
    opt.dataset.empresaId = String(item.empresa_id || '').trim();
    selectEl.appendChild(opt);
  });

  const existeValor = funcionarios.some(item => String(item.id) === valorAtual);
  selectEl.value = existeValor ? valorAtual : '';
}

async function carregarSelectFuncionariosPonto() {
  const [selPonto, selRelatorio, selAdminAjuste] = [
    document.getElementById('pontoFuncionarioSelect'),
    document.getElementById('filtroPontoFuncionario'),
    document.getElementById('adminAjustePontoFuncionario'),
  ];

  try {
    let funcionarios = await carregarFuncionariosAtivosPonto();
    const funcionarioRestritoId = obterFuncionarioRestritoLogadoIdParaPonto();
    if (funcionarioRestritoId) {
      funcionarios = funcionarios.filter(item => String(item.id) === funcionarioRestritoId);
    }

    preencherSelectFuncionariosPonto(selPonto, funcionarios, { placeholder: '- Selecione o funcionário -' });
    preencherSelectFuncionariosPonto(selRelatorio, funcionarios, { incluirTodos: !funcionarioRestritoId });
    preencherSelectFuncionariosPonto(selAdminAjuste, funcionarios, { placeholder: '- Selecione o funcionário -' });
    preencherSelectTempoAvisoPonto(funcionarios);
    atualizarCardTempoAvisoPonto();

    if (funcionarioRestritoId) {
      if (selPonto) {
        selPonto.value = funcionarioRestritoId;
        selPonto.disabled = true;
      }
      if (selRelatorio) {
        if (selRelatorio.classList?.contains('relatorio-check-filter')) {
          renderizarCheckboxFiltroRelatorioFinanceiro('filtroPontoFuncionario', funcionarios.map(item => ({ valor: String(item.id || ''), rotulo: item.nome || 'Funcionário' })), [funcionarioRestritoId]);
        } else {
          selRelatorio.value = funcionarioRestritoId;
          selRelatorio.disabled = true;
        }
      }
      if (selAdminAjuste) {
        selAdminAjuste.value = funcionarioRestritoId;
        selAdminAjuste.disabled = true;
      }
    } else {
      if (selPonto) selPonto.disabled = false;
      if (selRelatorio && !selRelatorio.classList?.contains('relatorio-check-filter')) selRelatorio.disabled = false;
      if (selAdminAjuste) selAdminAjuste.disabled = false;
      if (selPonto && !selPonto.value && usuarioSistemaLogado?.tipo === 'funcionario' && usuarioSistemaLogado?.id) {
        selPonto.value = String(usuarioSistemaLogado.id);
      }
    }
  } catch (error) {
    console.warn('Não foi possível carregar os funcionários do ponto:', error);
  }
}

function obterIntervaloDatasPorPeriodo(periodo = 'dia', referencia = new Date()) {
  const base = referencia instanceof Date ? referencia : new Date(referencia);
  const hojeLocal = dataLocalISO(base);

  if (periodo === 'ano') {
    const inicio = dataLocalISO(new Date(base.getFullYear(), 0, 1));
    const fim = dataLocalISO(new Date(base.getFullYear(), 11, 31));
    return { inicio, fim, info: `Período: ${inicio} até ${fim}.` };
  }
  if (periodo === 'mes') {
    const inicio = dataLocalISO(new Date(base.getFullYear(), base.getMonth(), 1));
    const fim = dataLocalISO(new Date(base.getFullYear(), base.getMonth() + 1, 0));
    return { inicio, fim, info: `Período: ${inicio} até ${fim}.` };
  }
  if (periodo === 'ontem') {
    const ontem = new Date(base);
    ontem.setDate(base.getDate() - 1);
    const dataOntem = dataLocalISO(ontem);
    return { inicio: dataOntem, fim: dataOntem, info: `Período: ${dataOntem} (ontem).` };
  }
  if (periodo === 'semana') {
    const diaSemana = base.getDay();
    const deslocamentoSegunda = diaSemana === 0 ? -6 : 1 - diaSemana;
    const inicioData = new Date(base);
    inicioData.setDate(base.getDate() + deslocamentoSegunda);
    const fimData = new Date(inicioData);
    fimData.setDate(inicioData.getDate() + 6);
    const inicio = dataLocalISO(inicioData);
    const fim = dataLocalISO(fimData);
    return { inicio, fim, info: `Período: ${inicio} até ${fim}.` };
  }
  return { inicio: hojeLocal, fim: hojeLocal, info: `Período: ${hojeLocal}.` };
}

async function carregarRegistrosPontoComIntervalos({ inicio = '', fim = '', funcionarioId = '' } = {}) {
  let query = sb
    .from('ponto_registros')
    .select('id, funcionario_id, data_ponto, entrada_em, inicio_intervalo_em, retorno_intervalo_em, saida_em, created_at, loja_id, empresa_id')
    .order('data_ponto', { ascending: false })
    .order('entrada_em', { ascending: false });

  if (inicio) query = query.gte('data_ponto', inicio);
  if (fim) query = query.lte('data_ponto', fim);
  if (funcionarioId) query = query.eq('funcionario_id', funcionarioId);

  const { data, error } = await query;
  if (error) throw error;

  let rows = data || [];

  if (inicio && fim && inicio === fim) {

      rows = await complementarRegistrosPontoSemFiltroLoja(rows, {
        inicio,
        fim,
        funcionarioId,
        campos: 'id, funcionario_id, data_ponto, entrada_em, inicio_intervalo_em, retorno_intervalo_em, saida_em, created_at, loja_id, empresa_id',
      });

      if (inicio && fim && inicio === fim) {
        rows = await complementarRegistrosPontoSemFiltroLojaPorCreatedAtDia(rows, {
          diaIso: inicio,
          funcionarioId,
          campos: 'id, funcionario_id, data_ponto, entrada_em, inicio_intervalo_em, retorno_intervalo_em, saida_em, created_at, loja_id, empresa_id',
        });
      }
    const { inicioUtc, fimUtc } = obterJanelaUtcDiaBrasil(inicio);
    if (inicioUtc && fimUtc) {
      const { data: dataFallback, error: errorFallback } = await executarSemFiltroLojaTemporario(() => {
        let queryFallback = sb
        .from('ponto_registros')
        .select('id, funcionario_id, data_ponto, entrada_em, inicio_intervalo_em, retorno_intervalo_em, saida_em, created_at, loja_id, empresa_id, funcionarios!inner(id,nome,loja_id,empresa_id)')
        .gte('created_at', inicioUtc)
        .lt('created_at', fimUtc)
        .order('created_at', { ascending: false });
        const lojaIdSessao = String(obterLojaIdSessao?.() || usuarioSistemaLogado?.loja_id || '').trim();
        if (lojaIdSessao) queryFallback = queryFallback.eq('funcionarios.loja_id', lojaIdSessao);
        if (funcionarioId) queryFallback = queryFallback.eq('funcionario_id', funcionarioId);
        return queryFallback;
      });
      if (errorFallback) {
        console.warn('Não foi possível aplicar fallback por created_at no ponto:', errorFallback);
      } else {
        rows = mesclarRegistrosPontoPorId(rows, dataFallback || []);
      }
    }
  }
  const funcionarioIds = [...new Set(rows.map(item => item.funcionario_id).filter(Boolean).map(String))];
  const nomesPorFuncionario = {};

  if (funcionarioIds.length) {
    const { data: funcionariosData, error: funcionariosError } = await sb
      .from('funcionarios')
      .select('id, nome')
      .in('id', funcionarioIds);

    if (!funcionariosError) {
      (funcionariosData || []).forEach(func => {
        nomesPorFuncionario[String(func.id)] = func.nome || 'Funcionário';
      });
    } else {
      console.warn('Não foi possível carregar nomes dos funcionários para o resumo de horas:', funcionariosError);
    }
  }

  rows = await filtrarRegistrosPontoPorFuncionariosVisiveis(rows, funcionarioId);

  rows = rows.map(item => ({
    ...item,
    funcionarios: {
      nome: nomesPorFuncionario[String(item.funcionario_id)] || relatorioPontoFuncionarioCache[String(item.funcionario_id)] || 'Funcionário',
    },
  }));

  const ids = rows.map(item => item.id).filter(Boolean);
  const intervalosPorRegistro = {};

  if (ids.length) {
    const { data: intervalosData, error: intervalosError } = await sb
      .from('ponto_intervalos')
      .select('id, ponto_registro_id, ordem, inicio_em, retorno_em')
      .in('ponto_registro_id', ids)
      .order('ordem', { ascending: true });

    if (intervalosError && !isMissingTimeClockIntervalsTableError(intervalosError)) throw intervalosError;

    (intervalosData || []).forEach(item => {
      const chave = String(item.ponto_registro_id);
      if (!intervalosPorRegistro[chave]) intervalosPorRegistro[chave] = [];
      intervalosPorRegistro[chave].push(item);
    });
  }

  return rows.map(item => ({
    ...item,
    intervalos_ponto: intervalosPorRegistro[String(item.id)] || [],
  }));
}
function calcularResumoHorasPorFuncionario(rows = []) {
  const mapa = {};
  rows.forEach(item => {
    const resumo = obterResumoJornadaPonto(item, item.intervalos_ponto || []);
    const chave = String(item.funcionario_id || 'sem-funcionario');
    if (!mapa[chave]) {
      mapa[chave] = {
        funcionarioId: chave,
        nome: item.funcionarios?.nome || relatorioPontoFuncionarioCache[chave] || (chave === 'sem-funcionario' ? 'Não identificado' : 'Funcionário'),
        minutos: 0,
      };
    }
    mapa[chave].minutos += resumo.totalMinutos || 0;
  });

  const lista = Object.values(mapa)
    .filter(item => item.minutos > 0)
    .sort((a, b) => b.minutos - a.minutos);
  const totalMinutos = lista.reduce((acc, item) => acc + item.minutos, 0);

  const participacao = distribuirPercentuaisFuncionarios(
    lista.map(item => ({ nome: item.nome, quantidade: item.minutos })),
    totalMinutos,
  ).map((item, idx) => ({
    ...item,
    minutos: lista[idx]?.minutos || 0,
  }));

  return { totalMinutos, participacao, colaboradores: lista.length };
}

function renderizarParticipacaoHoras({ listId, pieId, valueId, labelId, infoId, participacao = [], totalMinutos = 0, info = 'Período atual.' }) {
  const pie = document.getElementById(pieId);
  const value = document.getElementById(valueId);
  const label = document.getElementById(labelId);
  const infoEl = document.getElementById(infoId);
  const listaEl = document.getElementById(listId);

  if (infoEl) infoEl.textContent = info;

  if (!participacao.length || totalMinutos <= 0) {
    if (pie) pie.style.background = 'conic-gradient(rgba(107,143,112,0.25) 0deg 360deg)';
    if (value) value.textContent = '0h';
    if (label) label.textContent = 'Sem horas';
    if (listaEl) listaEl.innerHTML = '<div class="empty">Sem dados para o período.</div>';
    return;
  }

  let acumulado = 0;
  const faixas = participacao.map((item, idx) => {
    const inicio = acumulado;
    acumulado += item.percentualPizza;
    const fim = idx === participacao.length - 1 ? 100 : acumulado;
    return `${item.cor} ${inicio}% ${fim}%`;
  });

  if (pie) pie.style.background = `conic-gradient(${faixas.join(', ')})`;
  if (value) value.textContent = `${Math.floor(totalMinutos / 60)}h`;
  if (label) label.textContent = 'Total';

  if (listaEl) {
    listaEl.innerHTML = participacao.map(item => `
      <div class="prod-func-row">
        <div class="prod-func-left">
          <span class="prod-func-dot" style="background:${item.cor || 'var(--green)'}"></span>
          <div class="prod-func-name">${item.nome}</div>
        </div>
        <div class="prod-func-pct">${formatarDuracaoMinutos(item.minutos)} · ${item.percentual}%</div>
      </div>
    `).join('');
  }
}

function trocarPeriodoHorasDashboard(periodo, botao = null) {
  dashboardHorasPeriodo = periodo;
  document.querySelectorAll('.dashboard-period-btn[data-horas-periodo]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.horasPeriodo === periodo);
  });
  if (botao) botao.classList.add('active');
  carregarHorasDashboard();
}

async function carregarHorasDashboard() {
  const msgId = 'dash-horas-msg';
  const requestSeq = ++dashboardHorasRequestSeq;
  setMsg(msgId, '', '');
  try {
    const { inicio, fim, info } = obterIntervaloDatasPorPeriodo(dashboardHorasPeriodo || 'dia');
    const chaveResultado = [
      String(obterEmpresaIdSessao?.() || usuarioSistemaLogado?.empresa_id || ''),
      String(obterLojaIdSessao?.() || usuarioSistemaLogado?.loja_id || ''),
      String(dashboardHorasPeriodo || 'dia'),
      String(inicio || ''),
      String(fim || ''),
    ].join('|');
    const funcionarioRestritoId = obterFuncionarioRestritoLogadoIdParaPonto();
    const rows = await carregarRegistrosPontoComIntervalos({ inicio, fim, funcionarioId: funcionarioRestritoId || '' });
    if (requestSeq !== dashboardHorasRequestSeq) return;
    const resumo = calcularResumoHorasPorFuncionario(rows);
    const ultimoValido = dashboardHorasUltimoResultadoValido;
    const devePreservarUltimoValido = resumo.totalMinutos <= 0
      && ultimoValido
      && ultimoValido.chave === chaveResultado
      && Date.now() - ultimoValido.em < 15000;
    const resumoRender = devePreservarUltimoValido ? ultimoValido.resumo : resumo;

    if (resumo.totalMinutos > 0 || resumo.colaboradores > 0) {
      dashboardHorasUltimoResultadoValido = { chave: chaveResultado, resumo, em: Date.now() };
    }

    renderizarParticipacaoHoras({
      listId: 'horasFuncionariosListaDashboard',
      pieId: 'horasPieDashboard',
      valueId: 'horasPieValorDashboard',
      labelId: 'horasPieLabelDashboard',
      infoId: 'horasInfoDashboard',
      participacao: resumoRender.participacao,
      totalMinutos: resumoRender.totalMinutos,
      info,
    });

    const totalEl = document.getElementById('horasTotalDashboard');
    const colEl = document.getElementById('horasColaboradoresDashboard');
    if (totalEl) totalEl.textContent = formatarDuracaoMinutos(resumoRender.totalMinutos);
    if (colEl) colEl.textContent = String(resumoRender.colaboradores);
  } catch (error) {
    if (requestSeq !== dashboardHorasRequestSeq) return;
    console.error('Erro ao carregar horas do dashboard:', error);
    renderizarParticipacaoHoras({
      listId: 'horasFuncionariosListaDashboard',
      pieId: 'horasPieDashboard',
      valueId: 'horasPieValorDashboard',
      labelId: 'horasPieLabelDashboard',
      infoId: 'horasInfoDashboard',
      participacao: [],
      totalMinutos: 0,
      info: 'Período indisponível.',
    });
    setMsg(msgId, 'Não foi possível carregar as horas trabalhadas.', 'err');
  }
}

function trocarPeriodoRelatorioPonto(periodo, botao = null) {
  relatorioPontoPeriodo = periodo;
  document.querySelectorAll('.dashboard-period-btn[data-rel-ponto-periodo]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.relPontoPeriodo === periodo);
  });
  if (botao) botao.classList.add('active');

  const { inicio, fim } = obterIntervaloDatasPorPeriodo(periodo || 'dia');
  const dataInicio = document.getElementById('filtroPontoDataInicio');
  const dataFim = document.getElementById('filtroPontoDataFim');
  if (dataInicio) dataInicio.value = inicio;
  if (dataFim) dataFim.value = fim;
  carregarRelatorioPonto();
}

function formatarHoraPonto(valor) {
  if (!valor) return '-';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '-';
  return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatarDataPonto(valor) {
  if (!valor) return '-';
  const data = new Date(`${valor}T00:00:00`);
  if (Number.isNaN(data.getTime())) return '-';
  return data.toLocaleDateString('pt-BR');
}

function obterStatusRegistroPonto(registro) {
  if (!registro) return 'Sem registro no dia';
  if (registro.entrada_em && !registro.saida_em) return 'Em jornada';
  if (registro.entrada_em && registro.saida_em) return 'Fechado';
  return 'Sem registro no dia';
}

async function obterIntervalosPontoDoRegistro(registroId) {
  if (!registroId) return [];
  const { data, error } = await sb
    .from('ponto_intervalos')
    .select('id, ponto_registro_id, ordem, inicio_em, retorno_em')
    .eq('ponto_registro_id', registroId)
    .order('ordem', { ascending: true })
    .order('inicio_em', { ascending: true });

  if (error) {
    if (isMissingTimeClockIntervalsTableError(error)) return [];
    throw error;
  }
  return data || [];
}

function obterIntervaloAberto(intervalos = []) {
  return [...intervalos].reverse().find(item => item.inicio_em && !item.retorno_em) || null;
}

function proximaOrdemIntervalo(intervalos = []) {
  const maior = intervalos.reduce((max, item) => Math.max(max, Number(item.ordem || 0)), 0);
  return maior + 1;
}

function montarResumoIntervalos(intervalos = []) {
  if (!intervalos.length) return 'Intervalos: nenhum registrado';
  const texto = intervalos.map(item => {
    const n = item.ordem || '-';
    const duracao = calcularDuracaoIntervaloPonto(item);
    const duracaoTexto = duracao !== null ? ` (${formatarDuracaoMinutos(duracao)})` : '';
    return `#${n} ${formatarHoraPonto(item.inicio_em)} - ${formatarHoraPonto(item.retorno_em)}${duracaoTexto}`;
  }).join(' · ');
  return `Intervalos: ${texto}`;
}

function calcularDuracaoIntervaloPonto(intervalo = {}) {
  if (!intervalo?.inicio_em || !intervalo?.retorno_em) return null;
  const inicioMs = new Date(intervalo.inicio_em).getTime();
  const retornoMs = new Date(intervalo.retorno_em).getTime();
  if (Number.isNaN(inicioMs) || Number.isNaN(retornoMs) || retornoMs <= inicioMs) return null;
  return Math.floor((retornoMs - inicioMs) / 60000);
}

function obterIntervalosOrdenadosPonto(intervalos = []) {
  return [...(intervalos || [])].sort((a, b) => {
    const ordemA = Number(a.ordem || 0);
    const ordemB = Number(b.ordem || 0);
    const inicioA = new Date(a.inicio_em || 0).getTime();
    const inicioB = new Date(b.inicio_em || 0).getTime();
    return (ordemA - ordemB) || (inicioA - inicioB);
  });
}

function formatarDuracaoMinutos(totalMinutos = 0) {
  const minutos = Math.max(0, Number(totalMinutos || 0));
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return `${String(horas).padStart(2, '0')}:${String(resto).padStart(2, '0')}`;
}

function formatarMinutosIntervaloPonto(totalMinutos = 0) {
  const minutos = Math.max(0, Math.ceil(Number(totalMinutos || 0)));
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto ? `${horas}h ${resto}min` : `${horas}h`;
}


function batidaPontoProximaDoFimDoTurno(funcionario = {}, referenciaIso = null, janelaAntesMinutos = 90, janelaDepoisMinutos = 180) {
  const fim = horarioParaMinutos(horaCurta(funcionario?.horario_trabalho_fim || ''));
  if (fim === null) return false;

  const referencia = referenciaIso ? new Date(referenciaIso) : new Date();
  if (Number.isNaN(referencia.getTime())) return false;

  const minutosReferencia = (referencia.getHours() * 60) + referencia.getMinutes();
  let diff = minutosReferencia - fim;

  // Ajuste para turnos que viram o dia.
  if (diff < -720) diff += 1440;
  if (diff > 720) diff -= 1440;

  return diff >= -Number(janelaAntesMinutos || 0) && diff <= Number(janelaDepoisMinutos || 0);
}

function deveIniciarIntervaloPonto({ funcionario = {}, intervalos = [], registro = null, referenciaIso = null } = {}) {
  const lista = Array.isArray(intervalos) ? intervalos : [];
  const intervalosConcluidos = lista.filter(item => item?.inicio_em && item?.retorno_em).length;
  const possuiIntervaloAberto = lista.some(item => item?.inicio_em && !item?.retorno_em);
  if (possuiIntervaloAberto) return false;

  // Regra atual operacional:
  // 1ª batida abre jornada.
  // 2ª batida inicia o intervalo principal, exceto se já estiver perto do fim do turno.
  // 3ª batida retorna do intervalo.
  // 4ª batida fecha o expediente.
  // Regras com intervalos extras serão tratadas futuramente pela tela de Escala de Trabalho.
  if (intervalosConcluidos >= 1) return false;
  if (batidaPontoProximaDoFimDoTurno(funcionario, referenciaIso || registro?.saida_em || null)) return false;
  return true;
}

function obterResumoRetornoIntervaloPonto(intervaloAberto = null, tempoMinimoMinutos = 0) {
  const tempo = Number(tempoMinimoMinutos || 0);
  if (!intervaloAberto?.inicio_em || !tempo || tempo <= 0) return null;
  const inicioMs = new Date(intervaloAberto.inicio_em).getTime();
  if (Number.isNaN(inicioMs)) return null;
  const retornoPrevistoMs = inicioMs + (tempo * 60000);
  const diffMs = retornoPrevistoMs - Date.now();
  return {
    tempoMinimo: tempo,
    retornoPrevisto: new Date(retornoPrevistoMs).toISOString(),
    retornoPrevistoMs,
    texto: formatarTempoRegressivoPonto(diffMs),
    atrasado: diffMs <= 0,
  };
}

function falarAvisoRetornoIntervaloPonto(nomeFuncionario = '') {
  if (!('speechSynthesis' in window)) return;
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    const nome = String(nomeFuncionario || 'funcionário').trim();
    const utter = new SpeechSynthesisUtterance(`Retorno de intervalo atrasado. ${nome}.`);
    utter.lang = 'pt-BR';
    utter.volume = 1;
    utter.rate = 1.03;
    utter.pitch = 1.05;
    const vozes = synth.getVoices ? synth.getVoices() : [];
    const vozPtBr = vozes.find(v => (v.lang || '').toLowerCase().startsWith('pt-br'))
      || vozes.find(v => (v.lang || '').toLowerCase().startsWith('pt'))
      || null;
    if (vozPtBr) utter.voice = vozPtBr;
    synth.speak(utter);
  } catch (e) {}
}

function dispararAvisoRetornoIntervaloPonto(el, retornoMs) {
  try {
    if (!el || !retornoMs) return;
    const linha = el.closest('.ponto-resumo-linha');
    const nome = linha?.querySelector('.ponto-resumo-nome')?.textContent?.trim() || 'FUNCIONÁRIO';
    const chave = `checkdiario:aviso-retorno-intervalo:${retornoMs}:${nome}`;
    const ultimoAviso = Number(localStorage.getItem(chave) || 0);
    const agoraMs = Date.now();
    // Depois que atrasar, repete no máximo a cada 10 minutos.
    if (ultimoAviso && (agoraMs - ultimoAviso) < 10 * 60 * 1000) return;
    localStorage.setItem(chave, String(agoraMs));

    const horario = formatarHora(new Date(retornoMs).toISOString());
    const mensagem = `RETORNO DE INTERVALO ATRASADO: ${nome.toUpperCase()} deveria retornar às ${horario}.`;
    setMsg('msgPonto', mensagem, 'err');
    try { tocarSomNovaTarefaChecklist(); } catch (e) {}
    window.setTimeout(() => falarAvisoRetornoIntervaloPonto(nome), 250);
  } catch (e) {
    console.warn('Falha ao disparar aviso de retorno de intervalo:', e);
  }
}

function atualizarContadoresRetornoIntervaloPonto() {
  document.querySelectorAll('[data-retorno-intervalo-ms]').forEach(el => {
    const retornoMs = Number(el.getAttribute('data-retorno-intervalo-ms') || 0);
    if (!retornoMs) return;
    const diffMs = retornoMs - Date.now();
    el.textContent = formatarTempoRegressivoPonto(diffMs);
    const atrasado = diffMs <= 0;
    const card = el.closest('.ponto-retorno-destaque');
    if (card) card.classList.toggle('atrasado', atrasado);
    el.style.color = atrasado ? '#fca5a5' : '#ef4444';
    if (atrasado) dispararAvisoRetornoIntervaloPonto(el, retornoMs);
  });
}

function iniciarContadorRetornoIntervaloPonto() {
  if (intervaloContadorRetornoPonto) {
    clearInterval(intervaloContadorRetornoPonto);
    intervaloContadorRetornoPonto = null;
  }
  atualizarContadoresRetornoIntervaloPonto();
  if (!document.querySelector('[data-retorno-intervalo-ms]')) return;
  intervaloContadorRetornoPonto = window.setInterval(atualizarContadoresRetornoIntervaloPonto, 1000);
}

function obterIntervalosConsolidadosPonto(registro = {}, intervalos = []) {
  const lista = [...(intervalos || [])]
    .filter(item => item && item.inicio_em)
    .map(item => ({
      ...item,
      inicio_em: item.inicio_em,
      retorno_em: item.retorno_em || null,
      ordem: Number(item.ordem || 0),
    }));

  if (registro?.inicio_intervalo_em) {
    const inicioPrincipal = String(registro.inicio_intervalo_em || '');
    const existePrincipal = lista.some(item => String(item.inicio_em || '') === inicioPrincipal);
    if (!existePrincipal) {
      lista.push({
        ponto_registro_id: registro.id || '',
        inicio_em: registro.inicio_intervalo_em,
        retorno_em: registro.retorno_intervalo_em || null,
        ordem: 1,
      });
    }
  }

  return lista
    .filter(item => {
      const inicioMs = new Date(item.inicio_em || 0).getTime();
      if (Number.isNaN(inicioMs)) return false;
      const entradaMs = registro?.entrada_em ? new Date(registro.entrada_em).getTime() : null;
      const saidaMs = registro?.saida_em ? new Date(registro.saida_em).getTime() : null;
      if (entradaMs && !Number.isNaN(entradaMs) && inicioMs < entradaMs) return false;
      if (saidaMs && !Number.isNaN(saidaMs)) {
        const retornoMs = item?.retorno_em ? new Date(item.retorno_em).getTime() : null;
        if (inicioMs >= saidaMs) return false;
        if (retornoMs && !Number.isNaN(retornoMs) && retornoMs > saidaMs) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const aTime = new Date(a.inicio_em || 0).getTime();
      const bTime = new Date(b.inicio_em || 0).getTime();
      return (aTime - bTime) || (Number(a.ordem || 0) - Number(b.ordem || 0));
    });
}

function obterResumoJornadaPonto(registro, intervalos = []) {
  if (!registro?.entrada_em) {
    return {
      status: 'Sem registro no dia',
      proximaAcao: 'Entrada',
      totalMinutos: 0,
      totalTexto: '00:00',
      ultimaSaidaEm: null,
    };
  }

  const lista = obterIntervalosConsolidadosPonto(registro, intervalos);
  const intervaloAberto = obterIntervaloAberto(lista);
  const ultimoRetorno = [...lista].reverse().find(item => item.retorno_em)?.retorno_em || null;
  const agoraIso = new Date().toISOString();
  const fimJornada = registro.saida_em || intervaloAberto?.inicio_em || ultimoRetorno || agoraIso;

  let totalMinutos = 0;
  if (fimJornada) {
    const entradaMs = new Date(registro.entrada_em).getTime();
    const fimMs = new Date(fimJornada).getTime();
    if (!Number.isNaN(entradaMs) && !Number.isNaN(fimMs) && fimMs > entradaMs) {
      const duracaoBrutaMin = Math.floor((fimMs - entradaMs) / 60000);
      const intervaloMin = lista.reduce((acc, item) => {
        if (!item.inicio_em || !item.retorno_em) return acc;
        const inicioMs = new Date(item.inicio_em).getTime();
        const retornoMs = new Date(item.retorno_em).getTime();
        if (Number.isNaN(inicioMs) || Number.isNaN(retornoMs) || retornoMs <= inicioMs) return acc;
        return acc + Math.floor((retornoMs - inicioMs) / 60000);
      }, 0);
      totalMinutos = Math.max(0, duracaoBrutaMin - intervaloMin);
    }
  }

  const jornadaFechada = !!registro.saida_em;
  const status = jornadaFechada
    ? 'Jornada fechada'
    : (intervaloAberto ? 'Fora (última batida: saída)' : 'Em jornada');
  const proximaAcao = jornadaFechada
    ? 'Entrada'
    : (intervaloAberto ? 'Retorno' : 'Saída');
  const ultimaSaidaEm = intervaloAberto?.inicio_em || registro.saida_em || null;

  return {
    status,
    proximaAcao,
    totalMinutos,
    totalTexto: formatarDuracaoMinutos(totalMinutos),
    ultimaSaidaEm,
  };
}

function checklistDentroJanelaAlerta(horario) {
  const contexto = obterContextoPrazo(horario, ANTECEDENCIA_ALERTA_CHECKLIST_MINUTOS);
  return contexto.ativo;
}


async function anexarNomesFuncionariosARegistrosPonto(rows = []) {
  const lista = Array.isArray(rows) ? rows : [];
  const ids = [...new Set(lista.map(item => item?.funcionario_id).filter(Boolean).map(String))];
  const nomes = {};

  lista.forEach(item => {
    const id = String(item?.funcionario_id || '');
    const funcionarioVinculado = Array.isArray(item?.funcionarios) ? item.funcionarios[0] : item?.funcionarios;
    const nomeVinculado = String(funcionarioVinculado?.nome || '').trim();
    if (id && nomeVinculado) {
      nomes[id] = nomeVinculado;
      relatorioPontoFuncionarioCache[id] = nomeVinculado;
    }
  });

  ids.forEach(id => {
    if (relatorioPontoFuncionarioCache[String(id)]) {
      nomes[String(id)] = relatorioPontoFuncionarioCache[String(id)];
    }
  });

  const idsParaBuscar = ids.filter(id => !nomes[String(id)]);
  if (idsParaBuscar.length) {
    const { data, error } = await sb
      .from('funcionarios')
      .select('id, nome, loja_id, empresa_id')
      .in('id', idsParaBuscar);

    if (!error) {
      (data || []).forEach(func => {
        const id = String(func.id || '');
        if (!id) return;
        nomes[id] = func.nome || 'Funcionário';
        relatorioPontoFuncionarioCache[id] = nomes[id];
      });
    } else {
      console.warn('Não foi possível carregar nomes dos funcionários do ponto:', error);
    }
  }

  return lista.map(item => {
    const id = String(item?.funcionario_id || '');
    const funcionarioVinculado = Array.isArray(item?.funcionarios) ? item.funcionarios[0] : item?.funcionarios;
    return {
      ...item,
      funcionarios: {
        ...(funcionarioVinculado || {}),
        nome: nomes[id] || relatorioPontoFuncionarioCache[id] || 'Funcionário',
      },
    };
  });
}

async function carregarTempoIntervaloMinimoFuncionarios(ids = []) {
  const listaIds = [...new Set((ids || []).filter(Boolean).map(String))];
  if (!listaIds.length) return {};
  try {
    const { data, error } = await sb
      .from('funcionarios')
      .select('id, tempo_intervalo_minutos, intervalos_semana')
      .in('id', listaIds);
    if (error) {
      const msg = String(error.message || '').toLowerCase();
      if (msg.includes('tempo_intervalo_minutos') || msg.includes('intervalos_semana')) return {};
      throw error;
    }
    return Object.fromEntries((data || []).map(item => [String(item.id), {
      padrao: Number(item.tempo_intervalo_minutos || 0),
      semana: normalizarIntervalosSemanaFuncionario(item.intervalos_semana, item.tempo_intervalo_minutos),
      horario_trabalho_inicio: item.horario_trabalho_inicio || null,
      horario_trabalho_fim: item.horario_trabalho_fim || null,
    }]));
  } catch (error) {
    console.warn('Não foi possível carregar tempo mínimo de intervalo dos funcionários:', error);
    return {};
  }
}

function obterIntervalosMinimosFuncionarioData(config = {}, dataIso = dataLocalISO()) {
  const token = diaSemanaTokenDaData(new Date(`${dataIso}T00:00:00`));
  const lista = Array.isArray(config?.semana?.[token]) ? config.semana[token] : [];
  if (lista.length) return lista;
  return Number(config?.padrao || 0) > 0 ? [Number(config.padrao)] : [];
}


function obterDataResumoPontoSelecionada() {
  const base = new Date();
  base.setDate(base.getDate() + Number(pontoResumoOffsetDias || 0));
  return dataLocalISO(base);
}

function atualizarTituloResumoPonto() {
  const titulo = document.getElementById('pontoResumoTitulo');
  if (!titulo) return;
  const dataSelecionada = obterDataResumoPontoSelecionada();
  titulo.textContent = Number(pontoResumoOffsetDias || 0) === -1
    ? `Status de ponto de ontem (${dataSelecionada})`
    : `Status de ponto de hoje (${dataSelecionada})`;
}

async function trocarDiaResumoPonto(offsetDias = 0, botao = null) {
  pontoResumoOffsetDias = Number(offsetDias || 0);
  document.querySelectorAll('.dashboard-period-btn[data-ponto-resumo-offset]').forEach(btn => {
    btn.classList.toggle('active', String(btn.dataset.pontoResumoOffset) === String(pontoResumoOffsetDias));
  });
  if (botao) botao.classList.add('active');
  atualizarTituloResumoPonto();
  await carregarResumoPontoHoje(obterFuncionarioRestritoLogadoIdParaPonto() || '');
}

async function carregarResumoPontoHoje(funcionarioId = '') {
  const container = document.getElementById('pontoResumoHoje');
  if (!container) return;

  const hojeLocal = obterDataResumoPontoSelecionada();
  atualizarTituloResumoPonto();
  let query = sb
    .from('ponto_registros')
    .select('id, funcionario_id, data_ponto, entrada_em, inicio_intervalo_em, retorno_intervalo_em, saida_em, created_at, loja_id, empresa_id')
    .eq('data_ponto', hojeLocal)
    .order('created_at', { ascending: true });

  const id = String(funcionarioId || '');
  if (id) {
    query = query.eq('funcionario_id', id);
  }

  const { data: registros, error } = await query;

  if (error) {
    if (isMissingTimeClockTableError(error)) {
      container.innerHTML = '<div class="empty">Rode o SQL da tabela ponto_registros para usar o registro de ponto.</div>';
      return;
    }
    container.innerHTML = `<div class="empty">Erro ao carregar status de ponto: ${mensagemErroSupabase(error, 'erro desconhecido')}.</div>`;
    return;
  }

  let rows = registros || [];
  const { inicioUtc, fimUtc } = obterJanelaUtcDiaBrasil(hojeLocal);
  if (inicioUtc && fimUtc) {
    let queryFallback = sb
      .from('ponto_registros')
      .select('id, funcionario_id, data_ponto, entrada_em, inicio_intervalo_em, retorno_intervalo_em, saida_em, created_at, loja_id, empresa_id')
      .gte('created_at', inicioUtc)
      .lt('created_at', fimUtc)
      .order('created_at', { ascending: true });
    if (id) queryFallback = queryFallback.eq('funcionario_id', id);

    const { data: registrosFallback, error: erroFallback } = await queryFallback;
    if (erroFallback) {
      console.warn('Não foi possível aplicar fallback de resumo de ponto por created_at:', erroFallback);
    } else {
      rows = mesclarRegistrosPontoPorId(rows, registrosFallback || []);
    }
  }

  rows = await complementarRegistrosPontoSemFiltroLoja(rows, {
    inicio: hojeLocal,
    fim: hojeLocal,
    funcionarioId: id,
    campos: 'id, funcionario_id, data_ponto, entrada_em, inicio_intervalo_em, retorno_intervalo_em, saida_em, created_at, loja_id, empresa_id',
  });
  rows = await complementarRegistrosPontoSemFiltroLojaPorCreatedAtDia(rows, {
    diaIso: hojeLocal,
    funcionarioId: id,
    campos: 'id, funcionario_id, data_ponto, entrada_em, inicio_intervalo_em, retorno_intervalo_em, saida_em, created_at, loja_id, empresa_id',
  });
  rows = await filtrarRegistrosPontoPorFuncionariosVisiveis(rows, id);

  rows = await anexarNomesFuncionariosARegistrosPonto(rows);
  if (!rows.length) {
    container.innerHTML = `<div class="empty">Nenhum ponto registrado em ${hojeLocal}.</div>`;
    return;
  }

  const ids = rows.map(item => item.id).filter(Boolean);
  const intervalosPorRegistro = {};
  if (ids.length) {
    const { data: dataInt, error: errInt } = await sb
      .from('ponto_intervalos')
      .select('ponto_registro_id, inicio_em, retorno_em, ordem')
      .in('ponto_registro_id', ids);

    if (errInt && !isMissingTimeClockIntervalsTableError(errInt)) {
      container.innerHTML = `<div class="empty">Erro ao carregar intervalos de ponto: ${mensagemErroSupabase(errInt, 'erro desconhecido')}.</div>`;
      return;
    }
    (dataInt || []).forEach(item => {
      const chave = String(item.ponto_registro_id || '');
      if (!chave) return;
      if (!intervalosPorRegistro[chave]) intervalosPorRegistro[chave] = [];
      intervalosPorRegistro[chave].push(item);
    });
  }

  const batidasAuditoriaPorRegistro = {};
  if (ids.length) {
    try {
      const { data: dataAuditoria, error: errAuditoria } = await sb
        .from('ponto_batidas_auditoria')
        .select('ponto_registro_id, registrado_em, tipo_batida, origem_registro')
        .in('ponto_registro_id', ids)
        .order('registrado_em', { ascending: true });

      if (!errAuditoria) {
        (dataAuditoria || []).forEach(item => {
          const chave = String(item.ponto_registro_id || '');
          if (!chave || !item.registrado_em) return;
          if (String(item.origem_registro || '').toLowerCase().includes('anulado')) return;
          if (!batidasAuditoriaPorRegistro[chave]) batidasAuditoriaPorRegistro[chave] = [];
          batidasAuditoriaPorRegistro[chave].push(item.registrado_em);
        });
      }
    } catch (e) {
      console.warn('Auditoria de batidas indisponível para resumo do ponto:', e);
    }
  }

  const completarRegistroPontoComBatidasOrdenadas = (registro, batidasExtras = []) => {
    const valores = [
      registro?.entrada_em,
      registro?.inicio_intervalo_em,
      registro?.retorno_intervalo_em,
      registro?.saida_em,
      ...(batidasExtras || []),
    ]
      .filter(Boolean)
      .map(valor => {
        const data = new Date(valor);
        return Number.isNaN(data.getTime()) ? '' : data.toISOString();
      })
      .filter(Boolean);

    const unicos = [...new Set(valores)].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    // FIX 3.1.51: quando existem 3 batidas no dia (ex.: 09:00 ajuste de entrada,
    // 12:00 ajuste de saída para intervalo e 13:00 batida real de retorno), a 3ª
    // batida deve fechar o intervalo e manter a jornada aberta. Antes a tela
    // ignorava esse retorno ou tratava como saída final, deixando o card preso em
    // "Em intervalo" e escondendo a entrada das 13:00.
    if (unicos.length === 3) {
      const registroTemIntervaloSemRetorno = !!registro?.inicio_intervalo_em && !registro?.retorno_intervalo_em;
      const saidaRegistroIso = registro?.saida_em && !Number.isNaN(new Date(registro.saida_em).getTime())
        ? new Date(registro.saida_em).toISOString()
        : '';
      const terceiroEhSaidaErrada = !!saidaRegistroIso && saidaRegistroIso === unicos[2];
      if (registroTemIntervaloSemRetorno || terceiroEhSaidaErrada) {
        return {
          ...registro,
          entrada_em: unicos[0] || registro?.entrada_em || null,
          inicio_intervalo_em: unicos[1] || registro?.inicio_intervalo_em || null,
          retorno_intervalo_em: unicos[2] || registro?.retorno_intervalo_em || null,
          saida_em: null,
        };
      }
      return registro;
    }

    if (unicos.length < 4) return registro;

    // Uma quantidade ímpar de batidas significa jornada ainda aberta.
    // Antes, a 5ª batida (retorno do 2º intervalo) era copiada para saida_em,
    // criando visualmente um período duplicado como "15:54 → 15:54".
    if (unicos.length % 2 === 1) {
      return {
        ...registro,
        entrada_em: unicos[0] || registro?.entrada_em || null,
        inicio_intervalo_em: unicos[1] || registro?.inicio_intervalo_em || null,
        retorno_intervalo_em: unicos[2] || registro?.retorno_intervalo_em || null,
        saida_em: null,
      };
    }

    return {
      ...registro,
      entrada_em: unicos[0] || registro?.entrada_em || null,
      inicio_intervalo_em: unicos[1] || registro?.inicio_intervalo_em || null,
      retorno_intervalo_em: unicos[2] || registro?.retorno_intervalo_em || null,
      saida_em: unicos[unicos.length - 1] || registro?.saida_em || null,
    };
  };

  // Compatibilidade com o modelo real atual da tabela ponto_registros:
  // o intervalo principal fica nas colunas inicio_intervalo_em / retorno_intervalo_em.
  // Sem isso, o banco grava certo, mas a tela continua mostrando como "Aberto agora".
  (rows || []).forEach(registro => {
    const chave = String(registro?.id || '');
    if (!chave || !registro?.inicio_intervalo_em) return;
    if (!intervalosPorRegistro[chave]) intervalosPorRegistro[chave] = [];
    const jaExiste = intervalosPorRegistro[chave].some(item => String(item?.inicio_em || '') === String(registro.inicio_intervalo_em || ''));
    if (!jaExiste) {
      intervalosPorRegistro[chave].push({
        ponto_registro_id: chave,
        inicio_em: registro.inicio_intervalo_em,
        retorno_em: registro.retorno_intervalo_em || null,
        ordem: 1,
      });
    }
  });

  const temposIntervaloMinimo = await carregarTempoIntervaloMinimoFuncionarios(
    rows.map(item => item.funcionario_id)
  );

  const escapeHtml = (valor) => String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const formatarHora = (valorIso) => {
    if (!valorIso) return '--:--';
    const data = new Date(valorIso);
    if (Number.isNaN(data.getTime())) return '--:--';
    return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const ts = (valorIso) => {
    if (!valorIso) return 0;
    const data = new Date(valorIso);
    return Number.isNaN(data.getTime()) ? 0 : data.getTime();
  };

  const montarPeriodos = (registro, intervalos) => {
    const ordenados = obterIntervalosConsolidadosPonto(registro, intervalos);
    const periodos = [];
    let entradaAtual = registro.entrada_em || null;
    const temIntervaloAberto = ordenados.some(item => item.inicio_em && !item.retorno_em);

    ordenados.forEach(intervalo => {
      const entradaMs = ts(entradaAtual);
      const inicioIntervaloMs = ts(intervalo.inicio_em);
      if (entradaAtual && inicioIntervaloMs && (!entradaMs || inicioIntervaloMs > entradaMs)) {
        periodos.push({ entrada: entradaAtual, saida: intervalo.inicio_em, aberto: false });
      }
      entradaAtual = intervalo.retorno_em || null;
    });

    if (entradaAtual) {
      periodos.push({
        entrada: entradaAtual,
        saida: registro.saida_em || null,
        aberto: !registro.saida_em,
      });
    } else if (!periodos.length && registro.entrada_em) {
      periodos.push({
        entrada: registro.entrada_em,
        saida: registro.saida_em || null,
        aberto: !registro.saida_em,
      });
    } else if (registro.saida_em && !temIntervaloAberto && !periodos.length) {
      periodos.push({ entrada: registro.entrada_em || null, saida: registro.saida_em, aberto: false });
    }

    return periodos.filter(periodo => periodo.entrada);
  };

  const normalizarPeriodosExibicao = (periodos = []) => {
    const lista = [...periodos]
      .filter(periodo => periodo && periodo.entrada)
      .sort((a, b) => ts(a.entrada) - ts(b.entrada) || ts(a.saida) - ts(b.saida));

    return lista.filter((periodo, idx) => {
      const inicio = ts(periodo.entrada);
      const fim = ts(periodo.saida);
      if (!inicio || !fim) return true;
      const existemPartesDentro = lista.some((outro, outroIdx) => {
        if (outroIdx === idx) return false;
        const outroInicio = ts(outro.entrada);
        const outroFim = ts(outro.saida);
        return outroInicio && outroFim && outroInicio >= inicio && outroFim <= fim && (outroInicio > inicio || outroFim < fim);
      });
      return !existemPartesDentro;
    });
  };

  const porFuncionario = new Map();
  rows.forEach(registro => {
    const funcionarioIdAtual = String(registro.funcionario_id || '');
    if (!funcionarioIdAtual) return;

    const registroExibicao = completarRegistroPontoComBatidasOrdenadas(
      registro,
      batidasAuditoriaPorRegistro[String(registro.id)] || []
    );
    const nome = registroExibicao.funcionarios?.nome || relatorioPontoFuncionarioCache[funcionarioIdAtual] || 'Funcionário';
    const intervalosBase = intervalosPorRegistro[String(registroExibicao.id)] || [];
    const intervalos = obterIntervalosConsolidadosPonto(registroExibicao, intervalosBase);
    const resumo = obterResumoJornadaPonto(registroExibicao, intervalos);
    const periodos = montarPeriodos(registroExibicao, intervalos);

    if (!porFuncionario.has(funcionarioIdAtual)) {
      porFuncionario.set(funcionarioIdAtual, {
        id: funcionarioIdAtual,
        nome,
        periodos: [],
        totalMinutos: 0,
        aberto: false,
        ultimaEntradaTs: 0,
        ultimaSaidaTs: 0,
        ultimaEntrada: null,
        ultimaSaida: null,
        intervaloAbertoInicio: null,
        totalIntervaloMinutos: 0,
        tempoIntervaloMinimo: 0,
        intervalosMinimosDia: obterIntervalosMinimosFuncionarioData(temposIntervaloMinimo[funcionarioIdAtual] || {}, hojeLocal),
        horarioTrabalhoInicio: temposIntervaloMinimo[funcionarioIdAtual]?.horario_trabalho_inicio || null,
        horarioTrabalhoFim: temposIntervaloMinimo[funcionarioIdAtual]?.horario_trabalho_fim || null,
      });
    }

    const item = porFuncionario.get(funcionarioIdAtual);
    item.totalMinutos += Number(resumo?.totalMinutos || 0);
    const intervaloAbertoAtual = obterIntervaloAberto(intervalos);
    const intervalosConcluidos = (intervalos || []).filter(intervalo => intervalo.inicio_em && intervalo.retorno_em).length;
    // Regra 3.1.30: saída_em nunca deve ser tratada como início de intervalo.
    // O retorno atrasado só aparece se existir intervalo aberto de verdade
    // (inicio_intervalo_em preenchido e retorno_intervalo_em vazio).
    const inicioIntervaloAberto = intervaloAbertoAtual?.inicio_em || null;
    if (inicioIntervaloAberto && ts(inicioIntervaloAberto) > ts(item.intervaloAbertoInicio)) {
      item.intervaloAbertoInicio = inicioIntervaloAberto;
      item.tempoIntervaloMinimo = item.intervalosMinimosDia[intervalosConcluidos] || 0;
    }

    item.totalIntervaloMinutos += calcularTotalIntervalosPonto(intervalos, null);

    periodos.forEach(periodo => {
      item.periodos.push(periodo);
      const entradaTs = ts(periodo.entrada);
      const saidaTs = ts(periodo.saida);
      if (entradaTs > item.ultimaEntradaTs) {
        item.ultimaEntradaTs = entradaTs;
        item.ultimaEntrada = periodo.entrada;
      }
      if (saidaTs > item.ultimaSaidaTs) {
        item.ultimaSaidaTs = saidaTs;
        item.ultimaSaida = periodo.saida;
      }
    });
  });

  const listaStatus = Array.from(porFuncionario.values())
    .map(item => {
      // Considera em aberto apenas quando a última entrada é mais recente que a última saída.
      item.aberto = item.ultimaEntradaTs > item.ultimaSaidaTs;
      return item;
    })
    .sort((a, b) => {
      if (a.aberto !== b.aberto) return a.aberto ? -1 : 1;
      return a.nome.localeCompare(b.nome, 'pt-BR');
    });

  if (!listaStatus.length) {
    container.innerHTML = '<div class="empty">Nenhum ponto registrado hoje.</div>';
    return;
  }

  container.innerHTML = '<div class="ponto-resumo-lista">' + listaStatus.map(item => {
    const periodosExibicao = normalizarPeriodosExibicao(item.periodos);
    const periodosHtml = periodosExibicao.length
      ? periodosExibicao
          .map(periodo => {
            const abertoOriginal = !periodo.saida || periodo.aberto;
            const aberto = abertoOriginal && (!item.ultimaSaidaTs || ts(periodo.entrada) > item.ultimaSaidaTs);
            const saidaExibida = aberto ? null : (periodo.saida || item.ultimaSaida || null);
            return `
              <span class="ponto-periodo-chip${aberto ? ' aberto' : ''}">
                <span class="ponto-hora-entrada">${formatarHora(periodo.entrada)}</span>
                <span>→</span>
                <span class="${aberto ? 'ponto-hora-aberto' : 'ponto-hora-saida'}">${aberto ? 'Aberto agora' : formatarHora(saidaExibida)}</span>
              </span>
            `;
          }).join('')
      : '<span class="ponto-periodo-chip">Sem batidas detalhadas</span>';

    const avisoAntesMinutos = obterTempoAvisoManualPonto();
    // Se o funcionário não tem intervalo cadastrado, usa o valor do card como intervalo padrão da loja.
    const tempoRetornoIntervalo = Number(item.tempoIntervaloMinimo || 0) > 0
      ? Number(item.tempoIntervaloMinimo || 0)
      : Number(avisoAntesMinutos || 0);
    const resumoRetorno = obterResumoRetornoIntervaloPonto(
      item.intervaloAbertoInicio ? { inicio_em: item.intervaloAbertoInicio } : null,
      tempoRetornoIntervalo
    );
    const statusClasse = item.intervaloAbertoInicio ? 'tag tag-amber' : item.aberto ? 'tag tag-amber' : 'tag tag-green';
    const statusTexto = item.intervaloAbertoInicio ? 'Em intervalo' : item.aberto ? 'Aberto agora' : 'Fechado';
    const retornoHtml = resumoRetorno
      ? `<div class="ponto-retorno-destaque${resumoRetorno.atrasado ? ' atrasado' : ''}">
          <div class="retorno-label">${resumoRetorno.atrasado ? 'Retorno atrasado' : 'Minutos para retorno'}</div>
          <div class="retorno-contador" data-retorno-intervalo-ms="${new Date(resumoRetorno.retornoPrevisto).getTime()}">${escapeHtml(resumoRetorno.texto)}</div>
          <div class="ponto-retorno-detalhe">Intervalo definido: <strong>${formatarMinutosIntervaloPonto(tempoRetornoIntervalo)}</strong> • Retornar até: <strong>${formatarHora(resumoRetorno.retornoPrevisto)}</strong>${(!item.tempoIntervaloMinimo && avisoAntesMinutos) ? ' • Padrão da loja' : ''}</div>
        </div>`
      : tempoRetornoIntervalo
        ? `<div>Intervalo mínimo: <strong>${formatarMinutosIntervaloPonto(tempoRetornoIntervalo)}</strong></div>`
        : item.intervalosMinimosDia.length
          ? `<div>Intervalos previstos: <strong>${item.intervalosMinimosDia.map(formatarMinutosIntervaloPonto).join(' + ')}</strong></div>`
        : '';

    const acaoAdmin = usuarioPodeAcessar('ponto_ajustes')
      ? `<button class="btn btn-ghost btn-sm" type="button" onclick="abrirModalAjusteManualAdminPonto('${item.id}')">Ajustar</button>
         <button class="btn btn-ghost btn-sm" type="button" style="color:#fca5a5;border-color:rgba(239,68,68,0.4)" onclick="abrirModalExclusaoAjusteManualAdminPonto('${item.id}')">Excluir ajuste</button>`
      : '';

    return `
      <div class="ponto-resumo-linha${item.intervaloAbertoInicio ? ' em-intervalo-destaque' : ''}">
        <div class="ponto-resumo-nome">${escapeHtml(item.nome)}</div>
        <div class="ponto-resumo-sequencia">${periodosHtml}</div>
        <div class="ponto-resumo-metricas">
          <div>Total trabalhado: <strong>${formatarDuracaoMinutos(item.totalMinutos)}</strong></div>
          <div>Total intervalo: <strong>${formatarDuracaoMinutos(item.totalIntervaloMinutos || 0)}</strong></div>
          <div>Última entrada: ${formatarHora(item.ultimaEntrada)}</div>
          <div>Última saída: ${item.ultimaSaida ? formatarHora(item.ultimaSaida) : '-'}</div>
          ${retornoHtml}
        </div>
        <div class="ponto-resumo-tag" style="display:flex;gap:8px;align-items:center;justify-content:flex-end;flex-wrap:wrap"><span class="${statusClasse}">${statusTexto}</span>${acaoAdmin}</div>
      </div>
    `;
  }).join('') + '</div>';
  iniciarContadorRetornoIntervaloPonto();
}


function usuarioLogadoEhTerminalCompartilhadoPonto() {
  const valores = [
    usuarioSistemaLogado?.nome,
    usuarioSistemaLogado?.username,
    usuarioSistemaLogado?.email,
    usuarioSistemaLogado?.funcionario_nome,
  ].map(v => String(v || '').trim().toLowerCase());
  return valores.some(v => v === 'zuqui' || v.includes('zuqui'));
}

async function carregarBaterPonto() {
  if (!usuarioPodeAcessar('bater_ponto')) {
    const fallback = Array.from(document.querySelectorAll('.nav-btn[data-page]'))
      .find(btn => btn.style.display !== 'none' && usuarioPodeAcessar(btn.dataset.page));
    if (fallback) fallback.click();
    return;
  }
  configurarSegurancaCampoPinPonto();
  atualizarCardTempoAvisoPonto();
  limparCampoPinPonto();
  await carregarSelectFuncionariosPonto();
  const funcionarioRestritoId = obterFuncionarioRestritoLogadoIdParaPonto();
  const terminalCompartilhadoPonto = usuarioLogadoEhTerminalCompartilhadoPonto();
  const restringirPontoAoUsuarioLogado = funcionarioRestritoId && !terminalCompartilhadoPonto;
  const campoPin = document.getElementById('pontoPinInput');
  if (campoPin) {
    campoPin.style.display = restringirPontoAoUsuarioLogado ? 'none' : '';
    campoPin.required = !restringirPontoAoUsuarioLogado;
  }
  const btnAjusteManualAdmin = document.getElementById('btnAjusteManualAdminPonto');
  if (btnAjusteManualAdmin) btnAjusteManualAdmin.hidden = !usuarioPodeAcessar('ponto_ajustes');
  await carregarResumoPontoHoje(restringirPontoAoUsuarioLogado ? funcionarioRestritoId : '');
  await verificarAlertaEntradaPonto();
  await carregarHorasDashboard();
}


function detectarOrigemRegistroPonto() {
  const ua = navigator.userAgent || '';
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  return {
    origem_registro: mobile ? 'celular' : 'computador',
    registrado_via: mobile ? 'celular' : 'computador',
    dispositivo_info: ua.slice(0, 480),
  };
}

function obterGeolocalizacaoAtualPonto() {
  const origem = detectarOrigemRegistroPonto();
  if (origem.registrado_via !== 'celular') {
    return Promise.resolve({
      ...origem,
      geolocalizacao_status: 'nao_solicitada_computador',
      latitude: null,
      longitude: null,
      precisao_metros: null,
      endereco_aproximado: null,
    });
  }

  if (!navigator.geolocation) {
    return Promise.resolve({
      ...origem,
      geolocalizacao_status: 'indisponivel',
      latitude: null,
      longitude: null,
      precisao_metros: null,
      endereco_aproximado: null,
    });
  }

  setMsg('msgPonto', 'Solicitando localização do celular...', '');
  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      pos => resolve({
        ...origem,
        geolocalizacao_status: 'permitida',
        latitude: pos.coords?.latitude ?? null,
        longitude: pos.coords?.longitude ?? null,
        precisao_metros: pos.coords?.accuracy ?? null,
        endereco_aproximado: null,
      }),
      err => resolve({
        ...origem,
        geolocalizacao_status: err?.code === 1 ? 'negada' : 'erro',
        latitude: null,
        longitude: null,
        precisao_metros: null,
        endereco_aproximado: null,
      }),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  });
}

function isMissingPontoGeoColumnsError(error) {
  const msg = String(error?.message || '').toLowerCase();
  return String(error?.code || '') === '42703'
    || msg.includes('origem_registro')
    || msg.includes('dispositivo_info')
    || msg.includes('geolocalizacao_status')
    || msg.includes('ultima_batida')
    || msg.includes('registrado_via')
    || msg.includes('latitude')
    || msg.includes('longitude');
}

function montarCamposAuditoriaPonto(meta = {}, tipoBatida = '') {
  const agoraIso = new Date().toISOString();
  return {
    origem_registro: meta.origem_registro || null,
    registrado_via: meta.registrado_via || null,
    dispositivo_info: meta.dispositivo_info || null,
    latitude: meta.latitude ?? null,
    longitude: meta.longitude ?? null,
    precisao_metros: meta.precisao_metros ?? null,
    geolocalizacao_status: meta.geolocalizacao_status || null,
    endereco_aproximado: meta.endereco_aproximado || null,
    usuario_logado_id: usuarioSistemaLogado?.tipo === 'funcionario' ? (usuarioSistemaLogado.id || null) : null,
    ultima_batida_em: agoraIso,
    ultima_batida_tipo: tipoBatida || null,
    ultima_batida_origem: meta.origem_registro || null,
    ultima_batida_dispositivo: meta.dispositivo_info || null,
    ultima_batida_latitude: meta.latitude ?? null,
    ultima_batida_longitude: meta.longitude ?? null,
    ultima_batida_precisao_metros: meta.precisao_metros ?? null,
    ultima_batida_geolocalizacao_status: meta.geolocalizacao_status || null,
    ultima_batida_endereco_aproximado: meta.endereco_aproximado || null,
  };
}

async function executarComFallbackColunasPonto(queryBuilder, campos, camposBasicos) {
  const resposta = await queryBuilder(campos);
  if (!resposta.error) return resposta;
  if (isMissingPontoGeoColumnsError(resposta.error)) {
    return await queryBuilder(camposBasicos);
  }
  return resposta;
}

async function registrarAuditoriaBatidaPonto({ pontoRegistroId, funcionarioId, tipoBatida, registradoEm, meta }) {
  if (!pontoRegistroId || !funcionarioId) return;
  try {
    await sb.from('ponto_batidas_auditoria').insert([{
      ponto_registro_id: pontoRegistroId,
      funcionario_id: funcionarioId,
      usuario_logado_id: usuarioSistemaLogado?.tipo === 'funcionario' ? (usuarioSistemaLogado.id || null) : null,
      tipo_batida: tipoBatida || null,
      registrado_em: registradoEm || new Date().toISOString(),
      origem_registro: meta?.origem_registro || null,
      registrado_via: meta?.registrado_via || null,
      dispositivo_info: meta?.dispositivo_info || null,
      latitude: meta?.latitude ?? null,
      longitude: meta?.longitude ?? null,
      precisao_metros: meta?.precisao_metros ?? null,
      geolocalizacao_status: meta?.geolocalizacao_status || null,
      endereco_aproximado: meta?.endereco_aproximado || null,
    }]);
  } catch (e) {
    console.warn('Auditoria de batida indisponível:', e);
  }
}

async function obterFuncionarioLogadoParaPonto() {
  if (!obterFuncionarioRestritoLogadoIdParaPonto()) return null;
  let query = sb
    .from('funcionarios')
    .select('id, nome, ativo, horario_trabalho_inicio, horario_trabalho_fim, tempo_intervalo_minutos, loja_id, empresa_id')
    .eq('id', usuarioSistemaLogado.id)
    .eq('ativo', true);
  query = aplicarFiltroLojaAtualPontoQuery(query);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data || null;
}

function abrirModalExclusaoAjusteManualAdminPonto(funcionarioId = '') {
  abrirModalAjusteManualAdminPonto(funcionarioId, 'anular', dataLocalISO());
}

function fecharModalAjusteManualAdminPonto() {
  const modal = document.getElementById('modalAjusteManualAdminPonto');
  if (modal) modal.hidden = true;
  setMsg('msgAjusteManualAdminPonto', '', '');
}

async function validarSenhaAdministradorParaAjustePonto(senhaInformada) {
  const senha = String(senhaInformada || '').trim();
  if (!senha) return false;

  // A senha de login por e-mail nunca autoriza operacoes. Qualquer perfil com
  // ponto_ajustes (e o Global ADM) confirma com o PIN operacional do cadastro.
  const podeAdministrar = (typeof usuarioPodeAcessar === 'function' && usuarioPodeAcessar('ponto_ajustes'))
    || (typeof usuarioEhAdministrador === 'function' && usuarioEhAdministrador());
  if (!podeAdministrar || !usuarioSistemaLogado?.id) return false;

  if (await validarPinFuncionario(usuarioSistemaLogado.id, senha)) return true;

  // Contas administrativas nativas guardam o PIN operacional em usuarios_admin.
  if (usuarioSistemaLogado?.tipo === 'admin' || usuarioSistemaLogado?.tipo === 'admin_loja') {
    const { data, error } = await executarValidacaoCredencialComRetry('verificar_pin_usuario_admin', {
      p_usuario_id: usuarioSistemaLogado.id,
      p_pin: senha,
    }, data => data === true);
    if (error) throw error;
    return data === true;
  }

  return false;
}

function abrirModalSolicitarAjustePonto() {
  const modal = document.getElementById('modalSolicitarAjustePonto');
  if (!modal) return;
  const data = document.getElementById('ajustePontoData');
  const horario = document.getElementById('ajustePontoHorario');
  const motivo = document.getElementById('ajustePontoMotivo');
  const pin = document.getElementById('ajustePontoPin');
  const pinField = document.getElementById('ajustePontoPinField');
  const subtexto = document.getElementById('ajustePontoModalSubtexto');
  const usarSessaoFuncionario = usarSessaoFuncionarioSolicitacaoAjustePonto();

  if (pinField) pinField.hidden = false;
  if (subtexto) {
    subtexto.textContent = 'Informe o PIN do funcionário que está solicitando o ajuste. O sistema não usa o usuário logado para definir o funcionário desta solicitação.';
  }

  if (data) data.value = dataLocalISO();
  if (horario) horario.value = '';
  if (motivo) motivo.value = '';
  if (pin) pin.value = '';
  setMsg('msgSolicitarAjustePonto', '', '');
  modal.hidden = false;
  setTimeout(() => pin?.focus(), 80);
}

function fecharModalSolicitarAjustePonto() {
  const modal = document.getElementById('modalSolicitarAjustePonto');
  if (modal) modal.hidden = true;
  setMsg('msgSolicitarAjustePonto', '', '');
}

function isMissingPontoAjustesTableError(error) {
  const msg = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '').toUpperCase();
  return code === 'PGRST205' || code === '42P01' || msg.includes('missing relation "public.ponto_ajustes_solicitacoes"');
}

function dispositivoMovelSolicitacaoAjustePonto() {
  try {
    const coarsePointer = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    const mobileUA = /android|iphone|ipad|ipod/i.test(String(navigator.userAgent || ''));
    return coarsePointer || mobileUA;
  } catch (_) {
    return false;
  }
}

function usarSessaoFuncionarioSolicitacaoAjustePonto() {
  // FIX 3.1.60:
  // A solicitação de ajuste de ponto deve identificar o FUNCIONÁRIO PELO PIN informado no modal.
  // Não usar usuarioSistemaLogado aqui, pois em terminal/loja compartilhada o usuário logado pode ser PATRICK/ZUQUI,
  // enquanto quem está pedindo o ajuste é outro funcionário digitando o próprio PIN.
  return false;
}

async function salvarSolicitacaoAjustePonto() {
  const pin = String(document.getElementById('ajustePontoPin')?.value || '').trim();
  const dataAjuste = String(document.getElementById('ajustePontoData')?.value || '').trim();
  const horarioAjuste = String(document.getElementById('ajustePontoHorario')?.value || '').trim();
  const motivo = String(document.getElementById('ajustePontoMotivo')?.value || '').trim();

  if (!dataAjuste || !horarioAjuste || !motivo) {
    setMsg('msgSolicitarAjustePonto', 'Preencha data, horário e motivo.', 'err');
    return;
  }

  if (!pin) {
    setMsg('msgSolicitarAjustePonto', 'Informe o PIN do funcionário que está solicitando o ajuste.', 'err');
    return;
  }

  const funcionario = await obterFuncionarioAtivoPorPin(pin);
  if (!funcionario?.id) {
    setMsg('msgSolicitarAjustePonto', 'PIN inválido. Confira a senha do funcionário.', 'err');
    return;
  }

  const solicitacaoPayload = {
    funcionario_id: funcionario.id,
    funcionario_nome: funcionario.nome || 'Funcionário',
    data_ajuste: dataAjuste,
    horario_ajuste: horarioAjuste,
    motivo,
    status: 'pendente',
    ...(funcionario.loja_id ? { loja_id: funcionario.loja_id } : {}),
    ...(funcionario.empresa_id ? { empresa_id: funcionario.empresa_id } : {}),
  };

  setMsg('msgSolicitarAjustePonto', 'Enviando solicitação...', 'ok');
  const { error } = await sb
    .from('ponto_ajustes_solicitacoes')
    .insert([solicitacaoPayload]);

  if (error) {
    if (isMissingPontoAjustesTableError(error)) {
      setMsg('msgSolicitarAjustePonto', 'Tabela ponto_ajustes_solicitacoes não encontrada. Confirme se o SQL foi executado.', 'err');
      return;
    }
    setMsg('msgSolicitarAjustePonto', `Erro ao enviar solicitação: ${mensagemErroSupabase(error, 'erro desconhecido')}`, 'err');
    return;
  }

  setMsg('msgPonto', `Solicitação enviada para aprovação do administrador (${funcionario.nome || 'Funcionário'}).`, 'ok');
  fecharModalSolicitarAjustePonto();
  if (obterPaginaAtivaAtual() === 'ponto_ajustes') await carregarAjustesPonto();
}

function formatarDataHoraSolicitacaoPonto(valor) {
  if (!valor) return '-';
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function formatarHorarioAjustePonto(valor) {
  return String(valor || '').slice(0, 5) || '-';
}

function obterNomeAdminAtual() {
  return usuarioSistemaLogado?.nome || usuarioSistemaLogado?.email || 'Administrador';
}

function obterIdAdminAtual() {
  return usuarioSistemaLogado?.id || null;
}

function resetFiltroAjustesPonto() {
  const status = document.getElementById('filtroPontoAjusteStatus');
  const dataInicio = document.getElementById('filtroPontoAjusteDataInicio');
  const dataFim = document.getElementById('filtroPontoAjusteDataFim');
  if (status) status.value = 'pendente';
  if (dataInicio) dataInicio.value = '';
  if (dataFim) dataFim.value = '';
  carregarAjustesPonto();
}

async function carregarAjustesPonto() {
  const lista = document.getElementById('listaPontoAjustes');
  if (!lista) return;
  if (!usuarioPodeAcessar('ponto_ajustes')) {
    lista.innerHTML = '<div class="empty">Você não tem permissão para acessar os ajustes de ponto.</div>';
    return;
  }

  lista.innerHTML = '<div class="empty">Carregando solicitações...</div>';
  const statusFiltro = String(document.getElementById('filtroPontoAjusteStatus')?.value || 'pendente');
  const dataInicio = String(document.getElementById('filtroPontoAjusteDataInicio')?.value || '');
  const dataFim = String(document.getElementById('filtroPontoAjusteDataFim')?.value || '');

  let query = sb
    .from('ponto_ajustes_solicitacoes')
    .select('*')
    .order('solicitado_em', { ascending: false });

  if (statusFiltro && statusFiltro !== 'todos') query = query.eq('status', statusFiltro);
  if (dataInicio) query = query.gte('data_ajuste', dataInicio);
  if (dataFim) query = query.lte('data_ajuste', dataFim);

  const { data, error } = await query;
  if (error) {
    if (isMissingPontoAjustesTableError(error)) {
      lista.innerHTML = '<div class="empty">Tabela ponto_ajustes_solicitacoes não encontrada. Confirme se o SQL foi executado.</div>';
      return;
    }
    lista.innerHTML = `<div class="empty">Erro ao carregar ajustes: ${mensagemErroSupabase(error, 'erro desconhecido')}.</div>`;
    return;
  }

  let itens = data || [];
  if (usuarioSistemaLogado?.tipo === 'admin_loja') {
    const { data: funcionariosLoja, error: erroFuncionariosLoja } = await sb
      .from('funcionarios')
      .select('id');
    if (!erroFuncionariosLoja) {
      const idsPermitidos = new Set((funcionariosLoja || []).map(item => String(item.id || '')));
      itens = itens.filter(item => idsPermitidos.has(String(item.funcionario_id || '')));
    }
  }
  if (!itens.length) {
    lista.innerHTML = '<div class="empty">Nenhuma solicitação encontrada para os filtros atuais.</div>';
    return;
  }

  lista.innerHTML = '<div class="lista">' + itens.map(item => {
    const status = String(item.status || 'pendente');
    const tagClasse = status === 'aprovado' ? 'tag tag-green' : status === 'recusado' ? 'tag tag-red' : 'tag tag-amber';
    const acoes = status === 'pendente' ? `
      <button class="btn btn-green" type="button" onclick="aprovarAjustePonto('${item.id}')">Aprovar</button>
      <button class="btn btn-red" type="button" onclick="recusarAjustePonto('${item.id}')">Recusar</button>
    ` : '';
    const detalheFinal = status === 'aprovado'
      ? `Operador master que aprovou: ${item.aprovado_por_nome || '-'} · ${formatarDataHoraSolicitacaoPonto(item.aprovado_em)}`
      : status === 'recusado'
        ? `Operador master que recusou: ${item.recusado_por_nome || '-'} · ${formatarDataHoraSolicitacaoPonto(item.recusado_em)} · Motivo da recusa: ${item.motivo_recusa || '-'}`
        : 'Aguardando aprovação do administrador';
    return `
      <div class="item">
        <div class="item-info">
          <div class="item-nome">${item.funcionario_nome || 'Funcionário'}</div>
          <div class="item-detalhe">Data: ${formatarDataPonto(item.data_ajuste)} · Horário: ${formatarHorarioAjustePonto(item.horario_ajuste)}</div>
          <div class="item-detalhe">Motivo: ${item.motivo || '-'}</div>
          <div class="item-detalhe">Solicitado em: ${formatarDataHoraSolicitacaoPonto(item.solicitado_em)}</div>
          <div class="item-detalhe">${detalheFinal}</div>
        </div>
        <div class="item-actions">
          <span class="${tagClasse}">${status.toUpperCase()}</span>
          ${acoes}
        </div>
      </div>
    `;
  }).join('') + '</div>';
}

function montarIsoAjustePonto(dataAjuste, horarioAjuste) {
  const data = String(dataAjuste || '').trim();
  const hora = String(horarioAjuste || '').slice(0, 5);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !/^\d{2}:\d{2}$/.test(hora)) return null;
  const d = new Date(`${data}T${hora}:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

async function aprovarAjustePonto(id) {
  if (!usuarioPodeAcessar('ponto_ajustes')) return;
  const operadorMasterNome = obterNomeAdminAtual();
  if (!operadorMasterNome) {
    setMsg('msgPontoAjustes', 'Não foi possível identificar o operador master logado.', 'err');
    return;
  }
  const confirmacao = await abrirConfirmacaoSistema({
    title: 'Aprovar ajuste de ponto',
    subtitle: `Operador master: ${operadorMasterNome}`,
    body: 'Deseja aprovar esta solicitação e aplicar o horário no ponto do funcionário?',
    confirmText: 'Aprovar ajuste',
    cancelText: 'Cancelar',
    confirmClass: 'btn-green',
  });
  if (!confirmacao.confirmado) return;

  const { data: solicitacao, error: erroBusca } = await sb
    .from('ponto_ajustes_solicitacoes')
    .select('*')
    .eq('id', id)
    .single();

  if (erroBusca || !solicitacao) {
    setMsg('msgPontoAjustes', `Não foi possível localizar a solicitação: ${mensagemErroSupabase(erroBusca, 'erro desconhecido')}`, 'err');
    return;
  }
  if (String(solicitacao.status || '') !== 'pendente') {
    setMsg('msgPontoAjustes', 'Esta solicitação já foi analisada.', 'err');
    await carregarAjustesPonto();
    return;
  }

  const resultado = await aplicarAjusteAprovadoNoPonto(solicitacao);
  if (!resultado.ok) {
    setMsg('msgPontoAjustes', `Não foi possível aplicar o ajuste no ponto: ${resultado.mensagem}`, 'err');
    return;
  }

  const { error: erroUpdate } = await sb
    .from('ponto_ajustes_solicitacoes')
    .update({
      status: 'aprovado',
      aprovado_em: new Date().toISOString(),
      aprovado_por_id: obterIdAdminAtual(),
      aprovado_por_nome: operadorMasterNome,
    })
    .eq('id', id);

  if (erroUpdate) {
    setMsg('msgPontoAjustes', `O ponto foi aplicado, mas não consegui atualizar a solicitação: ${mensagemErroSupabase(erroUpdate, 'erro desconhecido')}`, 'err');
    return;
  }

  setMsg('msgPontoAjustes', `Ajuste aprovado. ${resultado.mensagem}`, 'ok');
  await carregarAjustesPonto();
  await carregarResumoPontoHoje();
  await carregarHorasDashboard();
  if (obterPaginaAtivaAtual() === 'relatorio_ponto') await carregarRelatorioPonto();
}

async function recusarAjustePonto(id) {
  if (!usuarioPodeAcessar('ponto_ajustes')) return;
  const operadorMasterNome = obterNomeAdminAtual();
  if (!operadorMasterNome) {
    setMsg('msgPontoAjustes', 'Não foi possível identificar o operador master logado.', 'err');
    return;
  }

  const confirmacao = await abrirConfirmacaoSistema({
    title: 'Recusar ajuste de ponto',
    subtitle: `Operador master: ${operadorMasterNome}`,
    body: 'Informe o motivo da recusa. Este motivo ficará registrado na solicitação.',
    input: true,
    exigeTexto: true,
    inputLabel: 'Motivo da recusa',
    inputPlaceholder: 'Ex.: horário divergente, solicitação duplicada, falta de justificativa...',
    confirmText: 'Recusar solicitação',
    cancelText: 'Cancelar',
    confirmClass: 'btn-red',
  });
  if (!confirmacao.confirmado) return;
  const motivoLimpo = String(confirmacao.valor || '').trim();
  if (!motivoLimpo) {
    setMsg('msgPontoAjustes', 'Para recusar, informe o motivo da recusa. A recusa não foi salva.', 'err');
    return;
  }

  const { error } = await sb
    .from('ponto_ajustes_solicitacoes')
    .update({
      status: 'recusado',
      recusado_em: new Date().toISOString(),
      recusado_por_id: obterIdAdminAtual(),
      recusado_por_nome: operadorMasterNome,
      motivo_recusa: motivoLimpo,
    })
    .eq('id', id)
    .eq('status', 'pendente');

  if (error) {
    setMsg('msgPontoAjustes', `Não foi possível recusar: ${mensagemErroSupabase(error, 'erro desconhecido')}`, 'err');
    return;
  }
  setMsg('msgPontoAjustes', 'Solicitação recusada com operador master e motivo registrados.', 'ok');
  await carregarAjustesPonto();
}

function registroAtendeFiltroHorario(registro, horaInicio = '', horaFim = '') {
  if (!horaInicio && !horaFim) return true;

  const toMinutes = (hora) => {
    const valor = String(hora || '').slice(0, 5);
    if (!/^\d{2}:\d{2}$/.test(valor)) return null;
    const [h, m] = valor.split(':').map(Number);
    return (h * 60) + m;
  };

  const inicioMin = toMinutes(horaInicio);
  const fimMin = toMinutes(horaFim);
  const horarios = [
    registro.entrada_em,
    ...(registro.intervalos_ponto || []).flatMap(item => [item.inicio_em, item.retorno_em]),
    registro.saida_em,
  ]
    .filter(Boolean)
    .map(valor => {
      const d = new Date(valor);
      return (d.getHours() * 60) + d.getMinutes();
    });

  if (!horarios.length) return false;

  if (inicioMin !== null && fimMin !== null) {
    if (inicioMin <= fimMin) return horarios.some(min => min >= inicioMin && min <= fimMin);
    return horarios.some(min => min >= inicioMin || min <= fimMin);
  }
  if (inicioMin !== null) return horarios.some(min => min >= inicioMin);
  if (fimMin !== null) return horarios.some(min => min <= fimMin);
  return true;
}

function atualizarPainelRelatorioPonto(rows = [], infoPeriodo = 'Período atual.') {
  const resumo = calcularResumoHorasPorFuncionario(rows);
  renderizarParticipacaoHoras({
    listId: 'horasFuncionariosListaRelatorio',
    pieId: 'horasPieRelatorio',
    valueId: 'horasPieValorRelatorio',
    labelId: 'horasPieLabelRelatorio',
    infoId: 'horasInfoRelatorio',
    participacao: resumo.participacao,
    totalMinutos: resumo.totalMinutos,
    info: infoPeriodo,
  });

  const totalEl = document.getElementById('horasTotalRelatorio');
  const mediaEl = document.getElementById('horasMediaRelatorio');
  const colEl = document.getElementById('horasColaboradoresRelatorio');
  const mediaMin = resumo.colaboradores ? Math.floor(resumo.totalMinutos / resumo.colaboradores) : 0;

  if (totalEl) totalEl.textContent = formatarDuracaoMinutos(resumo.totalMinutos);
  if (mediaEl) mediaEl.textContent = formatarDuracaoMinutos(mediaMin);
  if (colEl) colEl.textContent = String(resumo.colaboradores);
}

function resetFiltroRelatorioPonto() {
  relatorioPontoPeriodo = 'dia';
  document.querySelectorAll('.dashboard-period-btn[data-rel-ponto-periodo]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.relPontoPeriodo === 'dia');
  });
  const dataHoje = dataLocalISO();
  const dataInicio = document.getElementById('filtroPontoDataInicio');
  const dataFim = document.getElementById('filtroPontoDataFim');
  const horaInicio = document.getElementById('filtroPontoHoraInicio');
  const horaFim = document.getElementById('filtroPontoHoraFim');
  const funcionario = document.getElementById('filtroPontoFuncionario');

  if (dataInicio) dataInicio.value = dataHoje;
  if (dataFim) dataFim.value = dataHoje;
  if (horaInicio) horaInicio.value = '';
  if (horaFim) horaFim.value = '';
  if (funcionario?.classList?.contains('relatorio-check-filter')) {
    marcarTodosCheckboxFiltroRelatorioFinanceiro('filtroPontoFuncionario');
  } else if (funcionario) {
    funcionario.value = '';
  }
  carregarRelatorioPonto();
}

function obterNomeFornecedorRelatorioFinanceiro(item) {
  return String(item?.fornecedores?.nome || 'Fornecedor nao informado').trim() || 'Fornecedor nao informado';
}

function obterNomeFormaRelatorioFinanceiro(item) {
  const nomeForma = String(item?.formas_pagamento?.nome || item?.forma_pagamento || '').trim();
  return nomeForma || 'Nao informado';
}

function obterValorPagoRelatorioFinanceiro(item) {
  const valorPago = Number(item?.valor_pago);
  if (Number.isFinite(valorPago) && valorPago > 0) return valorPago;
  if (obterStatusContaBaixaFinanceiro(item) === 'pago') {
    const valorCompra = Number(item?.valor_compra || 0);
    return Number.isFinite(valorCompra) ? valorCompra : 0;
  }
  return 0;
}

function obterValorAbertoRelatorioFinanceiro(item) {
  if (!['a_vencer', 'vencida'].includes(obterStatusContaRelatorioFinanceiro(item))) return 0;
  const valorCompra = Number(item?.valor_compra || 0);
  return Number.isFinite(valorCompra) ? valorCompra : 0;
}

function preencherSelectRelatorioFinanceiro(selectEl, placeholder, opcoes = [], valorAtual = '') {
  if (!selectEl) return;
  const valorSelecionado = String(valorAtual || '');
  selectEl.innerHTML = `<option value="">${placeholder}</option>` + opcoes
    .map(item => `<option value="${escaparHtmlBasico(item.valor)}">${escaparHtmlBasico(item.rotulo)}</option>`)
    .join('');
  selectEl.value = opcoes.some(item => String(item.valor) === valorSelecionado) ? valorSelecionado : '';
}

const STATUS_OPCOES_RELATORIO_FINANCEIRO = [
  { valor: '', rotulo: 'Todos' },
  { valor: 'a_vencer', rotulo: 'A vencer' },
  { valor: 'vencida', rotulo: 'Vencida' },
  { valor: 'pago', rotulo: 'Pago' },
  { valor: 'excluido', rotulo: 'Excluído' },
];

function obterValoresCheckboxFiltroRelatorioFinanceiro(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return [];
  const marcados = Array.from(container.querySelectorAll('input[type="checkbox"]:checked'))
    .map(input => String(input.value || '').trim());
  if (!marcados.length || marcados.includes('')) return [];
  return marcados;
}

function obterRotulosCheckboxFiltroRelatorioFinanceiro(containerId, rotuloTodos = 'Todos') {
  const container = document.getElementById(containerId);
  if (!container) return rotuloTodos;
  const marcados = Array.from(container.querySelectorAll('input[type="checkbox"]:checked'));
  if (!marcados.length || marcados.some(input => !String(input.value || '').trim())) return rotuloTodos;
  const rotulos = marcados
    .map(input => input.closest('label')?.textContent?.trim() || '')
    .filter(Boolean);
  return rotulos.length ? rotulos.join(', ') : rotuloTodos;
}

function obterResumoCheckboxFiltroRelatorioFinanceiro(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return 'Todos';
  const rotulos = obterRotulosCheckboxFiltroRelatorioFinanceiro(containerId, 'Todos');
  if (rotulos === 'Todos') return 'Todos';
  const qtd = obterValoresCheckboxFiltroRelatorioFinanceiro(containerId).length;
  if (qtd > 1) return `${qtd} selecionados`;
  return rotulos;
}

function atualizarResumoCheckboxFiltroRelatorioFinanceiro(containerId) {
  const container = document.getElementById(containerId);
  const resumo = container?.querySelector('.relatorio-check-filter-summary');
  const consulta = container?.querySelector('.relatorio-check-filter-query');
  const exibicao = container?.querySelector('.relatorio-check-filter-display');
  const textoResumo = obterResumoCheckboxFiltroRelatorioFinanceiro(containerId);
  const placeholderConsulta = textoResumo === 'Todos'
    ? String(container.dataset.placeholder || 'Todos').trim()
    : textoResumo;
  if (resumo) resumo.textContent = textoResumo;
  if (exibicao) exibicao.textContent = placeholderConsulta;
  if (consulta && !container.classList.contains('is-open')) {
    consulta.value = '';
    consulta.placeholder = placeholderConsulta;
  }
}

function alternarTodosCheckboxRelatorioFinanceiro(containerId, marcar) {
  const container = document.getElementById(containerId);
  if (!container) return;
  // Com uma consulta ativa, marca/desmarca somente os resultados visíveis.
  container.querySelectorAll('.relatorio-check-filter-options label').forEach(label => {
    if (label.hidden || label.style.display === 'none') return;
    const input = label.querySelector('input[type="checkbox"]');
    if (input) input.checked = !!marcar;
  });
  atualizarResumoCheckboxFiltroRelatorioFinanceiro(containerId);
}

function marcarTodosCheckboxFiltroRelatorioFinanceiro(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.querySelectorAll('input[type="checkbox"]').forEach(input => {
    input.checked = false;
  });
  atualizarResumoCheckboxFiltroRelatorioFinanceiro(containerId);
}

function atualizarCheckboxFiltroRelatorioFinanceiro(containerId, checkbox) {
  const container = document.getElementById(containerId);
  if (!container || !checkbox) return;
  const todos = container.querySelector('input[type="checkbox"][value=""]');
  const opcoes = Array.from(container.querySelectorAll('input[type="checkbox"]'));
  if (String(checkbox.value || '') === '') {
    if (checkbox.checked) opcoes.forEach(input => { if (input !== checkbox) input.checked = false; });
  } else if (checkbox.checked && todos) {
    todos.checked = false;
  }
  const algumMarcado = opcoes.some(input => input.checked);
  if (!algumMarcado && todos) todos.checked = true;
  atualizarResumoCheckboxFiltroRelatorioFinanceiro(containerId);
}

function alternarDropdownCheckboxFiltroRelatorioFinanceiro(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const vaiAbrir = !container.classList.contains('is-open');
  document.querySelectorAll('.relatorio-check-filter.is-open').forEach(item => {
    if (item !== container) item.classList.remove('is-open');
  });
  container.classList.toggle('is-open', vaiAbrir);
  if (vaiAbrir) {
    posicionarDropdownCheckboxRelatorioFinanceiro(containerId);
    const consulta = container.querySelector('.relatorio-check-filter-query');
    if (consulta) setTimeout(() => consulta.focus(), 30);
  } else {
    atualizarResumoCheckboxFiltroRelatorioFinanceiro(containerId);
  }
}

function normalizarConsultaContem(valor = '') {
  return textoFinanceiroNormalizado(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function filtrarOpcoesCheckboxRelatorioFinanceiro(input, containerId) {
  const termo = normalizarConsultaContem(input?.value || '');
  const container = document.getElementById(containerId);
  if (!container) return;
  let quantidadeVisivel = 0;
  container.querySelectorAll('.relatorio-check-filter-options label').forEach(label => {
    const texto = normalizarConsultaContem(label.textContent || '');
    const corresponde = !termo || texto.includes(termo);
    label.hidden = !corresponde;
    label.style.display = corresponde ? 'flex' : 'none';
    if (corresponde) quantidadeVisivel += 1;
  });
  const selecionarTodos = container.querySelector('.relatorio-check-filter-todos');
  const selecionarTodosTexto = selecionarTodos?.querySelector('span');
  const selecionarTodosInput = selecionarTodos?.querySelector('input[type="checkbox"]');
  if (selecionarTodosTexto) {
    selecionarTodosTexto.textContent = termo
      ? `Selecionar resultados (${quantidadeVisivel})`
      : 'Selecionar todos';
  }
  if (selecionarTodosInput) {
    selecionarTodosInput.disabled = quantidadeVisivel === 0;
    selecionarTodosInput.checked = false;
  }
}

function abrirDropdownCheckboxRelatorioFinanceiro(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!container.classList.contains('is-open')) {
    alternarDropdownCheckboxFiltroRelatorioFinanceiro(containerId);
    return;
  }
  posicionarDropdownCheckboxRelatorioFinanceiro(containerId);
}

function posicionarDropdownCheckboxRelatorioFinanceiro(containerId) {
  const container = document.getElementById(containerId);
  const head = container?.querySelector('.relatorio-check-filter-head, .fornecedor-multi-search');
  const panel = container?.querySelector('.relatorio-check-filter-panel');
  if (!container || !head || !panel) return;
  const rect = head.getBoundingClientRect();
  const margem = 6;
  const largura = Math.max(rect.width, 220);
  const espacoAbaixo = window.innerHeight - rect.bottom - margem;
  const altura = Math.min(244, Math.max(140, espacoAbaixo - margem));
  const abrirParaCima = espacoAbaixo < 150 && rect.top > 170;
  panel.style.width = `${largura}px`;
  panel.style.maxHeight = `${altura}px`;
  panel.style.left = `${Math.max(margem, Math.min(rect.left, window.innerWidth - largura - margem))}px`;
  panel.style.top = abrirParaCima
    ? `${Math.max(margem, rect.top - altura - margem)}px`
    : `${rect.bottom + margem}px`;
}

function prepararEventosCheckboxRelatorioFinanceiro() {
  if (window.__relatorioFinanceiroCheckboxEventos) return;
  window.__relatorioFinanceiroCheckboxEventos = true;
  document.addEventListener('click', event => {
    if (!event.target.closest?.('.relatorio-check-filter')) {
      document.querySelectorAll('.relatorio-check-filter.is-open').forEach(item => {
        item.classList.remove('is-open');
        atualizarResumoCheckboxFiltroRelatorioFinanceiro(item.id);
      });
    }
  });
  window.addEventListener('resize', () => {
    document.querySelectorAll('.relatorio-check-filter.is-open').forEach(item => posicionarDropdownCheckboxRelatorioFinanceiro(item.id));
  });
  window.addEventListener('scroll', () => {
    document.querySelectorAll('.relatorio-check-filter.is-open').forEach(item => posicionarDropdownCheckboxRelatorioFinanceiro(item.id));
  }, true);
}

function renderizarCheckboxFiltroRelatorioFinanceiro(containerId, opcoes = [], valoresAtuais = [], acaoChange = '') {
  const container = document.getElementById(containerId);
  if (!container) return;
  prepararEventosCheckboxRelatorioFinanceiro();
  const valores = new Set((Array.isArray(valoresAtuais) ? valoresAtuais : [valoresAtuais]).map(valor => String(valor || '').trim()).filter(Boolean));
  const somenteExibicao = container.dataset.displayOnly === 'true';
  const pesquisaFornecedor = containerId === 'filtroRelFinanceiroFornecedor';
  const opcoesComTodos = opcoes.filter(item => String(item.valor || '').trim());
  const temValorValido = opcoesComTodos.some(item => valores.has(String(item.valor || '').trim()));
  const htmlOpcoes = opcoesComTodos.map((item, idx) => {
    const valor = String(item.valor || '').trim();
    const checked = valor ? (temValorValido && valores.has(valor)) : !temValorValido;
    const inputId = `${containerId}_${idx}`;
    return `
      <label for="${escaparHtmlBasico(inputId)}" title="${escaparHtmlBasico(item.rotulo)}">
        <input id="${escaparHtmlBasico(inputId)}" type="checkbox" value="${escaparHtmlBasico(valor)}" ${checked ? 'checked' : ''} onchange="atualizarCheckboxFiltroRelatorioFinanceiro('${containerId}', this); ${acaoChange}">
        <span>${escaparHtmlBasico(item.rotulo)}</span>
      </label>
    `;
  }).join('');
  const cabecalho = pesquisaFornecedor
    ? `<div class="fornecedor-multi-search">
        <span class="fornecedor-multi-search-icon" aria-hidden="true">⌕</span>
        <input class="relatorio-check-filter-query fornecedor-multi-search-input" type="search" autocomplete="off" placeholder="Digite o fornecedor" aria-label="Pesquisar fornecedor" onfocus="abrirDropdownCheckboxRelatorioFinanceiro('${containerId}')" oninput="filtrarOpcoesCheckboxRelatorioFinanceiro(this, '${containerId}')" onkeydown="if(event.key==='Escape'){this.closest('.relatorio-check-filter')?.classList.remove('is-open'); this.blur(); atualizarResumoCheckboxFiltroRelatorioFinanceiro('${containerId}');}">
      </div>`
    : somenteExibicao
      ? `<button class="relatorio-check-filter-head relatorio-check-filter-button" type="button" onclick="alternarDropdownCheckboxFiltroRelatorioFinanceiro('${containerId}')">
        <span class="relatorio-check-filter-display"></span>
        <span class="relatorio-check-filter-arrow">▾</span>
      </button>`
      : `<div class="relatorio-check-filter-head" onclick="abrirDropdownCheckboxRelatorioFinanceiro('${containerId}')">
        <input class="relatorio-check-filter-query" type="search" autocomplete="off" onfocus="abrirDropdownCheckboxRelatorioFinanceiro('${containerId}')" oninput="filtrarOpcoesCheckboxRelatorioFinanceiro(this, '${containerId}')" onkeydown="if(event.key==='Escape'){this.closest('.relatorio-check-filter')?.classList.remove('is-open'); this.blur(); atualizarResumoCheckboxFiltroRelatorioFinanceiro('${containerId}');}">
        <span class="relatorio-check-filter-summary"></span>
        <span class="relatorio-check-filter-arrow">▾</span>
      </div>`;
  container.innerHTML = `
    ${cabecalho}
    <div class="relatorio-check-filter-panel" onclick="event.stopPropagation()">
      <label class="relatorio-check-filter-todos" style="border-bottom:1px solid var(--border);font-weight:600;">
        <input type="checkbox" onchange="alternarTodosCheckboxRelatorioFinanceiro('${containerId}', this.checked); ${acaoChange}">
        <span>Selecionar todos</span>
      </label>
      <div class="relatorio-check-filter-options">${htmlOpcoes}</div>
    </div>
  `;
  atualizarResumoCheckboxFiltroRelatorioFinanceiro(containerId);
  if (container.classList.contains('is-open')) {
    requestAnimationFrame(() => posicionarDropdownCheckboxRelatorioFinanceiro(containerId));
  }
}

const CORES_PIZZA_RELATORIO_FINANCEIRO = ['#22c55e', '#3b82f6', '#f97316', '#ef4444', '#a855f7', '#14b8a6', '#eab308', '#f43f5e', '#84cc16', '#06b6d4'];

function renderizarPizzaRelatorioFinanceiro(containerId, itens = [], mensagemVazia = 'Sem dados para o gráfico no período.') {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!itens.length) {
    container.className = 'rf-pie-dashboard';
    container.innerHTML = `<div class="empty">${escaparHtmlBasico(mensagemVazia)}</div>`;
    return;
  }

  const totalGeral = itens.reduce((acc, item) => acc + (Number(item.total || 0) || 0), 0);

  if (!totalGeral) {
    container.className = 'rf-pie-dashboard';
    container.innerHTML = '<div class="empty">Sem valores para representar no gráfico.</div>';
    return;
  }

  let acumulado = 0;
  const fatias = itens.map((item, idx) => {
    const valor = Math.max(0, Number(item.total || 0) || 0);
    const inicio = acumulado;
    const fim = acumulado + (valor / totalGeral) * 100;
    acumulado = fim;
    const cor = CORES_PIZZA_RELATORIO_FINANCEIRO[idx % CORES_PIZZA_RELATORIO_FINANCEIRO.length];
    return { item, valor, inicio, fim, cor };
  }).filter(fatia => fatia.valor > 0);

  const gradiente = fatias.map(fatia => `${fatia.cor} ${fatia.inicio.toFixed(2)}% ${fatia.fim.toFixed(2)}%`).join(', ');
  const maior = fatias[0];

  container.className = 'rf-pie-dashboard';
  container.innerHTML = `
    <div class="rf-pie" style="background: conic-gradient(${gradiente});" title="${escaparHtmlBasico(maior?.item?.nome || '-')}: ${escaparHtmlBasico(formatarMoedaBRFinanceiro(maior?.valor || 0))}"></div>
    <div class="rf-pie-legenda">
      ${fatias.map(fatia => {
        const percentual = totalGeral ? ((fatia.valor / totalGeral) * 100) : 0;
        return `
          <div class="rf-pie-legenda-item" title="${escaparHtmlBasico(fatia.item.nome || '-')}: ${escaparHtmlBasico(formatarMoedaBRFinanceiro(fatia.valor))} (${percentual.toFixed(1)}%)">
            <span class="rf-pie-swatch" style="background:${fatia.cor}"></span>
            <span class="rf-pie-nome">${escaparHtmlBasico(fatia.item.nome || '-')}</span>
            <span class="rf-pie-valor">${escaparHtmlBasico(formatarMoedaBRFinanceiro(fatia.valor))}</span>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderizarListaResumoRelatorioFinanceiro(containerId, itens = [], tipo = '') {
  const lista = document.getElementById(containerId);
  if (!lista) return;

  if (!itens.length) {
    lista.innerHTML = '';
    return;
  }

  lista.innerHTML = '<div class="lista">' + itens.slice(0, 3).map((item, idx) => {
    return `
      <div class="item" title="${escaparHtmlBasico(item.nome || '-')}: ${escaparHtmlBasico(formatarMoedaBRFinanceiro(item.total || 0))}">
        <div class="item-info">
          <div class="item-nome">${idx + 1}. ${escaparHtmlBasico(item.nome || '-')}</div>
          <div class="item-detalhe">Total pago: ${formatarMoedaBRFinanceiro(item.total || 0)} · ${tipo === 'formas' ? 'Utilizações' : 'Pagamentos'}: ${item.qtd || 0}</div>
        </div>
      </div>
    `;
  }).join('') + '</div>';
}

function renderizarDashboardFornecedoresRelatorioFinanceiro(itens = []) {
  const lista = document.getElementById('listaRelatorioFinanceiroFornecedores');
  if (!lista) return;

  const agregados = {};
  itens.forEach(item => {
    if (obterStatusContaRelatorioFinanceiro(item) !== 'pago') return;
    const nome = obterNomeFornecedorRelatorioFinanceiro(item);
    if (!agregados[nome]) agregados[nome] = { nome, total: 0, qtd: 0 };
    agregados[nome].total += obterValorPagoRelatorioFinanceiro(item);
    agregados[nome].qtd += 1;
  });

  const ranking = Object.values(agregados)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  if (!ranking.length) {
    renderizarPizzaRelatorioFinanceiro('graficoRelatorioFinanceiroFornecedores', [], 'Sem pagamentos confirmados para montar o ranking de fornecedores.');
    lista.innerHTML = '';
    return;
  }

  renderizarPizzaRelatorioFinanceiro('graficoRelatorioFinanceiroFornecedores', ranking);
  renderizarListaResumoRelatorioFinanceiro('listaRelatorioFinanceiroFornecedores', ranking, 'fornecedores');
}

function renderizarDashboardFormasRelatorioFinanceiro(itens = []) {
  const lista = document.getElementById('listaRelatorioFinanceiroFormas');
  if (!lista) return;

  const agregados = {};
  itens.forEach(item => {
    if (obterStatusContaRelatorioFinanceiro(item) !== 'pago') return;
    const nome = obterNomeFormaRelatorioFinanceiro(item);
    if (!agregados[nome]) agregados[nome] = { nome, total: 0, qtd: 0 };
    agregados[nome].total += obterValorPagoRelatorioFinanceiro(item);
    agregados[nome].qtd += 1;
  });

  const ranking = Object.values(agregados)
    .sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      return b.qtd - a.qtd;
    })
    .slice(0, 10);

  if (!ranking.length) {
    renderizarPizzaRelatorioFinanceiro('graficoRelatorioFinanceiroFormas', [], 'Sem pagamentos confirmados para montar o dashboard de formas.');
    lista.innerHTML = '';
    return;
  }

  renderizarPizzaRelatorioFinanceiro('graficoRelatorioFinanceiroFormas', ranking);
  renderizarListaResumoRelatorioFinanceiro('listaRelatorioFinanceiroFormas', ranking, 'formas');
}

function escaparCsvRelatorioFinanceiro(valor = '') {
  const texto = String(valor ?? '');
  return `"${texto.replace(/"/g, '""')}"`;
}

function obterInfoParcelasRelatorioFinanceiro(item = {}) {
  const qtdParcelas = Math.max(1, Number.parseInt(String(item.qtd_parcelas || 1), 10) || 1);
  const numeroParcela = Math.min(qtdParcelas, Math.max(1, Number.parseInt(String(item.numero_parcela || 1), 10) || 1));
  const restantes = Math.max(0, qtdParcelas - numeroParcela);
  const temParcelamento = qtdParcelas > 1;
  return {
    qtdParcelas,
    numeroParcela,
    restantes,
    temParcelamento,
    parcelaTexto: temParcelamento ? `${numeroParcela} de ${qtdParcelas}` : '-',
    qtdTexto: temParcelamento ? String(qtdParcelas) : '-',
    restantesTexto: temParcelamento ? String(restantes) : '-',
    resumoTexto: temParcelamento
      ? `Qtd. parcelas: ${qtdParcelas} · Parcela atual: ${numeroParcela} de ${qtdParcelas} · Restantes após esta: ${restantes}`
      : 'Sem parcelamento',
  };
}

function ehContaEditadaRelatorioFinanceiro(item = {}) {
  if (!item?.updated_at || !item?.created_at || item?.excluido_em) return false;
  const atualizado = new Date(item.updated_at).getTime();
  const criado = new Date(item.created_at).getTime();
  if (!Number.isFinite(atualizado) || !Number.isFinite(criado)) return false;
  return atualizado - criado > 60000;
}

function obterFiltrosRodapeRelatorioFinanceiro() {
  const inicio = String(document.getElementById('filtroRelFinanceiroDataInicio')?.value || '').trim();
  const fim = String(document.getElementById('filtroRelFinanceiroDataFim')?.value || '').trim();
  const status = obterRotulosCheckboxFiltroRelatorioFinanceiro('filtroRelFinanceiroStatus', 'Todos os status');
  const fornecedor = obterRotulosCheckboxFiltroRelatorioFinanceiro('filtroRelFinanceiroFornecedor', 'Todos os fornecedores');
  const categoria = obterRotulosCheckboxFiltroRelatorioFinanceiro('filtroRelFinanceiroCategoria', 'Todas as categorias');
  const lojaAtualId = String(obterLojaIdSessao?.() || usuarioSistemaLogado?.loja_id || obterLojaAtualParaIsolamento?.() || '').trim();
  const lojas = obterNomeLojaFiltroMultiLoja(lojaAtualId) || 'Loja atual';
  return [
    `Vencimento: ${inicio ? formatarDataBRFinanceiro(inicio) : '-'} até ${fim ? formatarDataBRFinanceiro(fim) : '-'}`,
    `Status: ${status}`,
    `Fornecedor: ${fornecedor}`,
    `Categoria: ${categoria}`,
    `Loja: ${lojas}`,
  ].join(' | ');
}

function obterUsuarioRodapeRelatorioImpressao() {
  const usuario = typeof usuarioSistemaLogado !== 'undefined' ? usuarioSistemaLogado : null;
  return String(
    usuario?.nome ||
    usuario?.username ||
    usuario?.email ||
    obterNomeAdminAtual?.() ||
    'Usuário não identificado'
  ).trim();
}

function cssRodapeRelatorioImpressao() {
  return `
    .rodape-relatorio {
      position: fixed;
      left: 20px;
      right: 20px;
      bottom: 8px;
      border-top: 1px solid #ddd;
      padding-top: 4px;
      font-size: 9px;
      color: #555;
      background: #fff;
    }
    @media print {
      body { padding-bottom: 34px; }
      .rodape-relatorio { display: block; }
    }
  `;
}

function htmlRodapeRelatorioImpressao(geradoEm = '', filtros = '') {
  return `<div class="rodape-relatorio">Gerado em: ${escaparHtmlBasico(geradoEm || new Date().toLocaleString('pt-BR'))} | Usuário: ${escaparHtmlBasico(obterUsuarioRodapeRelatorioImpressao())} | Filtros: ${escaparHtmlBasico(filtros || '-')}</div>`;
}

function exportarRelatorioFinanceiroCsv() {
  const itens = Array.isArray(relatorioFinanceiroCache) ? relatorioFinanceiroCache : [];
  if (!itens.length) {
    setMsg('msgRelatorioFinanceiro', 'Não há dados para exportar. Aplique filtros e carregue o relatório.', 'err');
    return;
  }

  const agrupar = document.getElementById('relFinanceiroAgrupar')?.checked === true;
  let cabecalho, linhas;

  if (agrupar) {
    // Modo agrupado: uma linha por fornecedor
    const grupos = {};
    itens.forEach(item => {
      const nome = obterNomeFornecedorRelatorioFinanceiro(item);
      const pago = obterStatusContaRelatorioFinanceiro(item) === 'pago';
      const valor = Number(item.valor_compra || 0);
      if (!grupos[nome]) grupos[nome] = { nome, grupo: obterNomeGrupoRelatorioFinanceiro(item), qtd: 0, pago: 0, pendente: 0 };
      grupos[nome].qtd += 1;
      if (pago) grupos[nome].pago += valor; else grupos[nome].pendente += valor;
    });
    cabecalho = ['Fornecedor', 'Grupo', 'Qtd titulos', 'Total pago', 'Total em aberto', 'Total geral'];
    linhas = Object.values(grupos)
      .sort((a, b) => (b.pago + b.pendente) - (a.pago + a.pendente))
      .map(g => [
        g.nome,
        g.grupo,
        String(g.qtd),
        g.pago.toFixed(2),
        g.pendente.toFixed(2),
        (g.pago + g.pendente).toFixed(2),
      ].map(escaparCsvRelatorioFinanceiro).join(';'));
  } else {
    cabecalho = [
      'Fornecedor', 'Grupo', 'Categoria', 'Status', 'Forma de pagamento',
      'Data compra', 'Data vencimento', 'Data pagamento', 'Valor original', 'Valor previsto/atual', 'Valor pago',
      'PARCELA ATUAL', 'PARCELAS RESTANTES', 'Observacao',
      'Criado por', 'Cadastrado em', 'Excluido por', 'Excluido em',
    ];
    linhas = itens.map(item => {
      const statusAtual = obterStatusContaRelatorioFinanceiro(item);
      const status = statusAtual === 'pago' ? 'Pago' : (statusAtual === 'excluido' ? 'Excluído' : (statusAtual === 'vencida' ? 'Vencida' : 'A vencer'));
      const infoParcelas = obterInfoParcelasRelatorioFinanceiro(item);
      return [
        obterNomeFornecedorRelatorioFinanceiro(item),
        obterNomeGrupoRelatorioFinanceiro(item),
        obterNomeCategoriaRelatorioFinanceiro(item),
        status,
        obterNomeFormaRelatorioFinanceiro(item),
        item.data_compra || '',
        item.data_vencimento || '',
        item.data_pagamento || '',
        Number(item.valor_original ?? item.valor_compra ?? 0).toFixed(2),
        Number(item.valor_compra || 0).toFixed(2),
        obterValorPagoRelatorioFinanceiro(item).toFixed(2),
        infoParcelas.parcelaTexto,
        infoParcelas.restantesTexto,
        String(item.observacao || '').trim(),
        String(item.criado_por_nome || 'Cadastro anterior').trim(),
        item.created_at ? fmtDate(item.created_at) : '-',
        String(item.excluido_por_nome || '').trim() || '-',
        item.excluido_em ? fmtDate(item.excluido_em) : '-',
      ].map(escaparCsvRelatorioFinanceiro).join(';');
    });
  }

  const conteudo = [cabecalho.map(escaparCsvRelatorioFinanceiro).join(';'), ...linhas].join('\n');
  const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `relatorio-financeiro-${hoje()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  setMsg('msgRelatorioFinanceiro', 'CSV exportado com sucesso.', 'ok');
}

function obterNomeCategoriaRelatorioFinanceiro(item) {
  const id = item?.categoria_id;
  if (!id) return 'Sem categoria';
  return (categoriasCompraCache || []).find(c => String(c.id) === String(id))?.nome || 'Sem categoria';
}

function obterNomeGrupoRelatorioFinanceiro(item) {
  const grupoId = item?.fornecedores?.grupo_id;
  if (!grupoId) return '-';
  return (gruposFornecedorCache || []).find(g => String(g.id) === String(grupoId))?.nome || '-';
}

function imprimirRelatorioFinanceiroPdf() {
  const itens = Array.isArray(relatorioFinanceiroCache) ? relatorioFinanceiroCache : [];
  if (!itens.length) {
    setMsg('msgRelatorioFinanceiro', 'Não há dados para exportar em PDF. Aplique filtros e carregue o relatório.', 'err');
    return;
  }

  const totalPago = itens.reduce((acc, item) => acc + obterValorPagoRelatorioFinanceiro(item), 0);
  const totalPendente = itens.reduce((acc, item) => acc + obterValorAbertoRelatorioFinanceiro(item), 0);
  const totalGeral = totalPendente;
  const dataGeracaoRelatorio = new Date().toLocaleString('pt-BR');
  const filtrosRodape = obterFiltrosRodapeRelatorioFinanceiro();
  const agrupar = document.getElementById('relFinanceiroAgrupar')?.checked === true;

  let cabecalhoCols, linhas;
  if (agrupar) {
    // Modo agrupado: uma linha por fornecedor
    const grupos = {};
    itens.forEach(item => {
      const nome = obterNomeFornecedorRelatorioFinanceiro(item);
      const pago = obterStatusContaRelatorioFinanceiro(item) === 'pago';
      const valor = Number(item.valor_compra || 0);
      if (!grupos[nome]) grupos[nome] = { nome, grupo: obterNomeGrupoRelatorioFinanceiro(item), qtd: 0, pago: 0, pendente: 0 };
      grupos[nome].qtd += 1;
      if (pago) grupos[nome].pago += valor; else grupos[nome].pendente += valor;
    });
    cabecalhoCols = ['Fornecedor', 'Grupo', 'Qtd. títulos', 'Pago', 'Em aberto', 'Total'];
    linhas = Object.values(grupos)
      .sort((a, b) => (b.pago + b.pendente) - (a.pago + a.pendente))
      .map(g => `
        <tr>
          <td>${escaparHtmlBasico(g.nome)}</td>
          <td>${escaparHtmlBasico(g.grupo)}</td>
          <td>${g.qtd}</td>
          <td>${escaparHtmlBasico(formatarMoedaBRFinanceiro(g.pago))}</td>
          <td>${escaparHtmlBasico(formatarMoedaBRFinanceiro(g.pendente))}</td>
          <td>${escaparHtmlBasico(formatarMoedaBRFinanceiro(g.pago + g.pendente))}</td>
        </tr>`).join('');
  } else {
    cabecalhoCols = ['Fornecedor', 'Categoria', 'Status', 'Forma', 'Vencimento', 'Original', 'Atual', 'Pago', 'Parcela', 'Rest.', 'Observação', 'Cadastro'];
    linhas = itens.map(item => {
      const statusAtual = obterStatusContaRelatorioFinanceiro(item);
      const status = statusAtual === 'pago' ? 'Pago' : (statusAtual === 'excluido' ? 'Excluído' : (statusAtual === 'vencida' ? 'Vencida' : 'A vencer'));
      const infoParcelas = obterInfoParcelasRelatorioFinanceiro(item);
      const classeLinha = statusAtual === 'excluido' ? 'linha-excluida' : (ehContaEditadaRelatorioFinanceiro(item) ? 'linha-editada' : '');
      return `
        <tr class="${classeLinha}">
          <td>${escaparHtmlBasico(obterNomeFornecedorRelatorioFinanceiro(item))}</td>
          <td>${escaparHtmlBasico(obterNomeCategoriaRelatorioFinanceiro(item))}</td>
          <td>${escaparHtmlBasico(status)}</td>
          <td>${escaparHtmlBasico(obterNomeFormaRelatorioFinanceiro(item))}</td>
          <td>${escaparHtmlBasico(formatarDataBRFinanceiro(item.data_vencimento))}</td>
          <td>${escaparHtmlBasico(formatarMoedaBRFinanceiro(item.valor_original ?? item.valor_compra ?? 0))}</td>
          <td>${escaparHtmlBasico(formatarMoedaBRFinanceiro(item.valor_compra || 0))}</td>
          <td>${escaparHtmlBasico(formatarMoedaBRFinanceiro(obterValorPagoRelatorioFinanceiro(item)))}</td>
          <td>${escaparHtmlBasico(infoParcelas.parcelaTexto)}</td>
          <td>${escaparHtmlBasico(infoParcelas.restantesTexto)}</td>
          <td>${escaparHtmlBasico(String(item.observacao || '').trim() || '-')}</td>
          <td>${escaparHtmlBasico(String(item.criado_por_nome || 'Cadastro anterior').trim() || 'Cadastro anterior')}<br>${escaparHtmlBasico(item.created_at ? fmtDate(item.created_at) : '-')}</td>
        </tr>`;
    }).join('');
  }
  const cabecalhoHtml = cabecalhoCols.map(c => `<th>${escaparHtmlBasico(c)}</th>`).join('');

  const janela = window.open('', '_blank', 'width=1100,height=760');
  if (!janela) {
    setMsg('msgRelatorioFinanceiro', 'O navegador bloqueou a janela de impressão. Libere pop-ups para exportar o PDF.', 'err');
    return;
  }

  janela.document.write(`
    <html>
      <head>
        <title>Relatório de contas a pagar</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 8px; color: #111; }
          @page { size: A4 landscape; margin: 8mm; }
          h1 { margin: 0 0 4px; font-size: 13px; }
          .meta { margin-bottom: 6px; font-size: 8px; color: #444; }
          .totais { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; margin-bottom: 8px; }
          .box { border: 1px solid #d0d0d0; border-radius: 4px; padding: 4px 6px; }
          .box .label { font-size: 7px; color: #666; text-transform: uppercase; }
          .box .valor { font-size: 11px; font-weight: bold; margin-top: 2px; }
          table { width: 100%; border-collapse: collapse; font-size: 7.5px; table-layout: fixed; }
          th, td { border: 1px solid #ddd; padding: 2px 3px; text-align: left; vertical-align: top; word-wrap: break-word; overflow-wrap: break-word; }
          th { background: #f5f5f5; font-size: 7.5px; font-weight: bold; }
          /* Larguras fixas para auditoria de valores em A4 paisagem. */
          col.c-forn     { width: 18%; }
          col.c-cat      { width: 13%; }
          col.c-status   { width: 7%;  }
          col.c-forma    { width: 9%;  }
          col.c-venc     { width: 9%;  }
          col.c-valor    { width: 8%;  }
          col.c-original { width: 8%;  }
          col.c-pago     { width: 8%;  }
          col.c-variacao { width: 8%;  }
          col.c-parcela  { width: 7%;  }
          col.c-rest     { width: 4%;  }
          col.c-obs      { width: 16%; }
          col.c-cad      { width: 9%;  }
          .legenda { display: flex; gap: 14px; align-items: center; margin: 0 0 12px; font-size: 11px; color: #333; }
          .legenda-item { display: inline-flex; align-items: center; gap: 6px; }
          .legenda-cor { width: 22px; height: 10px; border: 1px solid #bbb; display: inline-block; }
          .legenda-cor.editada { background: #f3e8ff; border-color: #c084fc; }
          .legenda-cor.excluida { background: #fff1f2; border-color: #ef4444; position: relative; }
          .legenda-cor.excluida:after { content: ''; position: absolute; left: -2px; right: -2px; top: 50%; border-top: 2px solid #dc2626; }
          tr.linha-editada td { background: #f3e8ff; }
          tr.linha-excluida td { background: #fff1f2; color: #7f1d1d; text-decoration: line-through; text-decoration-color: #dc2626; text-decoration-thickness: 2px; }
          ${cssRodapeRelatorioImpressao()}
        </style>
      </head>
      <body>
        <h1>Relatório de contas a pagar</h1>
        <div class="meta">Gerado em: ${escaparHtmlBasico(dataGeracaoRelatorio)}</div>
        <div class="totais">
          <div class="box"><div class="label">Total pendente</div><div class="valor">${escaparHtmlBasico(formatarMoedaBRFinanceiro(totalGeral))}</div></div>
          <div class="box"><div class="label">Total pago</div><div class="valor">${escaparHtmlBasico(formatarMoedaBRFinanceiro(totalPago))}</div></div>
          <div class="box"><div class="label">Total em aberto</div><div class="valor">${escaparHtmlBasico(formatarMoedaBRFinanceiro(totalPendente))}</div></div>
          <div class="box"><div class="label">Qtd. títulos</div><div class="valor">${escaparHtmlBasico(String(itens.length))}</div></div>
        </div>
        <div class="legenda">
          <span class="legenda-item"><span class="legenda-cor editada"></span> Conta editada</span>
          <span class="legenda-item"><span class="legenda-cor excluida"></span> Conta excluída</span>
        </div>
        <table>
          <colgroup>
            <col class="c-forn"><col class="c-cat"><col class="c-status">
            <col class="c-forma"><col class="c-venc"><col class="c-original"><col class="c-valor"><col class="c-pago"><col class="c-variacao">
            <col class="c-parcela"><col class="c-rest"><col class="c-obs"><col class="c-cad">
          </colgroup>
          <thead>
            <tr>${cabecalhoHtml}</tr>
          </thead>
          <tbody>${linhas}</tbody>
        </table>
        ${htmlRodapeRelatorioImpressao(dataGeracaoRelatorio, filtrosRodape)}
      


</body>
    </html>
  `);
  janela.document.close();
  janela.focus();
  janela.print();
  setMsg('msgRelatorioFinanceiro', 'PDF preparado para impressão.', 'ok');
}

function renderizarDetalhesRelatorioFinanceiro(itens = []) {
  relatorioFinanceiroDetalhesAberto = true;
  const card = document.getElementById('cardDetalhamentoRelatorioFinanceiro');
  if (card) card.hidden = false;
  const btn = document.getElementById('btnToggleTitulosRelatorioFinanceiro');
  if (btn) btn.setAttribute('aria-expanded', 'true');
  const desc = document.getElementById('rfTitulosToggleDesc');
  if (desc) desc.textContent = 'Clique para ocultar os títulos';

  const lista = document.getElementById('listaRelatorioFinanceiro');
  if (!lista) return;

  if (!itens.length) {
    lista.innerHTML = '<div class="empty">Nenhum titulo encontrado com os filtros selecionados.</div>';
    return;
  }

  const statusSelecionadosOrdenacao = obterValoresCheckboxFiltroRelatorioFinanceiro('filtroRelFinanceiroStatus');
  const ordenados = [...itens].sort((a, b) => {
    if (statusSelecionadosOrdenacao.length === 1 && statusSelecionadosOrdenacao[0] === 'excluido') {
      const aExcluido = obterStatusContaRelatorioFinanceiro(a) === 'excluido' ? 1 : 0;
      const bExcluido = obterStatusContaRelatorioFinanceiro(b) === 'excluido' ? 1 : 0;
      if (aExcluido !== bExcluido) return bExcluido - aExcluido;
    }
    const dataA = new Date(obterDataReferenciaContaRelatorioFinanceiro(a) || '1970-01-01T00:00:00').getTime();
    const dataB = new Date(obterDataReferenciaContaRelatorioFinanceiro(b) || '1970-01-01T00:00:00').getTime();
    return dataB - dataA;
  });

  const totalExcluidos = ordenados.filter(item => obterStatusContaRelatorioFinanceiro(item) === 'excluido').length;
  const resumoExcluidos = totalExcluidos
    ? `<div class="rf-alerta-excluidos">${totalExcluidos} conta(s) excluída(s) exibida(s) abaixo. Os registros excluídos ficam destacados em vermelho.</div>`
    : '';

  // Modo AGRUPADO: uma linha por fornecedor, consolidando os títulos.
  const agrupar = document.getElementById('relFinanceiroAgrupar')?.checked === true;
  if (agrupar) {
    const grupos = {};
    ordenados.forEach(item => {
      const nome = obterNomeFornecedorRelatorioFinanceiro(item);
      const pago = obterStatusContaRelatorioFinanceiro(item) === 'pago';
      const valor = Number(item.valor_compra || 0);
      if (!grupos[nome]) grupos[nome] = { nome, qtd: 0, pago: 0, pendente: 0 };
      grupos[nome].qtd += 1;
      if (pago) grupos[nome].pago += valor; else grupos[nome].pendente += valor;
    });
    const linhas = Object.values(grupos)
      .sort((a, b) => (b.pago + b.pendente) - (a.pago + a.pendente));
    lista.innerHTML = resumoExcluidos + `
      <div class="rf-grupo-cabecalho" aria-hidden="true">
        <span>Fornecedor</span>
        <span>Pago</span>
        <span>Em aberto</span>
        <span>Total</span>
        <span>Títulos</span>
      </div>
      <div class="lista rf-grupo-lista">` + linhas.map(g => `
      <div class="item rf-grupo-item">
        <strong class="rf-grupo-fornecedor">${escaparHtmlBasico(g.nome)}</strong>
        <span class="rf-grupo-pago">${formatarMoedaBRFinanceiro(g.pago)}</span>
        <span class="rf-grupo-aberto">${formatarMoedaBRFinanceiro(g.pendente)}</span>
        <span class="rf-grupo-total">${formatarMoedaBRFinanceiro(g.pago + g.pendente)}</span>
        <strong class="rf-grupo-qtd">${g.qtd}</strong>
      </div>
    `).join('') + '</div>';
    return;
  }

  lista.innerHTML = resumoExcluidos + '<div class="lista">' + ordenados.map(item => {
    const status = obterStatusContaRelatorioFinanceiro(item);
    const valorCompra = Number(item.valor_compra || 0);
    const valorOriginal = Number(item.valor_original ?? item.valor_compra ?? 0);
    const valorRealizado = status === 'pago' ? obterValorPagoRelatorioFinanceiro(item) : valorCompra;
    const fornecedor = obterNomeFornecedorRelatorioFinanceiro(item);
    const forma = obterNomeFormaRelatorioFinanceiro(item);
    const observacao = String(item.observacao || '').trim() || '-';
    const classeItem = status === 'excluido' ? 'item item-relatorio-excluido' : 'item';
    const infoParcelas = obterInfoParcelasRelatorioFinanceiro(item);
    return `
      <div class="${classeItem}">
        <div class="item-info">
          <div class="item-nome">${escaparHtmlBasico(fornecedor)}</div>
          <div class="item-detalhe">Compra: ${formatarDataBRFinanceiro(item.data_compra)} · Vencimento: ${formatarDataBRFinanceiro(item.data_vencimento)} · Pagamento: ${formatarDataBRFinanceiro(item.data_pagamento)}</div>
          <div class="item-detalhe">Original: ${formatarMoedaBRFinanceiro(valorOriginal)} · Previsto/atual: ${formatarMoedaBRFinanceiro(valorCompra)} · ${status === 'pago' ? `Pago: ${formatarMoedaBRFinanceiro(valorRealizado)}` : `A pagar: ${formatarMoedaBRFinanceiro(valorRealizado)}`}</div>
          <div class="item-detalhe">Forma de pagamento: ${escaparHtmlBasico(forma)} · ${escaparHtmlBasico(infoParcelas.resumoTexto)}</div>
          <div class="item-detalhe">Obs.: ${escaparHtmlBasico(observacao)}</div>
          <div class="item-detalhe">Cadastro: ${escaparHtmlBasico(String(item.criado_por_nome || 'Cadastro anterior').trim() || 'Cadastro anterior')} · ${escaparHtmlBasico(item.created_at ? fmtDate(item.created_at) : '-')}</div>
          <div class="item-detalhe">Exclusão: ${escaparHtmlBasico(String(item.excluido_por_nome || '').trim() || '-')} · ${escaparHtmlBasico(item.excluido_em ? fmtDate(item.excluido_em) : '-')}</div>
        </div>
        <div class="item-destaque" style="display:flex;flex-direction:column;justify-content:center;align-items:center;gap:6px;flex:1;min-width:260px;padding:8px 16px;">
          <div style="display:flex;flex-direction:column;align-items:center;line-height:1;">
            <span style="font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#fca5a5;">Vencimento</span>
            <span style="font-size:30px;font-weight:900;color:#ff5b5b;text-shadow:0 0 12px rgba(255,91,91,.45);">${formatarDataBRFinanceiro(item.data_vencimento)}</span>
          </div>
          <div style="display:flex;flex-direction:column;align-items:center;line-height:1;">
            <span style="font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#fde047;">Valor</span>
            <span style="font-size:34px;font-weight:900;color:#ffd400;text-shadow:0 0 12px rgba(255,212,0,.45);">${formatarMoedaBRFinanceiro(valorCompra)}</span>
          </div>
        </div>
        <div class="item-actions">
          ${tagStatusContaRelatorioFinanceiro(status)}
        </div>
      </div>
    `;
  }).join('') + '</div>';
}

function ocultarDetalhesRelatorioFinanceiro() {
  relatorioFinanceiroDetalhesAberto = false;
  const card = document.getElementById('cardDetalhamentoRelatorioFinanceiro');
  if (card) card.hidden = true;
  const lista = document.getElementById('listaRelatorioFinanceiro');
  if (lista) lista.innerHTML = '';
  const btn = document.getElementById('btnToggleTitulosRelatorioFinanceiro');
  if (btn) btn.setAttribute('aria-expanded', 'false');
  const desc = document.getElementById('rfTitulosToggleDesc');
  if (desc) desc.textContent = 'Clique para ver os títulos';
}

function toggleDetalhesRelatorioFinanceiro() {
  if (relatorioFinanceiroDetalhesAberto) {
    ocultarDetalhesRelatorioFinanceiro();
    return;
  }
  renderizarDetalhesRelatorioFinanceiro(Array.isArray(relatorioFinanceiroCache) ? relatorioFinanceiroCache : []);
}

function resetFiltroRelatorioFinanceiro() {
  const hojeLocal = hoje();
  const campoDataInicio = document.getElementById('filtroRelFinanceiroDataInicio');
  const campoDataFim = document.getElementById('filtroRelFinanceiroDataFim');
  const campoStatus = document.getElementById('filtroRelFinanceiroStatus');
  const campoFornecedor = document.getElementById('filtroRelFinanceiroFornecedor');

  const sincronizouData = window.sincronizarFiltroDataPadronizado?.('relatorio_financeiro', hojeLocal, hojeLocal, 'vencimento') === true;
  if (!sincronizouData && campoDataInicio) campoDataInicio.value = hojeLocal;
  if (!sincronizouData && campoDataFim) campoDataFim.value = hojeLocal;
  marcarTodosCheckboxFiltroRelatorioFinanceiro('filtroRelFinanceiroStatus');
  marcarTodosCheckboxFiltroRelatorioFinanceiro('filtroRelFinanceiroFornecedor');
  marcarTodosCheckboxFiltroRelatorioFinanceiro('filtroRelFinanceiroCategoria');

  carregarRelatorioFinanceiro();
}

function limparFiltrosRelatorioFinanceiro() {
  // Mantém o período (vencimento inicial/final) e limpa todos os demais filtros.
  marcarTodosCheckboxFiltroRelatorioFinanceiro('filtroRelFinanceiroStatus');
  marcarTodosCheckboxFiltroRelatorioFinanceiro('filtroRelFinanceiroFornecedor');
  marcarTodosCheckboxFiltroRelatorioFinanceiro('filtroRelFinanceiroCategoria');

  carregarRelatorioFinanceiro();
}

function somarDiasDataLocal(dataIso = hoje(), dias = 0) {
  const data = new Date(`${dataIso}T12:00:00`);
  if (Number.isNaN(data.getTime())) return hoje();
  data.setDate(data.getDate() + Number(dias || 0));
  return dataLocalISO(data);
}

async function aplicarAtalhoPeriodoRelatorioFinanceiro(dias = 7) {
  const intervalo = Math.max(1, Number(dias || 7));
  const hojeLocal = hoje();
  const campoDataInicio = document.getElementById('filtroRelFinanceiroDataInicio');
  const campoDataFim = document.getElementById('filtroRelFinanceiroDataFim');
  const campoStatus = document.getElementById('filtroRelFinanceiroStatus');
  const campoFornecedor = document.getElementById('filtroRelFinanceiroFornecedor');

  const dataFimAtalho = somarDiasDataLocal(hojeLocal, intervalo);
  const sincronizouData = window.sincronizarFiltroDataPadronizado?.('relatorio_financeiro', hojeLocal, dataFimAtalho, 'vencimento') === true;
  if (!sincronizouData && campoDataInicio) campoDataInicio.value = hojeLocal;
  if (!sincronizouData && campoDataFim) campoDataFim.value = dataFimAtalho;
  if (campoStatus) {
    renderizarCheckboxFiltroRelatorioFinanceiro('filtroRelFinanceiroStatus', STATUS_OPCOES_RELATORIO_FINANCEIRO.slice(1), ['a_vencer', 'vencida']);
  }
  marcarTodosCheckboxFiltroRelatorioFinanceiro('filtroRelFinanceiroFornecedor');
  marcarTodosCheckboxFiltroRelatorioFinanceiro('filtroRelFinanceiroCategoria');

  const itens = await carregarRelatorioFinanceiro();
  renderizarDetalhesRelatorioFinanceiro(Array.isArray(itens) ? itens : (relatorioFinanceiroCache || []));
}

async function carregarRelatorioFinanceiro() {
  const listaDetalhes = document.getElementById('listaRelatorioFinanceiro');
  const listaFornecedores = document.getElementById('listaRelatorioFinanceiroFornecedores');
  const listaFormas = document.getElementById('listaRelatorioFinanceiroFormas');
  const campoDataInicio = document.getElementById('filtroRelFinanceiroDataInicio');
  const campoDataFim = document.getElementById('filtroRelFinanceiroDataFim');
  const campoStatus = document.getElementById('filtroRelFinanceiroStatus');
  const campoFornecedor = document.getElementById('filtroRelFinanceiroFornecedor');

  if (!listaDetalhes || !listaFornecedores || !listaFormas) return;
  // Evita renders concorrentes (causa do "piscar"): só a chamada mais recente
  // conclui a renderização; chamadas antigas são abandonadas após cada await.
  const seqRelFin = (window.__relFinSeq = (window.__relFinSeq || 0) + 1);
  const lojaAtualId = String(obterLojaIdSessao?.() || usuarioSistemaLogado?.loja_id || obterLojaAtualParaIsolamento?.() || '').trim();
  const lojasSelecionadas = lojaAtualId ? [lojaAtualId] : [];
  const statusSelecionadosAtuais = obterValoresCheckboxFiltroRelatorioFinanceiro('filtroRelFinanceiroStatus');
  renderizarCheckboxFiltroRelatorioFinanceiro('filtroRelFinanceiroStatus', STATUS_OPCOES_RELATORIO_FINANCEIRO.slice(1), statusSelecionadosAtuais);

  // Os filtros precisam estar disponíveis antes de o usuário informar o
  // período e clicar em Filtrar.
  if (!(fornecedoresFinanceiroCache || []).length && typeof carregarFornecedoresFinanceiro === 'function') {
    try { await carregarFornecedoresFinanceiro(); } catch (_) {}
  }
  if (!(categoriasCompraCache || []).length && typeof carregarCategoriasCompra === 'function') {
    try { await carregarCategoriasCompra(); } catch (_) {}
  }
  if (seqRelFin !== window.__relFinSeq) return [];
  const fornecedoresSelecionadosIniciais = obterValoresCheckboxFiltroRelatorioFinanceiro('filtroRelFinanceiroFornecedor');
  const fornecedoresIniciais = (fornecedoresFinanceiroCache || [])
    .filter(item => !lojaAtualId || String(item.loja_id || '').trim() === lojaAtualId)
    .map(item => ({ valor: String(item.id || '').trim(), rotulo: String(item.nome || 'Fornecedor').trim() }))
    .filter(item => item.valor)
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'));
  renderizarCheckboxFiltroRelatorioFinanceiro('filtroRelFinanceiroFornecedor', fornecedoresIniciais, fornecedoresSelecionadosIniciais);
  const categoriasSelecionadasIniciais = obterValoresCheckboxFiltroRelatorioFinanceiro('filtroRelFinanceiroCategoria');
  const categoriasIniciais = [
    { valor: '__sem__', rotulo: 'Sem categoria' },
    ...(categoriasCompraCache || []).map(item => ({ valor: String(item.id), rotulo: String(item.nome || '').trim() })),
  ].sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'));
  renderizarCheckboxFiltroRelatorioFinanceiro('filtroRelFinanceiroCategoria', categoriasIniciais, categoriasSelecionadasIniciais);

  const filtroDataPadronizado = document.querySelector('#relatorio_financeiro .date-filter-standard');
  const campoDataInicioVisivel = filtroDataPadronizado?.querySelector('.date-filter-start') || campoDataInicio;
  const campoDataFimVisivel = filtroDataPadronizado?.querySelector('.date-filter-end') || campoDataFim;
  const periodoInicioInformado = String(campoDataInicioVisivel?.value || '').trim();
  const periodoFimInformado = String(campoDataFimVisivel?.value || '').trim();

  // Sem um período completo o relatório deve permanecer vazio. Isso evita que
  // a ausência de datas seja interpretada como "consultar todo o histórico".
  if (!periodoInicioInformado || !periodoFimInformado) {
    relatorioFinanceiroCache = [];
    ['rfTotalGeral', 'rfTotalPago', 'rfTotalPendente', 'rfTotalSomado']
      .forEach(id => {
        const elemento = document.getElementById(id);
        if (elemento) elemento.textContent = formatarMoedaBRFinanceiro(0);
      });
    let saldoTotalContas = 0;
    try {
      saldoTotalContas = await obterSaldoTotalContasFinanceiras();
    } catch (erroSaldo) {
      console.warn('Erro ao carregar saldo do cofre sem período no relatório:', erroSaldo);
    }
    if (seqRelFin !== window.__relFinSeq) return [];
    const saldoContas = document.getElementById('rfSaldoContas');
    if (saldoContas) saldoContas.textContent = formatarMoedaBRFinanceiro(saldoTotalContas);
    window._contasFaltaCache = { totalPendente: 0, saldoTotalContas };
    exibirResultadoQuitacao(0, saldoTotalContas, 'Saldo atual do cofre; informe um período para calcular a dívida');
    const quantidade = document.getElementById('rfQuantidadeTitulos');
    if (quantidade) quantidade.textContent = '0';
    listaDetalhes.innerHTML = '<div class="empty">Informe a data inicial e a data final para consultar os títulos.</div>';
    listaFornecedores.innerHTML = '';
    listaFormas.innerHTML = '';
    ocultarDetalhesRelatorioFinanceiro();
    setMsg('msgRelatorioFinanceiro', 'Informe um período completo para carregar o relatório.', '');
    return [];
  }

  listaDetalhes.innerHTML = '<div class="empty">Carregando...</div>';
  listaFornecedores.innerHTML = '<div class="empty">Carregando...</div>';
  listaFormas.innerHTML = '<div class="empty">Carregando...</div>';
  ocultarDetalhesRelatorioFinanceiro();

  // Garante a lista de fornecedores para o filtro (todos da loja).
  if (!(fornecedoresFinanceiroCache || []).length && typeof carregarFornecedoresFinanceiro === 'function') {
    try { await carregarFornecedoresFinanceiro(); } catch (_) { /* segue com fallback */ }
  }
  // Garante categorias e grupos para exibir nomes no relatório e exportações.
  if (!(categoriasCompraCache || []).length && typeof carregarCategoriasCompra === 'function') {
    try { await carregarCategoriasCompra(); } catch (_) {}
  }
  if (!(gruposFornecedorCache || []).length && typeof carregarGruposFornecedor === 'function') {
    try { await carregarGruposFornecedor(); } catch (_) {}
  }
  if (seqRelFin !== window.__relFinSeq) return;

  try {
    const filtroDataInicioConsulta = periodoInicioInformado;
    const filtroDataFimConsulta = periodoFimInformado;
    const filtroDataTipo = String(document.querySelector('#relatorio_financeiro .date-filter-criterion')?.value || 'especial:vencimento').replace('especial:', '');
    const colunasDataConsulta = {
      compra: 'data_compra', vencimento: 'data_vencimento', pagamento: 'data_pagamento',
      cadastro: 'created_at', atualizacao: 'updated_at'
    };
    const colunaDataConsulta = colunasDataConsulta[filtroDataTipo] || 'data_vencimento';
    const { data, error } = await executarSemFiltrosTenantTemporario(() => {
      let query = sb
        .from('contasapagar')
        .select('id, fornecedor_id, categoria_id, data_compra, data_vencimento, data_pagamento, valor_original, valor_compra, valor_pago, forma_pagamento, forma_pagamento_id, observacao, pago_confirmado_em, qtd_parcelas, numero_parcela, created_at, updated_at, criado_por_nome, excluido_em, excluido_por_nome, loja_id, fornecedores(nome, grupo_id), formas_pagamento(id, nome)')
        .order('data_vencimento', { ascending: false });
      query = lojasSelecionadas.length
        ? query.in('loja_id', lojasSelecionadas)
        : query.eq('loja_id', '__sem_loja__');
      if (filtroDataInicioConsulta) query = query.gte(colunaDataConsulta, filtroDataInicioConsulta);
      if (filtroDataFimConsulta) query = query.lte(colunaDataConsulta,
        ['created_at', 'updated_at'].includes(colunaDataConsulta) ? `${filtroDataFimConsulta}T23:59:59.999` : filtroDataFimConsulta);
      return query;
    });

    if (error) {
      if (isMissingContasAPagarTableError(error) || isMissingFornecedoresTableError(error) || isMissingFormasPagamentoTableError(error) || isMissingContasAPagarPagamentoColumnsError(error) || isMissingContasAPagarAuditoriaColumnsError(error) || isMissingColumnError(error)) {
        listaDetalhes.innerHTML = '<div class="empty">Rode as migrations do financeiro para habilitar este relatorio.</div>';
        listaFornecedores.innerHTML = '<div class="empty">Dependencias do financeiro nao encontradas.</div>';
        listaFormas.innerHTML = '<div class="empty">Dependencias do financeiro nao encontradas.</div>';
        setMsg('msgRelatorioFinanceiro', 'Estrutura financeira ainda nao esta completa no banco.', 'err');
        return;
      }
      throw error;
    }

    const rows = data || [];
    if (seqRelFin !== window.__relFinSeq) return;

    // Lista de fornecedores do filtro: usa TODOS os fornecedores da(s) loja(s)
    // selecionada(s) — não apenas os que têm conta no período — para permitir
    // pré-selecionar e agrupar vários na somatória mesmo antes de filtrar a data.
    const fornecedoresSelecionadosAtuais = obterValoresCheckboxFiltroRelatorioFinanceiro('filtroRelFinanceiroFornecedor');
    let fornecedoresOpcoes;
    try {
      const cacheForn = (fornecedoresFinanceiroCache || []).filter(f => {
        if (!lojasSelecionadas.length) return true;
        return lojasSelecionadas.includes(String(f.loja_id || '').trim());
      });
      if (cacheForn.length) {
        fornecedoresOpcoes = cacheForn
          .map(f => ({ valor: String(f.id || '').trim(), rotulo: String(f.nome || 'Fornecedor').trim() }))
          .filter(item => item.valor)
          .sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'));
      }
    } catch (_) { /* cai no fallback abaixo */ }
    // Fallback: deriva dos resultados se o cache não estiver disponível
    if (!fornecedoresOpcoes || !fornecedoresOpcoes.length) {
      fornecedoresOpcoes = [...new Map(rows
        .map(item => ({ valor: String(item.fornecedor_id || '').trim(), rotulo: obterNomeFornecedorRelatorioFinanceiro(item) }))
        .filter(item => item.valor)
        .map(item => [item.valor, item])).values()]
        .sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'));
    }
    renderizarCheckboxFiltroRelatorioFinanceiro('filtroRelFinanceiroFornecedor', fornecedoresOpcoes, fornecedoresSelecionadosAtuais);

    // Categoria (multi-seleção): "Sem categoria" é uma opção fixa, pois representa
    // lançamentos sem categoria_id e não um cadastro da tabela de categorias.
    const categoriasSelecionadasAtuais = obterValoresCheckboxFiltroRelatorioFinanceiro('filtroRelFinanceiroCategoria');
    const categoriasOpcoes = [
      { valor: '__sem__', rotulo: 'Sem categoria' },
      ...(categoriasCompraCache || []).map(c => ({ valor: String(c.id), rotulo: String(c.nome || '').trim() })),
    ]
      .sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'));
    renderizarCheckboxFiltroRelatorioFinanceiro('filtroRelFinanceiroCategoria', categoriasOpcoes, categoriasSelecionadasAtuais);
    const filtroDataInicio = periodoInicioInformado;
    const filtroDataFim = periodoFimInformado;
    const filtrosStatus = obterValoresCheckboxFiltroRelatorioFinanceiro('filtroRelFinanceiroStatus');
    const filtrosFornecedor = obterValoresCheckboxFiltroRelatorioFinanceiro('filtroRelFinanceiroFornecedor');
    const filtrosCategoria = obterValoresCheckboxFiltroRelatorioFinanceiro('filtroRelFinanceiroCategoria');
    const elTotalGeral = document.getElementById('rfTotalGeral');
    const elTotalPago = document.getElementById('rfTotalPago');
    const elTotalPendente = document.getElementById('rfTotalPendente');
    const elSaldoContas = document.getElementById('rfSaldoContas');
    const elFaltaQuitar = document.getElementById('rfFaltaQuitar');
    const elQtdTitulos = document.getElementById('rfQuantidadeTitulos');

    if (filtroDataInicio && filtroDataFim && filtroDataFim < filtroDataInicio) {
      relatorioFinanceiroCache = [];
      if (elTotalGeral) elTotalGeral.textContent = formatarMoedaBRFinanceiro(0);
      if (elTotalPago) elTotalPago.textContent = formatarMoedaBRFinanceiro(0);
      if (elTotalPendente) elTotalPendente.textContent = formatarMoedaBRFinanceiro(0);
      const elTotalSomadoZero = document.getElementById('rfTotalSomado');
      if (elTotalSomadoZero) elTotalSomadoZero.textContent = formatarMoedaBRFinanceiro(0);
      if (elFaltaQuitar) elFaltaQuitar.textContent = formatarMoedaBRFinanceiro(0);
      if (elQtdTitulos) elQtdTitulos.textContent = '0';
      renderizarPizzaRelatorioFinanceiro('graficoRelatorioFinanceiroFornecedores', [], 'Corrija o período para carregar o dashboard.');
      renderizarPizzaRelatorioFinanceiro('graficoRelatorioFinanceiroFormas', [], 'Corrija o período para carregar o dashboard.');
      listaDetalhes.innerHTML = '<div class="empty">A data final do vencimento não pode ser menor que a data inicial.</div>';
      listaFornecedores.innerHTML = '';
      listaFormas.innerHTML = '';
      setMsg('msgRelatorioFinanceiro', 'Corrija o período: o vencimento final está antes do vencimento inicial.', 'err');
      return;
    }

    const itensFiltrados = rows.filter(item => {
      const status = obterStatusContaRelatorioFinanceiro(item);
      const fornecedorId = String(item.fornecedor_id || '').trim();
      const categoriaId = String(item.categoria_id || '').trim() || '__sem__';
      const datasFiltro = {
        compra:item.data_compra, vencimento:item.data_vencimento, pagamento:item.data_pagamento || item.pago_confirmado_em,
        cadastro:item.created_at, atualizacao:item.updated_at
      };
      const dataReferencia = String(datasFiltro[filtroDataTipo] || '').slice(0, 10);

      if (filtroDataInicio && (!dataReferencia || dataReferencia < filtroDataInicio)) return false;
      if (filtroDataFim && (!dataReferencia || dataReferencia > filtroDataFim)) return false;
      if (filtrosStatus.length && !filtrosStatus.includes(status)) return false;
      if (filtrosFornecedor.length && !filtrosFornecedor.includes(fornecedorId)) return false;
      if (filtrosCategoria.length && !filtrosCategoria.includes(categoriaId)) return false;
      return true;
    });

    relatorioFinanceiroCache = itensFiltrados;

    const totalPago = itensFiltrados.reduce((acc, item) => {
      if (obterStatusContaRelatorioFinanceiro(item) !== 'pago') return acc;
      return acc + obterValorPagoRelatorioFinanceiro(item);
    }, 0);
    const totalPendente = itensFiltrados.reduce((acc, item) => acc + obterValorAbertoRelatorioFinanceiro(item), 0);
    const totalGeral = totalPendente;
    let saldoTotalContas = 0;
    try {
      saldoTotalContas = await obterSaldoTotalContasFinanceiras();
    } catch (erroSaldo) {
      console.warn('Erro ao carregar saldo total das contas financeiras:', erroSaldo);
      saldoTotalContas = 0;
    }
    if (seqRelFin !== window.__relFinSeq) return;
    // Guardar para recalcular quando checkbox mudar
    window._contasFaltaCache = { totalPendente, saldoTotalContas };

    const qtdTitulos = itensFiltrados.length;
    const totalSomado = totalPago + totalPendente;
    if (elTotalGeral) elTotalGeral.textContent = formatarMoedaBRFinanceiro(totalGeral);
    if (elTotalPago) elTotalPago.textContent = formatarMoedaBRFinanceiro(totalPago);
    if (elTotalPendente) elTotalPendente.textContent = formatarMoedaBRFinanceiro(totalPendente);
    const elTotalSomado = document.getElementById('rfTotalSomado');
    if (elTotalSomado) elTotalSomado.textContent = formatarMoedaBRFinanceiro(totalSomado);
    if (elSaldoContas) elSaldoContas.textContent = formatarMoedaBRFinanceiro(saldoTotalContas);
    exibirResultadoQuitacao(totalPendente, saldoTotalContas, 'Saldo do cofre menos dívida no período');
    // Mantém a escolha do usuário: se "Somar recebimentos futuros ao saldo"
    // estiver marcado, recalcula o "Falta para quitar" somando os futuros.
    const chkAcoesFuturos = document.getElementById('contasSomarFuturosAcoes');
    if (chkAcoesFuturos?.checked === true) await recalcularFaltaQuitar();
    if (elQtdTitulos) elQtdTitulos.textContent = String(qtdTitulos);

    renderizarDashboardFornecedoresRelatorioFinanceiro(itensFiltrados);
    renderizarDashboardFormasRelatorioFinanceiro(itensFiltrados);
    renderizarDetalhesRelatorioFinanceiro(itensFiltrados);

    setMsg('msgRelatorioFinanceiro', '', '');
    return itensFiltrados;
  } catch (error) {
    console.error('Erro ao carregar relatorio financeiro:', error);
    renderizarPizzaRelatorioFinanceiro('graficoRelatorioFinanceiroFornecedores', []);
    renderizarPizzaRelatorioFinanceiro('graficoRelatorioFinanceiroFormas', []);
    listaDetalhes.innerHTML = '<div class="empty">Erro ao carregar relatorio financeiro.</div>';
    listaFornecedores.innerHTML = '<div class="empty">Erro ao carregar dashboard de fornecedores.</div>';
    listaFormas.innerHTML = '<div class="empty">Erro ao carregar dashboard de formas.</div>';
    setMsg('msgRelatorioFinanceiro', `Nao foi possivel carregar o relatorio financeiro: ${mensagemErroSupabase(error, 'erro desconhecido')}`, 'err');
  }
}

function obterNomePagadorRelatorioRecebimentos(item) {
  return String(item?.fornecedores?.nome || 'Pagador nao informado').trim() || 'Pagador nao informado';
}

function obterNomeFormaRelatorioRecebimentos(item) {
  return String(item?.formas_pagamento?.nome || 'Forma nao informada').trim() || 'Forma nao informada';
}

function obterNomeContaRelatorioRecebimentos(item) {
  return String(item?.contas_financeiras?.nome || 'Conta nao informada').trim() || 'Conta nao informada';
}

function obterNomeUsuarioRelatorioRecebimentos(item) {
  return String(item?.criado_por_nome || '').trim() || 'Cadastro anterior';
}

function obterChaveUsuarioRelatorioRecebimentos(item = {}) {
  const id = String(item.criado_por_id || '').trim();
  if (id) return `id:${id}`;
  const nome = obterNomeUsuarioRelatorioRecebimentos(item).toLowerCase();
  return nome ? `nome:${nome}` : '';
}

function subtrairDiasDataLocal(dataIso = hoje(), dias = 0) {
  const data = new Date(`${dataIso}T12:00:00`);
  if (Number.isNaN(data.getTime())) return hoje();
  data.setDate(data.getDate() - Number(dias || 0));
  return dataLocalISO(data);
}

function preencherFiltrosRelatorioRecebimentos(itens = []) {
  const pagadorEl = document.getElementById('filtroRelRecebPagador');
  const formaEl = document.getElementById('filtroRelRecebForma');
  const usuarioEl = document.getElementById('filtroRelRecebUsuario');
  if (!pagadorEl || !formaEl || !usuarioEl) return;

  const pagadorAtual = String(pagadorEl.value || '').trim();
  const formaAtual = String(formaEl.value || '').trim();
  const usuarioAtual = String(usuarioEl.value || '').trim();

  const pagadores = [...new Map((itens || [])
    .map(item => ({ valor: String(item.pagador_id || '').trim(), rotulo: obterNomePagadorRelatorioRecebimentos(item) }))
    .filter(item => item.valor)
    .map(item => [item.valor, item])).values()]
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'));

  const formas = [...new Map((itens || [])
    .map(item => {
      const formaId = String(item.forma_pagamento_id || item.formas_pagamento?.id || '').trim();
      const nome = obterNomeFormaRelatorioRecebimentos(item);
      return { valor: formaId || nome, rotulo: nome };
    })
    .filter(item => item.valor && item.rotulo !== 'Forma nao informada')
    .map(item => [item.valor, item])).values()]
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'));

  const usuarios = [...new Map((itens || [])
    .map(item => ({ valor: obterChaveUsuarioRelatorioRecebimentos(item), rotulo: obterNomeUsuarioRelatorioRecebimentos(item) }))
    .filter(item => item.valor)
    .map(item => [item.valor, item])).values()]
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'));

  preencherSelectRelatorioFinanceiro(pagadorEl, '- Todos os pagadores -', pagadores, pagadorAtual);
  preencherSelectRelatorioFinanceiro(formaEl, '- Todas as formas -', formas, formaAtual);
  preencherSelectRelatorioFinanceiro(usuarioEl, '- Todos os usuarios -', usuarios, usuarioAtual);
}

function resetFiltroRelatorioRecebimentos() {
  const hojeLocal = hoje();
  const dataInicio = document.getElementById('filtroRelRecebDataInicio');
  const dataFim = document.getElementById('filtroRelRecebDataFim');
  const pagador = document.getElementById('filtroRelRecebPagador');
  const forma = document.getElementById('filtroRelRecebForma');
  const usuario = document.getElementById('filtroRelRecebUsuario');
  const grupo = document.getElementById('filtroRelRecebGrupo');

  const sincronizouData = window.sincronizarFiltroDataPadronizado?.('relatorio_recebimentos', hojeLocal, hojeLocal, 'recebimento') === true;
  if (!sincronizouData && dataInicio) dataInicio.value = hojeLocal;
  if (!sincronizouData && dataFim) dataFim.value = hojeLocal;
  if (pagador) pagador.value = '';
  if (forma) forma.value = '';
  if (usuario) usuario.value = '';
  if (grupo) grupo.value = '';
  carregarRelatorioRecebimentos();
}

function limparFiltrosRelatorioRecebimentos() {
  ['filtroRelRecebPagador', 'filtroRelRecebGrupo', 'filtroRelRecebForma', 'filtroRelRecebUsuario'].forEach(id => {
    const campo = document.getElementById(id);
    if (campo) campo.value = '';
  });
  ['filtroRelRecebIncluirFuturos', 'filtroRelRecebIncluirPendentes'].forEach(id => {
    const campo = document.getElementById(id);
    if (campo) campo.checked = false;
  });
  carregarRelatorioRecebimentos();
}

async function aplicarAtalhoPeriodoRelatorioRecebimentos(dias = 7) {
  const intervalo = Math.max(1, Number(dias || 7));
  const hojeLocal = hoje();
  const dataInicio = document.getElementById('filtroRelRecebDataInicio');
  const dataFim = document.getElementById('filtroRelRecebDataFim');
  const dataInicioAtalho = subtrairDiasDataLocal(hojeLocal, intervalo - 1);
  const sincronizouData = window.sincronizarFiltroDataPadronizado?.('relatorio_recebimentos', dataInicioAtalho, hojeLocal, 'recebimento') === true;
  if (!sincronizouData && dataInicio) dataInicio.value = dataInicioAtalho;
  if (!sincronizouData && dataFim) dataFim.value = hojeLocal;
  await carregarRelatorioRecebimentos();
}

function renderizarRelatorioRecebimentos(itens = []) {
  const lista = document.getElementById('listaRelatorioRecebimentos');
  if (!lista) return;

  if (!itens.length) {
    lista.innerHTML = '<tr><td colspan="6" style="padding:16px;color:var(--text-muted)">Nenhum recebimento encontrado para os filtros informados.</td></tr>';
    return;
  }

  lista.innerHTML = itens.map(item => `
    <tr>
      <td style="padding:10px;border-bottom:1px solid var(--border)">${escaparHtmlBasico(item.created_at ? fmtDate(item.created_at) : '-')}</td>
      <td style="padding:10px;border-bottom:1px solid var(--border)">
        ${escaparHtmlBasico(obterNomePagadorRelatorioRecebimentos(item))}
        ${item.observacao ? `<div style="font-size:11px;color:var(--text-muted);margin-top:3px">${escaparHtmlBasico(item.observacao)}</div>` : ''}
        ${item.intervalo_dias ? `<div style="font-size:11px;color:var(--accent);margin-top:2px">Recorrência ${item.numero_recorrencia || 1}/${item.qtd_recorrencias || item.qtd_parcelas || 1} · a cada ${item.intervalo_dias} dia(s)</div>` : ''}
      </td>
      <td style="padding:10px;border-bottom:1px solid var(--border)">${escaparHtmlBasico(obterNomeFormaRelatorioRecebimentos(item))}</td>
      <td style="padding:10px;border-bottom:1px solid var(--border)">${escaparHtmlBasico(obterNomeContaRelatorioRecebimentos(item))}</td>
      <td style="padding:10px;border-bottom:1px solid var(--border);text-align:right">${escaparHtmlBasico(formatarMoedaBRFinanceiro(item.valor || 0))}</td>
      <td style="padding:10px;border-bottom:1px solid var(--border)">${escaparHtmlBasico(obterNomeUsuarioRelatorioRecebimentos(item))}</td>
    </tr>
  `).join('');
}

async function buscarDadosRelatorioRecebimentos() {
  const camposComAuditoria = 'id, pagador_id, forma_pagamento_id, conta_financeira_id, valor, created_at, updated_at, criado_por_id, criado_por_nome, qtd_parcelas, intervalo_dias, observacao, fornecedores(nome, grupo_id), formas_pagamento(id, nome), contas_financeiras(id, nome)';
  const camposSemAuditoria = 'id, pagador_id, forma_pagamento_id, conta_financeira_id, valor, created_at, qtd_parcelas, intervalo_dias, observacao, fornecedores(nome, grupo_id), formas_pagamento(id, nome), contas_financeiras(id, nome)';

  const executar = (campos) => sb
    .from('recebiveis')
    .select(campos)
    .order('created_at', { ascending: false });

  let res = await executar(camposComAuditoria);
  if (res.error && isMissingColumnError(res.error)) {
    res = await executar(camposSemAuditoria);
    return { ...res, auditoriaDisponivel: false };
  }

  // Se checkbox "incluir provisionados pendentes" marcado, buscar também de recebiveis_futuros não confirmados
  const incluirPendentes = document.getElementById('filtroRelRecebIncluirPendentes')?.checked === true;
  if (incluirPendentes && !res.error) {
    try {
      const { data: futuros } = await executarSemFiltroLojaTemporario(() =>
        sb.from('recebiveis_futuros')
          .select('id, pagador_id, forma_pagamento_id, conta_financeira_id, valor, data_prevista, observacao, intervalo_dias, qtd_recorrencias, numero_recorrencia, fornecedores(nome, grupo_id), formas_pagamento(id, nome), contas_financeiras(id, nome)')
          .is('confirmado_em', null)
          .order('data_prevista', { ascending: true })
      );
      if (futuros?.length) {
        // Normalizar para o mesmo formato
        const normalizados = futuros.map(f => ({
          ...f,
          created_at: f.data_prevista,
          _provisionadoPendente: true,
        }));
        res = { ...res, data: [...(res.data || []), ...normalizados] };
      }
    } catch(e) { /* tabela pode não existir ainda */ }
  }
  const incluirFuturos = document.getElementById('filtroRelRecebIncluirFuturos')?.checked === true;
  if (incluirFuturos && !res.error) {
    try {
      const { data: futuros } = await executarSemFiltroLojaTemporario(() =>
        sb.from('recebiveis_futuros')
          .select('id, pagador_id, forma_pagamento_id, conta_financeira_confirmada_id, valor_confirmado, confirmado_em, confirmado_por_nome, observacao, intervalo_dias, qtd_recorrencias, numero_recorrencia, fornecedores(nome, grupo_id), formas_pagamento(id, nome), contas_financeiras!conta_financeira_confirmada_id(id, nome)')
          .not('confirmado_em', 'is', null)
          .order('confirmado_em', { ascending: false })
      );
      if (futuros?.length) {
        // Normalizar para o mesmo formato
        const normalizados = futuros.map(f => ({
          ...f,
          conta_financeira_id: f.conta_financeira_confirmada_id,
          valor: f.valor_confirmado,
          created_at: f.confirmado_em,
          criado_por_nome: f.confirmado_por_nome,
          _futuro: true,
        }));
        res = { ...res, data: [...(res.data || []), ...normalizados] };
      }
    } catch(e) { /* tabela pode não existir ainda */ }
  }

  return { ...res, auditoriaDisponivel: true };
}

async function carregarRelatorioRecebimentos() {
  const lista = document.getElementById('listaRelatorioRecebimentos');
  const dataInicioEl = document.getElementById('filtroRelRecebDataInicio');
  const dataFimEl = document.getElementById('filtroRelRecebDataFim');
  const pagadorEl = document.getElementById('filtroRelRecebPagador');
  const formaEl = document.getElementById('filtroRelRecebForma');
  const usuarioEl = document.getElementById('filtroRelRecebUsuario');
  const grupoEl = document.getElementById('filtroRelRecebGrupo');
  if (!lista) return;

  if (dataInicioEl && !dataInicioEl.value) dataInicioEl.value = hoje();
  if (dataFimEl && !dataFimEl.value) dataFimEl.value = hoje();
  lista.innerHTML = '<tr><td colspan="6" style="padding:16px;color:var(--text-muted)">Carregando recebimentos...</td></tr>';

  try {
    const { data, error, auditoriaDisponivel } = await buscarDadosRelatorioRecebimentos();
    if (error) {
      if (isMissingRecebiveisTableError(error) || isMissingFornecedoresTableError(error) || isMissingFormasPagamentoTableError(error) || isMissingContasFinanceirasTableError(error) || isMissingColumnError(error)) {
        lista.innerHTML = '<tr><td colspan="6" style="padding:16px;color:var(--text-muted)">Rode as migrations mais recentes do financeiro para habilitar este relatório.</td></tr>';
        setMsg('msgRelatorioRecebimentos', 'Estrutura de recebimentos ainda nao esta completa no banco.', 'err');
        return;
      }
      throw error;
    }

    const rows = data || [];
    preencherFiltrosRelatorioRecebimentos(rows);

    const filtroInicio = String(dataInicioEl?.value || '').trim();
    const filtroFim = String(dataFimEl?.value || '').trim();
    const filtroPagador = String(pagadorEl?.value || '').trim();
    const filtroForma = String(formaEl?.value || '').trim();
    const filtroUsuario = String(usuarioEl?.value || '').trim();
    const filtroGrupo = String(grupoEl?.value || '').trim();
    const filtroDataTipo = String(document.querySelector('#relatorio_recebimentos .date-filter-criterion')?.value || 'especial:cadastro').replace('especial:', '');

    const itens = rows.filter(item => {
      const datasFiltro = {
        cadastro:item.created_at,
        atualizacao:item.updated_at,
        prevista:item._provisionadoPendente ? item.created_at : null,
        recebimento:item._futuro ? item.created_at : (!item._provisionadoPendente ? item.created_at : null)
      };
      const dataRef = String(datasFiltro[filtroDataTipo] || '').slice(0, 10);
      const pagadorId = String(item.pagador_id || '').trim();
      const formaId = String(item.forma_pagamento_id || item.formas_pagamento?.id || '').trim();
      const formaNome = obterNomeFormaRelatorioRecebimentos(item);
      const usuarioChave = obterChaveUsuarioRelatorioRecebimentos(item);

      if (filtroInicio && (!dataRef || dataRef < filtroInicio)) return false;
      if (filtroFim && (!dataRef || dataRef > filtroFim)) return false;
      if (filtroPagador && filtroPagador !== pagadorId) return false;
      if (filtroForma && filtroForma !== (formaId || formaNome)) return false;
      if (filtroUsuario && filtroUsuario !== usuarioChave) return false;
      if (filtroGrupo && String(item.fornecedores?.grupo_id || '').trim() !== filtroGrupo) return false;
      return true;
    });

    relatorioRecebimentosCache = itens;

    const total = itens.reduce((acc, item) => acc + (Number(item.valor || 0) || 0), 0);
    const quantidade = itens.length;
    const ticketMedio = quantidade ? total / quantidade : 0;
    const ultimo = itens[0]?.created_at ? fmtDate(itens[0].created_at) : '-';

    const totalEl = document.getElementById('rrTotalRecebido');
    const qtdEl = document.getElementById('rrQuantidade');
    const ticketEl = document.getElementById('rrTicketMedio');
    const ultimoEl = document.getElementById('rrUltimoLancamento');
    const futurosEl = document.getElementById('rrTotalFuturos');
    const confirmadosEl = document.getElementById('rrQtdConfirmados');
    const provisionadosEl = document.getElementById('rrQtdProvisionados');
    if (totalEl) totalEl.textContent = formatarMoedaBRFinanceiro(total);
    if (qtdEl) qtdEl.textContent = String(quantidade);
    if (ticketEl) ticketEl.textContent = formatarMoedaBRFinanceiro(ticketMedio);
    if (ultimoEl) ultimoEl.textContent = ultimo;
    if (confirmadosEl) confirmadosEl.textContent = String(itens.filter(item => !item._provisionadoPendente).length);
    if (provisionadosEl) provisionadosEl.textContent = String(itens.filter(item => item._provisionadoPendente).length);
    // Card de futuros pendentes (buscar da tabela separada)
    if (futurosEl) {
      futurosEl.textContent = '...';
      sb.from('recebiveis_futuros').select('valor').is('confirmado_em', null).eq('ativo', true)
      .then(({ data }) => {
        const totalFuturos = (data || []).reduce((s, i) => s + Number(i.valor || 0), 0);
        futurosEl.textContent = formatarMoedaBRFinanceiro(totalFuturos);
      }).catch(() => { futurosEl.textContent = 'N/D'; });
    }

    renderizarRelatorioRecebimentos(itens);

    if (!itens.length) {
      setMsg('msgRelatorioRecebimentos', 'Nenhum recebimento encontrado para os filtros informados.', 'ok');
      return;
    }
    setMsg('msgRelatorioRecebimentos', auditoriaDisponivel
      ? `${itens.length} recebimento(s) encontrado(s).`
      : `${itens.length} recebimento(s) encontrado(s). Rode a migration de auditoria para exibir quem lançou em novos registros.`, 'ok');
  } catch (error) {
    console.error('Erro ao carregar relatorio de recebimentos:', error);
    lista.innerHTML = '<tr><td colspan="6" style="padding:16px;color:var(--text-muted)">Nao foi possivel carregar o relatorio de recebimentos.</td></tr>';
    setMsg('msgRelatorioRecebimentos', `Nao foi possivel carregar o relatorio: ${mensagemErroSupabase(error, 'erro desconhecido')}`, 'err');
  }
}

function montarLinhasExportacaoRelatorioRecebimentos() {
  return (Array.isArray(relatorioRecebimentosCache) ? relatorioRecebimentosCache : []).map(item => ({
    dataHora: item.created_at ? fmtDate(item.created_at) : '-',
    pagador: obterNomePagadorRelatorioRecebimentos(item),
    forma: obterNomeFormaRelatorioRecebimentos(item),
    conta: obterNomeContaRelatorioRecebimentos(item),
    valor: Number(item.valor || 0) || 0,
    observacao: item.observacao || '',
    recorrencia: item.intervalo_dias ? `${item.numero_recorrencia || 1}/${item.qtd_recorrencias || item.qtd_parcelas || 1}` : '',
    intervaloDias: item.intervalo_dias || '',
    lancadoPor: obterNomeUsuarioRelatorioRecebimentos(item),
  }));
}

function exportarRelatorioRecebimentosCsv() {
  const linhas = montarLinhasExportacaoRelatorioRecebimentos();
  if (!linhas.length) {
    setMsg('msgRelatorioRecebimentos', 'Nao ha dados para exportar. Aplique filtros e carregue o relatorio.', 'err');
    return;
  }

  const cabecalho = ['Data/hora', 'Pagador', 'Forma de pagamento', 'Conta financeira', 'Valor', 'Observacao', 'Recorrencia', 'Intervalo em dias', 'Lancado por'];
  const conteudo = [
    cabecalho.map(escaparCsvRelatorioFinanceiro).join(';'),
    ...linhas.map(item => [
      item.dataHora,
      item.pagador,
      item.forma,
      item.conta,
      item.valor.toFixed(2),
      item.observacao,
      item.recorrencia,
      item.intervaloDias,
      item.lancadoPor,
    ].map(escaparCsvRelatorioFinanceiro).join(';')),
  ].join('\n');

  const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `relatorio-recebimentos-${hoje()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  setMsg('msgRelatorioRecebimentos', 'Excel exportado com sucesso.', 'ok');
}

function imprimirRelatorioRecebimentosPdf() {
  const linhas = montarLinhasExportacaoRelatorioRecebimentos();
  if (!linhas.length) {
    setMsg('msgRelatorioRecebimentos', 'Nao ha dados para exportar em PDF. Aplique filtros e carregue o relatorio.', 'err');
    return;
  }

  const total = linhas.reduce((acc, item) => acc + item.valor, 0);
  const periodo = `${document.getElementById('filtroRelRecebDataInicio')?.value || '-'} ate ${document.getElementById('filtroRelRecebDataFim')?.value || '-'}`;
  const geradoEm = new Date().toLocaleString('pt-BR');
  const filtrosRodape = `Periodo: ${periodo}`;
  const htmlLinhas = linhas.map(item => `
    <tr>
      <td>${escaparHtmlBasico(item.dataHora)}</td>
      <td>${escaparHtmlBasico(item.pagador)}</td>
      <td>${escaparHtmlBasico(item.forma)}</td>
      <td>${escaparHtmlBasico(item.conta)}</td>
      <td style="text-align:right">${escaparHtmlBasico(formatarMoedaBRFinanceiro(item.valor))}</td>
      <td>${escaparHtmlBasico(item.lancadoPor)}</td>
    </tr>
  `).join('');

  const janela = window.open('', '_blank', 'width=1100,height=760');
  if (!janela) {
    setMsg('msgRelatorioRecebimentos', 'O navegador bloqueou a janela de impressao. Libere pop-ups para exportar o PDF.', 'err');
    return;
  }

  janela.document.write(`
    <html>
      <head>
        <title>Relatorio de recebimentos</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; color: #111; }
          h1 { margin: 0 0 8px; font-size: 22px; }
          .meta { margin-bottom: 14px; font-size: 12px; color: #444; }
          .totais { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }
          .box { border: 1px solid #d0d0d0; border-radius: 8px; padding: 10px; }
          .box .label { font-size: 11px; color: #666; text-transform: uppercase; }
          .box .valor { font-size: 18px; font-weight: bold; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #ddd; padding: 6px; text-align: left; vertical-align: top; }
          th { background: #f5f5f5; }
          ${cssRodapeRelatorioImpressao()}
        </style>
      </head>
      <body>
        <h1>Relatorio de recebimentos</h1>
        <div class="meta">Periodo filtrado: ${escaparHtmlBasico(periodo)}</div>
        <div class="meta">Gerado em: ${escaparHtmlBasico(geradoEm)}</div>
        <div class="totais">
          <div class="box"><div class="label">Total recebido</div><div class="valor">${escaparHtmlBasico(formatarMoedaBRFinanceiro(total))}</div></div>
          <div class="box"><div class="label">Quantidade</div><div class="valor">${escaparHtmlBasico(String(linhas.length))}</div></div>
          <div class="box"><div class="label">Ticket medio</div><div class="valor">${escaparHtmlBasico(formatarMoedaBRFinanceiro(linhas.length ? total / linhas.length : 0))}</div></div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Data/hora</th>
              <th>Pagador</th>
              <th>Forma</th>
              <th>Conta financeira</th>
              <th>Valor</th>
              <th>Lancado por</th>
            </tr>
          </thead>
          <tbody>${htmlLinhas}</tbody>
        </table>
        ${htmlRodapeRelatorioImpressao(geradoEm, filtrosRodape)}
      </body>
    </html>
  `);
  janela.document.close();
  janela.focus();
  janela.print();
  setMsg('msgRelatorioRecebimentos', 'PDF preparado para impressao.', 'ok');
}

function obterChaveUsuarioRelAjusteSaldo(item = {}) {
  const id = String(item.usuario_id || '').trim();
  if (id) return `id:${id}`;
  const nome = String(item.usuario_nome || '').trim().toLowerCase();
  return nome ? `nome:${nome}` : '';
}

function calcularResumoRelatorioAjusteSaldo(itens = []) {
  const resumo = { totalEntradas: 0, totalSaidas: 0, saldoLiquido: 0, quantidade: 0 };
  (itens || []).forEach(item => {
    const valor = Math.abs(Number(item.valor || 0) || 0);
    const tipo = String(item.tipo || '').trim().toLowerCase();
    if (tipo === 'saida') resumo.totalSaidas += valor;
    else resumo.totalEntradas += valor;
    resumo.quantidade += 1;
  });
  resumo.saldoLiquido = resumo.totalEntradas - resumo.totalSaidas;
  return resumo;
}

function preencherFiltrosRelatorioAjusteSaldo(itens = []) {
  const selectConta = document.getElementById('filtroRelAjusteSaldoConta');
  const selectUsuario = document.getElementById('filtroRelAjusteSaldoUsuario');
  if (!selectConta || !selectUsuario) return;

  const valorContaAtual = String(selectConta.value || '').trim();
  const valorUsuarioAtual = String(selectUsuario.value || '').trim();

  const opcoesContas = (relatorioAjusteSaldoContasCache || [])
    .filter(item => item?.ativo !== false)
    .map(item => ({ valor: String(item.id || '').trim(), rotulo: String(item.nome || '').trim() }))
    .filter(item => item.valor && item.rotulo)
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'));
  preencherSelectRelatorioFinanceiro(selectConta, '- Todas as contas -', opcoesContas, valorContaAtual);

  const mapaUsuarios = new Map();
  (itens || []).forEach(item => {
    const chave = obterChaveUsuarioRelAjusteSaldo(item);
    if (!chave) return;
    const nome = String(item.usuario_nome || '').trim() || 'Usuario nao informado';
    mapaUsuarios.set(chave, { valor: chave, rotulo: nome });
  });
  const opcoesUsuarios = Array.from(mapaUsuarios.values()).sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'));
  preencherSelectRelatorioFinanceiro(selectUsuario, '- Todos os usuarios -', opcoesUsuarios, valorUsuarioAtual);
}

function renderizarRelatorioAjusteSaldo(itens = []) {
  const lista = document.getElementById('listaRelatorioAjusteSaldo');
  if (!lista) return;

  if (!itens.length) {
    lista.innerHTML = '<tr><td colspan="8" style="padding:16px;color:var(--text-muted)">Nenhum ajuste de saldo encontrado para os filtros informados.</td></tr>';
    return;
  }

  lista.innerHTML = itens.map(item => {
    const tipoNormalizado = String(item.tipo || '').trim().toLowerCase();
    const tipoTexto = tipoNormalizado === 'saida' ? 'Saida' : 'Entrada';
    const sinal = tipoNormalizado === 'saida' ? '-' : '+';
    return `
      <tr>
        <td style="padding:10px;border-bottom:1px solid var(--border)">${escaparHtmlBasico(item.created_at ? fmtDate(item.created_at) : '-')}</td>
        <td style="padding:10px;border-bottom:1px solid var(--border)">${escaparHtmlBasico(item.conta_financeira_nome || 'Conta nao informada')}</td>
        <td style="padding:10px;border-bottom:1px solid var(--border)">${escaparHtmlBasico(tipoTexto)}</td>
        <td style="padding:10px;border-bottom:1px solid var(--border);text-align:right">${escaparHtmlBasico(`${sinal}${formatarMoedaBRFinanceiro(item.valor || 0)}`)}</td>
        <td style="padding:10px;border-bottom:1px solid var(--border)">${escaparHtmlBasico(String(item.motivo || '').trim() || '-')}</td>
        <td style="padding:10px;border-bottom:1px solid var(--border)">${escaparHtmlBasico(String(item.usuario_nome || '').trim() || '-')}</td>
        <td style="padding:10px;border-bottom:1px solid var(--border);text-align:right">${escaparHtmlBasico(formatarMoedaBRFinanceiro(item.saldo_anterior || 0))}</td>
        <td style="padding:10px;border-bottom:1px solid var(--border);text-align:right">${escaparHtmlBasico(formatarMoedaBRFinanceiro(item.saldo_apos || 0))}</td>
      </tr>
    `;
  }).join('');
}

function resetFiltroRelatorioAjusteSaldo() {
  const hojeLocal = hoje();
  const dataInicio = document.getElementById('filtroRelAjusteSaldoDataInicio');
  const dataFim = document.getElementById('filtroRelAjusteSaldoDataFim');
  const conta = document.getElementById('filtroRelAjusteSaldoConta');
  const tipo = document.getElementById('filtroRelAjusteSaldoTipo');
  const usuario = document.getElementById('filtroRelAjusteSaldoUsuario');
  const buscaMotivo = document.getElementById('filtroRelAjusteSaldoBuscaMotivo');

  if (dataInicio) dataInicio.value = hojeLocal;
  if (dataFim) dataFim.value = hojeLocal;
  if (conta) {
    conta.value = '';
    conta.selectedIndex = 0;
  }
  if (tipo) {
    tipo.value = '';
    tipo.selectedIndex = 0;
  }
  if (usuario) {
    usuario.value = '';
    usuario.selectedIndex = 0;
  }
  if (buscaMotivo) buscaMotivo.value = '';

  carregarRelatorioAjusteSaldo();
}

async function carregarRelatorioAjusteSaldo() {
  const lista = document.getElementById('listaRelatorioAjusteSaldo');
  const campoDataInicio = document.getElementById('filtroRelAjusteSaldoDataInicio');
  const campoDataFim = document.getElementById('filtroRelAjusteSaldoDataFim');
  const campoConta = document.getElementById('filtroRelAjusteSaldoConta');
  const campoTipo = document.getElementById('filtroRelAjusteSaldoTipo');
  const campoUsuario = document.getElementById('filtroRelAjusteSaldoUsuario');
  const campoBusca = document.getElementById('filtroRelAjusteSaldoBuscaMotivo');

  const elEntradas = document.getElementById('relAjusteSaldoTotalEntradas');
  const elSaidas = document.getElementById('relAjusteSaldoTotalSaidas');
  const elLiquido = document.getElementById('relAjusteSaldoLiquido');
  const elQuantidade = document.getElementById('relAjusteSaldoQuantidade');

  if (!lista) return;

  if (campoDataInicio && !campoDataInicio.value) campoDataInicio.value = hoje();
  if (campoDataFim && !campoDataFim.value) campoDataFim.value = hoje();

  lista.innerHTML = '<tr><td colspan="8" style="padding:16px;color:var(--text-muted)">Carregando ajustes de saldo...</td></tr>';

  try {
    const [ajustesRes, contasRes] = await Promise.all([
      sb
        .from('contas_financeiras_ajustes_saldo')
        .select('*')
        .order('created_at', { ascending: false }),
      sb
        .from('contas_financeiras')
        .select('id, nome, ativo')
        .order('nome'),
    ]);

    if (ajustesRes.error) {
      if (isMissingContasFinanceirasAjustesSaldoTableError(ajustesRes.error)) {
        lista.innerHTML = '<tr><td colspan="8" style="padding:16px;color:var(--text-muted)">A tabela contas_financeiras_ajustes_saldo ainda nao existe. Rode a migration para habilitar este relatorio.</td></tr>';
        setMsg('msgRelatorioAjusteSaldo', 'Tabela de ajustes de saldo ainda nao encontrada no banco.', 'err');
        if (elEntradas) elEntradas.textContent = formatarMoedaBRFinanceiro(0);
        if (elSaidas) elSaidas.textContent = formatarMoedaBRFinanceiro(0);
        if (elLiquido) elLiquido.textContent = formatarMoedaBRFinanceiro(0);
        if (elQuantidade) elQuantidade.textContent = '0';
        return;
      }
      throw ajustesRes.error;
    }

    if (contasRes.error && !isMissingContasFinanceirasTableError(contasRes.error)) {
      throw contasRes.error;
    }

    relatorioAjusteSaldoContasCache = contasRes.data || [];
    const contasMap = Object.fromEntries((relatorioAjusteSaldoContasCache || []).map(item => [String(item.id), item.nome || '']));

    const ajustesBase = ajustesRes.data || [];
    const usuarioIds = [...new Set(ajustesBase.map(item => String(item.usuario_id || '').trim()).filter(Boolean))];
    let funcionariosMap = {};
    if (usuarioIds.length) {
      const { data: funcionariosData, error: funcionariosError } = await sb
        .from('funcionarios')
        .select('id, nome')
        .in('id', usuarioIds);
      if (funcionariosError && !isMissingTableError(funcionariosError)) throw funcionariosError;
      funcionariosMap = Object.fromEntries((funcionariosData || []).map(item => [String(item.id), String(item.nome || '').trim()]));
    }

    const itensBase = ajustesBase.map(item => {
      const usuarioId = String(item.usuario_id || '').trim();
      const usuarioNome = String(item.usuario_nome || '').trim() || String(funcionariosMap[usuarioId] || '').trim();
      const motivoAjuste = String(item.motivo || item.observacao || item.descricao || item.justificativa || '').trim();
      return {
        ...item,
        motivo: motivoAjuste,
        usuario_nome: usuarioNome,
        conta_financeira_nome: String(contasMap[String(item.conta_financeira_id)] || '').trim() || 'Conta nao informada',
      };
    });

    preencherFiltrosRelatorioAjusteSaldo(itensBase);

    const filtroDataInicio = String(campoDataInicio?.value || '').trim();
    const filtroDataFim = String(campoDataFim?.value || '').trim();
    const filtroConta = String(campoConta?.value || '').trim();
    const filtroTipo = String(campoTipo?.value || '').trim().toLowerCase();
    const filtroUsuario = String(campoUsuario?.value || '').trim();
    const filtroBusca = String(campoBusca?.value || '').trim().toLowerCase();

    const itensFiltrados = itensBase
      .filter(item => {
        const dataAjuste = String(item.created_at || '').slice(0, 10);
        const contaId = String(item.conta_financeira_id || '').trim();
        const tipo = String(item.tipo || '').trim().toLowerCase();
        const chaveUsuario = obterChaveUsuarioRelAjusteSaldo(item);
        const motivo = String(item.motivo || '').trim().toLowerCase();

        if (filtroDataInicio && (!dataAjuste || dataAjuste < filtroDataInicio)) return false;
        if (filtroDataFim && (!dataAjuste || dataAjuste > filtroDataFim)) return false;
        if (filtroConta && filtroConta !== contaId) return false;
        if (filtroTipo && filtroTipo !== tipo) return false;
        if (filtroUsuario && filtroUsuario !== chaveUsuario) return false;
        if (filtroBusca && !motivo.includes(filtroBusca)) return false;
        return true;
      })
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

    relatorioAjusteSaldoCache = itensFiltrados;

    const resumo = calcularResumoRelatorioAjusteSaldo(itensFiltrados);
    if (elEntradas) elEntradas.textContent = formatarMoedaBRFinanceiro(resumo.totalEntradas);
    if (elSaidas) elSaidas.textContent = formatarMoedaBRFinanceiro(resumo.totalSaidas);
    if (elLiquido) elLiquido.textContent = formatarMoedaBRFinanceiro(resumo.saldoLiquido);
    if (elQuantidade) elQuantidade.textContent = String(resumo.quantidade);

    renderizarRelatorioAjusteSaldo(itensFiltrados);

    if (!itensBase.length) {
      lista.innerHTML = '<tr><td colspan="8" style="padding:16px;color:var(--text-muted)">Nenhum ajuste de saldo cadastrado ate o momento.</td></tr>';
      setMsg('msgRelatorioAjusteSaldo', 'Ainda nao existem ajustes de saldo registrados.', 'ok');
      return;
    }

    if (!itensFiltrados.length) {
      setMsg('msgRelatorioAjusteSaldo', 'Nenhum ajuste encontrado para os filtros informados.', 'ok');
      return;
    }

    setMsg('msgRelatorioAjusteSaldo', `${itensFiltrados.length} ajuste(s) encontrado(s).`, 'ok');
  } catch (error) {
    console.error('Erro ao carregar relatorio de ajuste de saldo:', error);
    lista.innerHTML = '<tr><td colspan="8" style="padding:16px;color:var(--text-muted)">Nao foi possivel carregar o relatorio de ajuste de saldo.</td></tr>';
    if (elEntradas) elEntradas.textContent = formatarMoedaBRFinanceiro(0);
    if (elSaidas) elSaidas.textContent = formatarMoedaBRFinanceiro(0);
    if (elLiquido) elLiquido.textContent = formatarMoedaBRFinanceiro(0);
    if (elQuantidade) elQuantidade.textContent = '0';
    setMsg('msgRelatorioAjusteSaldo', `Nao foi possivel carregar o relatorio: ${mensagemErroSupabase(error, 'erro desconhecido')}`, 'err');
  }
}

function escaparCsvRelatorioAjusteSaldo(valor = '') {
  const texto = String(valor ?? '');
  return `"${texto.replace(/"/g, '""')}"`;
}

function exportarRelatorioAjusteSaldoCsv() {
  const itens = Array.isArray(relatorioAjusteSaldoCache) ? relatorioAjusteSaldoCache : [];
  if (!itens.length) {
    setMsg('msgRelatorioAjusteSaldo', 'Nao ha dados para exportar. Aplique filtros e carregue o relatorio.', 'err');
    return;
  }

  const cabecalho = [
    'Data/hora',
    'Conta financeira',
    'Tipo',
    'Valor',
    'Motivo',
    'Usuario',
    'Saldo anterior',
    'Saldo apos',
  ];

  const linhas = itens.map(item => {
    const tipo = String(item.tipo || '').trim().toLowerCase() === 'saida' ? 'Saida' : 'Entrada';
    return [
      item.created_at ? fmtDate(item.created_at) : '-',
      String(item.conta_financeira_nome || 'Conta nao informada').trim(),
      tipo,
      Number(item.valor || 0).toFixed(2),
      String(item.motivo || '').trim(),
      String(item.usuario_nome || '').trim(),
      Number(item.saldo_anterior || 0).toFixed(2),
      Number(item.saldo_apos || 0).toFixed(2),
    ].map(escaparCsvRelatorioAjusteSaldo).join(';');
  });

  const conteudo = [cabecalho.map(escaparCsvRelatorioAjusteSaldo).join(';'), ...linhas].join('\n');
  const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'relatorio-ajuste-saldo.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  setMsg('msgRelatorioAjusteSaldo', 'CSV exportado com sucesso.', 'ok');
}

function imprimirRelatorioAjusteSaldoPdf() {
  const itens = Array.isArray(relatorioAjusteSaldoCache) ? relatorioAjusteSaldoCache : [];
  if (!itens.length) {
    setMsg('msgRelatorioAjusteSaldo', 'Nao ha dados para exportar em PDF. Aplique filtros e carregue o relatorio.', 'err');
    return;
  }

  const dataInicio = String(document.getElementById('filtroRelAjusteSaldoDataInicio')?.value || '').trim();
  const dataFim = String(document.getElementById('filtroRelAjusteSaldoDataFim')?.value || '').trim();
  const periodo = `${dataInicio || '-'} ate ${dataFim || '-'}`;
  const geradoEm = new Date().toLocaleString('pt-BR');

  const linhas = itens.map(item => {
    const tipo = String(item.tipo || '').trim().toLowerCase() === 'saida' ? 'Saida' : 'Entrada';
    return `
      <tr>
        <td>${escaparHtmlBasico(item.created_at ? fmtDate(item.created_at) : '-')}</td>
        <td>${escaparHtmlBasico(String(item.conta_financeira_nome || 'Conta nao informada').trim())}</td>
        <td>${escaparHtmlBasico(tipo)}</td>
        <td style="text-align:right">${escaparHtmlBasico(formatarMoedaBRFinanceiro(item.valor || 0))}</td>
        <td>${escaparHtmlBasico(String(item.motivo || '').trim() || '-')}</td>
        <td>${escaparHtmlBasico(String(item.usuario_nome || '').trim() || '-')}</td>
        <td style="text-align:right">${escaparHtmlBasico(formatarMoedaBRFinanceiro(item.saldo_anterior || 0))}</td>
        <td style="text-align:right">${escaparHtmlBasico(formatarMoedaBRFinanceiro(item.saldo_apos || 0))}</td>
      </tr>
    `;
  }).join('');

  const janela = window.open('', '_blank', 'width=1200,height=760');
  if (!janela) {
    setMsg('msgRelatorioAjusteSaldo', 'O navegador bloqueou a janela de impressao. Libere pop-ups para exportar o PDF.', 'err');
    return;
  }

  janela.document.write(`
    <html>
      <head>
        <title>Relatorio ajuste de saldo</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; color: #111; }
          h1 { margin: 0 0 8px; font-size: 22px; }
          .meta { margin-bottom: 14px; font-size: 12px; color: #444; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #ddd; padding: 6px; text-align: left; vertical-align: top; }
          th { background: #f5f5f5; }
          ${cssRodapeRelatorioImpressao()}
      
  </style>
      </head>
      <body>
        <h1>Relatorio ajuste de saldo</h1>
        <div class="meta">Periodo filtrado: ${escaparHtmlBasico(periodo)}</div>
        <div class="meta">Gerado em: ${escaparHtmlBasico(geradoEm)}</div>
        <table>
          <thead>
            <tr>
              <th>Data/hora</th>
              <th>Conta financeira</th>
              <th>Tipo</th>
              <th>Valor</th>
              <th>Motivo</th>
              <th>Usuario</th>
              <th>Saldo anterior</th>
              <th>Saldo apos</th>
            </tr>
          </thead>
          <tbody>${linhas}</tbody>
        </table>
        ${htmlRodapeRelatorioImpressao(geradoEm, `Periodo: ${periodo}`)}
      


</body>
    </html>
  `);
  janela.document.close();
  janela.focus();
  janela.print();
  setMsg('msgRelatorioAjusteSaldo', 'PDF preparado para impressao.', 'ok');
}

function resetFiltroRelatorioLancamentos() {
  const hojeLocal = hoje();
  const dataInicio = document.getElementById('filtroLancamentoDataInicio');
  const dataFim = document.getElementById('filtroLancamentoDataFim');
  const evento = document.getElementById('filtroLancamentoEvento');
  const funcionario = document.getElementById('filtroLancamentoFuncionario');
  const busca = document.getElementById('filtroLancamentoBusca');

  relatorioLancamentosRegistrosVisiveis = true;
  if (dataInicio) dataInicio.value = hojeLocal;
  if (dataFim) dataFim.value = hojeLocal;
  if (evento) {
    evento.value = '';
    evento.selectedIndex = 0;
  }
  if (funcionario) {
    funcionario.value = '';
    funcionario.selectedIndex = 0;
  }
  if (busca) busca.value = '';
  carregarRelatorioLancamentos();
}

function montarLinhasExportacaoRelatorioLancamentos() {
  return (relatorioLancamentosCache || []).map(item => ({
    Tarefa: item.nomeTarefa || '',
    Status: item.statusTexto || '',
    Responsavel: item.responsavel || '',
    Observacao: item.observacao || '',
    Descricao: item.descricao || '',
    Data_programada: item.dataProgramada || '',
    Horario_programado: item.horarioProgramado || '',
    Inicio: item.iniciadoEm ? fmtDate(item.iniciadoEm) : '',
    Iniciado_pelo_usuario: item.iniciadoPor || '',
    Fim: item.finalizadoEm ? fmtDate(item.finalizadoEm) : '',
    Finalizado_pelo_usuario: item.finalizadoPor || '',
    Lancado_em: item.lancadoEm ? fmtDate(item.lancadoEm) : '',
    Lancado_pelo_usuario: item.lancadoPor || '',
  }));
}

function exportarRelatorioLancamentosExcel() {
  const linhas = montarLinhasExportacaoRelatorioLancamentos();
  if (!linhas.length) {
    setMsg('msgRelatorioLancamentos', 'Não há tarefas para exportar.', 'err');
    return;
  }
  const headers = Object.keys(linhas[0]);
  const csv = [headers.join(';')].concat(linhas.map(row => headers.map(h => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(';'))).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `relatorio-tarefas-${dataLocalISO()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  setMsg('msgRelatorioLancamentos', 'Excel exportado com sucesso.', 'ok');
}

function exportarRelatorioLancamentosPDF() {
  const linhas = montarLinhasExportacaoRelatorioLancamentos();
  if (!linhas.length) {
    setMsg('msgRelatorioLancamentos', 'Não há tarefas para exportar em PDF.', 'err');
    return;
  }
  const htmlLinhas = linhas.map(row => `
    <tr>
      <td>${escaparHtmlBasico(row.Tarefa)}</td>
      <td>${escaparHtmlBasico(row.Status)}</td>
      <td>${escaparHtmlBasico(row.Responsavel)}</td>
      <td>${escaparHtmlBasico(row.Observacao)}</td>
      <td>${escaparHtmlBasico(row.Descricao)}</td>
      <td>${escaparHtmlBasico(row.Data_programada)}</td>
      <td>${escaparHtmlBasico(row.Horario_programado)}</td>
      <td>${escaparHtmlBasico(row.Inicio)}</td>
      <td>${escaparHtmlBasico(row.Iniciado_pelo_usuario)}</td>
      <td>${escaparHtmlBasico(row.Fim)}</td>
      <td>${escaparHtmlBasico(row.Finalizado_pelo_usuario)}</td>
      <td>${escaparHtmlBasico(row.Lancado_pelo_usuario)}</td>
    </tr>
  `).join('');
  const win = window.open('', '_blank');
  if (!win) {
    setMsg('msgRelatorioLancamentos', 'O navegador bloqueou a janela de PDF.', 'err');
    return;
  }
  const geradoEm = new Date().toLocaleString('pt-BR');
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Relatório de tarefas</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}h1{font-size:20px}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #ccc;padding:6px;text-align:left;vertical-align:top}th{background:#f1f5f9}${cssRodapeRelatorioImpressao()}</style></head><body><h1>Relatório de tarefas</h1><p>Gerado em ${escaparHtmlBasico(geradoEm)}</p><table><thead><tr><th>Tarefa</th><th>Status</th><th>Responsável</th><th>Observação</th><th>Descrição</th><th>Data</th><th>Horário</th><th>Início</th><th>Iniciado pelo usuário</th><th>Fim</th><th>Finalizado pelo usuário</th><th>Lançado pelo usuário</th></tr></thead><tbody>${htmlLinhas}</tbody></table>${htmlRodapeRelatorioImpressao(geradoEm, 'Filtros aplicados na tela de Relatório de tarefas')}<script>window.onload=function(){window.print();}<\/script>


</body></html>`);
  win.document.close();
}

// ═══════════════════════════════════════════════════════════════════════════
