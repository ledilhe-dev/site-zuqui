// ---- STATE ----
let execucaoAtualId = null;
let itensExecucao = [];
let tarefasDisponiveis = true;
let tarefaEmEdicaoId = null;
let checklistReferenciaEmEdicaoId = null;
let funcionariosAtivosTarefa = [];
let selecaoFuncionarioLancamentoPorTarefa = {};
let horarioLancamentoPorTarefa = {};
let diasLancamentoPorTarefa = {};
// Repetição do lançamento: intervalo (dias entre relançamento) e duração (se repete por X dias).
let intervaloLancamentoPorTarefa = {};
let duracaoLancamentoPorTarefa = {};
const DIAS_SEMANA_INTERVALO_FUNCIONARIO = [
  ['dom', 'Domingo'],
  ['seg', 'Segunda-feira'],
  ['ter', 'Terça-feira'],
  ['qua', 'Quarta-feira'],
  ['qui', 'Quinta-feira'],
  ['sex', 'Sexta-feira'],
  ['sab', 'Sábado'],
];
let tarefaModalFuncionariosTarefaId = '';
let tarefaModalFuncionariosSelecionadoId = '';
let usuarioSistemaLogado = null;
let versaoSessaoSistema = 0;
let lojasCadastroCache = [];
let lojaCadastroEmEdicaoId = null;
let tabelaLojasCadastroAtiva = 'lojas';
let adminsLojaCadastroCache = [];
let adminLojaCadastroEmEdicaoId = null;
let funcionarioEmEdicaoId = null;
let funcionarioNomeOriginalEdicao = '';
let funcionarioEmailOriginalEdicao = '';
let funcionarioPerfilOriginalEdicao = '';
let funcionarioEmailVerificacaoPendente = { id: '', nome: '', email: '' };
let cadastroFuncionarioAberto = false;
let perfilEmEdicaoId = null;
let destinatarioEmailEmEdicaoId = null;
let fornecedorFinanceiroEmEdicaoId = null;
let formaPagamentoFinanceiroEmEdicaoId = null;
let contaAPagarFinanceiroEmEdicaoId = null;
let contasAPagarListaVisivel = false;
let contaFinanceiraEmEdicaoId = null;
let recebivelFinanceiroEmEdicaoId = null;
let ajusteSaldoCofreModo = 'ajuste';
let ajusteSaldoCofreTipo = 'entrada';
let fornecedoresFinanceiroCache = [];
let formasPagamentoFinanceiroCache = [];
let contasAPagarFinanceiroCache = [];
let contasAPagarFinanceiroVisiveisIds = [];
let contasAPagarFinanceiroSelecionadasIds = new Set();
let contasBaixarFinanceiroCache = [];
let baixarContasFiltroRapidoAtivo = '';
let contasFinanceirasCache = [];
let extratoContaFinanceiraCache = [];
let cofreMovimentacoesCache = [];
let cofreExtratoVisivel = false;
let recebiveisFinanceiroSelecionadosIds = new Set();
let recebiveisFinanceiroVisiveisIds = [];
let recFuturosSelecionadosIds = new Set();
let recFuturosVisiveisIds = [];
let recebiveisFinanceiroCache = [];
let recebiveisFinanceiroListaVisivel = false;
let recebiveisSaldoGerenciadoBancoCache = null;
let solicitacaoAcessoVisivel = false;
let painelNotificacoesAberto = false;
let notificacoesAtuais = [];
let envioAlertasEmailEmAndamento = false;
let lancamentoAutomaticoEmAndamento = false;
let tokenAutenticacaoEmProcessamento = false;
let quantidadeNotificacoesAnterior = null;
let somNotificacaoHabilitado = false;
let audioContextNotificacao = null;
let audioNotificacaoArquivo = null;
let audioNotificacaoEmReproducao = null;
let audioNotificacaoPreaquecido = false;
let somNotificacaoBloqueadoAte = 0;
let quantidadeAlertasCriticosAnterior = null;
let assinaturaAlertasCriticosAnterior = '';
let avisoCentralTarefasFechado = false;
let assinaturaAvisoCentralTarefas = '';
let assinaturaSomAlertaRapidoLista = '';
let envioAlertaRapidoEmAndamento = false;
let alertasCriticosSilenciadosNaSessao = false;
let assinaturaUltimoRedirecionamentoChecklist = '';
let assinaturaUltimoRedirecionamentoAlertaRapido = '';
let resolverModalPinPendente = null;
let resolverModalFormaPagamentoPendente = null;
let formasModalPagamentoFinanceiro = [];
let resolverModalContaFinanceiraBaixaPendente = null;
let contasModalContaFinanceiraBaixa = [];
let modalContaFinanceiraMovimentarSaldo = true;
let resolverModalConfirmacaoFinanceiraPendente = null;
let editarTituloFinanceiroId = null;
let resolverModalPontoPendente = null;
let intervaloAtualizacaoPaginaAtiva = null;
let intervaloAtualizacaoNotificacoes = null;
let intervaloStatusSincronizacao = null;
let intervaloContadorRetornoPonto = null;
let canalNotificacoesRealtime = null;
let ultimoSucessoSincronizacaoEm = null;
let ultimosLembretesExecucaoEm = {};
let ultimosLembretesChecklistEm = {};
let ultimosLembretesTarefaAtrasadaEm = {};
let execucoesPaginaAtual = 1;
let dashboardProdutividadePeriodo = 'dia';
let dashboardHorasPeriodo = 'dia';
let dashboardHorasRequestSeq = 0;
let dashboardHorasUltimoResultadoValido = null;
let pontoResumoOffsetDias = 0;
let relatorioPontoPeriodo = 'dia';
let relatorioPontoFuncionarioCache = {};
let timeoutAvisoPontoRegistrado = null;
let cacheFuncionariosTempoAvisoPonto = [];
let timeoutLimpezaPinPonto = null;
let segurancaPinPontoConfigurada = false;
let ultimoToquePinPontoEm = 0;
let intervaloVigilanciaPinPonto = null;
let alertasEntradaPontoPendentesAtuais = [];
let alertasRapidosListaEnviadosVisivel = false;
let notificacoesHistoricoMaster = [];
let filtroChecklistLancadoBuscaEditado = false;
let filtroTarefasNomeEditado = false;
let checklistsLancadosCache = [];
let checklistsLancadosFuncionariosMap = {};
let checklistsLancadosUltimaListaFiltrada = [];
let relatorioLancamentosCache = [];
let relatorioLancamentosRegistrosVisiveis = true;
let relatorioFinanceiroCache = [];
let relatorioRecebimentosCache = [];
let relatorioAjusteSaldoCache = [];
let relatorioAjusteSaldoContasCache = [];
let relatorioFinanceiroDetalhesAberto = false;
let tarefasCadastradasCache = [];
let tarefasSelecionadasIds = new Set();
let tarefasConsultaMarcadasIds = new Set();
let tarefasFavoritasIds = new Set();
let tarefasConfigLancamentoAbertasIds = new Set();
let mostrarSomenteFavoritasTarefas = false;
let favoritosTarefasMinimizados = false;
let checklistsFuturosExpandido = false;
let proximasTarefasSelecionadasIds = new Set();
let assinaturaRenderChecklists = '';
let tokenRequisicaoChecklists = 0;
let timeoutAtualizacaoChecklistsRealtime = null;
let timeoutAtualizacaoPaginaRealtime = null;
const lancamentosManuaisEmAndamento = new Set();
const STORAGE_CHECKLISTS_FUTUROS_OPEN = 'zuqui_checklists_futuros_open';
const INTERVALO_ATUALIZACAO_PADRAO_MS = 10 * 60 * 1000; // Consumo otimizado: sem polling visual pesado
const INTERVALO_ATUALIZACAO_CHECKLIST_MS = 10 * 60 * 1000; // Consumo otimizado: checklists atualizam por ação/Realtime
const INTERVALO_ATUALIZACAO_NOTIFICACOES_MS = 10 * 60 * 1000; // Consumo otimizado: sem consulta a cada 5s
const INTERVALO_LEMBRETE_CHECKLIST_MS = 1 * 60 * 1000;
const INTERVALO_LEMBRETE_TAREFA_ATRASADA_MS = 10 * 60 * 1000;
const TEMPO_INICIO_ALERTA_EXECUCAO_MS = 60 * 60 * 1000;
const INTERVALO_REPETICAO_ALERTA_EXECUCAO_MS = 10 * 60 * 1000;
const ANTECEDENCIA_ALERTA_CHECKLIST_MINUTOS = 30;
const JANELA_CONFLITO_LANCAMENTO_MANUAL_MINUTOS = 20;
const JANELA_ALERTA_IMEDIATO_LANCAMENTO_MS = 110 * 60 * 1000;
const LANCAMENTO_AUTOMATICO_TAREFAS_HABILITADO = false; // desativado: lançamento só manual via botão "Lançar"
// Horizonte de agendamento ao clicar em "Lançar tarefa" (ex.: 7, 14, 30).
const HORIZONTE_AGENDAMENTO_MANUAL_DIAS = 7;
let checklistLancamentosSuportaColunasAgendamento = null;

function redefinirEstadoAvisoCentralTarefas() {
  avisoCentralTarefasFechado = false;
  assinaturaAvisoCentralTarefas = '';
  assinaturaAlertasCriticosAnterior = '';
  assinaturaUltimoRedirecionamentoChecklist = '';
  assinaturaUltimoRedirecionamentoAlertaRapido = '';
  quantidadeNotificacoesAnterior = null;
  quantidadeAlertasCriticosAnterior = null;
  alertasCriticosSilenciadosNaSessao = obterSilenciamentoAlertasCriticosDaSessao();
}

function obterChaveUsuarioNotificacoes() {
  if (usuarioSistemaLogado?.tipo === 'admin') {
    return `admin:${usuarioSistemaLogado.username || 'principal'}`;
  }
  if (usuarioSistemaLogado?.id) {
    return `funcionario:${usuarioSistemaLogado.id}`;
  }
  return 'anonimo';
}

function obterStorageNotificacoesLidas() {
  return `zuqui_notificacoes_lidas:${obterChaveUsuarioNotificacoes()}`;
}

function obterStorageHistoricoNotificacoesMaster() {
  return `zuqui_notificacoes_master_historico:${obterChaveUsuarioNotificacoes()}`;
}

function obterStorageNotificacoesMasterDispensadas() {
  return `zuqui_notificacoes_master_dispensadas:${obterChaveUsuarioNotificacoes()}`;
}

function usuarioEhMasterNotificacoes() {
  if (!usuarioSistemaLogado) return false;
  if (usuarioSistemaLogado.tipo === 'admin') return true;

  const codigo = normalizarCodigoPerfil(normalizarPerfilUsuario(usuarioSistemaLogado?.perfil)?.codigo || '');
  if (codigo === 'ADM' || codigo === 'MASTER') return true;

  const permissoes = obterPermissoesUsuario();
  return !!(
    permissoes.tarefas_atraso ||
    permissoes.tarefas_rapidas ||
    permissoes.relatorio_lancamentos ||
    permissoes.ponto_ajustes ||
    permissoes.ver_todos_checklists ||
    permissoes.ver_todas_execucoes
  );
}

function carregarHistoricoNotificacoesMaster() {
  if (!usuarioEhMasterNotificacoes()) return [];
  try {
    const bruto = localStorage.getItem(obterStorageHistoricoNotificacoesMaster());
    if (!bruto) return [];
    const salvo = JSON.parse(bruto);
    if (!salvo || salvo.data !== hoje() || !Array.isArray(salvo.itens)) return [];
    return salvo.itens;
  } catch (e) {
    return [];
  }
}

function salvarHistoricoNotificacoesMaster(itens = []) {
  if (!usuarioEhMasterNotificacoes()) return;
  try {
    localStorage.setItem(obterStorageHistoricoNotificacoesMaster(), JSON.stringify({
      data: hoje(),
      itens: itens || [],
    }));
  } catch (e) {
    console.warn('Falha ao carregar notificações operacionais:', e);
  }
}

function carregarNotificacoesMasterDispensadas() {
  if (!usuarioEhMasterNotificacoes()) return [];
  try {
    const bruto = localStorage.getItem(obterStorageNotificacoesMasterDispensadas());
    if (!bruto) return [];
    const salvo = JSON.parse(bruto);
    if (!salvo || salvo.data !== hoje() || !Array.isArray(salvo.chaves)) return [];
    return salvo.chaves.filter(Boolean);
  } catch (e) {
    return [];
  }
}

function salvarNotificacoesMasterDispensadas(chaves = []) {
  if (!usuarioEhMasterNotificacoes()) return;
  try {
    localStorage.setItem(obterStorageNotificacoesMasterDispensadas(), JSON.stringify({
      data: hoje(),
      chaves: [...new Set((chaves || []).filter(Boolean))],
    }));
  } catch (e) {}
}

function dispensarNotificacoesMaster(chaves = []) {
  if (!usuarioEhMasterNotificacoes() || !chaves.length) return;
  const atuais = carregarNotificacoesMasterDispensadas();
  salvarNotificacoesMasterDispensadas([...atuais, ...chaves]);
}

function notificacaoMasterFoiDispensada(item) {
  if (!usuarioEhMasterNotificacoes()) return false;
  if (tipoNotificacaoCritica(item?.tipo)) return false;
  const chave = String(item?.chave || '');
  if (!chave) return false;
  return carregarNotificacoesMasterDispensadas().includes(chave);
}

function filtrarNotificacoesMasterDispensadas(itens = []) {
  if (!usuarioEhMasterNotificacoes()) return itens || [];
  const chavesDispensadas = new Set(carregarNotificacoesMasterDispensadas());
  return (itens || []).filter(item => {
    if (tipoNotificacaoCritica(item?.tipo)) return true;
    return !chavesDispensadas.has(String(item?.chave || ''));
  });
}

function limparAvisosNotificacaoMaster() {
  if (!usuarioEhMasterNotificacoes()) return;
  const chavesDispensar = notificacoesAtuais
    .filter(item => !tipoNotificacaoCritica(item?.tipo))
    .map(item => item?.chave)
    .filter(Boolean);
  dispensarNotificacoesMaster(chavesDispensar);
  notificacoesHistoricoMaster = filtrarNotificacoesMasterDispensadas(notificacoesHistoricoMaster);
  notificacoesAtuais = filtrarNotificacoesMasterDispensadas(notificacoesAtuais);
  salvarHistoricoNotificacoesMaster(notificacoesHistoricoMaster);
  atualizarBadgeTarefasAtraso(0);
  renderizarListaNotificacoes();
}

function obterStoragePaginaAtiva() {
  return `zuqui_pagina_ativa:${obterChaveUsuarioNotificacoes()}`;
}

function salvarPaginaAtiva(id) {
  if (!id) return;
  try {
    localStorage.setItem(obterStoragePaginaAtiva(), id);
  } catch (e) {}
}

function obterPaginaAtivaSalva() {
  try {
    return localStorage.getItem(obterStoragePaginaAtiva()) || '';
  } catch (e) {
    return '';
  }
}

function restaurarPaginaAtivaSalvaOuPadrao() {
  fecharMenusLaterais();
  // Tela inicial = primeiro nav-btn visível na ordem personalizada do usuário
  // (a ordem foi aplicada por carregarOrdemNavMenu antes desta chamada)
  const telaPreferida = typeof obterTelaPreferidaAoLogin === 'function' ? obterTelaPreferidaAoLogin() : null;
  const primeiroBtnVisivel = Array.from(document.querySelectorAll('#navContainer .nav-btn[data-page]:not(.nav-sub-btn):not(.nav-btn-parent)'))
    .find(btn => btn.style.display !== 'none' && (!usuarioSistemaLogado || usuarioPodeAcessar(btn.dataset.page)));
  const paginaPrimeira = telaPreferida || primeiroBtnVisivel?.dataset?.page || 'checklists';
  if (document.getElementById(paginaPrimeira) && (!usuarioSistemaLogado || usuarioPodeAcessar(paginaPrimeira))) {
    const botaoPrincipal = document.querySelector(`.nav-btn[data-page="${paginaPrimeira}"]`);
    abrirPagina(paginaPrimeira, botaoPrincipal);
    return true;
  }

  let paginaSalva = obterPaginaAtivaSalva();
  if (paginaSalva === 'itens') {
    paginaSalva = 'tarefas';
    salvarPaginaAtiva('tarefas');
  }
  if (paginaSalva && document.getElementById(paginaSalva) && (!usuarioSistemaLogado || usuarioPodeAcessar(paginaSalva))) {
    const botaoSalvo = document.querySelector(`.nav-btn[data-page="${paginaSalva}"]`);
    abrirPagina(paginaSalva, botaoSalvo);
    return true;
  }

  const primeiroDisponivel = Array.from(document.querySelectorAll('.nav-btn[data-page]'))
    .find(btn => btn.style.display !== 'none' && (!usuarioSistemaLogado || usuarioPodeAcessar(btn.dataset.page)));
  if (primeiroDisponivel?.dataset?.page) {
    abrirPagina(primeiroDisponivel.dataset.page, primeiroDisponivel);
    return true;
  }

  return false;
}

function obterStorageAlertasCriticosSilenciados() {
  return `zuqui_alertas_criticos_silenciados:${obterChaveUsuarioNotificacoes()}`;
}

function obterSilenciamentoAlertasCriticosDaSessao() {
  try {
    return sessionStorage.getItem(obterStorageAlertasCriticosSilenciados()) === '1';
  } catch (e) {
    return alertasCriticosSilenciadosNaSessao;
  }
}

function salvarSilenciamentoAlertasCriticosDaSessao(silenciado) {
  alertasCriticosSilenciadosNaSessao = !!silenciado;
  try {
    if (silenciado) {
      sessionStorage.setItem(obterStorageAlertasCriticosSilenciados(), '1');
    } else {
      sessionStorage.removeItem(obterStorageAlertasCriticosSilenciados());
    }
  } catch (e) {}
}

function silenciarAlertasCriticosDaSessao() {
  salvarSilenciamentoAlertasCriticosDaSessao(true);
  const chavesCriticas = obterNotificacoesCriticas().map(item => item.chave).filter(Boolean);
  marcarNotificacoesComoLidas(chavesCriticas);
  notificacoesAtuais = notificacoesAtuais.filter(item => !tipoNotificacaoTarefaAtrasada(item.tipo));
  avisoCentralTarefasFechado = true;
  painelNotificacoesAberto = false;
  renderizarListaNotificacoes();
  togglePainelNotificacoes(false);
}

function obterNotificacoesLidas() {
  try {
    const bruto = localStorage.getItem(obterStorageNotificacoesLidas());
    if (!bruto) return [];
    const salvo = JSON.parse(bruto);
    if (!salvo || salvo.data !== hoje() || !Array.isArray(salvo.chaves)) {
      return [];
    }
    return salvo.chaves;
  } catch (e) {
    return [];
  }
}

function salvarNotificacoesLidas(chaves) {
  localStorage.setItem(obterStorageNotificacoesLidas(), JSON.stringify({
    data: hoje(),
    chaves: [...new Set(chaves.filter(Boolean))],
  }));
}

function marcarNotificacoesComoLidas(chaves = []) {
  if (!chaves.length) return;
  const atuais = obterNotificacoesLidas();
  salvarNotificacoesLidas([...atuais, ...chaves]);
}

function notificacaoJaFoiLida(chave) {
  if (!chave) return false;
  return obterNotificacoesLidas().includes(chave);
}

function notificacaoDeveSempreAparecer(item) {
  // Alertas críticos devem permanecer visíveis enquanto existirem.
  return tipoNotificacaoCritica(item?.tipo);
}

function tipoNotificacaoTarefaAtrasada(tipo) {
  return ['tarefa_atrasada', 'lancamento_atrasado', 'execucao_atrasada', 'checklist_pendente'].includes(tipo);
}

function tipoNotificacaoCritica(tipo) {
  return tipoNotificacaoTarefaAtrasada(tipo) || tipo === 'alerta_rapido';
}

function paginaPermiteAlertaForte(pageId = obterPaginaAtivaAtual()) {
  return ['execucoes', 'tarefas_atraso'].includes(pageId);
}

function obterQuantidadeAtrasosNotificacao() {
  return (notificacoesAtuais || []).filter(item => ['lancamento_atrasado', 'execucao_atrasada'].includes(item?.tipo)).length;
}

function atualizarBadgeTarefasAtraso(quantidade = 0) {
  const badge = document.getElementById('navBadgeTarefasAtraso');
  const botao = document.querySelector('.nav-btn[data-page="tarefas_atraso"]');
  if (!badge || !botao) return;

  const exibirBadge = usuarioEhMasterNotificacoes() && usuarioPodeAcessar('tarefas_atraso');
  if (!exibirBadge) {
    badge.style.display = 'none';
    botao.classList.remove('nav-btn-atraso-piscando');
    return;
  }

  const total = Math.max(0, Number(quantidade) || 0);
  badge.textContent = total > 99 ? '99+' : String(total);
  badge.style.display = total > 0 ? 'inline-flex' : 'none';
  botao.classList.toggle('nav-btn-atraso-piscando', total > 0);
}

function obterNotificacoesCriticas() {
  return notificacoesAtuais.filter(item => tipoNotificacaoCritica(item?.tipo));
}

function obterFuncionarioDestinoAlertaRapidoAtual() {
  if (usuarioSistemaLogado?.id) {
    const ehAdminSistema = usuarioSistemaLogado?.tipo === 'admin' || usuarioSistemaLogado?.tipo === 'admin_loja';
    if (!ehAdminSistema) {
      return {
        id: String(usuarioSistemaLogado.id),
        nome: usuarioSistemaLogado.nome || usuarioSistemaLogado.username || usuarioSistemaLogado.email || '',
      };
    }
  }
  return {
    id: '',
    nome: usuarioSistemaLogado?.nome || usuarioSistemaLogado?.username || usuarioSistemaLogado?.email || '',
  };
}

async function buscarAlertasRapidosPendentesParaDestino(destino = { id: '', nome: '' }) {
  const destinoId = String(destino?.id || '').trim();
  const destinoNomeNormalizado = normalizarTextoComparacao(destino?.nome || '');
  const lojaIdSessao = String(obterLojaIdSessao?.() || usuarioSistemaLogado?.loja_id || '').trim();
  const empresaIdSessao = String(obterEmpresaIdSessao?.() || usuarioSistemaLogado?.empresa_id || '').trim();
  const podeReceberFilaDaLoja = usuarioPodeReceberAlertaRapido();

  const agruparAlertas = (itens = []) => {
    const grupos = new Map();

    (itens || []).forEach(item => {
      const chaveGrupo = String(item.grupo_id || item.id || '');
      const atual = grupos.get(chaveGrupo);
      const nomeDestinoItem = String(item.funcionario_destino_nome || '').trim();

      if (!atual) {
        grupos.set(chaveGrupo, {
          ...item,
          grupo_id: chaveGrupo,
          funcionario_destino_nome: nomeDestinoItem || 'Funcionário',
          destinatarios: nomeDestinoItem ? [nomeDestinoItem] : [],
          quantidadeDestinos: nomeDestinoItem ? 1 : 0,
        });
        return;
      }

      if (nomeDestinoItem) {
        if (!atual.destinatarios.includes(nomeDestinoItem)) {
          atual.destinatarios.push(nomeDestinoItem);
        }
        atual.quantidadeDestinos = atual.destinatarios.length;
        if (!atual.funcionario_destino_nome) {
          atual.funcionario_destino_nome = nomeDestinoItem;
        }
      }
    });

    return Array.from(grupos.values()).map(item => ({
      ...item,
      funcionario_destino_nome: item.destinatarios.length > 1
        ? item.destinatarios.join(', ')
        : (item.destinatarios[0] || item.funcionario_destino_nome || 'Funcionário'),
    }));
  };

  const consultarPendentes = async (campoData = 'criado_em', modoBusca = 'auto') => {
    let query = sb
      .from('alertas_rapidos')
      .select(`id, grupo_id, mensagem, funcionario_destino_id, funcionario_destino_nome, ${campoData}, status`)
      .eq('status', 'pendente')
      .order(campoData, { ascending: false })
      .limit(100);

    if (modoBusca === 'id' && destinoId) {
      query = query.eq('funcionario_destino_id', destinoId);
    } else if (modoBusca === 'nome' && destinoNomeNormalizado) {
      query = query.ilike('funcionario_destino_nome', `%${escaparValorLike(destino.nome)}%`);
    } else if (destinoId) {
      query = query.eq('funcionario_destino_id', destinoId);
    } else if (destinoNomeNormalizado) {
      query = query.ilike('funcionario_destino_nome', `%${escaparValorLike(destino.nome)}%`);
    }

    const { data, error } = await query;
    if (error) return { data: null, error };
    return {
      data: (data || []).map(item => ({
        ...item,
        criado_em: item.criado_em || item.created_at || null,
        created_at: item.created_at || item.criado_em || null,
      })),
      error: null,
    };
  };

  let consulta = await consultarPendentes('criado_em');
  if (consulta.error && String(consulta.error?.message || '').toLowerCase().includes('criado_em')) {
    consulta = await consultarPendentes('created_at');
  }

  if (consulta.error) {
    if (isMissingQuickAlertsTableError(consulta.error)) return [];
    throw consulta.error;
  }

  let dadosConsulta = consulta.data || [];
  if (!dadosConsulta.length && destinoId && destinoNomeNormalizado) {
    let consultaPorNome = await consultarPendentes('criado_em', 'nome');
    if (consultaPorNome.error && String(consultaPorNome.error?.message || '').toLowerCase().includes('criado_em')) {
      consultaPorNome = await consultarPendentes('created_at', 'nome');
    }
    if (!consultaPorNome.error && consultaPorNome.data?.length) {
      dadosConsulta = consultaPorNome.data || [];
    }
  }
  if ((destinoId || destinoNomeNormalizado) && lojaIdSessao) {
    const consultarPendentesSemFiltroLoja = async (campoData = 'criado_em', modoBusca = 'id') => executarSemFiltroLojaTemporario(async () => {
      let query = sb
        .from('alertas_rapidos')
        .select(`id, grupo_id, mensagem, funcionario_destino_id, funcionario_destino_nome, ${campoData}, status`)
        .eq('status', 'pendente')
        .order(campoData, { ascending: false })
        .limit(100);
      if (modoBusca === 'id' && destinoId) {
        query = query.eq('funcionario_destino_id', destinoId);
      } else if (modoBusca === 'nome' && destinoNomeNormalizado) {
        query = query.ilike('funcionario_destino_nome', `%${escaparValorLike(destino.nome)}%`);
      }
      const { data, error } = await query;
      if (error) return { data: null, error };
      return {
        data: (data || []).map(item => ({
          ...item,
          criado_em: item.criado_em || item.created_at || null,
          created_at: item.created_at || item.criado_em || null,
        })),
        error: null,
      };
    });

    let fallback = await consultarPendentesSemFiltroLoja('criado_em', destinoId ? 'id' : 'nome');
    if (fallback.error && String(fallback.error?.message || '').toLowerCase().includes('criado_em')) {
      fallback = await consultarPendentesSemFiltroLoja('created_at', destinoId ? 'id' : 'nome');
    }
    if (!fallback.error && !fallback.data?.length && destinoId && destinoNomeNormalizado) {
      fallback = await consultarPendentesSemFiltroLoja('criado_em', 'nome');
      if (fallback.error && String(fallback.error?.message || '').toLowerCase().includes('criado_em')) {
        fallback = await consultarPendentesSemFiltroLoja('created_at', 'nome');
      }
    }
    if (!fallback.error && fallback.data?.length) {
      const porId = new Map();
      [...dadosConsulta, ...fallback.data].forEach(item => {
        const chave = String(item?.id || '');
        if (chave) porId.set(chave, item);
      });
      dadosConsulta = Array.from(porId.values());
    } else if (fallback.error && !isMissingQuickAlertsTableError(fallback.error)) {
      console.warn('Falha no fallback sem filtro de loja para alertas rápidos:', fallback.error);
    }
  }

  if (podeReceberFilaDaLoja && (lojaIdSessao || empresaIdSessao)) {
    const consultarPendentesDaLoja = async (campoData = 'criado_em') => {
      let query = sb
        .from('alertas_rapidos')
        .select(`id, grupo_id, mensagem, funcionario_destino_id, funcionario_destino_nome, ${campoData}, status`)
        .eq('status', 'pendente')
        .order(campoData, { ascending: false })
        .limit(100);

      if (lojaIdSessao) {
        query = query.eq('loja_id', lojaIdSessao);
      } else if (empresaIdSessao) {
        query = query.eq('empresa_id', empresaIdSessao);
      }

      const { data, error } = await query;
      if (error) return { data: null, error };
      return {
        data: (data || []).map(item => ({
          ...item,
          criado_em: item.criado_em || item.created_at || null,
          created_at: item.created_at || item.criado_em || null,
          visivel_por_permissao_alerta_rapido: true,
        })),
        error: null,
      };
    };

    let consultaLoja = await consultarPendentesDaLoja('criado_em');
    if (consultaLoja.error && String(consultaLoja.error?.message || '').toLowerCase().includes('criado_em')) {
      consultaLoja = await consultarPendentesDaLoja('created_at');
    }
    if (!consultaLoja.error && consultaLoja.data?.length) {
      const porId = new Map();
      [...dadosConsulta, ...consultaLoja.data].forEach(item => {
        const chave = String(item?.id || '');
        if (chave) porId.set(chave, item);
      });
      dadosConsulta = Array.from(porId.values());
    } else if (consultaLoja.error && !isMissingQuickAlertsTableError(consultaLoja.error)) {
      console.warn('Falha ao buscar fila de alertas rápidos da loja:', consultaLoja.error);
    }
  }

  const filtradosPorDestino = (dadosConsulta || []).filter(item => {
    if (podeReceberFilaDaLoja && item?.visivel_por_permissao_alerta_rapido) return true;
    if (destinoId && String(item.funcionario_destino_id || '') === destinoId) return true;
    if (destinoNomeNormalizado) return normalizarTextoComparacao(item.funcionario_destino_nome || '') === destinoNomeNormalizado;
    return false;
  });

  return agruparAlertas(filtradosPorDestino);
}

function usuarioRecebeAlertaOperacional() {
  if (!usuarioSistemaLogado) return false;
  if (usuarioSistemaLogado.tipo === 'admin') return false;
  if (usuarioSistemaLogado.tipo === 'admin_loja') return false;

  return true;
}

function usuarioPodeVerNotificacaoSolicitacao() {
  return !usuarioSistemaLogado || usuarioSistemaLogado.tipo === 'admin' || usuarioPodeAcessar('solicitacoes');
}

function usuarioPodeVerNotificacaoChecklist() {
  return usuarioRecebeAlertaOperacional();
}

function usuarioPodeVerNotificacaoExecucao() {
  return usuarioRecebeAlertaOperacional();
}

function usuarioPodeReceberAlertaRapido() {
  if (!usuarioSistemaLogado) return false;
  return !!obterPermissoesUsuario().receber_alertas_rapidas;
}

function usuarioPodeConfirmarAlertaRapido() {
  if (!usuarioSistemaLogado) return false;
  return !!obterPermissoesUsuario().confirmar_alertas_rapidas || usuarioSistemaLogado.tipo === 'funcionario';
}

function usuarioPodeEnviarAlertasRapidos() {
  if (!usuarioSistemaLogado) return false;
  if (!usuarioEhAdministrador()) return false;
  return !!obterPermissoesUsuario().enviar_alertas_rapidas;
}

function usuarioPodeGerenciarAlertasRapidos() {
  // Permite se for admin OU se o perfil tiver a permissão 'excluir_alertas_rapidas'
  if (usuarioEhAdministrador()) return true;
  return !!obterPermissoesUsuario().excluir_alertas_rapidas;
}

function usuarioPodeAcessarAlertasRapidos() {
  if (!usuarioSistemaLogado) return false;
  if (usuarioPodeEnviarAlertasRapidos()) return true;
  const permissoes = obterPermissoesUsuario();
  return !!(permissoes.tarefas_rapidas || permissoes.receber_alertas_rapidas || permissoes.confirmar_alertas_rapidas);
}

function usuarioEhPerfilGerencialNotificacoes() {
  if (!usuarioSistemaLogado) return false;
  if (usuarioSistemaLogado.tipo === 'admin') return true;
  const permissoes = obterPermissoesUsuario();
  return !!(permissoes.tarefas_rapidas || permissoes.ponto_ajustes || permissoes.tarefas_atraso || permissoes.ver_todos_checklists || permissoes.ver_todas_execucoes);
}

const PERFIL_PERMISSOES = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'meu_painel', label: 'Meu Painel (personalizado)' },
  { key: 'checklists', label: 'Iniciar checklist' },
  { key: 'bater_ponto', label: 'Bater ponto' },
  { key: 'escala_plantoes', label: 'Escalas' },
  { key: 'cadastro_plantao', label: 'Cadastro de plantão' },
  { key: 'excluir_agenda_cadastrada', label: 'Agenda - excluir item cadastrado com PIN' },
  { key: 'relatorio_plantao', label: 'Relatório de plantão' },
  { key: 'escala_valor_combinado', label: 'Escala - ver valor combinado' },
  { key: 'relatorio_ponto', label: 'Relatório de ponto' },
  { key: 'ponto_ajustes', label: 'Solicitações de ajuste de ponto' },
  { key: 'alterar_tempo_aviso_ponto', label: 'Ponto - alterar tempo para aviso de retorno' },
  { key: 'relatorio_lancamentos', label: 'Relatório de tarefas' },
  { key: 'relatorio_tarefas_cadastradas', label: 'Relatório de tarefas cadastradas' },
  { key: 'relatorio_financeiro', label: 'Relatório de contas a pagar' },
  { key: 'relatorio_recebimentos', label: 'Relatório de recebimentos' },
  { key: 'relatorio_ajuste_saldo', label: 'Relatório ajuste de saldo' },
  { key: 'financeiro_fornecedores', label: 'Financeiro - Fornecedores' },
  { key: 'financeiro_formas_pagamento', label: 'Financeiro - Formas de pagamento' },
  { key: 'financeiro_contasapagar', label: 'Financeiro - Contas a pagar' },
  { key: 'financeiro_baixar_contas', label: 'Financeiro - Baixar contas' },
  { key: 'financeiro_conta_financeira', label: 'Financeiro - Conta financeira' },
  { key: 'financeiro_recebiveis', label: 'Financeiro - Recebíveis' },
  { key: 'financeiro_cofre', label: 'Financeiro - Cofre' },
  { key: 'financeiro_grupo_fornecedor', label: 'Financeiro - Grupos de Fornecedor' },
  { key: 'financeiro_categorias_compra', label: 'Financeiro - Categorias de Compra' },
  { key: 'funcionarios', label: 'Funcionarios' },
  { key: 'solicitacoes', label: 'Solicitações de acesso / aprovar e-mail' },
  { key: 'emails', label: 'Envio de e-mail' },
  { key: 'configuracoes', label: 'Informacoes da loja' },
  { key: 'forcar_atualizacao_geral', label: 'Forçar atualização geral dos usuários' },
  { key: 'gerenciar_empresas', label: 'SaaS - gerenciar empresas/clientes' },
  { key: 'gerenciar_lojas', label: 'SaaS - gerenciar lojas por empresa' },
  { key: 'cadastro_lojas', label: 'Lojas - visualizar/editar' },
  { key: 'criar_lojas', label: 'Lojas - criar/inativar' },
  { key: 'cadastro_admins_loja', label: 'Admins por loja - criar/editar/remover' },
  { key: 'perfis', label: 'Perfis' },
  { key: 'tarefas', label: 'Cadastro de Checklist' },
  { key: 'tarefas_rapidas', label: 'Alertas rápidas' },
  { key: 'enviar_alertas_rapidas', label: 'Enviar alertas rápidos' },
  { key: 'excluir_alertas_rapidas', label: 'Excluir alertas rápidos' },
  { key: 'receber_alertas_rapidas', label: 'Receber notificação de alerta rápido' },
  { key: 'confirmar_alertas_rapidas', label: 'Confirmar alertas rápidos' },
  { key: 'execucoes', label: 'Em andamento' },
  { key: 'tarefas_atraso', label: 'Tarefas em atraso' },
  { key: 'nova_execucao_manual', label: 'Nova execucao manual' },
  { key: 'ver_todos_checklists', label: 'Ver checklists de todos' },
  { key: 'ver_todas_execucoes', label: 'Ver execucoes de todos' },
  { key: 'excluir_proximas_tarefas', label: 'Excluir próximas tarefas (seleção em massa em Iniciar checklist)' },
  { key: 'excluir_tarefas_massa', label: 'Excluir tarefas em massa (Cadastro de checklist)' },
  { key: 'excluir_checklist_lancado', label: 'Excluir checklist lançado individualmente' },
  { key: 'aprovar_solicitacao_acesso', label: 'Aprovar solicitação de acesso (definir lojas/perfil)' },
];

const PERFIL_ACOES_COLUNAS = [
  { key: 'visualizar', label: 'Visualizar' },
  { key: 'criar', label: 'Criar' },
  { key: 'editar', label: 'Editar' },
  { key: 'excluir', label: 'Excluir' },
];

const PERFIL_MODULOS_MATRIZ_BASE = [
  { nome: 'Operação diária', recursos: [
    { nome: 'Dashboard', visualizar: 'dashboard' },
    { nome: 'Meu Painel', visualizar: 'meu_painel', editar: 'meu_painel_editar' },
    { nome: 'Execução de checklist', visualizar: 'checklists', criar: 'nova_execucao_manual', editar: 'checklists_editar', excluir: 'excluir_checklist_lancado' },
    { nome: 'Agenda / Escalas', visualizar: 'escala_plantoes', criar: 'cadastro_plantao', editar: 'agenda_editar', excluir: 'excluir_agenda_cadastrada' },
    { nome: 'Alertas rápidos', visualizar: 'tarefas_rapidas', criar: 'enviar_alertas_rapidas', editar: 'confirmar_alertas_rapidas', excluir: 'excluir_alertas_rapidas' },
    { nome: 'Bater ponto', visualizar: 'bater_ponto', editar: 'ponto_ajustes' },
  ]},
  { nome: 'Cadastros', recursos: [
    { nome: 'Funcionários', visualizar: 'funcionarios', criar: 'funcionarios_criar', editar: 'funcionarios_editar', excluir: 'funcionarios_excluir' },
    { nome: 'Perfis de acesso', visualizar: 'perfis', criar: 'perfis_criar', editar: 'perfis_editar', excluir: 'perfis_excluir' },
    { nome: 'Checklists / Tarefas', visualizar: 'tarefas', criar: 'tarefas_criar', editar: 'tarefas_editar', excluir: 'excluir_tarefas_massa' },
    { nome: 'Lojas', visualizar: 'cadastro_lojas', criar: 'criar_lojas', editar: 'configuracoes', excluir: 'lojas_excluir' },
    { nome: 'Administradores de loja', visualizar: 'cadastro_admins_loja', criar: 'admins_loja_criar', editar: 'admins_loja_editar', excluir: 'admins_loja_excluir' },
  ]},
  { nome: 'Financeiro', recursos: [
    { nome: 'Contas a pagar', visualizar: 'financeiro_contasapagar', criar: 'contasapagar_criar', editar: 'contasapagar_editar', excluir: 'contasapagar_excluir' },
    { nome: 'Baixa de contas', visualizar: 'financeiro_baixar_contas', editar: 'financeiro_baixar_contas_editar', excluir: 'financeiro_baixar_contas_estornar' },
    { nome: 'Recebíveis', visualizar: 'financeiro_recebiveis', criar: 'recebiveis_criar', editar: 'recebiveis_editar', excluir: 'recebiveis_excluir' },
    { nome: 'Fornecedores', visualizar: 'financeiro_fornecedores', criar: 'fornecedores_criar', editar: 'fornecedores_editar', excluir: 'fornecedores_excluir' },
    { nome: 'Formas de pagamento', visualizar: 'financeiro_formas_pagamento', criar: 'formas_pagamento_criar', editar: 'formas_pagamento_editar', excluir: 'formas_pagamento_excluir' },
    { nome: 'Contas financeiras', visualizar: 'financeiro_conta_financeira', criar: 'contas_financeiras_criar', editar: 'contas_financeiras_editar', excluir: 'contas_financeiras_excluir' },
    { nome: 'Categorias de compra', visualizar: 'financeiro_categorias_compra', criar: 'categorias_compra_criar', editar: 'categorias_compra_editar', excluir: 'categorias_compra_excluir' },
    { nome: 'Grupos de fornecedor', visualizar: 'financeiro_grupo_fornecedor', criar: 'grupos_fornecedor_criar', editar: 'grupos_fornecedor_editar', excluir: 'grupos_fornecedor_excluir' },
    { nome: 'Cofre', visualizar: 'financeiro_cofre', editar: 'financeiro_cofre_editar' },
  ]},
  { nome: 'Relatórios', recursos: [
    { nome: 'Agenda / Plantão', visualizar: 'relatorio_plantao' },
    { nome: 'Ponto', visualizar: 'relatorio_ponto' },
    { nome: 'Lançamentos e tarefas', visualizar: 'relatorio_lancamentos' },
    { nome: 'Tarefas cadastradas', visualizar: 'relatorio_tarefas_cadastradas' },
    { nome: 'Contas a pagar', visualizar: 'relatorio_financeiro' },
    { nome: 'Recebimentos', visualizar: 'relatorio_recebimentos' },
    { nome: 'Ajustes de saldo', visualizar: 'relatorio_ajuste_saldo' },
  ]},
  { nome: 'Administração', recursos: [
    { nome: 'Solicitações de acesso', visualizar: 'solicitacoes', editar: 'aprovar_solicitacao_acesso' },
    { nome: 'Envio de e-mail', visualizar: 'emails', criar: 'emails_enviar' },
    { nome: 'Empresas / clientes', visualizar: 'gerenciar_empresas', criar: 'empresas_criar', editar: 'empresas_editar', excluir: 'empresas_excluir' },
    { nome: 'Gestão global de lojas', visualizar: 'gerenciar_lojas', criar: 'lojas_globais_criar', editar: 'lojas_globais_editar', excluir: 'lojas_globais_excluir' },
    { nome: 'Atualização geral', editar: 'forcar_atualizacao_geral' },
  ]},
];

const chavesMatrizPerfil = new Set();
PERFIL_MODULOS_MATRIZ_BASE.forEach(modulo => modulo.recursos.forEach(recurso => {
  PERFIL_ACOES_COLUNAS.forEach(acao => {
    const chave = recurso[acao.key];
    if (!chave) return;
    chavesMatrizPerfil.add(chave);
    if (!PERFIL_PERMISSOES.some(item => item.key === chave)) {
      PERFIL_PERMISSOES.push({ key: chave, label: `${recurso.nome} - ${acao.label}` });
    }
  });
}));

const permissoesAvancadasMatriz = PERFIL_PERMISSOES
  .filter(item => !chavesMatrizPerfil.has(item.key))
  .map(item => ({ nome: item.label, visualizar: item.key }));

const PERFIL_MODULOS_MATRIZ = [
  ...PERFIL_MODULOS_MATRIZ_BASE,
  ...(permissoesAvancadasMatriz.length ? [{ nome: 'Permissões complementares', recursos: permissoesAvancadasMatriz }] : []),
];

function obterPermissoesBase(codigo) {
  const codigoNormalizado = normalizarCodigoPerfil(codigo);
  if (codigoNormalizado === 'ADM' || codigoNormalizado === 'MASTER') {
    return Object.fromEntries(PERFIL_PERMISSOES.map(p => [p.key, true]));
  }

  if (codigoNormalizado === 'VENDEDOR') {
    return {
      dashboard: false,
      meu_painel: false,
      checklists: false,
      bater_ponto: false,
      escala_plantoes: false,
      cadastro_plantao: false,
      excluir_agenda_cadastrada: false,
      relatorio_plantao: false,
      escala_valor_combinado: false,
      relatorio_ponto: false,
      ponto_ajustes: false,
      relatorio_lancamentos: false,
      relatorio_tarefas_cadastradas: false,
      relatorio_financeiro: false,
      relatorio_recebimentos: false,
      relatorio_ajuste_saldo: false,
      financeiro_fornecedores: false,
      financeiro_formas_pagamento: false,
      financeiro_contasapagar: false,
      financeiro_baixar_contas: false,
      financeiro_conta_financeira: false,
      financeiro_recebiveis: false,
      financeiro_grupo_fornecedor: false,
      financeiro_categorias_compra: false,
      financeiro_cofre: false,
      funcionarios: false,
      solicitacoes: true,
      emails: false,
      configuracoes: false,
      gerenciar_empresas: false,
      gerenciar_lojas: false,
      cadastro_lojas: true,
      criar_lojas: false,
      cadastro_admins_loja: true,
      perfis: false,
      tarefas: false,
      tarefas_rapidas: false,
      enviar_alertas_rapidas: false,
      receber_alertas_rapidas: false,
      confirmar_alertas_rapidas: false,
      execucoes: false,
      tarefas_atraso: false,
      nova_execucao_manual: false,
      ver_todos_checklists: false,
      ver_todas_execucoes: false,
    };
  }

  if (codigoNormalizado === 'GERENTE' || codigoNormalizado === 'GESTOR') {
    return {
      dashboard: true,
      checklists: true,
      bater_ponto: true,
      escala_plantoes: true,
      cadastro_plantao: true,
      excluir_agenda_cadastrada: true,
      relatorio_plantao: true,
      escala_valor_combinado: false,
      relatorio_ponto: true,
      ponto_ajustes: true,
      relatorio_lancamentos: true,
      relatorio_tarefas_cadastradas: true,
      relatorio_financeiro: false,
      relatorio_recebimentos: false,
      relatorio_ajuste_saldo: false,
      financeiro_fornecedores: false,
      financeiro_formas_pagamento: false,
      financeiro_contasapagar: false,
      financeiro_baixar_contas: false,
      financeiro_conta_financeira: false,
      financeiro_recebiveis: false,
      financeiro_grupo_fornecedor: false,
      financeiro_categorias_compra: false,
      financeiro_cofre: false,
      funcionarios: false,
      solicitacoes: false,
      emails: false,
      configuracoes: false,
      gerenciar_empresas: false,
      gerenciar_lojas: false,
      cadastro_lojas: false,
      criar_lojas: false,
      cadastro_admins_loja: false,
      perfis: false,
      tarefas: false,
      tarefas_rapidas: true,
      enviar_alertas_rapidas: false,
      receber_alertas_rapidas: true,
      confirmar_alertas_rapidas: true,
      execucoes: true,
      tarefas_atraso: true,
      nova_execucao_manual: true,
      ver_todos_checklists: true,
      ver_todas_execucoes: true,
    };
  }

  return {
    dashboard: false,
      meu_painel: false,
    checklists: true,
    bater_ponto: true,
    escala_plantoes: false,
    cadastro_plantao: false,
    excluir_agenda_cadastrada: false,
    relatorio_plantao: false,
    escala_valor_combinado: true,
    relatorio_ponto: false,
    ponto_ajustes: false,
    relatorio_lancamentos: false,
    relatorio_tarefas_cadastradas: false,
    relatorio_financeiro: false,
    relatorio_recebimentos: false,
    relatorio_ajuste_saldo: false,
    financeiro_fornecedores: false,
    financeiro_formas_pagamento: false,
    financeiro_contasapagar: false,
    financeiro_baixar_contas: false,
    financeiro_conta_financeira: false,
    financeiro_recebiveis: false,
      financeiro_cofre: false,
    funcionarios: false,
    solicitacoes: false,
    emails: false,
    configuracoes: false,
    cadastro_lojas: false,
    criar_lojas: false,
    cadastro_admins_loja: false,
    perfis: false,
    tarefas: false,
    tarefas_rapidas: false,
    enviar_alertas_rapidas: false,
    receber_alertas_rapidas: true,
    confirmar_alertas_rapidas: true,
    execucoes: true,
    tarefas_atraso: false,
    nova_execucao_manual: false,
    ver_todos_checklists: false,
    ver_todas_execucoes: false,
  };
}
