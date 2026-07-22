// ---- HELPERS ----
function setMsg(id, txt, tipo) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = txt;
  el.className = 'msg' + (tipo ? ' ' + tipo : '');
}


function usuarioPodeAlterarTempoAvisoPonto() {
  if (!usuarioSistemaLogado) return false;
  if (usuarioEhAdministrador()) return true;
  const permissoes = obterPermissoesUsuario();
  return permissoes?.alterar_tempo_aviso_ponto === true;
}

function obterChaveTempoAvisoPonto(funcionarioId = '', dataIso = dataLocalISO()) {
  const lojaId = obterLojaIdSessao?.() || usuarioSistemaLogado?.loja_id || 'global';
  return `checkdiario:tempo_aviso_ponto:${lojaId}:global`;
}

function obterTempoAvisoManualPonto(funcionarioId = '', dataIso = dataLocalISO()) {
  try {
    const valor = localStorage.getItem(obterChaveTempoAvisoPonto());
    const minutos = Number(valor || 0);
    return Number.isFinite(minutos) && minutos > 0 ? Math.round(minutos) : 0;
  } catch (e) {
    return 0;
  }
}

function atualizarCardTempoAvisoPonto() {
  const card = document.getElementById('pontoTempoAvisoCard');
  if (!card) return;
  card.hidden = !usuarioPodeAlterarTempoAvisoPonto();
  if (!card.hidden) carregarTempoAvisoManualPontoSelecionado();
}

function preencherSelectTempoAvisoPonto(funcionarios = []) {
  cacheFuncionariosTempoAvisoPonto = Array.isArray(funcionarios) ? funcionarios : [];
  carregarTempoAvisoManualPontoSelecionado();
}

function carregarTempoAvisoManualPontoSelecionado() {
  const input = document.getElementById('tempoAvisoPontoMinutos');
  const ajuda = document.getElementById('tempoAvisoPontoAjuda');
  const valorAtual = document.getElementById('tempoAvisoPontoAtual');
  const infoIcon = document.getElementById('tempoAvisoPontoInfo');
  if (!input) return;
  const manual = obterTempoAvisoManualPonto();
  input.value = manual ? String(manual) : '';
  const textoAjuda = manual
    ? `Intervalo padrão ativo: quando o funcionário não tiver intervalo cadastrado, o sistema considera ${manual} min e avisa se passar do horário.`
    : 'Sem intervalo padrão configurado. O sistema usa apenas o intervalo cadastrado no funcionário.';
  if (ajuda) ajuda.textContent = textoAjuda;
  if (valorAtual) valorAtual.textContent = manual ? String(manual) : '--';
  if (infoIcon) infoIcon.title = textoAjuda;
}

async function salvarTempoAvisoManualPonto() {
  if (!usuarioPodeAlterarTempoAvisoPonto()) {
    setMsg('msgTempoAvisoPonto', 'Você não tem permissão para alterar o tempo de aviso.', 'err');
    return;
  }
  const input = document.getElementById('tempoAvisoPontoMinutos');
  const minutos = Number(input?.value || 0);
  if (!Number.isFinite(minutos) || minutos <= 0 || minutos > 240 || !Number.isInteger(minutos)) {
    setMsg('msgTempoAvisoPonto', 'Informe um tempo entre 1 e 240 minutos.', 'err');
    return;
  }
  try {
    localStorage.setItem(obterChaveTempoAvisoPonto(), String(minutos));
    setMsg('msgTempoAvisoPonto', `Intervalo padrão salvo: ${minutos} min.`, 'ok');
    carregarTempoAvisoManualPontoSelecionado();
    await carregarResumoPontoHoje();
  } catch (e) {
    setMsg('msgTempoAvisoPonto', 'Não foi possível salvar o tempo de aviso neste navegador.', 'err');
  }
}

async function limparTempoAvisoManualPonto() {
  if (!usuarioPodeAlterarTempoAvisoPonto()) {
    setMsg('msgTempoAvisoPonto', 'Você não tem permissão para alterar o tempo de aviso.', 'err');
    return;
  }
  try {
    localStorage.removeItem(obterChaveTempoAvisoPonto());
    setMsg('msgTempoAvisoPonto', 'Intervalo padrão removido. O contador continua usando o intervalo cadastrado do funcionário.', 'ok');
    carregarTempoAvisoManualPontoSelecionado();
    await carregarResumoPontoHoje();
  } catch (e) {
    setMsg('msgTempoAvisoPonto', 'Não foi possível remover o tempo de aviso neste navegador.', 'err');
  }
}

function calcularTotalIntervalosPonto(intervalos = [], saidaIntervaloSemRegistro = null) {
  // Evita dobrar intervalo quando o mesmo descanso aparece em mais de uma origem
  // (ex.: ponto_intervalos + campos principais do ponto).
  // A regra correta é contar cada janela de intervalo uma única vez.
  const faixas = [];

  (intervalos || []).forEach(intervalo => {
    if (!intervalo?.inicio_em) return;
    const inicioMs = new Date(intervalo.inicio_em).getTime();
    const fimMs = intervalo.retorno_em ? new Date(intervalo.retorno_em).getTime() : Date.now();
    if (!Number.isNaN(inicioMs) && !Number.isNaN(fimMs) && fimMs > inicioMs) {
      faixas.push([inicioMs, fimMs]);
    }
  });

  if (saidaIntervaloSemRegistro) {
    const inicioMs = new Date(saidaIntervaloSemRegistro).getTime();
    const fimMs = Date.now();
    if (!Number.isNaN(inicioMs) && fimMs > inicioMs) {
      faixas.push([inicioMs, fimMs]);
    }
  }

  if (!faixas.length) return 0;

  faixas.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const consolidadas = [];
  faixas.forEach(([inicio, fim]) => {
    const ultima = consolidadas[consolidadas.length - 1];
    if (!ultima || inicio > ultima[1]) {
      consolidadas.push([inicio, fim]);
      return;
    }
    // Intervalo igual ou sobreposto: une em uma única faixa para não somar duas vezes.
    ultima[1] = Math.max(ultima[1], fim);
  });

  const total = consolidadas.reduce((acc, [inicio, fim]) => acc + Math.floor((fim - inicio) / 60000), 0);
  return Math.max(0, total);
}

function formatarTempoRegressivoPonto(msRestante = 0) {
  const negativo = msRestante < 0;
  const totalSegundos = Math.max(0, Math.floor(Math.abs(msRestante) / 1000));
  const horas = Math.floor(totalSegundos / 3600);
  const minutos = Math.floor((totalSegundos % 3600) / 60);
  const segundos = totalSegundos % 60;
  const texto = `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;
  return negativo ? `-${texto}` : texto;
}

function falarAvisoPontoRegistrado(nomeFuncionario = '', tipoPonto = 'iniciado') {
  if (!('speechSynthesis' in window)) return;
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    const vozes = synth.getVoices ? synth.getVoices() : [];
    const vozPtBr = vozes.find(v => (v.lang || '').toLowerCase().startsWith('pt-br'))
      || vozes.find(v => (v.lang || '').toLowerCase().startsWith('pt'))
      || null;
    const nome = String(nomeFuncionario || 'funcionário').trim();
    const tipoNormalizado = String(tipoPonto || '').toLowerCase();
    const frase = tipoNormalizado === 'parado'
      ? `Ponto parado. ${nome}.`
      : `Ponto iniciado. ${nome}.`;
    const utter = new SpeechSynthesisUtterance(frase);
    utter.lang = 'pt-BR';
    utter.volume = 1;
    utter.rate = 1.03;
    utter.pitch = 1.05;
    if (vozPtBr) utter.voice = vozPtBr;
    synth.speak(utter);
  } catch (e) {}
}

function falarAlertaPontoBatidoMenosDezMinutos(nomeFuncionario = '') {
  if (!('speechSynthesis' in window)) return;
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    const vozes = synth.getVoices ? synth.getVoices() : [];
    const vozPtBr = vozes.find(v => (v.lang || '').toLowerCase().startsWith('pt-br'))
      || vozes.find(v => (v.lang || '').toLowerCase().startsWith('pt'))
      || null;
    const nome = String(nomeFuncionario || 'funcionário').trim();
    const utter = new SpeechSynthesisUtterance(`Atenção. Ponto batido há menos de dez minutos. ${nome}. Aguarde para registrar novamente.`);
    utter.lang = 'pt-BR';
    utter.volume = 1;
    utter.rate = 0.98;
    utter.pitch = 1.02;
    if (vozPtBr) utter.voice = vozPtBr;
    synth.speak(utter);
  } catch (e) {}
}

function exibirAvisoPontoRegistrado(nomeFuncionario = '', tipoPonto = 'iniciado') {
  const overlay = document.getElementById('pontoFeedbackOverlay');
  const texto = document.getElementById('pontoFeedbackText');
  if (!overlay || !texto) return;

  const nome = String(nomeFuncionario || 'FUNCIONÁRIO').trim().toUpperCase();
  const tipoNormalizado = String(tipoPonto || '').toLowerCase();
  const pontoParado = tipoNormalizado === 'parado';
  texto.classList.toggle('parado', pontoParado);
  texto.textContent = `${pontoParado ? 'PONTO PARADO' : 'PONTO INICIADO'} ${nome}`;
  overlay.hidden = false;
  overlay.classList.add('show');

  try {
    tocarSomNovaTarefaChecklist();
    window.setTimeout(() => falarAvisoPontoRegistrado(nomeFuncionario, tipoPonto), 260);
  } catch (e) {}

  if (timeoutAvisoPontoRegistrado) {
    clearTimeout(timeoutAvisoPontoRegistrado);
  }

  timeoutAvisoPontoRegistrado = setTimeout(() => {
    overlay.classList.remove('show');
    overlay.hidden = true;
  }, 3000);
}

function falarConfirmacaoPendenciaPonto() {
  if (!('speechSynthesis' in window)) return;
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    const vozes = synth.getVoices ? synth.getVoices() : [];
    const vozPtBr = vozes.find(v => (v.lang || '').toLowerCase().startsWith('pt-br'))
      || vozes.find(v => (v.lang || '').toLowerCase().startsWith('pt'))
      || null;
    const utter = new SpeechSynthesisUtterance('TAREFA PENDENTE, VOCÊ CONFIRMA?');
    utter.lang = 'pt-BR';
    utter.volume = 1;
    utter.rate = 1.03;
    utter.pitch = 1.05;
    if (vozPtBr) utter.voice = vozPtBr;
    synth.speak(utter);
  } catch (e) {}
}

function abrirModalPendenciaPonto({
  nomeFuncionario = '',
  textoPendencias = '',
  quantidadePendentesInicio = 0,
  quantidadePendentesFinalizacao = 0,
} = {}) {
  const overlay = document.getElementById('pontoPendenteOverlay');
  const texto = document.getElementById('pontoPendenteTexto');
  const lista = document.getElementById('pontoPendenteLista');
  const btnTarefas = document.getElementById('btnPontoPendenteTarefas');
  const btnChecklists = document.getElementById('btnPontoPendenteChecklists');
  const btnConfirmar = document.getElementById('btnPontoPendenteConfirmar');
  if (!overlay || !texto || !lista || !btnTarefas || !btnChecklists || !btnConfirmar) {
    return Promise.resolve('cancelar');
  }

  texto.textContent = `${nomeFuncionario || 'Funcionário'}, existem tarefas pendentes no seu nome.`;
  lista.textContent = textoPendencias || 'Há tarefas sem iniciar ou sem finalizar.';

  const temChecklistPendente = Number(quantidadePendentesInicio || 0) > 0;
  const temTarefaPendenteFinalizar = Number(quantidadePendentesFinalizacao || 0) > 0;

  // Mantém como está quando existem os dois tipos de pendência.
  if (temChecklistPendente && temTarefaPendenteFinalizar) {
    btnTarefas.style.display = '';
    btnChecklists.style.display = '';
    btnTarefas.textContent = 'Ver tarefas';
    btnChecklists.textContent = 'Ver checklists';
  } else if (temChecklistPendente) {
    btnTarefas.style.display = 'none';
    btnChecklists.style.display = '';
    btnChecklists.textContent = 'Abrir checklists';
  } else if (temTarefaPendenteFinalizar) {
    btnTarefas.style.display = '';
    btnChecklists.style.display = 'none';
    btnTarefas.textContent = 'Abrir tarefa';
  } else {
    btnTarefas.style.display = 'none';
    btnChecklists.style.display = 'none';
  }

  overlay.hidden = false;

  if (somNotificacaoHabilitado) {
    tocarSomExecucaoAtrasadaNotificacao(false);
  }
  setTimeout(() => falarConfirmacaoPendenciaPonto(), 250);

  return new Promise(resolve => {
    resolverModalPontoPendente = resolve;
  });
}

function fecharModalPendenciaPonto(acao = 'cancelar') {
  const overlay = document.getElementById('pontoPendenteOverlay');
  if (overlay) overlay.hidden = true;
  const resolver = resolverModalPontoPendente;
  resolverModalPontoPendente = null;
  if (resolver) resolver(acao);
}

function limparCampoPinPonto() {
  const campoPin = document.getElementById('pontoPinInput');
  if (!campoPin) return;
  campoPin.value = '';
  ultimoToquePinPontoEm = 0;
}

function agendarLimpezaCampoPinPonto() {
  if (timeoutLimpezaPinPonto) {
    clearTimeout(timeoutLimpezaPinPonto);
  }
  timeoutLimpezaPinPonto = setTimeout(() => {
    limparCampoPinPonto();
  }, 10000);
}

function registrarInteracaoCampoPinPonto() {
  ultimoToquePinPontoEm = Date.now();
  agendarLimpezaCampoPinPonto();
}

function configurarSegurancaCampoPinPonto() {
  if (segurancaPinPontoConfigurada) return;
  const campoPin = document.getElementById('pontoPinInput');
  if (!campoPin) return;

  segurancaPinPontoConfigurada = true;
  campoPin.setAttribute('autocomplete', 'new-password');
  campoPin.setAttribute('autocapitalize', 'off');
  campoPin.setAttribute('autocorrect', 'off');
  campoPin.setAttribute('spellcheck', 'false');
  campoPin.setAttribute('name', 'ponto_pin_seguro');
  campoPin.readOnly = false;
  campoPin.addEventListener('focus', () => {
    campoPin.readOnly = false;
    registrarInteracaoCampoPinPonto();
  });

  ['input', 'keydown', 'paste', 'change'].forEach(evt => {
    campoPin.addEventListener(evt, registrarInteracaoCampoPinPonto);
  });

  campoPin.addEventListener('blur', () => {
    agendarLimpezaCampoPinPonto();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') {
      limparCampoPinPonto();
    }
  });

  window.addEventListener('pageshow', () => {
    limparCampoPinPonto();
  });

  // Limpa imediatamente caso o navegador/autofill injete valor.
  limparCampoPinPonto();
  window.setTimeout(() => limparCampoPinPonto(), 60);
  window.setTimeout(() => limparCampoPinPonto(), 300);

  intervaloVigilanciaPinPonto = window.setInterval(() => {
    const valor = String(campoPin.value || '').trim();
    if (!valor) return;
    if (!ultimoToquePinPontoEm) {
      ultimoToquePinPontoEm = Date.now();
    }
    if ((Date.now() - ultimoToquePinPontoEm) >= 10000) {
      limparCampoPinPonto();
    }
  }, 1000);
}

function nomePareceCompleto(nome) {
  return String(nome || '').trim().length >= 4;
}

function emailPareceValido(email) {
  if (!email) return false;
  const normalizado = email.trim().toLowerCase();
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!regex.test(normalizado)) return false;

  const dominiosBloqueados = [
    'teste.com',
    'test.com',
    'email.com',
    'exemplo.com',
    'example.com',
    'fake.com',
    'invalido.com',
    'invalid.com',
  ];

  const dominio = normalizado.split('@')[1] || '';
  if (dominiosBloqueados.includes(dominio)) return false;
  return true;
}

function normalizarTextoComparacao(valor) {
  return String(valor || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function escaparValorLike(valor) {
  return String(valor || '').replace(/[%,]/g, ' ').trim();
}

async function validarDuplicidadeCadastro({
  nome,
  email,
  pin,
  funcionarioIdIgnorar = null,
  solicitacaoIdIgnorar = null,
  verificarSolicitacoesPendentes = true,
} = {}) {
  const nomeNormalizado = normalizarTextoComparacao(nome);
  const emailNormalizado = String(email || '').trim().toLowerCase();
  const pinNormalizado = String(pin || '').trim();

  if (emailNormalizado) {
    const { data: funcionarioEmail } = await sb
      .from('funcionarios')
      .select('id')
      .eq('email', emailNormalizado)
      .neq('id', funcionarioIdIgnorar || '00000000-0000-0000-0000-000000000000')
      .maybeSingle();

    if (funcionarioEmail) return 'Já existe um usuário com este e-mail.';
  }

  if (pinNormalizado) {
    const { data: pinEmUso } = await sb.rpc('credencial_funcionario_em_uso', {
      p_senha: pinNormalizado,
      p_ignorar_id: funcionarioIdIgnorar || null,
    });
    if (pinEmUso === true) return 'Já existe um usuário com este PIN.';
  }

  // Em edicoes, o UPDATE e o indice unico do banco sao a fonte de verdade.
  // A pre-consulta pode enxergar registros fora da lista/escopo atual e gerar
  // falso positivo; o banco ainda bloqueia uma duplicidade real ao salvar.
  if (nomeNormalizado && !funcionarioIdIgnorar) {
    let consultaFuncionariosMesmoNome = sb
      .from('funcionarios')
      .select('id, nome')
      .ilike('nome', escaparValorLike(nome));

    const { data: funcionariosMesmoNome } = await consultaFuncionariosMesmoNome;

    if ((funcionariosMesmoNome || []).some(item =>
      String(item.id) !== String(funcionarioIdIgnorar ?? '')
      && normalizarTextoComparacao(item.nome) === nomeNormalizado
    )) {
      return 'Já existe um usuário com este nome.';
    }
  }

  if (!verificarSolicitacoesPendentes) {
    return '';
  }

  if (emailNormalizado) {
    const { data: solicitacaoEmail } = await sb
      .from('solicitacoes_acesso')
      .select('id')
      .eq('email', emailNormalizado)
      .eq('status', 'pendente')
      .neq('id', solicitacaoIdIgnorar || '00000000-0000-0000-0000-000000000000')
      .maybeSingle();

    if (solicitacaoEmail) return 'Já existe uma solicitação pendente com este e-mail.';
  }

  if (nomeNormalizado) {
    const { data: solicitacoesMesmoNome } = await sb
      .from('solicitacoes_acesso')
      .select('id, nome')
      .eq('status', 'pendente')
      .ilike('nome', escaparValorLike(nome));

    if ((solicitacoesMesmoNome || []).some(item => item.id !== solicitacaoIdIgnorar && normalizarTextoComparacao(item.nome) === nomeNormalizado)) {
      return 'Já existe uma solicitação pendente com este nome.';
    }
  }

  return '';
}

async function excluirCadastroCompletoPorEmail(email, opcoes = {}) {
  const emailNormalizado = String(email || '').trim().toLowerCase();
  if (!emailNormalizado) return { success: false, message: 'E-mail inválido.' };

  const confirmar = opcoes.confirmar !== false;
  const textoConfirmacao = opcoes.textoConfirmacao || 'Excluir totalmente este e-mail do sistema? Isso remove solicitações, usuário e tokens de autenticação.';
  if (confirmar && !confirm(textoConfirmacao)) {
    return { success: false, cancelled: true };
  }

  const { data: funcionariosRelacionados, error: erroFuncionariosRelacionados } = await executarSemFiltrosTenantTemporario(() => sb
    .from('funcionarios')
    .select('id')
    .eq('email', emailNormalizado));

  if (erroFuncionariosRelacionados && !isMissingTableError(erroFuncionariosRelacionados)) {
    return { success: false, message: mensagemErroSupabase(erroFuncionariosRelacionados, 'Não foi possível preparar a exclusão do cadastro.') };
  }

  for (const item of (funcionariosRelacionados || [])) {
    const preparo = await desvincularFuncionarioParaExclusao(item.id);
    if (!preparo.success) return preparo;
  }

  const resultados = await executarSemFiltrosTenantTemporario(() => Promise.allSettled([
    sb.from('email_tokens_auth').delete().eq('email', emailNormalizado),
    sb.from('solicitacoes_acesso').delete().eq('email', emailNormalizado),
    sb.from('funcionarios').delete().eq('email', emailNormalizado),
  ]));
  const falha = resultados.find(resultado => resultado.status === 'fulfilled' && resultado.value?.error && !isMissingAccessRequestsTableError(resultado.value.error) && !isMissingTableError(resultado.value.error));

  if (falha && falha.status === 'fulfilled') {
    if (isForeignKeyViolationError(falha.value.error)) {
      return { success: false, message: 'Não foi possível excluir porque ainda existem vínculos obrigatórios deste usuário no histórico.' };
    }
    return { success: false, message: falha.value.error.message || 'Não foi possível excluir o cadastro completo.' };
  }

  return { success: true };
}

function obterUrlBaseAutenticacao() {
  const urlConfigurada = String(AUTH_REDIRECT_URL || '').trim();
  if (/^https?:\/\//i.test(urlConfigurada)) {
    return urlConfigurada;
  }

  if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
    return `${window.location.origin}${window.location.pathname}`;
  }

  return 'https://checkdiario.com.br/';
}

function extrairMensagemErroAutenticacao(valor) {
  if (!valor) return '';

  if (typeof valor === 'string') {
    const texto = valor.trim();
    if (!texto) return '';
    if ((texto.startsWith('{') && texto.endsWith('}')) || (texto.startsWith('[') && texto.endsWith(']'))) {
      try {
        const json = JSON.parse(texto);
        return extrairMensagemErroAutenticacao(json);
      } catch (e) {
      }
    }
    return texto;
  }

  if (typeof valor === 'object') {
    return (
      extrairMensagemErroAutenticacao(valor.message) ||
      extrairMensagemErroAutenticacao(valor.error) ||
      extrairMensagemErroAutenticacao(valor.details) ||
      extrairMensagemErroAutenticacao(valor.msg) ||
      ''
    );
  }

  return '';
}

async function chamarFuncaoAutenticacao(payload) {
  const { data, error } = await sb.functions.invoke(AUTH_EMAIL_FUNCTION_NAME, {
    body: payload,
  });

  if (error) {
    let mensagem = 'Falha ao processar autenticacao por e-mail.';

    if (error?.context && typeof error.context.json === 'function') {
      try {
        const detalhes = await error.context.json();
        mensagem = extrairMensagemErroAutenticacao(detalhes) || mensagem;
      } catch (parseError) {
      }
    }

    const contextoErro = extrairMensagemErroAutenticacao(error?.context?.error);
    const mensagemErro = error?.message && error.message !== 'Edge Function returned a non-2xx status code'
      ? extrairMensagemErroAutenticacao(error.message)
      : '';

    mensagem = contextoErro || mensagemErro || mensagem;

    throw new Error(mensagem);
  }

  return data || {};
}

async function enviarVerificacaoEmailFuncionario(email, opcoes = {}) {
  const emailNormalizado = String(email || '').trim().toLowerCase();
  if (!emailNormalizado || !emailPareceValido(emailNormalizado)) {
    throw new Error('E-mail inválido para verificação.');
  }

  return chamarFuncaoAutenticacao({
    action: 'send_verification',
    email: emailNormalizado,
    funcionarioId: String(opcoes.funcionarioId || '').trim() || undefined,
    redirectUrl: obterUrlBaseAutenticacao(),
  });
}

async function localizarFuncionarioPorLoginParaEmail(loginInformado = '') {
  const login = String(loginInformado || '').trim();
  if (!login) return { funcionario: null, erro: null, motivo: 'vazio' };

  const loginEhEmail = login.includes('@');
  const selectCampos = 'id, nome, email, ativo, email_verificado';

  try {
    if (loginEhEmail) {
      const { data, error } = await sb
        .from('funcionarios')
        .select(selectCampos)
        .eq('ativo', true)
        .eq('email', login.toLowerCase())
        .maybeSingle();
      return { funcionario: data || null, erro: error || null, motivo: data ? '' : 'nao_encontrado' };
    }

    const { data, error } = await sb
      .from('funcionarios')
      .select(selectCampos)
      .eq('ativo', true)
      .ilike('nome', `%${escaparValorLike(login)}%`)
      .limit(20);

    if (error) return { funcionario: null, erro: error, motivo: 'erro' };

    const buscaNormalizada = normalizarTextoComparacao(login);
    const candidatos = data || [];
    const exatos = candidatos.filter(item => normalizarTextoComparacao(item.nome) === buscaNormalizada);
    const lista = exatos.length ? exatos : candidatos;

    if (lista.length === 1) return { funcionario: lista[0], erro: null, motivo: '' };
    if (lista.length > 1) return { funcionario: null, erro: null, motivo: 'ambiguo' };
    return { funcionario: null, erro: null, motivo: 'nao_encontrado' };
  } catch (erro) {
    return { funcionario: null, erro, motivo: 'erro' };
  }
}

function obterContextoTokenAutenticacao() {
  const params = new URLSearchParams(window.location.search);
  const action = params.get('auth_action') || '';
  const token = params.get('token') || '';
  return { action, token };
}

function limparContextoTokenAutenticacao() {
  const url = new URL(window.location.href);
  url.searchParams.delete('auth_action');
  url.searchParams.delete('token');
  window.history.replaceState({}, '', url.toString());
}

function isMissingTableError(error) {
  return error?.code === 'PGRST205' || (error?.message && error.message.includes('missing relation "public.tarefas"'));
}

function isMissingLancamentosTableError(error) {
  return error?.code === 'PGRST205' || (error?.message && error.message.includes('missing relation "public.checklist_lancamentos"'));
}

function isMissingProfilesTableError(error) {
  return error?.code === 'PGRST205' || (error?.message && error.message.includes('missing relation "public.perfis"'));
}

function isMissingEmailNotificationsTableError(error) {
  return error?.code === 'PGRST205' || (error?.message && error.message.includes('missing relation "public.email_notificacoes"'));
}

function isMissingEmailAlertsTableError(error) {
  return error?.code === 'PGRST205' || (error?.message && error.message.includes('missing relation "public.email_alertas"'));
}

function isMissingAccessRequestsTableError(error) {
  return error?.code === 'PGRST205' || (error?.message && error.message.includes('missing relation "public.solicitacoes_acesso"'));
}

function isMissingStoreSettingsTableError(error) {
  return error?.code === 'PGRST205' || (error?.message && error.message.includes('missing relation "public.configuracoes_loja"'));
}

function isMissingStoresTableError(error) {
  return error?.code === 'PGRST205' || (error?.message && error.message.includes('missing relation "public.lojas"'));
}

function isMissingAdminUsersTableError(error) {
  return error?.code === 'PGRST205' || (error?.message && error.message.includes('missing relation "public.usuarios_admin"'));
}

function isMissingTimeClockTableError(error) {
  return error?.code === 'PGRST205' || (error?.message && error.message.includes('missing relation "public.ponto_registros"'));
}

function isMissingTimeClockIntervalsTableError(error) {
  return error?.code === 'PGRST205' || (error?.message && error.message.includes('missing relation "public.ponto_intervalos"'));
}

function isMissingLaunchEventsTableError(error) {
  return error?.code === 'PGRST205' || (error?.message && error.message.includes('missing relation "public.checklist_lancamento_eventos"'));
}

function isMissingChecklistLaunchScheduleColumnsError(error) {
  const mensagem = String(error?.message || '').toLowerCase();
  return error?.code === '42703' && (mensagem.includes('created_at') || mensagem.includes('data_programada'));
}

function isMissingQuickAlertsTableError(error) {
  return error?.code === 'PGRST205' || (error?.message && error.message.includes('missing relation "public.alertas_rapidos"'));
}

function isMissingFornecedoresTableError(error) {
  return error?.code === 'PGRST205' || (error?.message && error.message.includes('missing relation "public.fornecedores"'));
}

function isMissingFormasPagamentoTableError(error) {
  return error?.code === 'PGRST205' || (error?.message && error.message.includes('missing relation "public.formas_pagamento"'));
}

function isMissingContasAPagarTableError(error) {
  return error?.code === 'PGRST205' || (error?.message && error.message.includes('missing relation "public.contasapagar"'));
}

function isMissingRecebiveisTableError(error) {
  return error?.code === 'PGRST205' || (error?.message && error.message.includes('missing relation "public.recebiveis"'));
}

function isMissingContasFinanceirasTableError(error) {
  return error?.code === 'PGRST205' || (error?.message && error.message.includes('missing relation "public.contas_financeiras"'));
}

function isMissingContasFinanceirasMovimentacoesTableError(error) {
  return error?.code === 'PGRST205' || (error?.message && error.message.includes('missing relation "public.contas_financeiras_movimentacoes"'));
}

function isMissingContasFinanceirasAjustesSaldoTableError(error) {
  return error?.code === 'PGRST205' || (error?.message && error.message.includes('missing relation "public.contas_financeiras_ajustes_saldo"'));
}

function isMissingContasAPagarPagamentoColumnsError(error) {
  const msg = String(error?.message || '').toLowerCase();
  return error?.code === '42703' && (
    msg.includes('valor_pago') ||
    msg.includes('forma_pagamento') ||
    msg.includes('forma_pagamento_id') ||
    msg.includes('pago_confirmado_em')
  );
}

function isMissingContasAPagarAuditoriaColumnsError(error) {
  const msg = String(error?.message || '').toLowerCase();
  return error?.code === '42703' && (
    msg.includes('criado_por_id') ||
    msg.includes('criado_por_nome') ||
    msg.includes('excluido_em') ||
    msg.includes('excluido_por_id') ||
    msg.includes('excluido_por_nome')
  );
}

function isForeignKeyViolationError(error) {
  return error?.code === '23503' || (error?.message && String(error.message).toLowerCase().includes('violates foreign key constraint'));
}

function isMissingColumnError(error) {
  return error?.code === '42703' || String(error?.message || '').toLowerCase().includes('column');
}

async function desvincularFuncionarioParaExclusao(funcionarioId) {
  const id = String(funcionarioId || '').trim();
  if (!id) return { success: false, message: 'Funcionário inválido para exclusão.' };

  const operacoes = [
    sb.from('tarefas').update({ funcionario_id: null }).eq('funcionario_id', id),
    sb.from('checklist_lancamentos').update({ funcionario_id: null }).eq('funcionario_id', id),
    sb.from('checklist_execucoes').update({ funcionario_id: null }).eq('funcionario_id', id),
    sb.from('checklist_execucoes').update({ usuario_inicio_id: null }).eq('usuario_inicio_id', id),
    sb.from('checklist_execucoes').update({ usuario_fim_id: null }).eq('usuario_fim_id', id),
    sb.from('checklist_lancamento_eventos').update({ funcionario_responsavel_id: null }).eq('funcionario_responsavel_id', id),
    sb.from('checklist_lancamento_eventos').update({ funcionario_ator_id: null }).eq('funcionario_ator_id', id),
    // Remove os vínculos de loja (multi-loja) para permitir a exclusão sem violar FK.
    executarSemFiltroLojaTemporario(() => sb.from('funcionario_lojas').delete().eq('funcionario_id', id)),
  ];

  const resultados = await Promise.allSettled(operacoes);
  const falha = resultados.find(resultado => {
    if (resultado.status !== 'fulfilled') return true;
    const erro = resultado.value?.error;
    if (!erro) return false;
    if (
      isMissingTableError(erro) ||
      isMissingLancamentosTableError(erro) ||
      isMissingLaunchEventsTableError(erro) ||
      isMissingColumnError(erro)
    ) return false;
    return true;
  });

  if (falha) {
    if (falha.status === 'fulfilled') {
      return { success: false, message: mensagemErroSupabase(falha.value?.error, 'Erro ao desvincular registros do funcionário.') };
    }
    return { success: false, message: 'Erro ao preparar a exclusão do funcionário.' };
  }

  return { success: true };
}

function isMissingWorkShiftColumnsError(error) {
  const msg = String(error?.message || '').toLowerCase();
  return msg.includes('horario_trabalho_inicio') || msg.includes('horario_trabalho_fim');
}

function obterPermissoesUsuario() {
  if (!usuarioSistemaLogado) return {};
  if (usuarioSistemaLogado.tipo === 'admin') {
    return obterPermissoesBase('ADM');
  }

  const perfilNormalizado = normalizarPerfilUsuario(usuarioSistemaLogado?.perfil);
  if (!perfilNormalizado?.codigo) {
    return {};
  }

  const codigo = normalizarCodigoPerfil(perfilNormalizado.codigo);
  const permissoesDoBanco = normalizarPermissoesPerfil(perfilNormalizado.permissoes);

  if (codigo === 'ADM' || codigo === 'MASTER') {
    const permissoes = { ...obterPermissoesBase(codigo), ...permissoesDoBanco };
    PERFIL_PERMISSOES.forEach(p => { permissoes[p.key] = true; });
    if (usuarioSistemaLogado?.tipo !== 'admin') {
      // Perfis ADM antigos não têm estas permissões salvas no banco ainda.
      // Quando ausentes, mantemos liberado; quando desmarcadas no perfil, bloqueamos.
      permissoes.solicitacoes = permissoesDoBanco.solicitacoes !== false;
      permissoes.cadastro_lojas = permissoesDoBanco.cadastro_lojas !== false;
      permissoes.criar_lojas = permissoesDoBanco.criar_lojas !== false;
      permissoes.cadastro_admins_loja = permissoesDoBanco.cadastro_admins_loja !== false;
    }
    permissoes.bater_ponto = true;
    permissoes.ver_todos_checklists = true;
    permissoes.ver_todas_execucoes = true;
    return permissoes;
  }

  // Regra principal: qualquer perfil que venha do banco manda nas permissões.
  // Antes o código forçava acessos por nome/código do perfil, e isso fazia o Gerente
  // ou o Funcionário enxergarem funções que estavam desmarcadas na tela Perfis.
  return { ...obterPermissoesBase(codigo), ...permissoesDoBanco };
}

function usuarioPodeAcessar(pageId) {
  if (!usuarioSistemaLogado) return false;
  // Autoridade global e contexto SaaS são coisas diferentes. Mesmo um usuário
  // administrador, quando está dentro de uma loja, não vê páginas do painel SaaS.
  const apenasAdminGlobal = ['solicitacoes', 'emails', 'forcar_atualizacao_geral', 'tela_preferida_login', 'empresas_saas', 'lojas_saas', 'configuracoes'];
  if (apenasAdminGlobal.includes(pageId)) {
    return usuarioSistemaLogado?.tipo === 'admin' && !String(usuarioSistemaLogado?.loja_id || '').trim();
  }
  if (usuarioEhAdministrador()) return true;
  const permissoes = obterPermissoesUsuario();
  if (String(pageId || '').startsWith('integracoes_financeiras_')) return permissoes.integracoes_financeiras === true;
  if (pageId === 'tarefas_rapidas') {
    return usuarioPodeAcessarAlertasRapidos();
  }
  if (pageId === 'escala_plantoes') {
    return permissoes.agenda === true;
  }
  if (pageId === 'relatorio_plantao') {
    return permissoes.relatorio_plantao === true;
  }
  return !!permissoes[pageId];
}

// Verifica uma permissão específica de FUNÇÃO (não de página) definida no perfil.
// Admin global e perfis ADM/MASTER sempre passam. Demais perfis dependem do toggle salvo.
function usuarioTemPermissao(chave) {
  if (!usuarioSistemaLogado) return false;
  if (usuarioEhAdministrador()) return true;
  const permissoes = obterPermissoesUsuario();
  return permissoes?.[chave] === true;
}

// True para admin de SISTEMA (tipo='admin') OU membro do perfil Administrador/Master
// OU admin de loja. Use para operações privilegiadas de loja (checklist, funcionários),
// onde o perfil Administrador deve ter os mesmos direitos, mesmo sem ser admin de sistema.
function usuarioEhAdminOuPerfilAdmin() {
  if (!usuarioSistemaLogado) return false;
  if (usuarioEhAdministrador()) return true;
  if (usuarioSistemaLogado?.tipo === 'admin_loja') return true;
  if (usuarioSistemaLogado?.é_administrador === true || usuarioSistemaLogado?.is_admin === true) return true;
  const codigo = normalizarCodigoPerfil(
    usuarioSistemaLogado?.perfil?.codigo || usuarioSistemaLogado?.tipo || ''
  );
  return codigo === 'ADM' || codigo === 'MASTER';
}

function usuarioEhAdministrador() {
  // Retorna true APENAS para admin global (painel administrativo)
  // NÃO confundir com admin de loja que tem perfil ADM/MASTER
  if (!usuarioSistemaLogado) return false;
  return usuarioSistemaLogado?.tipo === 'admin';
}

function usuarioEhAdminDeLoja() {
  // Retorna true se é funcionário com é_administrador=true EM UMA LOJA
  // ou se tem tipo='admin_loja'
  if (!usuarioSistemaLogado) return false;
  if (usuarioSistemaLogado?.tipo === 'admin') return false;  // Admin global não é admin de loja
  
  // Verificar se marcado como administrador nesta loja específica
  return usuarioSistemaLogado?.é_administrador === true || 
         usuarioSistemaLogado?.is_admin === true ||
         usuarioSistemaLogado?.tipo === 'admin_loja';
}

function usuarioPodeVerValorCombinadoEscala() {
  if (!usuarioSistemaLogado) return false;
  if (usuarioEhAdministrador()) return true;
  const codigoPerfil = normalizarCodigoPerfil(usuarioSistemaLogado?.perfil?.codigo || usuarioSistemaLogado?.tipo || '');
  const permissoes = obterPermissoesUsuario();
  if (permissoes?.escala_valor_combinado === true) return true;
  return ['FUNCIONARIO', 'FUNCIONÁRIO', 'COLABORADOR'].includes(codigoPerfil);
}

function aplicarPermissaoValorCombinadoEscala() {
  const podeVer = usuarioPodeVerValorCombinadoEscala();
  document.querySelectorAll('[data-permissao-valor-escala]').forEach(el => {
    el.style.display = podeVer ? '' : 'none';
  });
  const campo = document.getElementById('escalaPlantaoValor');
  if (campo) {
    campo.disabled = !podeVer;
    if (!podeVer) campo.value = '';
  }
  document.body.classList.toggle('sem-valor-combinado-escala', !podeVer);
  return podeVer;
}

function usuarioPodeGerenciarLojasGlobais() {
  if (!usuarioSistemaLogado) return false;
  if (usuarioEhAdministrador()) return true;
  if (usuarioSistemaLogado.tipo === 'admin_loja') return true;
  return !!obterPermissoesUsuario().cadastro_lojas;
}

function usuarioPodeCriarLojasGlobais() {
  if (!usuarioSistemaLogado) return false;
  if (usuarioEhAdministrador()) return true;
  return !!obterPermissoesUsuario().criar_lojas;
}

function usuarioPodeGerenciarAdminsLojasGlobais() {
  if (!usuarioSistemaLogado) return false;
  if (usuarioEhAdministrador()) return true;
  return !!obterPermissoesUsuario().cadastro_admins_loja;
}

function usuarioPodeEditarAdminsDaLojaLogada() {
  if (!usuarioSistemaLogado) return false;
  if (usuarioEhAdministrador()) return true;
  if (usuarioSistemaLogado.tipo === 'admin_loja') return true;
  return !!obterPermissoesUsuario().cadastro_admins_loja;
}

function usuarioPodeCriarAdminsLojasGlobais() {
  if (!usuarioSistemaLogado) return false;
  if (usuarioEhAdministrador()) return true;
  return !!obterPermissoesUsuario().cadastro_admins_loja;
}

function usuarioEhContaZuquiOperacional() {
  if (!usuarioSistemaLogado) return false;
  const nome = normalizarTextoComparacao(usuarioSistemaLogado.nome || usuarioSistemaLogado.username || '');
  return usuarioSistemaLogado?.tipo === 'admin' && nome === 'zuqui';
}

function usuarioEhPerfilOperacionalGeral() {
  if (!usuarioSistemaLogado) return false;
  if (usuarioSistemaLogado.tipo === 'admin') return true;
  const codigo = normalizarCodigoPerfil(normalizarPerfilUsuario(usuarioSistemaLogado?.perfil)?.codigo || '');
  return codigo === 'ADM' || codigo === 'MASTER' || usuarioEhContaZuquiOperacional();
}

function usuarioTemEscopoTodosFuncionariosPorPermissao() {
  const permissoes = obterPermissoesUsuario();
  return !!(permissoes.ver_todos_checklists || permissoes.ver_todas_execucoes);
}

function usuarioDeveVerApenasProprioFuncionario() {
  return !!(usuarioSistemaLogado?.tipo === 'funcionario'
    && usuarioSistemaLogado?.id
    && !usuarioEhPerfilOperacionalGeral()
    && !usuarioTemEscopoTodosFuncionariosPorPermissao());
}

function obterFuncionarioRestritoLogadoId() {
  return usuarioDeveVerApenasProprioFuncionario() ? String(usuarioSistemaLogado.id || '') : '';
}

function usuarioPodeVisualizarPontoTodosUsuariosLoja() {
  const permissoes = obterPermissoesUsuario();
  const lojaIdSessao = String(obterLojaIdSessao?.() || usuarioSistemaLogado?.loja_id || '').trim();
  const lojasPermitidas = Array.isArray(usuarioSistemaLogado?.lojas_permitidas) ? usuarioSistemaLogado.lojas_permitidas : [];
  const temAcessoLojaSessao = !!lojaIdSessao && lojasPermitidas.some(loja => String(loja?.id || loja?.loja_id || '') === lojaIdSessao);

  return usuarioEhAdministrador() || temAcessoLojaSessao || !!(
    permissoes.relatorio_ponto
    || permissoes.ponto_ajustes
    || permissoes.ver_todos_checklists
    || permissoes.ver_todas_execucoes
  );
}

function obterFuncionarioRestritoLogadoIdParaPonto() {
  if (!usuarioDeveVerApenasProprioFuncionario()) return '';
  if (usuarioPodeVisualizarPontoTodosUsuariosLoja()) return '';
  return String(usuarioSistemaLogado?.id || '');
}

function usuarioPodeVerTodosChecklists() {
  return usuarioEhAdministrador() || !!obterPermissoesUsuario().ver_todos_checklists;
}

function usuarioPodeVerTodasExecucoes() {
  return usuarioEhAdministrador() || !!obterPermissoesUsuario().ver_todas_execucoes;
}

function normalizarCodigoPerfil(codigo) {
  const valor = String(codigo || '').trim().toUpperCase();
  if (['FUNCIONARIOS', 'FUNCIONÁRIOS', 'GERENCIA', 'GERENTE', 'GESTOR'].includes(valor)) return 'GERENTE';
  if (['FUNCIONARIO', 'FUNCIONÁRIO'].includes(valor)) return 'FUNCIONARIO';
  if (['ADMIN', 'ADMINISTRADOR'].includes(valor)) return 'ADM';
  return valor;
}

function normalizarPermissoesPerfil(permissoes) {
  if (!permissoes) return {};
  let normalizadas = {};
  if (typeof permissoes === 'string') {
    try {
      const parsed = JSON.parse(permissoes);
      normalizadas = parsed && typeof parsed === 'object' ? { ...parsed } : {};
    } catch (e) {
      return {};
    }
  } else if (typeof permissoes === 'object') {
    normalizadas = { ...permissoes };
  }
  // Compatibilidade enquanto sessões antigas ainda carregam a chave anterior.
  if (typeof normalizadas.agenda !== 'boolean' && typeof normalizadas.escala_plantoes === 'boolean') {
    normalizadas.agenda = normalizadas.escala_plantoes;
  }
  return normalizadas;
}

function normalizarPerfilUsuario(perfil) {
  if (!perfil) return null;
  const perfilBase = Array.isArray(perfil) ? (perfil[0] || null) : perfil;
  if (!perfilBase || typeof perfilBase !== 'object') return null;

  const codigo = normalizarCodigoPerfil(perfilBase.codigo);
  const nome = codigo === 'GERENTE' && normalizarTextoComparacao(perfilBase.nome || '').includes('funcion')
    ? 'Gerente'
    : (perfilBase.nome || (codigo === 'FUNCIONARIO' ? 'Funcionário' : perfilBase.nome));

  return {
    ...perfilBase,
    nome,
    codigo,
    permissoes: normalizarPermissoesPerfil(perfilBase.permissoes),
  };
}


function isMissingLojaIdColumnError(error) {
  const msg = String(error?.message || '').toLowerCase();
  const details = String(error?.details || '').toLowerCase();
  const hint = String(error?.hint || '').toLowerCase();
  return msg.includes('loja_id') || details.includes('loja_id') || hint.includes('loja_id');
}

function obterLojaIdParaEscopoAtual() {
  if (!usuarioSistemaLogado) return '';
  return String(usuarioSistemaLogado.loja_id || '').trim();
}

async function buscarPerfilPorCodigoEscopoLoja(codigo = 'GERENTE', lojaId = obterLojaIdParaEscopoAtual()) {
  const codigoNormalizado = normalizarCodigoPerfil(codigo || 'GERENTE') || 'GERENTE';
  const lojaIdNormalizado = String(lojaId || '').trim();

  if (lojaIdNormalizado) {
    try {
      const respostaLoja = await sb
        .from('perfis')
        .select('*')
        .eq('codigo', codigoNormalizado)
        .eq('loja_id', lojaIdNormalizado)
        .limit(1);
      if (!respostaLoja.error && respostaLoja.data?.[0]) {
        return normalizarPerfilUsuario(respostaLoja.data[0]);
      }
      if (respostaLoja.error && !isMissingLojaIdColumnError(respostaLoja.error) && !isMissingProfilesTableError(respostaLoja.error)) {
        console.warn('Falha ao buscar perfil por loja:', respostaLoja.error);
      }
    } catch (error) {
      console.warn('Falha ao buscar perfil por loja:', error);
    }
  }

  try {
    const respostaGlobal = await sb
      .from('perfis')
      .select('*')
      .eq('codigo', codigoNormalizado)
      .limit(1);
    if (!respostaGlobal.error && respostaGlobal.data?.[0]) {
      return normalizarPerfilUsuario(respostaGlobal.data[0]);
    }
  } catch (error) {
    console.warn('Falha ao buscar perfil global:', error);
  }

  return normalizarPerfilUsuario({
    nome: codigoNormalizado === 'FUNCIONARIO' ? 'Funcionário' : 'Gerente',
    codigo: codigoNormalizado,
    permissoes: obterPermissoesBase(codigoNormalizado),
  });
}

async function buscarPerfilAdminPadraoParaFuncionario() {
  const perfilAdm = await buscarPerfilPorCodigoEscopoLoja('ADM');
  if (perfilAdm?.id) return perfilAdm;
  return await buscarPerfilPorCodigoEscopoLoja('MASTER');
}

async function obterPerfilAdminLojaSeguro(lojaId = '') {
  // Admin de loja entra com permissões de ADM, mas o acesso aos dados segue
  // limitado pelo loja_id da sessão no wrapper do Supabase.
  const permissoes = obterPermissoesBase('ADM');
  permissoes.solicitacoes = false;
  permissoes.cadastro_lojas = true;
  permissoes.criar_lojas = false;
  permissoes.cadastro_admins_loja = false;
  return normalizarPerfilUsuario({
    nome: 'Administrador da loja',
    codigo: 'ADM',
    permissoes,
  });
}

function persistirSessaoSistemaAtual(manterConectado = false) {
  if (!usuarioSistemaLogado) return;
  const payload = JSON.stringify({
    ...usuarioSistemaLogado,
    perfil: normalizarPerfilUsuario(usuarioSistemaLogado.perfil),
  });
  if (manterConectado) {
    localStorage.setItem('zuqui_auth', payload);
    localStorage.setItem('check_diario_auth_persistente', payload);
    sessionStorage.setItem('zuqui_auth', payload);
    sessionStorage.setItem('check_diario_auth_persistente', payload);
  } else {
    sessionStorage.setItem('zuqui_auth', payload);
    sessionStorage.setItem('check_diario_auth_persistente', payload);
    localStorage.removeItem('zuqui_auth');
    localStorage.removeItem('check_diario_auth_persistente');
  }
}

function obterLojasDisponiveisParaFiltroMultiLoja() {
  const mapa = new Map();
  const empresaSessaoId = String(obterEmpresaIdSessao?.() || usuarioSistemaLogado?.empresa_id || '').trim();
  try {
    if (typeof obterLojasPermitidasSessao === 'function') {
      obterLojasPermitidasSessao().forEach(loja => {
        const id = String(loja?.id || loja?.loja_id || '').trim();
        const empresaLoja = String(loja?.empresa_id || '').trim();
        if (empresaSessaoId && empresaLoja && empresaLoja !== empresaSessaoId) return;
        if (id) mapa.set(id, { id, nome: String(loja?.nome || loja?.nome_loja || 'Loja').trim() || 'Loja' });
      });
    }
  } catch (_) {}

  const lojaSessaoId = String(obterLojaIdSessao?.() || usuarioSistemaLogado?.loja_id || '').trim();
  if (lojaSessaoId && !mapa.has(lojaSessaoId)) {
    mapa.set(lojaSessaoId, {
      id: lojaSessaoId,
      nome: String(usuarioSistemaLogado?.loja_nome || usuarioSistemaLogado?.nome_loja || document.getElementById('topbar-store-name')?.textContent || 'Loja logada').trim() || 'Loja logada',
    });
  }
  return Array.from(mapa.values()).sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'));
}

function renderizarFiltroLojasCheckbox(containerId = '', onChange = '') {
  const container = document.getElementById(containerId);
  if (!container) return [];
  const lojas = obterLojasDisponiveisParaFiltroMultiLoja();
  const lojaSessaoId = String(obterLojaIdSessao?.() || usuarioSistemaLogado?.loja_id || '').trim();
  const lojaSessaoAnterior = String(container.dataset.lojaSessaoId || '').trim();
  const houveTrocaLojaSessao = !!lojaSessaoId && lojaSessaoAnterior && lojaSessaoAnterior !== lojaSessaoId;
  const selecionadasAntes = houveTrocaLojaSessao
    ? new Set()
    : new Set(Array.from(container.querySelectorAll('input[type="checkbox"]:checked')).map(input => String(input.value || '')));
  const selecionadas = selecionadasAntes.size ? selecionadasAntes : new Set(lojaSessaoId ? [lojaSessaoId] : lojas.map(loja => loja.id));
  const handler = String(onChange || '').trim() || 'void 0';

  if (!lojas.length) {
    container.innerHTML = '<span class="multi-loja-filter-title">Lojas</span><span class="item-detalhe">Nenhuma loja disponível.</span>';
    return [];
  }

  const todasMarcadas = lojas.every(loja => selecionadas.has(String(loja.id)));
  container.innerHTML = [
    '<span class="multi-loja-filter-title">Lojas</span>',
    `<label><input type="checkbox" data-multi-loja-todas="1" ${todasMarcadas ? 'checked' : ''} onchange="toggleTodasLojasFiltroMultiLoja('${escaparHtmlBasico(containerId)}', this.checked); ${handler}">Todas</label>`,
    ...lojas.map(loja => `
      <label title="${escaparHtmlBasico(loja.nome)}">
        <input type="checkbox" value="${escaparHtmlBasico(loja.id)}" ${selecionadas.has(String(loja.id)) ? 'checked' : ''} onchange="sincronizarTodasLojasFiltroMultiLoja('${escaparHtmlBasico(containerId)}'); ${handler}">
        ${escaparHtmlBasico(loja.nome)}
      </label>
    `),
  ].join('');
  container.dataset.lojaSessaoId = lojaSessaoId;
  return lojas;
}

function sincronizarTodasLojasFiltroMultiLoja(containerId = '') {
  const container = document.getElementById(containerId);
  if (!container) return;
  const lojas = Array.from(container.querySelectorAll('input[type="checkbox"][value]'));
  const todas = container.querySelector('[data-multi-loja-todas]');
  if (todas) todas.checked = !!lojas.length && lojas.every(input => input.checked);
}

function toggleTodasLojasFiltroMultiLoja(containerId = '', marcado = false) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.querySelectorAll('input[type="checkbox"][value]').forEach(input => {
    input.checked = !!marcado;
  });
}

function obterIdsLojasSelecionadasFiltroMultiLoja(containerId = '') {
  const container = document.getElementById(containerId);
  const ids = container
    ? Array.from(container.querySelectorAll('input[type="checkbox"][value]:checked')).map(input => String(input.value || '').trim()).filter(Boolean)
    : [];
  if (ids.length) return [...new Set(ids)];
  const lojaSessaoId = String(obterLojaIdSessao?.() || usuarioSistemaLogado?.loja_id || '').trim();
  return lojaSessaoId ? [lojaSessaoId] : [];
}

function obterNomeLojaFiltroMultiLoja(lojaId = '') {
  const id = String(lojaId || '').trim();
  if (!id) return '';
  return obterLojasDisponiveisParaFiltroMultiLoja().find(loja => String(loja.id) === id)?.nome || '';
}

function preencherSelectLojaContaAPagarFinanceiro(lojaAtual = '') {
  const select = document.getElementById('contaLojaId');
  if (!select) return;
  const lojas = obterLojasDisponiveisParaFiltroMultiLoja();
  const lojaSessaoId = String(obterLojaIdSessao?.() || usuarioSistemaLogado?.loja_id || '').trim();
  const valorAtual = String(lojaAtual || select.value || lojaSessaoId || '').trim();
  select.innerHTML = lojas.map(loja => `<option value="${escaparHtmlBasico(loja.id)}">${escaparHtmlBasico(loja.nome)}</option>`).join('');
  if (valorAtual && lojas.some(loja => String(loja.id) === valorAtual)) {
    select.value = valorAtual;
  } else if (lojas[0]) {
    select.value = lojas[0].id;
  }
}

function obterLojaSelecionadaContaAPagarFinanceiro() {
  const lojaId = String(document.getElementById('contaLojaId')?.value || '').trim();
  if (!lojaId) return null;
  return obterLojasDisponiveisParaFiltroMultiLoja().find(loja => String(loja.id) === lojaId) || null;
}

async function atualizarSessaoAdminLojaComPerfilCorreto(manterConectado = false) {
  if (usuarioSistemaLogado?.tipo !== 'admin_loja') return;
  const perfilCorreto = await obterPerfilAdminLojaSeguro(usuarioSistemaLogado.loja_id || '');
  usuarioSistemaLogado = {
    ...usuarioSistemaLogado,
    perfil: perfilCorreto,
  };
  window.usuarioSistemaLogado = usuarioSistemaLogado;
  window.__sessaoSistema = () => usuarioSistemaLogado;
  persistirSessaoSistemaAtual(manterConectado);
  atualizarUsuarioTopbar();
  aplicarPermissoesSistema();
  carregarNotificacoes();
}

function aplicarPermissoesSistema() {
  if (!usuarioSistemaLogado) return;

  document.querySelectorAll('.nav-btn[data-page]').forEach(btn => {
    const page = btn.dataset.page;
    btn.style.display = usuarioPodeAcessar(page) ? '' : 'none';
  });

  const paginaAtiva = document.querySelector('.pagina.ativa')?.id;
  if (paginaAtiva && !usuarioPodeAcessar(paginaAtiva)) {
    const fallback = Array.from(document.querySelectorAll('.nav-btn[data-page]')).find(btn => btn.style.display !== 'none');
    if (fallback) fallback.click();
  }

  const itensChecklist = Array.from(document.querySelectorAll('#menuChecklistGroup .nav-btn[data-page]'));
  const grupoChecklist = document.getElementById('menuChecklistGroup');
  const algumVisivel = itensChecklist.some(btn => btn.style.display !== 'none');
  if (grupoChecklist) {
    grupoChecklist.style.display = algumVisivel ? '' : 'none';
  }

  const itensRelatorios = Array.from(document.querySelectorAll('#menuRelatoriosGroup .nav-btn[data-page]'));
  const grupoRelatorios = document.getElementById('menuRelatoriosGroup');
  const algumRelatorioVisivel = itensRelatorios.some(btn => btn.style.display !== 'none');
  if (grupoRelatorios) {
    grupoRelatorios.style.display = algumRelatorioVisivel ? '' : 'none';
  }

  const itensFinanceiro = Array.from(document.querySelectorAll('#menuFinanceiroGroup .nav-btn[data-page]'));
  const grupoFinanceiro = document.getElementById('menuFinanceiroGroup');
  const algumFinanceiroVisivel = itensFinanceiro.some(btn => btn.style.display !== 'none');
  if (grupoFinanceiro) {
    grupoFinanceiro.style.display = algumFinanceiroVisivel ? '' : 'none';
  }

  const itensIntegracoesFinanceiras = Array.from(document.querySelectorAll('#menuIntegracoesFinanceirasGroup .nav-btn[data-page]'));
  const grupoIntegracoesFinanceiras = document.getElementById('menuIntegracoesFinanceirasGroup');
  const algumaIntegracaoFinanceiraVisivel = itensIntegracoesFinanceiras.some(btn => btn.style.display !== 'none');
  if (grupoIntegracoesFinanceiras) {
    grupoIntegracoesFinanceiras.style.display = algumaIntegracaoFinanceiraVisivel ? '' : 'none';
  }

  const itensFuncionarios = Array.from(document.querySelectorAll('#menuFuncionariosGroup .nav-btn[data-page]'));
  const grupoFuncionarios = document.getElementById('menuFuncionariosGroup');
  const algumFuncionarioVisivel = itensFuncionarios.some(btn => btn.style.display !== 'none');
  if (grupoFuncionarios) {
    grupoFuncionarios.style.display = algumFuncionarioVisivel ? '' : 'none';
  }

  const itensConfiguracoes = Array.from(document.querySelectorAll('#menuConfiguracoesGroup .nav-btn[data-page]'));
  const grupoConfiguracoes = document.getElementById('menuConfiguracoesGroup');
  const algumaConfiguracaoVisivel = itensConfiguracoes.some(btn => btn.style.display !== 'none');
  if (grupoConfiguracoes) {
    grupoConfiguracoes.style.display = algumaConfiguracaoVisivel ? '' : 'none';
  }

  const itensSaas = Array.from(document.querySelectorAll('#menuSaasGroup .nav-btn[data-page]'));
  const grupoSaas = document.getElementById('menuSaasGroup');
  const algumSaasVisivel = itensSaas.some(btn => btn.style.display !== 'none');
  if (grupoSaas) {
    grupoSaas.style.display = algumSaasVisivel ? '' : 'none';
  }

  atualizarBotaoForcarAtualizacaoGeral();
  configurarControleVersaoSistema();
  // Garante que a checkbox de admin seja ocultada/bloqueada conforme o usuário logado
  atualizarVisibilidadeCheckboxAdmin();
  // Ordem do menu é carregada explicitamente antes de restaurarPaginaAtivaSalvaOuPadrao
  // Recarregar tema da loja atual sempre que as permissões são reaplicadas
  if (usuarioSistemaLogado) carregarTemaUsuario();
  document.documentElement.classList.remove('admin-fouc-pendente');
}

async function countTable(tableName) {
  const { count, error } = await sb.from(tableName).select('*', { count: 'exact', head: true });
  if (error) {
    console.error(`Erro ao contar tabela ${tableName}:`, error);
    if (tableName === 'tarefas' && isMissingTableError(error)) {
      tarefasDisponiveis = false;
    }
    return null;
  }
  return count;
}

function hoje() {
  return dataLocalISO();
}

function obterPartesDataHoraBrasil(valor = new Date()) {
  const data = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(data.getTime())) return null;

  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const partes = fmt.formatToParts(data);
  const obter = (tipo) => partes.find(p => p.type === tipo)?.value || '';

  const year = obter('year');
  const month = obter('month');
  const day = obter('day');
  const hour = obter('hour');
  const minute = obter('minute');
  if (!year || !month || !day || !hour || !minute) return null;

  return { year, month, day, hour, minute };
}

function dataLocalISO(valor = new Date()) {
  const partes = obterPartesDataHoraBrasil(valor);
  if (!partes) return '';
  return `${partes.year}-${partes.month}-${partes.day}`;
}

function obterJanelaUtcDiaBrasil(dataIso = '') {
  const dataBase = String(dataIso || dataLocalISO()).trim();
  if (!dataBase) return { inicioUtc: '', fimUtc: '' };
  const inicio = new Date(`${dataBase}T00:00:00-03:00`);
  if (Number.isNaN(inicio.getTime())) return { inicioUtc: '', fimUtc: '' };
  const fim = new Date(inicio.getTime() + (24 * 60 * 60 * 1000));
  return { inicioUtc: inicio.toISOString(), fimUtc: fim.toISOString() };
}

function mesclarRegistrosPontoPorId(base = [], complemento = []) {
  const mapa = new Map();
  [...(base || []), ...(complemento || [])].forEach(item => {
    const chave = String(item?.id || '');
    if (!chave) return;
    mapa.set(chave, item);
  });
  return Array.from(mapa.values());
}

async function obterIdsFuncionariosVisiveisLojaParaPonto(funcionarioId = '') {
  const idUnico = String(funcionarioId || '').trim();
  if (idUnico) return [idUnico];

  const lojaId = String(obterLojaIdSessao() || '').trim();
  if (!lojaId) return [];

  let query = sb
    .from('funcionarios')
    .select('id')
    .eq('ativo', true);

  query = aplicarFiltroLojaAtualPontoQuery(query);
  const { data, error } = await query;
  if (error) {
    console.warn('Não foi possível carregar funcionários visíveis para fallback de ponto:', error);
    return [];
  }
  return [...new Set((data || []).map(item => String(item?.id || '')).filter(Boolean))];
}

async function filtrarRegistrosPontoPorFuncionariosVisiveis(rows = [], funcionarioId = '') {
  const lista = Array.isArray(rows) ? rows : [];
  const lojaId = String(obterLojaIdSessao?.() || usuarioSistemaLogado?.loja_id || '').trim();
  const idsFiltro = Array.isArray(funcionarioId)
    ? funcionarioId.map(id => String(id || '').trim()).filter(Boolean)
    : String(funcionarioId || '').trim()
      ? [String(funcionarioId || '').trim()]
      : [];
  const idsVisiveis = await obterIdsFuncionariosVisiveisLojaParaPonto(idsFiltro.length === 1 ? idsFiltro[0] : '');
  if (!lojaId && !idsVisiveis.length) return lista;
  const permitidos = new Set(idsVisiveis.map(String));
  return lista.filter(item => {
    if (idsFiltro.length && !idsFiltro.includes(String(item?.funcionario_id || ''))) return false;
    const funcionarioVinculado = Array.isArray(item?.funcionarios) ? item.funcionarios[0] : item?.funcionarios;
    const lojaFuncionario = String(funcionarioVinculado?.loja_id || '').trim();
    if (lojaFuncionario) return !lojaId || lojaFuncionario === lojaId;

    if (permitidos.has(String(item?.funcionario_id || ''))) return true;

    const lojaRegistro = String(item?.loja_id || '').trim();
    if (lojaRegistro) return !lojaId || lojaRegistro === lojaId;
    if (!idsVisiveis.length) return !lojaId;
    return false;
  });
}

async function complementarRegistrosPontoSemFiltroLoja(rows = [], {
  inicio = '',
  fim = '',
  funcionarioId = '',
  campos = 'id, funcionario_id, data_ponto, entrada_em, saida_em, created_at',
} = {}) {
  const empresaIdSessao = String(obterEmpresaIdSessao() || '').trim();
  if (!empresaIdSessao) return rows || [];

  const { data: dataFallback, error: errorFallback } = await executarSemFiltroLojaTemporario(() => {
    const idsFiltro = Array.isArray(funcionarioId)
      ? funcionarioId.map(id => String(id || '').trim()).filter(Boolean)
      : String(funcionarioId || '').trim()
        ? [String(funcionarioId || '').trim()]
        : [];
    let query = sb
      .from('ponto_registros')
      .select(`${campos}, funcionarios!inner(id,nome,loja_id,empresa_id)`)
      .eq('funcionarios.empresa_id', empresaIdSessao);
    const lojaIdSessao = String(obterLojaIdSessao?.() || usuarioSistemaLogado?.loja_id || '').trim();
    if (lojaIdSessao) query = query.eq('funcionarios.loja_id', lojaIdSessao);
    if (idsFiltro.length === 1) query = query.eq('funcionario_id', idsFiltro[0]);
    if (idsFiltro.length > 1) query = query.in('funcionario_id', idsFiltro);
    if (inicio) query = query.gte('data_ponto', inicio);
    if (fim) query = query.lte('data_ponto', fim);
    return query.order('data_ponto', { ascending: false }).order('created_at', { ascending: false });
  });

  if (errorFallback) {
    console.warn('Não foi possível aplicar fallback sem filtro de loja para ponto:', errorFallback);
    return rows || [];
  }

  return filtrarRegistrosPontoPorFuncionariosVisiveis(
    mesclarRegistrosPontoPorId(rows || [], dataFallback || []),
    funcionarioId
  );
}

async function complementarRegistrosPontoSemFiltroLojaPorCreatedAtDia(rows = [], {
  diaIso = '',
  funcionarioId = '',
  campos = 'id, funcionario_id, data_ponto, entrada_em, saida_em, created_at',
} = {}) {
  const empresaIdSessao = String(obterEmpresaIdSessao() || '').trim();
  if (!empresaIdSessao) return rows || [];

  const { inicioUtc, fimUtc } = obterJanelaUtcDiaBrasil(diaIso || dataLocalISO());
  if (!inicioUtc || !fimUtc) return rows || [];

  const { data: dataFallback, error: errorFallback } = await executarSemFiltroLojaTemporario(() => {
    const idsFiltro = Array.isArray(funcionarioId)
      ? funcionarioId.map(id => String(id || '').trim()).filter(Boolean)
      : String(funcionarioId || '').trim()
        ? [String(funcionarioId || '').trim()]
        : [];
    let query = sb
      .from('ponto_registros')
      .select(`${campos}, funcionarios!inner(id,nome,loja_id,empresa_id)`)
      .eq('funcionarios.empresa_id', empresaIdSessao)
      .gte('created_at', inicioUtc)
      .lt('created_at', fimUtc)
      .order('created_at', { ascending: false });
    const lojaIdSessao = String(obterLojaIdSessao?.() || usuarioSistemaLogado?.loja_id || '').trim();
    if (lojaIdSessao) query = query.eq('funcionarios.loja_id', lojaIdSessao);
    if (idsFiltro.length === 1) query = query.eq('funcionario_id', idsFiltro[0]);
    if (idsFiltro.length > 1) query = query.in('funcionario_id', idsFiltro);
    return query;
  });

  if (errorFallback) {
    console.warn('Não foi possível aplicar fallback por created_at sem filtro de loja para ponto:', errorFallback);
    return rows || [];
  }

  return filtrarRegistrosPontoPorFuncionariosVisiveis(
    mesclarRegistrosPontoPorId(rows || [], dataFallback || []),
    funcionarioId
  );
}

function checklistFoiLancadoHoje(lancadoEm, criadoEm = null) {
  const referencia = lancadoEm || criadoEm;
  if (!referencia) return false;
  return dataLocalISO(referencia) === dataLocalISO();
}

function obterDataProgramadaLancamento(item = {}) {
  const dataProgramada = String(item?.data_programada || '').trim();
  if (dataProgramada) return dataProgramada;
  const referencia = item?.lancado_em || item?.created_at || null;
  return referencia ? dataLocalISO(referencia) : '';
}

function lancamentoProgramadoNaData(item = {}, dataRef = hoje()) {
  return obterDataProgramadaLancamento(item) === dataRef;
}

function lancamentoProgramadoHoje(item = {}) {
  return lancamentoProgramadoNaData(item, hoje());
}

function lancamentoAtendeFiltroDiaSemana(item = {}, dataRef = '') {
  const dataProgramada = String(item?.data_programada || '').trim();
  if (dataProgramada) return true;
  const referencia = String(dataRef || obterDataProgramadaLancamento(item) || hoje()).trim() || hoje();
  return tarefaDisponivelHoje(item?.dias_semana, referencia);
}

function lancamentoContaComoExistenteParaAgenda(item = {}) {
  const status = String(item?.status || '').trim().toLowerCase();
  if (['cancelado', 'cancelada', 'excluido', 'excluida'].includes(status)) return false;
  return true;
}

function extrairMinutosReferenciaBrasil(dataIso) {
  if (!dataIso) return null;
  const partes = obterPartesDataHoraBrasil(new Date(dataIso));
  if (!partes) return null;
  const horas = Number(partes.hour);
  const minutos = Number(partes.minute);
  if (Number.isNaN(horas) || Number.isNaN(minutos)) return null;
  return (horas * 60) + minutos;
}

function lancamentoRecemCriadoParaAlerta(item = {}, janelaMs = JANELA_ALERTA_IMEDIATO_LANCAMENTO_MS) {
  const referencia = item?.lancado_em || item?.created_at || null;
  if (!referencia || !lancamentoProgramadoHoje(item)) return false;

  const diffMs = Date.now() - new Date(referencia).getTime();
  if (Number.isNaN(diffMs) || diffMs < 0) return false;
  return diffMs <= janelaMs;
}

function lancamentoFoiCriadoAposHorarioNoMesmoDia(item = {}) {
  const horarioLimite = horaCurta(item.horario_limite || '');
  if (!horarioLimite) return false;
  if (!lancamentoProgramadoHoje(item)) return false;

  const limiteMin = horarioParaMinutos(horarioLimite);
  const criadoMin = extrairMinutosReferenciaBrasil(item.lancado_em || item.created_at);
  if (limiteMin === null || criadoMin === null) return false;
  return criadoMin > limiteMin;
}

function agoraHoraMinuto() {
  const partes = obterPartesDataHoraBrasil(new Date());
  if (!partes) return '';
  return `${partes.hour}:${partes.minute}`;
}

function fmtDate(str) {
  if (!str) return '-';
  return new Date(str).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function formatarDataProgramadaBr(valor) {
  if (!valor) return '-';
  const data = new Date(`${valor}T00:00:00`);
  if (Number.isNaN(data.getTime())) return valor;
  return data.toLocaleDateString('pt-BR');
}

function formatarDiaSemanaExtenso(valor) {
  if (!valor) return '-';
  const data = new Date(`${valor}T00:00:00`);
  if (Number.isNaN(data.getTime())) return '-';
  return data.toLocaleDateString('pt-BR', { weekday: 'long' });
}

function obterAtorAuditoriaAtual() {
  if (usuarioSistemaLogado?.tipo === 'admin') {
    return {
      funcionarioId: null,
      nome: usuarioSistemaLogado.username || 'Administrador',
      origem: 'admin',
    };
  }

  if (usuarioSistemaLogado?.id) {
    return {
      funcionarioId: usuarioSistemaLogado.id,
      nome: usuarioSistemaLogado.nome || 'Funcionário',
      origem: 'sistema',
    };
  }

  return {
    funcionarioId: null,
    nome: 'Sistema',
    origem: 'sistema',
  };
}

function tituloEventoLancamento(tipoEvento = '') {
  const mapa = {
    lancado: 'Lançado',
    agendamento_ignorado: 'Ignorado',
    iniciado: 'Iniciado',
    finalizado: 'Finalizado',
    cancelado: 'Cancelado',
  };
  return mapa[String(tipoEvento || '').trim()] || 'Evento';
}

function tagEventoLancamento(tipoEvento = '') {
  const tipo = String(tipoEvento || '').trim();
  if (tipo === 'lancado') return '<span class="tag tag-green">Lançado</span>';
  if (tipo === 'iniciado') return '<span class="tag tag-amber">Iniciado</span>';
  if (tipo === 'finalizado') return '<span class="tag tag-green">Finalizado</span>';
  if (tipo === 'agendamento_ignorado') return '<span class="tag tag-red">Ignorado</span>';
  if (tipo === 'cancelado') return '<span class="tag tag-gray">Cancelado</span>';
  return `<span class="tag tag-gray">${escaparHtmlBasico(tipo || 'Evento')}</span>`;
}

async function registrarEventoLancamento({
  lancamentoId = null,
  execucaoId = null,
  tarefaId = null,
  checklistId = null,
  funcionarioResponsavelId = null,
  funcionarioAtorId = null,
  funcionarioAtorNome = '',
  tipoEvento = 'lancado',
  origemEvento = 'sistema',
  dataProgramada = null,
  horarioProgramado = null,
  registradoEm = null,
  observacao = '',
  meta = {},
} = {}) {
  const { error } = await sb.from('checklist_lancamento_eventos').insert([{
    lancamento_id: lancamentoId,
    execucao_id: execucaoId,
    tarefa_id: tarefaId,
    checklist_id: checklistId,
    funcionario_responsavel_id: funcionarioResponsavelId,
    funcionario_ator_id: funcionarioAtorId,
    funcionario_ator_nome: funcionarioAtorNome || null,
    tipo_evento: tipoEvento,
    origem_evento: origemEvento || 'sistema',
    data_programada: dataProgramada || null,
    horario_programado: horaCurta(horarioProgramado || '') || null,
    registrado_em: registradoEm || new Date().toISOString(),
    observacao: observacao || null,
    meta: meta || {},
  }]);

  if (!error) return true;
  if (isMissingLaunchEventsTableError(error)) return false;
  throw error;
}

function obterFuncionarioOperadorAtual() {
  if (usuarioSistemaLogado?.tipo === 'funcionario' && usuarioSistemaLogado?.id) {
    return { id: usuarioSistemaLogado.id, nome: usuarioSistemaLogado.nome || 'Funcionário', origem: 'sistema' };
  }

  return null;
}

function abrirModalPin({
  titulo = 'Confirmar ação',
  subtitulo = '',
  nomeFuncionario = '',
  textoAcao = 'Confirmar',
  mensagem = '',
  exibirUsuario = true,
  textoUsuario = '',
  placeholderInput = 'Digite seu PIN',
  tipoMensagem = 'err'
} = {}) {
  const overlay = document.getElementById('pinActionOverlay');
  const title = document.getElementById('pinActionTitle');
  const subtitle = document.getElementById('pinActionSubtitle');
  const userName = document.getElementById('pinActionUserName');
  const input = document.getElementById('pinActionInput');
  const msg = document.getElementById('pinActionMsg');
  const confirmButton = document.getElementById('pinActionConfirmButton');
  if (!overlay || !title || !subtitle || !userName || !input || !msg || !confirmButton) {
    return Promise.resolve(null);
  }

  const modalEl = overlay.querySelector('.modal');

  title.textContent = titulo;
  subtitle.textContent = subtitulo;
  userName.textContent = textoUsuario || (nomeFuncionario ? `Usuário sugerido: ${nomeFuncionario}` : 'Informe o PIN do usuário autorizado.');
  userName.style.display = exibirUsuario ? '' : 'none';
  input.placeholder = placeholderInput;
  input.value = '';
  msg.textContent = mensagem;
  // Tipo da mensagem: 'err' (vermelho) ou 'alerta' (amarelo, destacado dentro da caixa).
  const classeMsg = mensagem ? (tipoMensagem === 'alerta' ? ' alerta' : ' err') : '';
  msg.className = 'msg' + classeMsg;
  // Em modo alerta, a caixa inteira muda de cor (borda/fundo amarelados) para o usuário leigo perceber.
  if (modalEl) {
    modalEl.classList.toggle('pin-modal-alerta', !!mensagem && tipoMensagem === 'alerta');
  }
  confirmButton.textContent = textoAcao;
  overlay.classList.add('show');

  window.setTimeout(() => input.focus(), 0);

  return new Promise(resolve => {
    resolverModalPinPendente = resolve;
  });
}

function fecharModalPin(resultado = null) {
  const overlay = document.getElementById('pinActionOverlay');
  const input = document.getElementById('pinActionInput');
  const msg = document.getElementById('pinActionMsg');
  if (overlay) overlay.classList.remove('show');
  const modalEl = overlay?.querySelector('.modal');
  if (modalEl) modalEl.classList.remove('pin-modal-alerta');
  if (input) input.value = '';
  if (msg) {
    msg.textContent = '';
    msg.className = 'msg';
  }

  const resolver = resolverModalPinPendente;
  resolverModalPinPendente = null;
  if (resolver) resolver(resultado);
}

function confirmarModalPin() {
  const input = document.getElementById('pinActionInput');
  fecharModalPin({ pin: (input?.value || '').trim() });
}

function abrirInfoRegraChecklist(tipo = 'lancados') {
  const overlay = document.getElementById('modalInfoRegraChecklist');
  const titulo = document.getElementById('infoRegraChecklistTitulo');
  const subtitulo = document.getElementById('infoRegraChecklistSubtitulo');
  const body = document.getElementById('infoRegraChecklistBody');
  if (!overlay || !titulo || !subtitulo || !body) return;

  if (tipo === 'alertas_rapidos') {
    titulo.textContent = 'Regra dos alertas rápidos';
    subtitulo.textContent = 'Avisos emergenciais que não viram tarefa de checklist.';
    body.innerHTML = `
      <ul style="margin:0;padding-left:18px;line-height:1.55;color:var(--text-muted);font-size:13px">
        <li><strong style="color:var(--text)">Uso:</strong> serve para avisos pontuais e urgentes, como porta da geladeira aberta, falta de energia ou risco imediato.</li>
        <li><strong style="color:var(--text)">Notificação:</strong> aparece com som e voz para usuários com permissão de receber alertas rápidos na loja, sem entrar na lista de tarefas/checklists.</li>
        <li><strong style="color:var(--text)">Repetição:</strong> não usa a repetição automática das tarefas; depois que o aviso é aceito, ele finaliza.</li>
        <li><strong style="color:var(--text)">Aceite:</strong> qualquer funcionário ativo pode finalizar o aviso informando o próprio PIN/senha.</li>
      </ul>
    `;
  } else if (tipo === 'execucoes') {
    titulo.textContent = 'Regra das execuções';
    subtitulo.textContent = 'Acompanhamento de tarefas iniciadas, pausadas e finalizadas.';
    body.innerHTML = `
      <ul style="margin:0;padding-left:18px;line-height:1.55;color:var(--text-muted);font-size:13px">
        <li><strong style="color:var(--text)">Em andamento:</strong> aparece quando uma tarefa lançada foi iniciada por um funcionário.</li>
        <li><strong style="color:var(--text)">Pausar:</strong> muda a execução para pausada, mantendo histórico de início e responsável.</li>
        <li><strong style="color:var(--text)">Finalizar:</strong> registra quem finalizou, data/hora de fim e muda o status para finalizado.</li>
        <li><strong style="color:var(--text)">Filtro de data:</strong> considera data da execução, início e finalização para manter finalizados visíveis.</li>
        <li><strong style="color:var(--text)">Relançamento:</strong> ao finalizar, o sistema cria a mesma tarefa para a próxima semana, com o mesmo funcionário e horário, sem duplicar se já existir.</li>
      </ul>
    `;
  } else {
    titulo.textContent = 'Regra dos checklists lançados';
    subtitulo.textContent = 'Fila de tarefas disponíveis para início.';
    body.innerHTML = `
      <ul style="margin:0;padding-left:18px;line-height:1.55;color:var(--text-muted);font-size:13px">
        <li><strong style="color:var(--text)">Lançado:</strong> a tarefa só aparece aqui depois de ser lançada para uma data, funcionário e horário.</li>
        <li><strong style="color:var(--text)">Iniciar:</strong> qualquer funcionário autorizado confirma o PIN e assume o início da execução.</li>
        <li><strong style="color:var(--text)">Responsável:</strong> vem do lançamento feito no cadastro da tarefa.</li>
        <li><strong style="color:var(--text)">Próxima tarefa:</strong> tarefas futuras ficam separadas da lista de hoje.</li>
        <li><strong style="color:var(--text)">Repetição semanal:</strong> quando uma execução é finalizada, o sistema relança automaticamente para +7 dias com o mesmo funcionário e horário.</li>
      </ul>
    `;
  }

  overlay.classList.add('show');
}

function fecharInfoRegraChecklist() {
  document.getElementById('modalInfoRegraChecklist')?.classList.remove('show');
}

function abrirModalConfirmacaoFinanceira({
  titulo = 'Confirmar alteração',
  subtitulo = '',
  fornecedor = '',
  lancamento = '',
  detalhes = [],
  textoSim = 'Sim, alterar todos',
  textoNao = 'Não, alterar só este',
  textoAjuda = '',
} = {}) {
  const overlay = document.getElementById('confirmacaoFinanceiraOverlay');
  const title = document.getElementById('confirmacaoFinanceiraTitle');
  const subtitle = document.getElementById('confirmacaoFinanceiraSubtitle');
  const body = document.getElementById('confirmacaoFinanceiraBody');
  const btnSim = document.getElementById('confirmacaoFinanceiraSim');
  const btnNao = document.getElementById('confirmacaoFinanceiraNao');
  if (!overlay || !title || !subtitle || !body || !btnSim || !btnNao) return Promise.resolve('cancelar');

  title.textContent = titulo;
  subtitle.textContent = subtitulo;
  btnSim.textContent = textoSim;
  btnNao.textContent = textoNao;
  body.innerHTML = `
    <div class="confirmacao-destaque-box">
      <strong>${escaparHtmlBasico(fornecedor || 'Fornecedor')}</strong>
      <span>${escaparHtmlBasico(lancamento || 'Lançamento')}</span>
      ${(detalhes || []).map(item => `<span>${escaparHtmlBasico(item)}</span>`).join('')}
    </div>
    <div style="font-size:13px;color:var(--text-muted);line-height:1.5">
      ${textoAjuda
        ? escaparHtmlBasico(textoAjuda)
        : 'Escolha <strong style="color:var(--text)">Sim</strong> para aplicar a alteração em todos os lançamentos relacionados, ou <strong style="color:var(--text)">Não</strong> para alterar somente este título.'}
    </div>
  `;
  overlay.classList.add('show');

  return new Promise(resolve => {
    resolverModalConfirmacaoFinanceiraPendente = resolve;
  });
}

function fecharModalConfirmacaoFinanceira(resultado = 'cancelar') {
  const overlay = document.getElementById('confirmacaoFinanceiraOverlay');
  if (overlay) overlay.classList.remove('show');
  const resolver = resolverModalConfirmacaoFinanceiraPendente;
  resolverModalConfirmacaoFinanceiraPendente = null;
  if (resolver) resolver(resultado);
}

function abrirModalFormaPagamentoFinanceiro({ formas = [], formaAtual = '' } = {}) {
  const overlay = document.getElementById('formaPagamentoOverlay');
  const opcoesEl = document.getElementById('formaPagamentoModalOpcoes');
  const msg = document.getElementById('formaPagamentoModalMsg');
  if (!overlay || !opcoesEl || !msg) return Promise.resolve(null);

  const opcoes = (formas || []).filter(item => item && item.ativo !== false);
  if (!opcoes.length) return Promise.resolve(null);
  formasModalPagamentoFinanceiro = opcoes;

  const atualNormalizado = normalizarChaveFormaPagamentoFinanceiro(formaAtual);
  const atualPorNome = opcoes.find(item => normalizarChaveFormaPagamentoFinanceiro(item.nome) === atualNormalizado) || null;

  opcoesEl.innerHTML = opcoes.map((item, idx) => {
    const selecionada = atualPorNome && String(atualPorNome.id) === String(item.id);
    return `
      <button class="forma-pagamento-opcao forma-pagamento-cor-${idx % 6}" type="button" onclick="selecionarFormaPagamentoFinanceiro('${item.id}')">
        <span class="nome">${escaparHtmlBasico(item.nome || '-')}</span>
        <span class="hint">${selecionada ? 'Forma vinculada atualmente' : 'Clique para confirmar esta forma'}</span>
      </button>
    `;
  }).join('');

  msg.textContent = '';
  msg.className = 'msg';
  overlay.classList.add('show');

  return new Promise(resolve => {
    resolverModalFormaPagamentoPendente = resolve;
  });
}

function fecharModalFormaPagamentoFinanceiro(resultado = null) {
  const overlay = document.getElementById('formaPagamentoOverlay');
  const opcoesEl = document.getElementById('formaPagamentoModalOpcoes');
  const msg = document.getElementById('formaPagamentoModalMsg');

  if (overlay) overlay.classList.remove('show');
  if (opcoesEl) opcoesEl.innerHTML = '';
  if (msg) {
    msg.textContent = '';
    msg.className = 'msg';
  }

  formasModalPagamentoFinanceiro = [];
  const resolver = resolverModalFormaPagamentoPendente;
  resolverModalFormaPagamentoPendente = null;
  if (resolver) resolver(resultado);
}

function selecionarFormaPagamentoFinanceiro(formaId) {
  const msg = document.getElementById('formaPagamentoModalMsg');
  const id = String(formaId || '').trim();

  const forma = formasModalPagamentoFinanceiro.find(item => String(item.id) === id) || null;
  if (!forma) {
    if (msg) {
      msg.textContent = 'Forma selecionada inválida. Tente novamente.';
      msg.className = 'msg err';
    }
    return;
  }

  fecharModalFormaPagamentoFinanceiro(forma);
}

function atualizarEstadoMovimentacaoSaldoContaFinanceiraBaixa() {
  const btnSim = document.getElementById('btnContaFinanceiraMovimentarSim');
  const btnNao = document.getElementById('btnContaFinanceiraMovimentarNao');
  if (btnSim) btnSim.classList.toggle('ativo', modalContaFinanceiraMovimentarSaldo === true);
  if (btnNao) btnNao.classList.toggle('ativo', modalContaFinanceiraMovimentarSaldo === false);
}

function definirMovimentacaoSaldoContaFinanceiraBaixa(movimentar = true) {
  modalContaFinanceiraMovimentarSaldo = movimentar === true;
  atualizarEstadoMovimentacaoSaldoContaFinanceiraBaixa();
}

function abrirModalContaFinanceiraBaixaFinanceiro({ contas = [], contaAtualId = '', valor = 0, titulo = '', movimentarSaldo = true, modo = 'baixa' } = {}) {
  const overlay = document.getElementById('contaFinanceiraBaixaOverlay');
  const opcoesEl = document.getElementById('contaFinanceiraBaixaOpcoes');
  const msg = document.getElementById('contaFinanceiraBaixaMsg');
  const subtitle = document.getElementById('contaFinanceiraBaixaSubtitle');
  const tituloEl = document.getElementById('contaFinanceiraBaixaTitle');
  const introEl = document.getElementById('contaFinanceiraBaixaIntro');
  const valorWrap = document.getElementById('contaFinanceiraValorPagoWrap');
  const valorInput = document.getElementById('contaFinanceiraValorPago');
  if (!overlay || !opcoesEl || !msg) return Promise.resolve(null);

  const opcoes = (contas || []).filter(item => item && item.ativo !== false);
  if (modo === 'estorno' && contaAtualId) {
    opcoes.sort((a, b) => Number(String(b.id) === String(contaAtualId)) - Number(String(a.id) === String(contaAtualId)));
  }
  if (!opcoes.length) return Promise.resolve(null);
  contasModalContaFinanceiraBaixa = opcoes;
  modalContaFinanceiraMovimentarSaldo = movimentarSaldo !== false;
  atualizarEstadoMovimentacaoSaldoContaFinanceiraBaixa();
  overlay.dataset.modo = modo;
  if (valorWrap) valorWrap.style.display = modo === 'baixa' ? 'grid' : 'none';
  if (valorInput) {
    valorInput.value = Number(valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  if (subtitle) {
    subtitle.textContent = `${modo === 'estorno' ? 'Valor a devolver' : 'Valor da baixa'}: ${formatarMoedaBRFinanceiro(valor || 0)}${titulo ? ` · ${titulo}` : ''}`;
  }
  if (tituloEl) tituloEl.textContent = modo === 'estorno' ? 'Devolver saldo ao cofre' : 'Selecionar conta financeira';
  if (introEl) introEl.textContent = modo === 'estorno'
    ? 'A conta usada no pagamento está sugerida. Escolha onde o valor será devolvido ou marque “Não” para somente reabrir o título.'
    : 'Clique na conta financeira que será usada para pagar este título.';

  opcoesEl.innerHTML = opcoes.map((item, idx) => {
    const selecionada = String(item.id) === String(contaAtualId || '');
    return `
      <button class="conta-financeira-opcao conta-financeira-cor-${idx % 6}" type="button" onclick="selecionarContaFinanceiraBaixa('${item.id}')">
        <span class="nome">${escaparHtmlBasico(item.nome || '-')}</span>
        <span class="saldo">${escaparHtmlBasico(formatarMoedaBRFinanceiro(item.saldo_atual || 0))}</span>
        <span class="hint">${selecionada ? (modo === 'estorno' ? 'Conta de onde saiu o pagamento' : 'Conta vinculada atualmente') : (modo === 'estorno' ? 'Devolver nesta conta' : 'Clique para usar esta conta')}</span>
      </button>
    `;
  }).join('');

  msg.textContent = '';
  msg.className = 'msg';
  overlay.classList.add('show');

  return new Promise(resolve => {
    resolverModalContaFinanceiraBaixaPendente = resolve;
  });
}

function selecionarContaFinanceiraBaixa(id) {
  const conta = contasModalContaFinanceiraBaixa.find(item => String(item.id) === String(id)) || null;
  if (!conta) {
    const msg = document.getElementById('contaFinanceiraBaixaMsg');
    if (msg) {
      msg.textContent = 'Conta selecionada inválida. Tente novamente.';
      msg.className = 'msg err';
    }
    return;
  }
  const overlay = document.getElementById('contaFinanceiraBaixaOverlay');
  const modo = String(overlay?.dataset?.modo || 'baixa');
  const valorInput = document.getElementById('contaFinanceiraValorPago');
  const valorPago = modo === 'baixa' ? lerValorMonetarioFinanceiro(valorInput?.value || '') : null;
  if (modo === 'baixa' && (!Number.isFinite(valorPago) || valorPago <= 0)) {
    const msg = document.getElementById('contaFinanceiraBaixaMsg');
    if (msg) {
      msg.textContent = 'Informe um valor efetivamente pago maior que zero.';
      msg.className = 'msg err';
    }
    valorInput?.focus();
    return;
  }
  fecharModalContaFinanceiraBaixa({
    ...conta,
    movimentarSaldo: modalContaFinanceiraMovimentarSaldo === true,
    valorPago: modo === 'baixa' ? Number(valorPago.toFixed(2)) : null,
  });
}

function fecharModalContaFinanceiraBaixa(resultado = null) {
  const overlay = document.getElementById('contaFinanceiraBaixaOverlay');
  const opcoesEl = document.getElementById('contaFinanceiraBaixaOpcoes');
  const msg = document.getElementById('contaFinanceiraBaixaMsg');
  if (overlay) overlay.classList.remove('show');
  if (opcoesEl) opcoesEl.innerHTML = '';
  if (msg) {
    msg.textContent = '';
    msg.className = 'msg';
  }

  contasModalContaFinanceiraBaixa = [];
  modalContaFinanceiraMovimentarSaldo = true;
  const resolver = resolverModalContaFinanceiraBaixaPendente;
  resolverModalContaFinanceiraBaixaPendente = null;
  if (resolver) resolver(resultado);
}

async function executarValidacaoCredencialComRetry(nomeRpc, parametros, respostaValida) {
  // RPCs de credencial já resolvem o escopo no banco. Alterar filtros globais
  // aqui criava uma disputa com carregamentos paralelos, principalmente no
  // celular, fazendo o mesmo PIN falhar nas primeiras tentativas.
  const executar = () => sb.rpc(nomeRpc, parametros);
  const esperas = [0, 220, 550];
  let resposta = null;
  for (const espera of esperas) {
    if (espera) await new Promise(resolve => window.setTimeout(resolve, espera));
    resposta = await executar();
    if (!resposta?.error && respostaValida(resposta?.data)) return resposta;
  }
  return resposta;
}

async function validarPinFuncionario(funcionarioId, pin) {
  if (!funcionarioId || !pin) return false;
  const { data, error } = await executarValidacaoCredencialComRetry('verificar_credencial_funcionario', {
    p_funcionario_id: funcionarioId,
    p_senha: String(pin),
  }, data => data === true);
  return !error && data === true;
}

async function obterFuncionarioAtivoPorId(funcionarioId) {
  const id = String(funcionarioId || '').trim();
  if (!id) return null;

  const { data: funcionario, error } = await executarSemFiltroLojaTemporario(() => sb
    .from('funcionarios')
    .select('id, nome, ativo, loja_id, empresa_id')
    .eq('id', id)
    .eq('ativo', true)
    .maybeSingle());

  if (error || !funcionario) return null;
  if (typeof funcionarioPertenceLojaAtualPonto === 'function' && !funcionarioPertenceLojaAtualPonto(funcionario)) return null;
  return funcionario;
}

async function obterFuncionarioLogadoConfirmadoPorPin(pin) {
  const funcionarioId = String(usuarioSistemaLogado?.tipo === 'funcionario' ? usuarioSistemaLogado?.id || '' : '').trim();
  if (!funcionarioId || !pin) return null;
  const ok = await validarPinFuncionario(funcionarioId, pin);
  if (!ok) return null;
  return {
    id: funcionarioId,
    nome: usuarioSistemaLogado?.nome || 'Funcionário',
  };
}

async function obterFuncionarioAtivoPorPin(pin) {
  if (!pin) return null;

  const pinNormalizado = String(pin).trim();

  const { data, error } = await executarValidacaoCredencialComRetry('buscar_funcionarios_por_credencial', {
    p_senha: pinNormalizado,
  }, data => Array.isArray(data) && data.length > 0);
  if (error) return null;
  const funcionario = (Array.isArray(data) ? data : [])
    .filter(funcionarioPertenceLojaAtualPonto)[0] || null;
  return funcionario;
}

function perfilPermiteExcluirAgenda(perfil) {
  if (!perfil) return false;
  const perfilNormalizado = normalizarPerfilUsuario(perfil);
  const codigo = normalizarCodigoPerfil(perfilNormalizado?.codigo || perfil?.codigo || '');
  if (codigo === 'MASTER' || codigo === 'ADM') return true;
  const permissoes = { ...obterPermissoesBase(codigo), ...(perfilNormalizado?.permissoes || {}) };
  return permissoes.excluir_agenda_cadastrada === true;
}

async function validarPinExclusaoAgenda(pin, lojaId) {
  const pinNormalizado = String(pin || '').trim();
  const loja = String(lojaId || obterLojaIdSessao?.() || usuarioSistemaLogado?.loja_id || '').trim();
  if (!pinNormalizado || !loja) return { funcionario: null, motivo: 'pin_invalido' };

  const candidatosRes = await executarValidacaoCredencialComRetry('buscar_funcionarios_por_credencial', {
    p_senha: pinNormalizado,
  }, data => Array.isArray(data) && data.length > 0);
  if (candidatosRes.error || !(candidatosRes.data || []).length) {
    return { funcionario: null, motivo: 'pin_invalido' };
  }

  let encontrouNaLoja = false;
  for (const funcionario of candidatosRes.data || []) {
    if (funcionario.é_administrador === true) return { funcionario, motivo: '' };

    const vinculoRes = await executarSemFiltrosTenantTemporario(() => sb
      .from('funcionario_lojas')
      .select('perfil_id, ativo')
      .eq('funcionario_id', funcionario.id)
      .eq('loja_id', loja)
      .eq('ativo', true)
      .maybeSingle());
    const pertenceDireto = String(funcionario.loja_id || '') === loja;
    const pertencePorVinculo = !!vinculoRes.data;
    if (!pertenceDireto && !pertencePorVinculo) continue;
    encontrouNaLoja = true;

    const perfilId = vinculoRes.data?.perfil_id || funcionario.perfil_id || null;
    if (!perfilId) continue;
    const perfilRes = await executarSemFiltrosTenantTemporario(() => sb
      .from('perfis')
      .select('id, nome, codigo, permissoes')
      .eq('id', perfilId)
      .maybeSingle());
    if (!perfilRes.error && perfilPermiteExcluirAgenda(perfilRes.data)) {
      return { funcionario, perfil: perfilRes.data, motivo: '' };
    }
  }

  return { funcionario: null, motivo: encontrouNaLoja ? 'sem_permissao' : 'fora_da_loja' };
}

// Busca o funcionário pelo PIN dentro da EMPRESA, sem prender ao filtro de
// "loja atual do ponto". Usado em ações financeiras (baixa, ajustes), onde
// qualquer funcionário da empresa pode confirmar com o próprio PIN.
async function obterFuncionarioAtivoPorPinEmpresa(pin) {
  if (!pin) return null;
  const pinNormalizado = String(pin).trim();

  // REGRA 1 — Administrador (global ou admin de loja / Painel ADM):
  // como administra todas as lojas, seu PIN vale em qualquer loja. Confere
  // direto pelo cadastro do próprio usuário logado, sem filtro de empresa/loja.
  const ehAdmin = (typeof usuarioEhAdministrador === 'function' && usuarioEhAdministrador())
    || (typeof usuarioEhAdminDeLoja === 'function' && usuarioEhAdminDeLoja());
  if (ehAdmin) {
    const idLogado = String(usuarioSistemaLogado?.id || '').trim();
    if (idLogado) {
      const { data: euAdmin } = await executarSemFiltrosTenantTemporario(() => sb
        .from('funcionarios')
        .select('id, nome, ativo, loja_id, empresa_id')
        .eq('id', idLogado)
        .maybeSingle());
      if (euAdmin && euAdmin.ativo !== false && await validarPinFuncionario(euAdmin.id, pinNormalizado)) {
        return euAdmin;
      }
    }
    if (usuarioSistemaLogado?.tipo === 'admin_loja' && idLogado) {
      const { data: adminValido } = await executarValidacaoCredencialComRetry('verificar_pin_usuario_admin', {
        p_usuario_id: idLogado,
        p_pin: pinNormalizado,
      }, data => data === true);
      if (adminValido === true) {
      return {
        id: idLogado || usuarioSistemaLogado?.id || 'admin',
        nome: usuarioSistemaLogado?.nome || 'Administrador',
        ativo: true,
      };
      }
    }
  }

  // REGRA 2 — Demais funcionários: procura o PIN entre TODAS as lojas às quais
  // o usuário logado tem vínculo, de TODAS as empresas (não só a empresa ativa).
  // Resolve o caso de funcionário cadastrado em outra empresa do mesmo grupo.
  const lojasVinculadas = (typeof obterLojasPermitidasSessao === 'function'
    ? obterLojasPermitidasSessao()
    : []).map(l => String(l?.id || l?.loja_id || '').trim()).filter(Boolean);

  const { data, error } = await executarValidacaoCredencialComRetry('buscar_funcionarios_por_credencial', {
    p_senha: pinNormalizado,
  }, data => Array.isArray(data) && data.length > 0);

  if (error) { console.warn('Falha ao buscar funcionário por PIN:', error); return null; }
  return (Array.isArray(data) ? data : []).find(f => f.ativo !== false && (!lojasVinculadas.length || lojasVinculadas.includes(String(f.loja_id || '')))) || null;
}

function resumoNomesPendencias(pendencias = [], limite = 3) {
  const nomes = (pendencias || []).map(item => item.nome || 'Tarefa').filter(Boolean);
  if (!nomes.length) return '';
  const lista = nomes.slice(0, limite).join(', ');
  if (nomes.length <= limite) return lista;
  return `${lista} e mais ${nomes.length - limite}`;
}

async function obterPendenciasChecklistDoFuncionario(funcionarioId) {
  if (!funcionarioId) return { pendentesInicio: [], pendentesFinalizacao: [] };

  const hojeLocal = dataLocalISO();
  const consultarLancamentosPendentes = async (comCreatedAt = true) => {
    const campos = comCreatedAt
      ? 'id, nome, status, lancado_em, created_at, data_programada'
      : 'id, nome, status, lancado_em, data_programada';
    return sb
      .from('checklist_lancamentos')
      .select(campos)
      .eq('funcionario_id', funcionarioId)
      .eq('status', 'pendente')
      .order('lancado_em', { ascending: false })
      .limit(30);
  };

  let lancamentosRes = await consultarLancamentosPendentes(true);
  if (lancamentosRes.error && (
    String(lancamentosRes.error.message || '').toLowerCase().includes('created_at')
    || String(lancamentosRes.error.message || '').toLowerCase().includes('data_programada')
  )) {
    lancamentosRes = await consultarLancamentosPendentes(false);
  }

  const execucoesRes = await sb
    .from('checklist_execucoes')
    .select('id, status, data_execucao, tarefas(nome), checklists(nome)')
    .eq('funcionario_id', funcionarioId)
    .in('status', ['aberto', 'pausado'])
    .order('iniciado_em', { ascending: false })
    .limit(30);

  if (lancamentosRes.error && !isMissingLancamentosTableError(lancamentosRes.error)) throw lancamentosRes.error;
  if (execucoesRes.error && !isMissingTableError(execucoesRes.error)) throw execucoesRes.error;

  const pendentesInicio = (lancamentosRes.data || []).filter(item => lancamentoProgramadoHoje(item));
  const pendentesFinalizacao = (execucoesRes.data || [])
    .filter(item => item.data_execucao === hojeLocal)
    .map(item => ({
      id: item.id,
      nome: item.tarefas?.nome || item.checklists?.nome || 'Checklist em andamento',
      status: item.status,
    }));

  return { pendentesInicio, pendentesFinalizacao };
}

async function validarPendenciasAntesFecharPonto({ funcionario, proximaAcao }) {
  if (!funcionario?.id) return true;
  if (proximaAcao !== 'Saída') return true;

  const contextoTurno = obterContextoPrazo(funcionario.horario_trabalho_fim, 15);
  if (!contextoTurno.ativo) return true;
  let pendentesInicio = [];
  let pendentesFinalizacao = [];
  try {
    const pendencias = await obterPendenciasChecklistDoFuncionario(funcionario.id);
    pendentesInicio = pendencias.pendentesInicio || [];
    pendentesFinalizacao = pendencias.pendentesFinalizacao || [];
  } catch (error) {
    console.warn('Não foi possível validar pendências de checklist no ponto:', error);
    return true;
  }
  if (!pendentesInicio.length && !pendentesFinalizacao.length) return true;

  const partes = [];
  if (pendentesInicio.length) {
    partes.push(`${pendentesInicio.length} checklist(s) sem iniciar (${resumoNomesPendencias(pendentesInicio)})`);
  }
  if (pendentesFinalizacao.length) {
    partes.push(`${pendentesFinalizacao.length} checklist(s) em andamento/pausado (${resumoNomesPendencias(pendentesFinalizacao)})`);
  }

  const mensagem = [
    `Funcionário: ${funcionario.nome || 'Funcionário'}`,
    `Pendências encontradas:`,
    `- ${partes.join('\n- ')}`,
  ].join('\n');

  const acao = await abrirModalPendenciaPonto({
    nomeFuncionario: funcionario.nome || 'Funcionário',
    textoPendencias: mensagem,
    quantidadePendentesInicio: pendentesInicio.length,
    quantidadePendentesFinalizacao: pendentesFinalizacao.length,
  });

  if (acao === 'ver_tarefas') {
    const botao = document.querySelector('.nav-btn[data-page="execucoes"]');
    abrirPagina('execucoes', botao);
    setMsg('msgPonto', 'Batida cancelada. Confira as tarefas em andamento.', 'err');
    return false;
  }

  if (acao === 'ver_checklists') {
    const botao = document.querySelector('.nav-btn[data-page="checklists"]');
    abrirPagina('checklists', botao);
    setMsg('msgPonto', 'Batida cancelada. Confira os checklists pendentes.', 'err');
    return false;
  }

  if (acao !== 'confirmar') {
    setMsg('msgPonto', 'Batida cancelada. Resolva os checklists pendentes antes de finalizar o turno.', 'err');
    return false;
  }

  setMsg('msgPonto', 'Atenção: ponto confirmado com pendências de checklist.', 'ok');
  return true;
}

function mensagemErroSupabase(error, fallback = 'Erro inesperado.') {
  if (!error) return fallback;
  return [error.message, error.details, error.hint, error.code].filter(Boolean).join(' - ') || fallback;
}

async function confirmarAcaoComPin({ funcionario, titulo, subtitulo, textoAcao, exigirFuncionarioInformado = false, escopo = 'ponto', validarFuncionarioConfirmado = null }) {
  let mensagemErro = '';
  let tipoMensagem = 'err';
  while (true) {
    const resposta = await abrirModalPin({
      titulo,
      subtitulo,
      nomeFuncionario: funcionario?.nome || '',
      textoAcao,
      mensagem: mensagemErro,
      tipoMensagem,
    });

    if (!resposta) return null;
    if (!resposta.pin) {
      mensagemErro = 'Digite o PIN para continuar.';
      tipoMensagem = 'err';
      continue;
    }

    let funcionarioConfirmado = null;
    if (exigirFuncionarioInformado && funcionario?.id) {
      const ok = await validarPinFuncionario(funcionario.id, resposta.pin);
      funcionarioConfirmado = ok ? {
        id: funcionario.id,
        nome: funcionario.nome || 'Funcionário',
      } : null;
    } else if (escopo === 'empresa') {
      // Ações financeiras: qualquer funcionário ativo da empresa pode confirmar.
      funcionarioConfirmado = await obterFuncionarioAtivoPorPinEmpresa(resposta.pin);
    } else {
      funcionarioConfirmado = funcionario?.id && String(funcionario.id) === String(usuarioSistemaLogado?.id || '')
        ? await obterFuncionarioLogadoConfirmadoPorPin(resposta.pin)
        : await obterFuncionarioAtivoPorPin(resposta.pin);
    }
    if (funcionarioConfirmado?.id) {
      // Validação extra (ex.: conferência — quem iniciou não pode finalizar).
      // Se retornar uma string, mantém o modal aberto e mostra o aviso DENTRO da caixa.
      if (typeof validarFuncionarioConfirmado === 'function') {
        const erroValidacao = await validarFuncionarioConfirmado(funcionarioConfirmado);
        if (erroValidacao) {
          mensagemErro = String(erroValidacao);
          tipoMensagem = 'alerta';
          continue;
        }
      }
      return {
        funcionarioId: funcionarioConfirmado.id,
        nomeFuncionario: funcionarioConfirmado.nome || 'Funcionário',
        confirmadoEm: new Date().toISOString(),
      };
    }

    mensagemErro = exigirFuncionarioInformado
      ? `Senha inválida para ${funcionario?.nome || 'o funcionário responsável'}.`
      : 'PIN inválido. Tente novamente.';
    tipoMensagem = 'err';
  }
}

function isMissingExecutionUsersTableError(error) {
  return error?.code === 'PGRST205' || (error?.message && error.message.includes('missing relation "public.checklist_execucao_usuarios"'));
}

function isMissingExecutionRegistrySchemaError(error) {
  const mensagem = String(error?.message || '');
  return mensagem.includes('usuario_inicio_id')
    || mensagem.includes('usuario_fim_id')
    || mensagem.includes('inicio_confirmado_em')
    || mensagem.includes('finalizacao_confirmada_em')
    || mensagem.includes('lancamento_id')
    || mensagem.includes('checklist_execucao_usuarios');
}

async function registrarMovimentacaoExecucao({ execucaoId, tipoAcao, funcionarioId, funcionarioResponsavelId = null, tarefaId = null, checklistId = null, registradoEm = null }) {
  const { error } = await sb.from('checklist_execucao_usuarios').insert([{
    execucao_id: execucaoId,
    tipo_acao: tipoAcao,
    funcionario_id: funcionarioId,
    funcionario_responsavel_id: funcionarioResponsavelId,
    tarefa_id: tarefaId,
    checklist_id: checklistId,
    registrado_em: registradoEm || new Date().toISOString(),
  }]);

  if (error && !isMissingExecutionUsersTableError(error)) {
    throw error;
  }
}

function horaJaPassou(horario) {
  if (!horario) return false;
  return agoraHoraMinuto() >= horario.slice(0, 5);
}

function horarioParaMinutos(horario) {
  const valor = String(horario || '').slice(0, 5);
  if (!/^\d{2}:\d{2}$/.test(valor)) return null;
  const [horas, minutos] = valor.split(':').map(Number);
  if (Number.isNaN(horas) || Number.isNaN(minutos)) return null;
  return (horas * 60) + minutos;
}

function obterContextoPrazo(horario, antecedenciaMinutos = 60) {
  const limiteMinutos = horarioParaMinutos(horario);
  if (limiteMinutos === null) {
    return { ativo: false, vencido: false };
  }

  const agoraMinutos = horarioParaMinutos(agoraHoraMinuto());
  if (agoraMinutos === null) {
    return { ativo: false, vencido: false };
  }
  return {
    ativo: agoraMinutos >= Math.max(0, limiteMinutos - antecedenciaMinutos),
    vencido: agoraMinutos >= limiteMinutos,
  };
}

function horaCurta(horario) {
  return (horario || '').slice(0, 5);
}

function diaSemanaTokenDaData(dataRef) {
  const data = dataRef instanceof Date ? dataRef : new Date(dataRef);
  if (!(data instanceof Date) || Number.isNaN(data.getTime())) return null;
  const dias = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
  return dias[data.getDay()] || null;
}

function diasSemanaParaConjunto(diasSemana) {
  const valor = String(diasSemana || 'todos').trim().toLowerCase();
  if (!valor || valor === 'todos') {
    return new Set(['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab']);
  }
  return new Set(
    valor
      .split(',')
      .map(item => item.trim().toLowerCase())
      .filter(item => ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'].includes(item))
  );
}

function combinarDataHorarioEmIso(dataRef, horario) {
  const hora = horaCurta(horario);
  const data = dataRef instanceof Date ? new Date(dataRef.getTime()) : new Date(dataRef);
  if (!(data instanceof Date) || Number.isNaN(data.getTime())) return new Date().toISOString();
  if (!hora || !/^\d{2}:\d{2}$/.test(hora)) {
    data.setHours(12, 0, 0, 0);
    return data.toISOString();
  }
  const [h, m] = hora.split(':').map(Number);
  data.setHours(h, m, 0, 0);
  return data.toISOString();
}

function adicionarDiasDataISO(dataISO = '', dias = 0) {
  const base = String(dataISO || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(base)) return '';
  const data = new Date(`${base}T00:00:00`);
  if (Number.isNaN(data.getTime())) return '';
  data.setDate(data.getDate() + Number(dias || 0));
  return dataLocalISO(data);
}

function horarioJaPassouHoje(horario) {
  const limite = horarioParaMinutos(horaCurta(horario));
  const agora = horarioParaMinutos(agoraHoraMinuto());
  if (limite === null || agora === null) return false;
  // "Após o horário" = estritamente maior; no minuto exato ainda pode lançar.
  return agora > limite;
}

function agoraHoraMinutoUTC() {
  const agora = new Date();
  const horas = String(agora.getUTCHours()).padStart(2, '0');
  const minutos = String(agora.getUTCMinutes()).padStart(2, '0');
  return `${horas}:${minutos}`;
}

function agoraHoraMinutoOperacional() {
  // Os turnos cadastrados na aba Funcionários são horários locais da loja.
  // Por isso a validação de turno deve usar a mesma base local da regra do checklist.
  return agoraHoraMinuto();
}

function funcionarioPossuiTurnoPreenchido(funcionario = {}) {
  const inicio = horarioParaMinutos(horaCurta(funcionario?.horario_trabalho_inicio || ''));
  const fim = horarioParaMinutos(horaCurta(funcionario?.horario_trabalho_fim || ''));
  return inicio !== null && fim !== null;
}

function funcionarioDentroDoTurnoOperacional(funcionario = {}) {
  if (!funcionarioPossuiTurnoPreenchido(funcionario)) return true;

  const inicio = horarioParaMinutos(horaCurta(funcionario.horario_trabalho_inicio || ''));
  const fim = horarioParaMinutos(horaCurta(funcionario.horario_trabalho_fim || ''));
  const agora = horarioParaMinutos(agoraHoraMinutoOperacional());
  if (inicio === null || fim === null || agora === null) return true;

  // Turno normal, exemplo 08:00 às 18:00.
  if (inicio <= fim) return agora >= inicio && agora <= fim;

  // Turno virando o dia, exemplo 22:00 às 06:00.
  return agora >= inicio || agora <= fim;
}

function criarChaveAgendaDiaria(tarefaId, funcionarioId, dataRef = dataLocalISO()) {
  return [dataRef || dataLocalISO(), tarefaId || 'sem-tarefa', funcionarioId || 'sem-funcionario'].join('::');
}

function criarChaveAlerta(tipo, referenciaId, dataRef = hoje()) {
  return [tipo, referenciaId || 'geral', dataRef].join('::');
}

async function garantirLancamentosAutomaticosDoDia(configuracaoLoja = null) {
  // [DESATIVADO] Lançamento automático diário das tarefas ativas.
  // Removido a pedido: as tarefas agora só são lançadas quando o usuário clica em "Lançar",
  // definindo a repetição (a cada X dias por Y dias). Mantida como no-op para não quebrar chamadas.
  return;
}

async function garantirLancamentosAutomaticosDoDiaLegado(configuracaoLoja = null) {
  if (!LANCAMENTO_AUTOMATICO_TAREFAS_HABILITADO) return;
  if (lancamentoAutomaticoEmAndamento) return;

  const horarioLancamento = String(configuracaoLoja?.horario_lancamento_checklist || '').trim();
  // Se houver horário configurado, respeita o horário.
  // Se não houver, permite gerar automaticamente ao acessar o sistema no dia.
  if (horarioLancamento && !horaJaPassou(horarioLancamento)) return;

  lancamentoAutomaticoEmAndamento = true;
  try {
    const dataReferencia = dataLocalISO();
    const consultarLancamentosAutomaticos = async (comCreatedAt = true, comStatus = true) => {
      const camposBase = comCreatedAt
        ? ['id', 'tarefa_id', 'funcionario_id', 'lancado_em', 'created_at', 'data_programada']
        : ['id', 'tarefa_id', 'funcionario_id', 'lancado_em', 'data_programada'];
      const campos = [...camposBase, ...(comStatus ? ['status'] : [])].join(', ');
      return sb.from('checklist_lancamentos').select(campos);
    };

    const [tarefasResultado, lancamentosPrimeiraTentativa, execucoesResultado] = await Promise.all([
      sb
        .from('tarefas')
        .select('id, nome, descricao, funcionario_id, checklist_id, horario_limite, dias_semana, loja_id, empresa_id')
        .eq('ativo', true),
      consultarLancamentosAutomaticos(true, true),
      sb
        .from('checklist_execucoes')
        .select('id, tarefa_id, funcionario_id, data_execucao')
        .eq('data_execucao', dataReferencia),
    ]);

    let lancamentosResultado = lancamentosPrimeiraTentativa;
    if (lancamentosResultado.error && (
      String(lancamentosResultado.error.message || '').toLowerCase().includes('created_at')
      || String(lancamentosResultado.error.message || '').toLowerCase().includes('data_programada')
      || String(lancamentosResultado.error.message || '').toLowerCase().includes('status')
    )) {
      const erroTexto = String(lancamentosResultado.error.message || '').toLowerCase();
      lancamentosResultado = await consultarLancamentosAutomaticos(false, !erroTexto.includes('status'));
    }

    if (tarefasResultado.error) {
      if (!isMissingTableError(tarefasResultado.error)) throw tarefasResultado.error;
      return;
    }

    if (lancamentosResultado.error) {
      if (!isMissingLancamentosTableError(lancamentosResultado.error)) throw lancamentosResultado.error;
      return;
    }

    if (execucoesResultado.error) throw execucoesResultado.error;

    const funcionariosIdsTurno = [...new Set((tarefasResultado.data || [])
      .map(item => item.funcionario_id)
      .filter(Boolean)
      .map(id => String(id)))];
    let funcionariosPorIdTurno = new Map();
    if (funcionariosIdsTurno.length) {
      const { data: funcionariosTurno, error: erroFuncionariosTurno } = await sb
        .from('funcionarios')
        .select('id, horario_trabalho_inicio, horario_trabalho_fim')
        .in('id', funcionariosIdsTurno);

      if (erroFuncionariosTurno && !isMissingWorkShiftColumnsError(erroFuncionariosTurno)) {
        throw erroFuncionariosTurno;
      }

      funcionariosPorIdTurno = new Map((funcionariosTurno || []).map(funcionario => [String(funcionario.id), funcionario]));
    }

    const chavesExistentes = new Set();

    (lancamentosResultado.data || []).forEach(item => {
      if (!lancamentoContaComoExistenteParaAgenda(item)) return;
      const dataProgramada = obterDataProgramadaLancamento(item);
      if (!dataProgramada) return;
      chavesExistentes.add(criarChaveAgendaDiaria(item.tarefa_id, item.funcionario_id, dataProgramada));
    });

    (execucoesResultado.data || []).forEach(item => {
      chavesExistentes.add(criarChaveAgendaDiaria(item.tarefa_id, item.funcionario_id, item.data_execucao || dataReferencia));
    });

    const lancamentosParaCriar = (tarefasResultado.data || [])
      .filter(item => item.funcionario_id && tarefaDisponivelHoje(item.dias_semana))
      // Se o funcionário tiver turno preenchido, só lança hoje dentro do turno local cadastrado.
      // Se o turno estiver vazio/incompleto, segue apenas a regra normal do checklist.
      .filter(item => funcionarioDentroDoTurnoOperacional(funcionariosPorIdTurno.get(String(item.funcionario_id)) || null))
      .map(item => ({ item, horarioLimite: horaCurta(item.horario_limite || '') }))
      // Se o horário da tarefa já passou no dia atual, ignora hoje e agenda apenas os próximos dias.
      // Tarefa sem horário não pode ser lançada automaticamente.
      .filter(({ horarioLimite }) => horarioLimite && !horarioJaPassouHoje(horarioLimite))
      .filter(({ item }) => !chavesExistentes.has(criarChaveAgendaDiaria(item.id, item.funcionario_id, dataReferencia)))
      .map(({ item, horarioLimite }) => ({
        tarefa_id: item.id,
        checklist_id: item.checklist_id || null,
        funcionario_id: item.funcionario_id,
        nome: item.nome,
        descricao: item.descricao || null,
        horario_limite: horarioLimite,
        dias_semana: item.dias_semana || 'todos',
        data_programada: dataReferencia,
        lancado_em: new Date().toISOString(),
        criado_por_nome: 'Automático',
        origem_lancamento: 'automatico',
        observacao_lancamento: 'Lançamento automático do dia.',
        empresa_id: item.empresa_id || obterEmpresaIdSessao?.() || usuarioSistemaLogado?.empresa_id || null,
        loja_id: item.loja_id || obterLojaIdSessao?.() || usuarioSistemaLogado?.loja_id || null,
        status: 'pendente',
      }));

    if (!lancamentosParaCriar.length) return;

    const { data: lancamentosCriados, error } = await sb.from('checklist_lancamentos').insert(lancamentosParaCriar).select('id, tarefa_id, checklist_id, funcionario_id, data_programada, horario_limite');
    if (error && !isMissingLancamentosTableError(error)) {
      throw error;
    }

    await Promise.all((lancamentosCriados || []).map(item => registrarEventoLancamento({
      lancamentoId: item.id,
      tarefaId: item.tarefa_id,
      checklistId: item.checklist_id,
      funcionarioResponsavelId: item.funcionario_id,
      funcionarioAtorNome: 'Automático',
      tipoEvento: 'lancado',
      origemEvento: 'automatico',
      dataProgramada: item.data_programada,
      horarioProgramado: item.horario_limite,
      observacao: 'Lançamento automático do dia.',
      meta: { automatico: true },
    }).catch(err => console.warn('Falha ao auditar lançamento automático:', err))));
  } catch (error) {
    console.warn('Não foi possível gerar os lançamentos automáticos do dia:', error);
  } finally {
    lancamentoAutomaticoEmAndamento = false;
  }
}

async function obterDestinatariosEmailAtivos() {
  const { data, error } = await sb
    .from('email_notificacoes')
    .select('id, nome, email')
    .eq('ativo', true)
    .order('nome');

  if (error) {
    if (isMissingEmailNotificationsTableError(error)) {
      return { data: [], missing: true };
    }
    throw error;
  }

  return { data: data || [], missing: false };
}

async function registrarAlertaEmail(alerta, destinatarios) {
  if (!destinatarios?.length) {
    return { inserted: false, skipped: true };
  }

  const payload = {
    chave_unica: alerta.chaveUnica,
    tipo: alerta.tipo,
    assunto: alerta.assunto,
    mensagem: alerta.mensagem,
    destinatarios: destinatarios.map(item => item.email),
    meta: alerta.meta || {},
  };

  const { error } = await sb.from('email_alertas').insert([payload]);

  if (error) {
    if (error.code === '23505') {
      return { inserted: false, duplicated: true };
    }
    if (isMissingEmailAlertsTableError(error)) {
      return { inserted: false, missing: true };
    }
    throw error;
  }

  return { inserted: true };
}

async function processarFilaAlertasEmail() {
  if (envioAlertasEmailEmAndamento) return;

  envioAlertasEmailEmAndamento = true;
  try {
    const { error } = await sb.functions.invoke(EMAIL_FUNCTION_NAME, {
      body: { origem: 'painel-check-diario' },
    });

    if (error) {
      console.warn('Falha ao processar fila de alertas por e-mail:', error);
    }
  } catch (error) {
    console.warn('Nao foi possivel chamar a Edge Function de e-mail:', error);
  } finally {
    envioAlertasEmailEmAndamento = false;
  }
}

async function enviarEmailChecklistFinalizado(execucaoId) {
  if (!execucaoId) return;

  try {
    const cfg = await obterConfiguracoesLoja();
    if (cfg.missing || !cfg.data?.enviar_email_lembrete) return;

    const destinatariosResultado = await obterDestinatariosEmailAtivos();
    if (destinatariosResultado.missing || !destinatariosResultado.data.length) return;

    const { data: execucao, error } = await sb
      .from('checklist_execucoes')
      .select('id, tarefa_id, checklist_id, funcionario_id, usuario_inicio_id, usuario_fim_id, inicio_confirmado_em, finalizado_em, finalizacao_confirmada_em, tarefas(nome, horario_limite), checklists(nome)')
      .eq('id', execucaoId)
      .single();

    if (error || !execucao) {
      throw error || new Error('Execução finalizada não encontrada.');
    }

    const idsUsuarios = [...new Set([
      execucao.funcionario_id,
      execucao.usuario_inicio_id,
      execucao.usuario_fim_id,
    ].filter(Boolean).map(item => String(item)))];

    let mapaUsuarios = {};
    if (idsUsuarios.length) {
      const { data: usuariosData } = await sb
        .from('funcionarios')
        .select('id, nome')
        .in('id', idsUsuarios);
      mapaUsuarios = Object.fromEntries((usuariosData || []).map(item => [String(item.id), item.nome]));
    }

    const nomeResponsavel = mapaUsuarios[String(execucao.funcionario_id || '')] || '';
    const nomeOperadorInicio = mapaUsuarios[String(execucao.usuario_inicio_id || '')] || '';
    const nomeOperadorFim = mapaUsuarios[String(execucao.usuario_fim_id || '')] || '';
    const nomeChecklist = execucao.checklists?.nome || 'Checklist';
    const nomeTarefa = execucao.tarefas?.nome || nomeChecklist;
    const horarioProgramado = horaCurta(execucao.tarefas?.horario_limite) || 'não informado';
    const horarioInicio = execucao.inicio_confirmado_em
      ? new Date(execucao.inicio_confirmado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      : '-';
    const horarioConclusao = (execucao.finalizacao_confirmada_em || execucao.finalizado_em)
      ? new Date(execucao.finalizacao_confirmada_em || execucao.finalizado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      : agoraHoraMinuto();

    const resultado = await registrarAlertaEmail({
      chaveUnica: criarChaveAlerta('checklist_finalizado', execucao.id),
      tipo: 'checklist_finalizado',
      assunto: `CHECK DIARIO: tarefa finalizada - ${nomeTarefa}`,
      mensagem: `${nomeTarefa} (${nomeChecklist}) foi finalizada às ${horarioConclusao}. Responsável: ${nomeResponsavel || '-'}. Iniciado por: ${nomeOperadorInicio || '-'} (${horarioInicio}). Finalizado por: ${nomeOperadorFim || '-'} (${horarioConclusao}). Horário previsto: ${horarioProgramado}.`,
      meta: {
        nome_tarefa: nomeTarefa,
        nome_checklist: nomeChecklist,
        nome_funcionario: nomeResponsavel || null,
        nome_operador_inicio: nomeOperadorInicio || null,
        nome_operador_finalizacao: nomeOperadorFim || null,
        status_alerta: 'finalizado',
        horario_programado: horarioProgramado,
        horario_inicio: horarioInicio,
        horario_conclusao: horarioConclusao,
      },
    }, destinatariosResultado.data);

    if (resultado.inserted) {
      await processarFilaAlertasEmail();
    }
  } catch (error) {
    console.warn('Não foi possível enviar o e-mail de checklist finalizado:', error);
  }
}

async function obterConfiguracoesLoja() {
  const { data, error } = await sb
    .from('configuracoes_loja')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingStoreSettingsTableError(error)) {
      return { data: null, missing: true };
    }
    throw error;
  }

  return { data, missing: false };
}

function formatarDataNotificacaoLancamento(item = {}) {
  const dataRef = obterDataProgramadaLancamento(item);
  if (!dataRef) return 'não informada';
  return formatarDataProgramadaBr(dataRef);
}

function montarResumoDataHoraNotificacao(dataProgramada, horarioProgramado) {
  const dataTexto = dataProgramada || 'não informada';
  const horaTexto = horarioProgramado || 'não informado';
  return `Data: ${dataTexto} · Horário: ${horaTexto}`;
}

function limparNotificacaoUsuario(event, index) {
  if (event?.preventDefault) event.preventDefault();
  if (event?.stopPropagation) event.stopPropagation();
  const item = notificacoesAtuais[index];
  if (!item?.chave) return;

  marcarNotificacoesComoLidas([item.chave]);
  if (usuarioEhMasterNotificacoes() && !tipoNotificacaoCritica(item?.tipo)) {
    dispensarNotificacoesMaster([item.chave]);
  }
  notificacoesAtuais = notificacoesAtuais.filter((_, itemIndex) => itemIndex !== index);
  quantidadeNotificacoesAnterior = notificacoesAtuais.length;
  quantidadeAlertasCriticosAnterior = obterNotificacoesCriticas().length;
  assinaturaAlertasCriticosAnterior = obterNotificacoesCriticas().map(n => n.chave).sort().join('|');
  atualizarBadgeTarefasAtraso(obterQuantidadeAtrasosNotificacao());
  renderizarListaNotificacoes();
  sincronizarAvisoNotificacoes();
}

function notificacaoFoiLimpaPeloUsuario(item) {
  return notificacaoJaFoiLida(item?.chave);
}

function renderizarListaNotificacoes() {
  const count = document.getElementById('notificationCount');
  const list = document.getElementById('notificationList');
  const button = document.querySelector('.notification-btn');
  const btnLimpar = document.getElementById('btnLimparAvisosMaster');
  if (!count || !list) return;

  if (btnLimpar) {
    btnLimpar.style.display = usuarioEhMasterNotificacoes() ? '' : 'none';
  }

  count.textContent = String(notificacoesAtuais.length);
  count.classList.toggle('show', notificacoesAtuais.length > 0);
  if (button) {
    button.classList.toggle('has-alert', notificacoesAtuais.length > 0);
    button.title = notificacoesAtuais.length > 0
      ? `${notificacoesAtuais.length} notificacao(oes) pendente(s)`
      : 'Notificacoes';
  }

  if (!notificacoesAtuais.length) {
    list.innerHTML = '<div class="empty">Nenhuma notificação no momento.</div>';
    return;
  }

  list.innerHTML = '<div class="notification-list">' + notificacoesAtuais.map((n, index) => `
    <div class="notification-item">
      <button class="notification-item-main" type="button" onclick="abrirNotificacao(${index})">
        <strong>${n.titulo}</strong>
        <span>${n.descricao}</span>
      </button>
      <div class="notification-item-actions">
        <button class="btn btn-ghost btn-sm" type="button" onclick="limparNotificacaoUsuario(event, ${index})">Limpar</button>
      </div>
    </div>
  `).join('') + '</div>';

  renderizarAvisoCentralTarefas();
}


function togglePainelNotificacoes(force = null) {
  const panel = document.getElementById('notificationPanel');
  if (!panel) return;
  const abrindo = typeof force === 'boolean' ? force : !painelNotificacoesAberto;
  painelNotificacoesAberto = typeof force === 'boolean' ? force : !painelNotificacoesAberto;
  panel.classList.toggle('show', painelNotificacoesAberto);
  if (abrindo && notificacoesAtuais.length) {
    renderizarListaNotificacoes();
  }
}


function obterCaminhosAudioNotificacao() {
  const origem = window.location.origin;
  const hrefAtual = window.location.href;
  const caminhos = [
    new URL('./media/alborghetti-presta-atencao.mp3', hrefAtual).toString(),
    new URL('media/alborghetti-presta-atencao.mp3', hrefAtual).toString(),
    `${origem}/media/alborghetti-presta-atencao.mp3`,
  ];
  return [...new Set(caminhos)];
}

function prepararArquivoAudioNotificacao() {
  if (audioNotificacaoArquivo) return;

  const caminhos = obterCaminhosAudioNotificacao();
  let indice = 0;
  const audio = new Audio();
  audio.preload = 'auto';
  audioNotificacaoArquivo = audio;

  const tentarProximo = () => {
    if (indice >= caminhos.length) return;
    const src = caminhos[indice];
    indice += 1;
    audio.src = src;
    audio.load();
  };

  audio.addEventListener('error', () => {
    if (indice < caminhos.length) {
      tentarProximo();
    }
  });

  tentarProximo();
}

function habilitarSomNotificacao() {
  somNotificacaoHabilitado = true;
  garantirContextoAudioAtivo();
}

function pararSomNotificacao() {
  if (!audioNotificacaoEmReproducao) return;
  try {
    audioNotificacaoEmReproducao.pause();
    audioNotificacaoEmReproducao.currentTime = 0;
  } catch (e) {}
  audioNotificacaoEmReproducao = null;
}

function falarNovaTarefaNotificacao() {
  if (!('speechSynthesis' in window)) return;
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    const vozes = synth.getVoices ? synth.getVoices() : [];
    const vozPtBr = vozes.find(v => (v.lang || '').toLowerCase().startsWith('pt-br'))
      || vozes.find(v => (v.lang || '').toLowerCase().startsWith('pt'))
      || null;

    for (let i = 0; i < 4; i += 1) {
      const utter = new SpeechSynthesisUtterance('NOVA TAREFA!');
      utter.lang = 'pt-BR';
      utter.volume = 1;
      utter.rate = 1.2;
      utter.pitch = 1.28;
      if (vozPtBr) utter.voice = vozPtBr;
      synth.speak(utter);
    }
  } catch (e) {}
}

function falarAlertaRapidoNotificacao() {
  if (!('speechSynthesis' in window)) return;
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    const vozes = synth.getVoices ? synth.getVoices() : [];
    const vozPtBr = vozes.find(v => (v.lang || '').toLowerCase().startsWith('pt-br'))
      || vozes.find(v => (v.lang || '').toLowerCase().startsWith('pt'))
      || null;

    for (let i = 0; i < 3; i += 1) {
      const utter = new SpeechSynthesisUtterance('ALERTA RÁPIDO!');
      utter.lang = 'pt-BR';
      utter.volume = 1;
      utter.rate = 1.18;
      utter.pitch = 1.24;
      if (vozPtBr) utter.voice = vozPtBr;
      synth.speak(utter);
    }
  } catch (e) {}
}

function tocarSomAlertaRapidoNotificacao(forcar = false) {
  if (forcar) {
    somNotificacaoBloqueadoAte = 0;
  }
  tocarSomNotificacaoFallback(true, false);
  window.setTimeout(() => {
    falarAlertaRapidoNotificacao();
  }, 260);
}

function falarVerificarTarefaNotificacao() {
  if (!('speechSynthesis' in window)) return;
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    const vozes = synth.getVoices ? synth.getVoices() : [];
    const vozPtBrFeminina = vozes.find(v => {
      const nome = (v.name || '').toLowerCase();
      const lang = (v.lang || '').toLowerCase();
      return lang.startsWith('pt-br') && /(female|feminina|mulher|woman|maria|luciana|ana|helena|camila|beatriz)/.test(nome);
    }) || vozes.find(v => (v.lang || '').toLowerCase().startsWith('pt-br'))
      || vozes.find(v => (v.lang || '').toLowerCase().startsWith('pt'))
      || null;

    for (let i = 0; i < 2; i += 1) {
      const utter = new SpeechSynthesisUtterance('VERIFICAR TAREFA!');
      utter.lang = 'pt-BR';
      utter.volume = 1;
      utter.rate = 1.25;
      utter.pitch = 1.35;
      if (vozPtBrFeminina) utter.voice = vozPtBrFeminina;
      synth.speak(utter);
    }
  } catch (e) {}
}

function preaquecerAudioNotificacao() {
  if (!audioContextNotificacao || audioNotificacaoPreaquecido) return;
  try {
    const inicio = audioContextNotificacao.currentTime + 0.01;
    const osc = audioContextNotificacao.createOscillator();
    const gain = audioContextNotificacao.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, inicio);
    gain.gain.setValueAtTime(0.0001, inicio);
    gain.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.03);
    osc.connect(gain);
    gain.connect(audioContextNotificacao.destination);
    osc.start(inicio);
    osc.stop(inicio + 0.03);
    audioNotificacaoPreaquecido = true;
  } catch (e) {}
}

function garantirContextoAudioAtivo(callback = null) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return false;

  if (!audioContextNotificacao) {
    audioContextNotificacao = new AudioCtx();
  }

  const executar = () => {
    preaquecerAudioNotificacao();
    if (typeof callback === 'function') callback();
  };

  if (audioContextNotificacao.state === 'suspended') {
    audioContextNotificacao.resume().then(executar).catch(() => {});
    return false;
  }

  executar();
  return true;
}

function somNotificacaoPodeDisparar() {
  return Date.now() >= somNotificacaoBloqueadoAte;
}

function bloquearDisparoSomPor(ms) {
  const ate = Date.now() + Math.max(0, ms || 0);
  if (ate > somNotificacaoBloqueadoAte) {
    somNotificacaoBloqueadoAte = ate;
  }
}

function tocarSinoNotificacaoAlto({ quantidade = 4, volume = 0.42, espacamento = 0.34 } = {}) {
  const duracaoToque = 0.34;
  const duracaoTotal = (quantidade * duracaoToque) + ((quantidade - 1) * espacamento);

  const disparar = () => {
    const inicioBase = audioContextNotificacao.currentTime + 0.02;
    for (let i = 0; i < quantidade; i += 1) {
      const inicio = inicioBase + (i * (duracaoToque + espacamento));
      const fim = inicio + duracaoToque;
      const osciladorA = audioContextNotificacao.createOscillator();
      const osciladorB = audioContextNotificacao.createOscillator();
      const gain = audioContextNotificacao.createGain();

      osciladorA.type = 'sine';
      osciladorB.type = 'triangle';
      osciladorA.frequency.setValueAtTime(1046.5, inicio);
      osciladorB.frequency.setValueAtTime(1318.5, inicio);
      osciladorA.frequency.exponentialRampToValueAtTime(1568, fim - 0.04);
      osciladorB.frequency.exponentialRampToValueAtTime(2093, fim - 0.04);

      gain.gain.setValueAtTime(0.0001, inicio);
      gain.gain.exponentialRampToValueAtTime(volume, inicio + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, fim);

      osciladorA.connect(gain);
      osciladorB.connect(gain);
      gain.connect(audioContextNotificacao.destination);
      osciladorA.start(inicio);
      osciladorB.start(inicio);
      osciladorA.stop(fim + 0.02);
      osciladorB.stop(fim + 0.02);
    }
  };

  garantirContextoAudioAtivo(disparar);
  return duracaoTotal;
}


function tocarSireneSequencial({
  quantidade = 2,
  duracao = 2.1,
  volume = 0.2,
  frequenciaBaixa = 620,
  frequenciaAlta = 1220,
  espacamento = 0.32,
} = {}) {
  const intervaloSirene = duracao + espacamento;
  const duracaoTotal = (quantidade * duracao) + ((quantidade - 1) * espacamento);

  const tocarSirene = (inicio) => {
    const fim = inicio + duracao;
    const oscillator = audioContextNotificacao.createOscillator();
    const gainNode = audioContextNotificacao.createGain();

    // "triangle" mantém a sirene alta, mas reduz a sensação de som embolado.
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(frequenciaBaixa, inicio);
    oscillator.frequency.linearRampToValueAtTime(frequenciaAlta, inicio + 0.35);
    oscillator.frequency.linearRampToValueAtTime(frequenciaBaixa, inicio + 0.7);
    oscillator.frequency.linearRampToValueAtTime(frequenciaAlta, inicio + 1.05);
    oscillator.frequency.linearRampToValueAtTime(frequenciaBaixa, inicio + 1.4);
    oscillator.frequency.linearRampToValueAtTime(frequenciaAlta, inicio + 1.75);
    oscillator.frequency.linearRampToValueAtTime(frequenciaBaixa, fim);

    gainNode.gain.setValueAtTime(0.0001, inicio);
    gainNode.gain.exponentialRampToValueAtTime(volume, inicio + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(volume, fim - 0.12);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, fim);

    oscillator.connect(gainNode);
    gainNode.connect(audioContextNotificacao.destination);
    oscillator.start(inicio);
    oscillator.stop(fim + 0.02);
  };

  const disparar = () => {
    const agora = audioContextNotificacao.currentTime;
    const inicioBase = agora + 0.02;
    for (let i = 0; i < quantidade; i += 1) {
      tocarSirene(inicioBase + (i * intervaloSirene));
    }
  };

  garantirContextoAudioAtivo(disparar);
  return duracaoTotal;
}

function tocarSomNotificacaoFallback(critico = false, incluirFala = true) {
  if (!somNotificacaoHabilitado) {
    habilitarSomNotificacao();
  }
  if (!somNotificacaoHabilitado) return;
  if (!somNotificacaoPodeDisparar()) return;

  const duracaoTotalSirenes = tocarSinoNotificacaoAlto({
    quantidade: critico ? 5 : 4,
    volume: critico ? 0.48 : 0.4,
    espacamento: critico ? 0.26 : 0.34,
  });

  const duracaoFalaMs = incluirFala ? 3600 : 0;
  bloquearDisparoSomPor(Math.round((duracaoTotalSirenes * 1000) + duracaoFalaMs + 280));

  if (incluirFala) {
    window.setTimeout(() => {
      falarNovaTarefaNotificacao();
    }, Math.round((duracaoTotalSirenes + 0.16) * 1000));
  }
}

function tocarSomNovaTarefaChecklist() {
  if (!somNotificacaoHabilitado) {
    habilitarSomNotificacao();
  }
  if (!somNotificacaoHabilitado) return;
  if (!somNotificacaoPodeDisparar()) return;

  const duracaoTotalSino = tocarSinoNotificacaoAlto({
    quantidade: 3,
    volume: 0.45,
    espacamento: 0.32,
  });

  bloquearDisparoSomPor(Math.round((duracaoTotalSino * 1000) + 240));
}

function tocarBipCurtoTarefaAtrasada() {
  if (!somNotificacaoHabilitado) {
    habilitarSomNotificacao();
  }
  if (!somNotificacaoHabilitado) return;
  if (!somNotificacaoPodeDisparar()) return;

  const disparar = () => {
    const inicio = audioContextNotificacao.currentTime + 0.02;
    const duracao = 0.16;
    const fim = inicio + duracao;
    const oscillator = audioContextNotificacao.createOscillator();
    const gainNode = audioContextNotificacao.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, inicio);
    oscillator.frequency.linearRampToValueAtTime(1100, fim);

    gainNode.gain.setValueAtTime(0.0001, inicio);
    gainNode.gain.exponentialRampToValueAtTime(0.11, inicio + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, fim);

    oscillator.connect(gainNode);
    gainNode.connect(audioContextNotificacao.destination);
    oscillator.start(inicio);
    oscillator.stop(fim + 0.02);
  };

  garantirContextoAudioAtivo(disparar);
  bloquearDisparoSomPor(900);
}

function tocarSomExecucaoAtrasadaNotificacao(incluirFala = true) {
  if (!somNotificacaoHabilitado) {
    habilitarSomNotificacao();
  }
  if (!somNotificacaoHabilitado) return;
  if (!somNotificacaoPodeDisparar()) return;

  const duracaoTotalSirenes = tocarSireneSequencial({
    quantidade: 2,
    duracao: 2.2,
    volume: 0.25,
    frequenciaBaixa: 700,
    frequenciaAlta: 1400,
    espacamento: 0.32,
  });

  const duracaoFalaMs = incluirFala ? 2400 : 0;
  bloquearDisparoSomPor(Math.round((duracaoTotalSirenes * 1000) + duracaoFalaMs + 240));

  if (incluirFala) {
    window.setTimeout(() => {
      falarVerificarTarefaNotificacao();
    }, Math.round((duracaoTotalSirenes + 0.14) * 1000));
  }
}

function tocarSomNotificacao(critico = false, incluirFala = true) {
  if (!somNotificacaoHabilitado) return;
  tocarSomNotificacaoFallback(critico, incluirFala);
}

function testarSomNotificacao() {
  habilitarSomNotificacao();
  somNotificacaoBloqueadoAte = 0;
  // iOS/Safari: fala imediata no gesto do clique aumenta compatibilidade.
  falarNovaTarefaNotificacao();
  tocarSomNotificacao(false, false);
}

function testarSomNotificacaoAndamento() {
  habilitarSomNotificacao();
  somNotificacaoBloqueadoAte = 0;
  // iOS/Safari: fala imediata no gesto do clique aumenta compatibilidade.
  falarVerificarTarefaNotificacao();
  tocarSomExecucaoAtrasadaNotificacao(false);
}

function destacarNovasNotificacoes() {
  const button = document.querySelector('.notification-btn');
  if (!button) return;
  button.classList.remove('ringing');
  void button.offsetWidth;
  button.classList.add('ringing');
}

function obterNomeResponsavelAvisoTarefa(notificacoesCriticas = []) {
  const primeiraComResponsavel = (notificacoesCriticas || []).find(item => {
    const nome = item?.meta?.nomeFuncionario || item?.meta?.nome_funcionario;
    return !!String(nome || '').trim();
  });
  const nomeResponsavel = primeiraComResponsavel?.meta?.nomeFuncionario
    || primeiraComResponsavel?.meta?.nome_funcionario
    || '';
  if (!nomeResponsavel) return 'RESPONSÁVEL';
  return String(nomeResponsavel).toUpperCase();
}

function renderizarAvisoCentralTarefas() {
  const banner = document.getElementById('overdueAlertBanner');
  const list = document.getElementById('overdueAlertList');
  const title = document.getElementById('overdueAlertTitle');
  const text = document.getElementById('overdueAlertText');
  const btnPrincipal = document.getElementById('btnOverdueAlertAction');
  const btnSecundario = document.getElementById('btnOverdueAlertExecucoes');
  if (!banner || !list) return;

  if (!paginaPermiteAlertaForte()) {
    banner.hidden = true;
    list.innerHTML = '';
    return;
  }

  const criticas = obterNotificacoesCriticas();
  const criticasOperacionais = criticas.filter(item => tipoNotificacaoTarefaAtrasada(item?.tipo));
  const alertasRapidos = criticas.filter(item => item?.tipo === 'alerta_rapido');
  const itensBanner = criticasOperacionais.length ? criticasOperacionais : alertasRapidos;
  const temAlertaRapido = !criticasOperacionais.length && alertasRapidos.length > 0;
  if (title) {
    title.textContent = temAlertaRapido
      ? 'ALERTA RÁPIDO'
      : `"${obterNomeResponsavelAvisoTarefa(itensBanner)}" NOVA TAREFA`;
  }
  if (text) {
    text.textContent = temAlertaRapido
      ? 'Existe um aviso imediato aguardando confirmação por PIN. Finalize agora para registrar quem confirmou.'
      : 'Existem checklists próximos do prazo ou em atraso aguardando início. Resolva agora para evitar falhas na rotina.';
  }
  const assinaturaAtual = itensBanner.map(item => item.chave).sort().join('|');
  if (assinaturaAtual !== assinaturaAvisoCentralTarefas) {
    assinaturaAvisoCentralTarefas = assinaturaAtual;
    avisoCentralTarefasFechado = false;
  }

  if (!itensBanner.length || avisoCentralTarefasFechado) {
    banner.hidden = true;
    list.innerHTML = '';
    if (btnPrincipal) btnPrincipal.textContent = 'Ver checklists';
    if (btnSecundario) {
      btnSecundario.textContent = 'Acompanhar tarefa';
      btnSecundario.style.display = '';
    }
    return;
  }

  if (btnPrincipal) btnPrincipal.textContent = temAlertaRapido ? 'Finalizar aviso' : 'Ver checklists';
  if (btnSecundario) {
    btnSecundario.textContent = 'Acompanhar tarefa';
    btnSecundario.style.display = temAlertaRapido ? 'none' : '';
  }

  list.innerHTML = itensBanner.slice(0, 3).map(item => {
    const nomeTarefa = item?.tipo === 'alerta_rapido'
      ? `AVISO: ${item?.meta?.mensagem || item?.descricao || 'Alerta rápido'}`
      : (item?.meta?.nomeTarefa || item?.meta?.nomeChecklist || item?.meta?.nome_checklist || item?.titulo || 'Checklist pendente');
    const nomeFuncionario = item?.meta?.nomeFuncionario || item?.meta?.nome_funcionario || 'Responsável não definido';
    const horario = item?.tipo === 'alerta_rapido'
      ? 'Aviso imediato'
      : (item?.meta?.horarioProgramado || item?.meta?.horario_programado || 'Não informado');
    const dataProgramada = item?.meta?.dataProgramada || item?.meta?.data_programada || '';
    const dataHorarioTexto = item?.tipo === 'alerta_rapido'
      ? horario
      : (dataProgramada ? `${dataProgramada} às ${horario}` : horario);
    const rodape = item?.tipo === 'alerta_rapido'
      ? 'Aviso rápido. Confirme com seu PIN para finalizar o aviso.'
      : item?.tipo === 'execucao_atrasada'
      ? 'Aviso de tarefa em andamento/pausada. Selecione uma opção.'
      : 'Aviso de nova tarefa. Selecione uma opção.';
    return `
    <div class="overdue-alert-item">
      <div class="overdue-alert-task">${nomeTarefa}</div>
      <div class="overdue-alert-funcionario">${nomeFuncionario}</div>
      <div class="overdue-alert-horario">${item?.tipo === 'alerta_rapido' ? 'Aviso para: ' : 'Data e hora da tarefa: '}${dataHorarioTexto}</div>
      <div class="overdue-alert-rodape">${rodape}</div>
    </div>
  `;
  }).join('');

  banner.hidden = false;
}

function fecharAvisoCentralTarefas() {
  avisoCentralTarefasFechado = true;
  const banner = document.getElementById('overdueAlertBanner');
  if (banner) banner.hidden = true;
}

async function abrirPainelTarefasAtrasadas(event) {
  if (event?.preventDefault) event.preventDefault();
  if (event?.stopPropagation) event.stopPropagation();

  const existeAvisoTarefa = notificacoesAtuais.some(item => tipoNotificacaoTarefaAtrasada(item?.tipo));
  const alertaRapido = notificacoesAtuais.find(item => item?.tipo === 'alerta_rapido');
  if (alertaRapido && !existeAvisoTarefa) {
    const index = notificacoesAtuais.findIndex(item => item?.chave === alertaRapido?.chave);
    await confirmarAlertaRapidoNotificacao(alertaRapido, index);
    return;
  }

  const destino = 'checklists';
  const botao = document.querySelector('.nav-btn[data-page="checklists"]');

  fecharAvisoCentralTarefas();
  togglePainelNotificacoes(false);
  abrirPagina(destino, botao);
}

function abrirPainelExecucoesEmAndamento(event) {
  if (event?.preventDefault) event.preventDefault();
  if (event?.stopPropagation) event.stopPropagation();

  const destino = 'execucoes';
  const botao = document.querySelector('.nav-btn[data-page="execucoes"]');

  fecharAvisoCentralTarefas();
  togglePainelNotificacoes(false);
  abrirPagina(destino, botao);
}

function obterInicioExecucaoParaLembrete(item) {
  return item?.inicio_confirmado_em || null;
}

function execucaoPrecisaLembreteFinalizacao(item) {
  const inicio = obterInicioExecucaoParaLembrete(item);
  if (!inicio) return false;
  return (Date.now() - new Date(inicio).getTime()) >= TEMPO_INICIO_ALERTA_EXECUCAO_MS;
}

function formatarDuracaoDecorrida(dataIso) {
  if (!dataIso) return 'algum tempo';
  const diffMs = Math.max(0, Date.now() - new Date(dataIso).getTime());
  const totalMinutos = Math.max(1, Math.floor(diffMs / 60000));
  if (totalMinutos < 60) return `${totalMinutos} min`;
  const horas = Math.floor(totalMinutos / 60);
  const minutos = totalMinutos % 60;
  return minutos ? `${horas}h ${minutos}min` : `${horas}h`;
}

function limparControleLembretesExecucao(chavesAtivas = []) {
  const ativos = new Set(chavesAtivas);
  Object.keys(ultimosLembretesExecucaoEm).forEach(chave => {
    if (!ativos.has(chave)) {
      delete ultimosLembretesExecucaoEm[chave];
    }
  });
}

function limparControleLembretesChecklist(chavesAtivas = []) {
  const ativos = new Set(chavesAtivas);
  Object.keys(ultimosLembretesChecklistEm).forEach(chave => {
    if (!ativos.has(chave)) {
      delete ultimosLembretesChecklistEm[chave];
    }
  });
}

function limparControleLembretesTarefaAtrasada(chavesAtivas = []) {
  const ativos = new Set(chavesAtivas);
  Object.keys(ultimosLembretesTarefaAtrasadaEm).forEach(chave => {
    if (!ativos.has(chave)) {
      delete ultimosLembretesTarefaAtrasadaEm[chave];
    }
  });
}

function sincronizarAvisoNotificacoes() {
  const totalAtual = notificacoesAtuais.length;
  const notificacoesCriticas = obterNotificacoesCriticas();
  const totalCriticoAtual = notificacoesCriticas.length;
  const assinaturaCriticaAtual = notificacoesCriticas.map(item => item.chave).sort().join('|');
  const criticasOperacionais = notificacoesCriticas.filter(item => tipoNotificacaoTarefaAtrasada(item?.tipo));
  const alertasRapidos = notificacoesCriticas.filter(item => item?.tipo === 'alerta_rapido');
  const lancamentosPendentes = notificacoesCriticas.filter(item => item.tipo === 'lancamento_atrasado' || item.tipo === 'checklist_pendente');
  const tarefasAtrasadas = notificacoesCriticas.filter(item => item.tipo === 'tarefa_atrasada');
  const execucoesAtrasadas = notificacoesCriticas.filter(item => item.tipo === 'execucao_atrasada');
  const agora = Date.now();
  let somTocadoNesteCiclo = false;
  const alertaFortePermitido = paginaPermiteAlertaForte();
  const chavesCriticasAnteriores = new Set(String(assinaturaAlertasCriticosAnterior || '').split('|').filter(Boolean));
  const notificacoesCriticasNovas = notificacoesCriticas.filter(item => !chavesCriticasAnteriores.has(String(item?.chave || '')));
  const novasTarefasChecklist = notificacoesCriticasNovas.filter(item => item?.tipo === 'checklist_pendente' || item?.tipo === 'lancamento_atrasado');
  const novosAlertasRapidos = notificacoesCriticasNovas.filter(item => item?.tipo === 'alerta_rapido');
  const possuiNovaTarefaChecklist = novasTarefasChecklist.length > 0;
  const possuiNovoAlertaRapido = novosAlertasRapidos.length > 0;
  const podeAlertarNovaTarefaChecklist = possuiNovaTarefaChecklist && existeSessaoAtivaParaAtualizacao();
  const podeAlertarNovoAlertaRapido = possuiNovoAlertaRapido && existeSessaoAtivaParaAtualizacao();

  const redirecionarParaChecklistSeNecessario = () => {
    if (!possuiNovaTarefaChecklist) return;
    if (!usuarioPodeAcessar('checklists')) return;
    if (!usuarioEhMasterNotificacoes() || !usuarioEhPerfilGerencialNotificacoes()) return;

    const assinaturaNovaTarefa = novasTarefasChecklist
      .map(item => String(item?.chave || ''))
      .filter(Boolean)
      .sort()
      .join('|');

    if (!assinaturaNovaTarefa || assinaturaNovaTarefa === assinaturaUltimoRedirecionamentoChecklist) return;
    assinaturaUltimoRedirecionamentoChecklist = assinaturaNovaTarefa;

    const botaoChecklist = document.querySelector('.nav-btn[data-page="checklists"]');
    abrirPagina('checklists', botaoChecklist);
  };

  const redirecionarParaAlertaRapidoSeNecessario = () => {
    if (!possuiNovoAlertaRapido) return;
    if (!usuarioPodeReceberAlertaRapido()) return;
    if (!usuarioPodeAcessar('tarefas_rapidas')) return;

    const assinaturaNovoAlerta = novosAlertasRapidos
      .map(item => String(item?.chave || ''))
      .filter(Boolean)
      .sort()
      .join('|');

    if (!assinaturaNovoAlerta || assinaturaNovoAlerta === assinaturaUltimoRedirecionamentoAlertaRapido) return;
    assinaturaUltimoRedirecionamentoAlertaRapido = assinaturaNovoAlerta;

    const botaoAlertasRapidos = document.querySelector('.nav-btn[data-page="tarefas_rapidas"]');
    abrirPagina('tarefas_rapidas', botaoAlertasRapidos);
  };

  renderizarAvisoCentralTarefas();

  limparControleLembretesExecucao(execucoesAtrasadas.map(item => item.chave).filter(Boolean));
  limparControleLembretesChecklist(lancamentosPendentes.map(item => item.chave).filter(Boolean));
  limparControleLembretesTarefaAtrasada(tarefasAtrasadas.map(item => item.chave).filter(Boolean));

  const tocarSomCriticoChecklist = () => {
    if (!criticasOperacionais.length && alertasRapidos.length) {
      tocarSomAlertaRapidoNotificacao(true);
    } else {
      tocarSomNotificacao(true);
    }
    somTocadoNesteCiclo = true;
  };

  const tocarSomCriticoExecucao = () => {
    tocarBipCurtoTarefaAtrasada();
    somTocadoNesteCiclo = true;
  };

  if (quantidadeNotificacoesAnterior === null) {
    if (totalCriticoAtual > 0 && existeSessaoAtivaParaAtualizacao() && (alertaFortePermitido || podeAlertarNovaTarefaChecklist || podeAlertarNovoAlertaRapido)) {
      destacarNovasNotificacoes();
      avisoCentralTarefasFechado = false;
      renderizarAvisoCentralTarefas();
      if (execucoesAtrasadas.length) {
        tocarSomCriticoExecucao();
      } else if (possuiNovaTarefaChecklist) {
        tocarSomNovaTarefaChecklist();
        somTocadoNesteCiclo = true;
      } else {
        tocarSomCriticoChecklist();
      }
      if (!painelNotificacoesAberto) {
        togglePainelNotificacoes(true);
      }
      redirecionarParaAlertaRapidoSeNecessario();
      redirecionarParaChecklistSeNecessario();
    }
    quantidadeNotificacoesAnterior = totalAtual;
    quantidadeAlertasCriticosAnterior = totalCriticoAtual;
    assinaturaAlertasCriticosAnterior = assinaturaCriticaAtual;
    return;
  }

  if (totalCriticoAtual > 0 && assinaturaCriticaAtual !== assinaturaAlertasCriticosAnterior && (alertaFortePermitido || podeAlertarNovaTarefaChecklist || podeAlertarNovoAlertaRapido)) {
    destacarNovasNotificacoes();
    avisoCentralTarefasFechado = false;
    renderizarAvisoCentralTarefas();
    if (execucoesAtrasadas.length) {
      tocarSomCriticoExecucao();
    } else if (possuiNovaTarefaChecklist) {
      tocarSomNovaTarefaChecklist();
      somTocadoNesteCiclo = true;
    } else {
      tocarSomCriticoChecklist();
    }
    if (!painelNotificacoesAberto) {
      togglePainelNotificacoes(true);
    }
    redirecionarParaAlertaRapidoSeNecessario();
    redirecionarParaChecklistSeNecessario();
  } else if (totalAtual > quantidadeNotificacoesAnterior && (alertaFortePermitido || podeAlertarNovaTarefaChecklist || podeAlertarNovoAlertaRapido)) {
    destacarNovasNotificacoes();
    const notificacaoMaisRecente = notificacoesAtuais[0] || null;
    const notificacaoSilenciosa = notificacaoMaisRecente?.tipo === 'checklist_agendado';
    if (!notificacaoSilenciosa) {
      if (possuiNovaTarefaChecklist) {
        tocarSomNovaTarefaChecklist();
      } else {
        tocarSomNotificacao(false);
      }
    }
    if (!painelNotificacoesAberto) {
      togglePainelNotificacoes(true);
    }
    redirecionarParaAlertaRapidoSeNecessario();
    redirecionarParaChecklistSeNecessario();
  }

  const lembretesExecucaoDevidos = execucoesAtrasadas.filter(item => {
    const ultimoLembrete = ultimosLembretesExecucaoEm[item.chave] || 0;
    return !ultimoLembrete || (agora - ultimoLembrete) >= INTERVALO_REPETICAO_ALERTA_EXECUCAO_MS;
  });

  if (lembretesExecucaoDevidos.length && alertaFortePermitido) {
    lembretesExecucaoDevidos.forEach(item => {
      if (item?.chave) {
        ultimosLembretesExecucaoEm[item.chave] = agora;
      }
    });
    if (!somTocadoNesteCiclo) {
      tocarSomCriticoExecucao();
    }
  }

  const lembretesChecklistDevidos = lancamentosPendentes.filter(item => {
    const ultimoLembrete = ultimosLembretesChecklistEm[item.chave] || 0;
    return !ultimoLembrete || (agora - ultimoLembrete) >= INTERVALO_LEMBRETE_CHECKLIST_MS;
  });

  if (lembretesChecklistDevidos.length && alertaFortePermitido) {
    lembretesChecklistDevidos.forEach(item => {
      if (item?.chave) {
        ultimosLembretesChecklistEm[item.chave] = agora;
      }
    });
    if (!somTocadoNesteCiclo) {
      tocarSomCriticoChecklist();
    }
  }

  const lembretesTarefaAtrasadaDevidos = tarefasAtrasadas.filter(item => {
    const ultimoLembrete = ultimosLembretesTarefaAtrasadaEm[item.chave] || 0;
    return !ultimoLembrete || (agora - ultimoLembrete) >= INTERVALO_LEMBRETE_TAREFA_ATRASADA_MS;
  });

  if (lembretesTarefaAtrasadaDevidos.length && alertaFortePermitido) {
    lembretesTarefaAtrasadaDevidos.forEach(item => {
      if (item?.chave) {
        ultimosLembretesTarefaAtrasadaEm[item.chave] = agora;
      }
    });
    if (!somTocadoNesteCiclo) {
      tocarBipCurtoTarefaAtrasada();
    }
  }

  quantidadeNotificacoesAnterior = totalAtual;
  quantidadeAlertasCriticosAnterior = totalCriticoAtual;
  assinaturaAlertasCriticosAnterior = assinaturaCriticaAtual;
}

async function abrirNotificacao(index) {
  const item = notificacoesAtuais[index];
  if (!item) return;
  if (item.tipo === 'alerta_rapido') {
    await confirmarAlertaRapidoNotificacao(item, index);
    return;
  }
  togglePainelNotificacoes(false);
  if (item.page) {
    const botao = document.querySelector(`.nav-btn[data-page="${item.page}"]`);
    abrirPagina(item.page, botao);
  }
}


async function carregarNotificacoes() {
  const itens = [];
  const alertasEmail = [];

  try {
    const { data: solicitacoes, error: errSolicitacoes } = await sb
      .from('solicitacoes_acesso')
      .select('id, nome, email, created_at, status')
      .eq('status', 'pendente')
      .order('created_at', { ascending: false });

    if (usuarioPodeVerNotificacaoSolicitacao() && !errSolicitacoes && solicitacoes?.length) {
      const solicitacoesVisiveis = [];
      const emailsVistos = new Set();
      (solicitacoes || []).forEach(s => {
        const chaveEmail = String(s.email || '').trim().toLowerCase() || `id:${s.id}`;
        if (emailsVistos.has(chaveEmail)) return;
        emailsVistos.add(chaveEmail);
        solicitacoesVisiveis.push(s);
      });

      solicitacoesVisiveis.forEach(s => {
        const emailNormalizado = String(s.email || '').trim().toLowerCase();
        itens.push({
          chave: emailNormalizado ? `solicitacao_email::${emailNormalizado}` : `solicitacao::${s.id}`,
          tipo: 'solicitacao',
          page: 'solicitacoes',
          titulo: 'Novo usuário aguardando aprovação',
          descricao: `${s.nome} (${s.email}) pediu acesso em ${fmtDate(s.created_at)}.`,
        });
      });
    }
  } catch (e) {}

  try {
    const destino = obterFuncionarioDestinoAlertaRapidoAtual();
    if (usuarioPodeReceberAlertaRapido() && (destino.id || destino.nome)) {
      const data = await buscarAlertasRapidosPendentesParaDestino(destino);
      (data || []).forEach(item => {
        const mensagem = String(item.mensagem || '').trim();
        if (!mensagem) return;
        itens.push({
          chave: criarChaveAlerta('alerta_rapido', item.grupo_id || item.id),
          tipo: 'alerta_rapido',
          page: 'tarefas_rapidas',
          titulo: 'Alerta rápido',
          descricao: `ALERTA "${mensagem}"`,
          meta: {
            alertaRapidoId: item.id,
            alertaRapidoGrupoId: item.grupo_id || '',
            mensagem,
            nomeFuncionario: item.funcionario_destino_nome || destino.nome || 'Funcionário',
            funcionarioDestinoId: String(item.funcionario_destino_id || destino.id || ''),
            horarioProgramado: 'Aviso imediato',
          },
        });
      });
    }
  } catch (e) {
    if (!isMissingQuickAlertsTableError(e)) {
      console.warn('Falha ao carregar alertas rápidos para o funcionário:', e);
    }
  }

  try {
    const cfg = await obterConfiguracoesLoja();
    if (!cfg.missing) {
      await garantirLancamentosAutomaticosDoDia(cfg.data || null);
    }

    const carregarLancamentosPendentes = async () => {
      const consultaBase = () => sb
        .from('checklist_lancamentos')
        .select('id, tarefa_id, checklist_id, nome, horario_limite, dias_semana, funcionario_id, status, lancado_em')
        .eq('status', 'pendente')
        .order('lancado_em', { ascending: false });

      if (checklistLancamentosSuportaColunasAgendamento !== false) {
        const consultaCompleta = await sb
          .from('checklist_lancamentos')
          .select('id, tarefa_id, checklist_id, nome, horario_limite, dias_semana, funcionario_id, status, lancado_em, created_at, data_programada')
          .eq('status', 'pendente')
          .order('lancado_em', { ascending: false });

        if (!consultaCompleta.error) {
          checklistLancamentosSuportaColunasAgendamento = true;
          return consultaCompleta.data || [];
        }

        if (!isMissingChecklistLaunchScheduleColumnsError(consultaCompleta.error)) {
          throw consultaCompleta.error;
        }

        checklistLancamentosSuportaColunasAgendamento = false;
      }

      const consultaFallback = await sb
        .from('checklist_lancamentos')
        .select('id, tarefa_id, checklist_id, nome, horario_limite, dias_semana, funcionario_id, status, lancado_em, data_programada')
        .eq('status', 'pendente')
        .order('lancado_em', { ascending: false });

      if (consultaFallback.error) throw consultaFallback.error;
      return (consultaFallback.data || []).map(item => ({ ...item, created_at: null }));
    };

    let execucoesPendentesQuery = sb
      .from('checklist_execucoes')
      .select('id, tarefa_id, lancamento_id, checklist_id, status, data_execucao, iniciado_em, inicio_confirmado_em, funcionario_id, tarefas(nome, horario_limite)')
      .in('status', ['aberto', 'pausado'])
      .eq('data_execucao', hoje());

    const [lancamentosPendentes, { data: execucoesPendentes }] = await Promise.all([
      carregarLancamentosPendentes(),
      execucoesPendentesQuery.order('iniciado_em', { ascending: false }),
    ]);

    const lancamentoIdsPendentesParaAuditoria = [...new Set((lancamentosPendentes || [])
      .map(item => item.id)
      .filter(Boolean)
      .map(item => String(item)))];
    let execucoesDoDiaDosLancamentos = [];

    if (lancamentoIdsPendentesParaAuditoria.length) {
      const { data: execucoesLancamentosData, error: errExecucoesLancamentos } = await sb
        .from('checklist_execucoes')
        .select('id, lancamento_id, status, data_execucao')
        .in('lancamento_id', lancamentoIdsPendentesParaAuditoria)
        .eq('data_execucao', hoje());

      if (!errExecucoesLancamentos) {
        execucoesDoDiaDosLancamentos = execucoesLancamentosData || [];
      }
    }

    const funcionarioRestritoNotificacoesId = obterFuncionarioRestritoLogadoId();
    if (funcionarioRestritoNotificacoesId) {
      for (let i = lancamentosPendentes.length - 1; i >= 0; i--) {
        if (String(lancamentosPendentes[i]?.funcionario_id || '') !== funcionarioRestritoNotificacoesId) lancamentosPendentes.splice(i, 1);
      }
      if (Array.isArray(execucoesPendentes)) {
        for (let i = execucoesPendentes.length - 1; i >= 0; i--) {
          if (String(execucoesPendentes[i]?.funcionario_id || '') !== funcionarioRestritoNotificacoesId) execucoesPendentes.splice(i, 1);
        }
      }
    }

    const funcionarioIds = [...new Set([
      ...(lancamentosPendentes || []).map(item => item.funcionario_id).filter(Boolean),
      ...(execucoesPendentes || []).map(item => item.funcionario_id).filter(Boolean),
    ].map(item => String(item)))];
    let funcionariosMap = {};

    if (funcionarioIds.length) {
      const { data: funcionariosData } = await sb
        .from('funcionarios')
        .select('id, nome')
        .in('id', funcionarioIds);
      funcionariosMap = Object.fromEntries((funcionariosData || []).map(item => [String(item.id), item.nome]));
    }

    const checklistIds = [...new Set([
      ...(lancamentosPendentes || []).map(item => item.checklist_id).filter(Boolean),
      ...(execucoesPendentes || []).map(item => item.checklist_id).filter(Boolean),
    ].map(item => String(item)))];
    let checklistsMap = {};

    if (checklistIds.length) {
      const { data: checklistsData } = await sb
        .from('checklists')
        .select('id, nome')
        .in('id', checklistIds);
      checklistsMap = Object.fromEntries((checklistsData || []).map(item => [String(item.id), item.nome]));
    }

    const lancamentoIdsExecucao = [...new Set((execucoesPendentes || []).map(item => item.lancamento_id).filter(Boolean).map(item => String(item)))];
    let lancamentosExecucaoMap = {};

    if (lancamentoIdsExecucao.length) {
      const { data: lancamentosExecucaoData } = await sb
        .from('checklist_lancamentos')
        .select('id, horario_limite')
        .in('id', lancamentoIdsExecucao);
      lancamentosExecucaoMap = Object.fromEntries((lancamentosExecucaoData || []).map(item => [String(item.id), item]));
    }

    const lancamentosComExecucaoAtivaIds = new Set([
      ...(execucoesPendentes || []),
      ...(execucoesDoDiaDosLancamentos || []),
    ]
      .filter(item => {
        const statusExecucao = String(item?.status || '').trim().toLowerCase();
        return statusExecucao !== 'cancelado' && statusExecucao !== 'cancelada';
      })
      .map(item => item.lancamento_id)
      .filter(Boolean)
      .map(item => String(item)));

    const lancamentoJaPossuiExecucaoAtiva = (item = {}) => {
      const id = String(item?.id || '');
      return !!id && lancamentosComExecucaoAtivaIds.has(id);
    };

    const lancamentoEhDoDiaOuSemData = (item) => {
      if (lancamentoProgramadoHoje(item)) return true;
      return !item?.lancado_em && !item?.created_at;
    };

    const lancamentosPendentesHoje = (lancamentosPendentes || []).filter(item => {
      if (!lancamentoEhDoDiaOuSemData(item) || !lancamentoAtendeFiltroDiaSemana(item, hoje())) {
        return false;
      }
      if (lancamentoJaPossuiExecucaoAtiva(item)) return false;
      if (lancamentoFoiCriadoAposHorarioNoMesmoDia(item)) return false;
      const prazo = obterContextoPrazo(item.horario_limite, ANTECEDENCIA_ALERTA_CHECKLIST_MINUTOS);
      return (prazo.ativo && !prazo.vencido) || lancamentoRecemCriadoParaAlerta(item);
    });

    const lancamentosAtrasados = (lancamentosPendentes || []).filter(item => {
      if (!lancamentoEhDoDiaOuSemData(item) || !lancamentoAtendeFiltroDiaSemana(item, hoje())) {
        return false;
      }
      if (lancamentoJaPossuiExecucaoAtiva(item)) return false;
      if (lancamentoFoiCriadoAposHorarioNoMesmoDia(item)) return false;
      const prazo = obterContextoPrazo(item.horario_limite, ANTECEDENCIA_ALERTA_CHECKLIST_MINUTOS);
      return prazo.ativo && prazo.vencido;
    });

    const lancamentosAgendadosParaProximoCiclo = (lancamentosPendentes || []).filter(item => {
      if (!lancamentoEhDoDiaOuSemData(item) || !lancamentoAtendeFiltroDiaSemana(item, hoje())) {
        return false;
      }
      return lancamentoFoiCriadoAposHorarioNoMesmoDia(item);
    });

    lancamentosPendentesHoje.forEach(item => {
      if (!usuarioPodeVerNotificacaoChecklist()) return;

      const nomeFuncionario = funcionariosMap[String(item.funcionario_id)] || '';
      const nomeChecklist = checklistsMap[String(item.checklist_id)] || item.nome || 'Checklist';
      const horarioProgramado = horaCurta(item.horario_limite) || 'não informado';
      const dataProgramada = formatarDataNotificacaoLancamento(item);
      const resumoDataHora = montarResumoDataHoraNotificacao(dataProgramada, horarioProgramado);

      itens.push({
        chave: criarChaveAlerta('checklist_pendente', item.id),
        tipo: 'checklist_pendente',
        page: 'checklists',
        titulo: 'Checklist pendente aguardando início',
        descricao: `${nomeChecklist}${nomeFuncionario ? ' · Responsável: ' + nomeFuncionario : ''} · ${resumoDataHora}.`,
        meta: {
          nomeTarefa: nomeChecklist,
          nomeFuncionario: nomeFuncionario || 'Sem responsável',
          horarioProgramado,
          dataProgramada,
        },
      });
    });

    lancamentosAtrasados.forEach(item => {
      if (!usuarioPodeVerNotificacaoChecklist()) return;

      const prazo = obterContextoPrazo(item.horario_limite, ANTECEDENCIA_ALERTA_CHECKLIST_MINUTOS);
      const nomeFuncionario = funcionariosMap[String(item.funcionario_id)] || '';
      const nomeChecklist = checklistsMap[String(item.checklist_id)] || item.nome || 'Checklist';
      const horarioProgramado = horaCurta(item.horario_limite) || 'não informado';
      const dataProgramada = formatarDataNotificacaoLancamento(item);
      const resumoDataHora = montarResumoDataHoraNotificacao(dataProgramada, horarioProgramado);
      const titulo = prazo.vencido ? 'Checklist não iniciado após o prazo' : 'Checklist não iniciado e próximo do prazo';
      const descricao = prazo.vencido
        ? `${nomeChecklist} ainda não foi iniciado${nomeFuncionario ? ' por ' + nomeFuncionario : ''}. ${resumoDataHora}.`
        : `${nomeChecklist} ainda não foi iniciado${nomeFuncionario ? ' por ' + nomeFuncionario : ''}. Falta menos de 1 hora. ${resumoDataHora}.`;
      const mensagem = prazo.vencido
        ? `${nomeChecklist} ainda não foi iniciado${nomeFuncionario ? ' por ' + nomeFuncionario : ''}. ${resumoDataHora}.`
        : `${nomeChecklist} ainda não foi iniciado${nomeFuncionario ? ' por ' + nomeFuncionario : ''}. Falta menos de 1 hora. ${resumoDataHora}.`;
      const assunto = prazo.vencido
        ? `CHECK DIARIO: checklist não iniciado após o prazo - ${nomeChecklist}`
        : `CHECK DIARIO: checklist próximo do prazo sem início - ${nomeChecklist}`;

      itens.push({
        chave: criarChaveAlerta('lancamento_atrasado', item.id),
        tipo: 'lancamento_atrasado',
        page: 'checklists',
        titulo,
        descricao,
        meta: {
          nomeTarefa: nomeChecklist,
          nomeFuncionario: nomeFuncionario || 'Sem responsável',
          horarioProgramado,
          dataProgramada,
        },
      });

      if (cfg?.data?.enviar_email_lembrete) {
        alertasEmail.push({
          chaveUnica: criarChaveAlerta('lancamento_atrasado', item.id),
          tipo: 'lancamento_atrasado',
          assunto,
          mensagem,
          meta: {
            nome_checklist: nomeChecklist,
            nome_funcionario: nomeFuncionario || null,
            status_alerta: prazo.vencido ? 'nao_iniciado' : 'proximo_do_prazo',
            horario_programado: horarioProgramado,
            data_programada: dataProgramada,
          },
        });
      }
    });

    lancamentosAgendadosParaProximoCiclo.forEach(item => {
      if (!usuarioPodeVerNotificacaoChecklist()) return;

      const nomeFuncionario = funcionariosMap[String(item.funcionario_id)] || '';
      const nomeChecklist = checklistsMap[String(item.checklist_id)] || item.nome || 'Checklist';
      const horarioProgramado = horaCurta(item.horario_limite) || 'não informado';
      const dataProgramada = formatarDataNotificacaoLancamento(item);
      const resumoDataHora = montarResumoDataHoraNotificacao(dataProgramada, horarioProgramado);

      itens.push({
        chave: criarChaveAlerta('checklist_agendado', item.id),
        tipo: 'checklist_agendado',
        page: 'checklists',
        titulo: 'Nova tarefa agendada para o próximo ciclo',
        descricao: `${nomeChecklist}${nomeFuncionario ? ' · Responsável: ' + nomeFuncionario : ''} · ${resumoDataHora}. Hoje não gera alerta crítico.`,
        meta: {
          nomeTarefa: nomeChecklist,
          nomeFuncionario: nomeFuncionario || 'Sem responsável',
          horarioProgramado,
          dataProgramada,
        },
      });
    });

    const execucoesAtrasadas = (execucoesPendentes || []).filter(item => execucaoPrecisaLembreteFinalizacao(item));

    execucoesAtrasadas.forEach(item => {
      if (!usuarioPodeVerNotificacaoExecucao()) return;

      const inicioReferencia = obterInicioExecucaoParaLembrete(item);
      const tempoDecorrido = formatarDuracaoDecorrida(inicioReferencia);
      const nomeChecklist = checklistsMap[String(item.checklist_id)] || item.tarefas?.nome || 'Checklist';
      const nomeFuncionario = funcionariosMap[String(item.funcionario_id)] || '';
      const horarioProgramado = horaCurta(item.tarefas?.horario_limite || lancamentosExecucaoMap[String(item.lancamento_id)]?.horario_limite) || 'não informado';
      const pausada = item.status === 'pausado';
      const titulo = pausada ? 'Checklist pausado sem finalização' : 'Checklist aberto sem finalização';
      const descricao = pausada
        ? `${nomeChecklist} está pausado${nomeFuncionario ? ' por ' + nomeFuncionario : ''} há ${tempoDecorrido}. Horário previsto: ${horarioProgramado}.`
        : `${nomeChecklist} ainda não foi concluído${nomeFuncionario ? ' por ' + nomeFuncionario : ''}. Já se passaram ${tempoDecorrido} desde o início. Horário previsto: ${horarioProgramado}.`;
      const mensagem = pausada
        ? `${nomeChecklist} está pausado${nomeFuncionario ? ' por ' + nomeFuncionario : ''} há ${tempoDecorrido}. Horário previsto: ${horarioProgramado}.`
        : `${nomeChecklist} ainda não foi concluído${nomeFuncionario ? ' por ' + nomeFuncionario : ''}. Já se passaram ${tempoDecorrido} desde o início. Horário previsto: ${horarioProgramado}.`;

      itens.push({
        chave: criarChaveAlerta('execucao_atrasada', item.id),
        tipo: 'execucao_atrasada',
        page: 'execucoes',
        titulo,
        descricao,
        meta: {
          nomeTarefa: nomeChecklist,
          nomeFuncionario: nomeFuncionario || 'Sem responsável',
          horarioProgramado,
        },
      });

      if (cfg?.data?.enviar_email_lembrete) {
        alertasEmail.push({
          chaveUnica: criarChaveAlerta('execucao_atrasada', item.id),
          tipo: 'execucao_atrasada',
          assunto: `CHECK DIARIO: checklist após o prazo - ${nomeChecklist}`,
          mensagem,
          meta: {
            nome_checklist: nomeChecklist,
            nome_funcionario: nomeFuncionario || null,
            status_alerta: item.status === 'pausado' ? 'nao_concluido' : 'em_andamento_atrasado',
            horario_programado: horarioProgramado,
            inicio_execucao: inicioReferencia,
            tempo_decorrido: tempoDecorrido,
          },
        });
      }
    });

    const horarioLembrete = cfg?.data?.horario_lembrete_checklist || '';
    if (horarioLembrete && horaJaPassou(horarioLembrete)) {
      let pendentesChecklist = [];
      const consultaPendentesCompleta = await sb
        .from('checklist_lancamentos')
        .select('id, nome, dias_semana, status, lancado_em, created_at, data_programada')
        .eq('status', 'pendente');

      if (!consultaPendentesCompleta.error) {
        pendentesChecklist = consultaPendentesCompleta.data || [];
      } else {
        const mensagemErro = String(consultaPendentesCompleta.error?.message || '').toLowerCase();
        if (!mensagemErro.includes('created_at') && !mensagemErro.includes('data_programada')) throw consultaPendentesCompleta.error;

        const consultaPendentesFallback = await sb
          .from('checklist_lancamentos')
          .select('id, nome, dias_semana, status, lancado_em')
          .eq('status', 'pendente');
        if (consultaPendentesFallback.error) throw consultaPendentesFallback.error;
        pendentesChecklist = (consultaPendentesFallback.data || []).map(item => ({ ...item, created_at: null }));
      }

      const pendentesHoje = (pendentesChecklist || []).filter(c => lancamentoEhDoDiaOuSemData(c) && tarefaDisponivelHoje(c.dias_semana));
      if (pendentesHoje.length && usuarioPodeVerNotificacaoChecklist()) {
        itens.push({
          chave: criarChaveAlerta('lembrete_checklist', `pendentes-${pendentesHoje.length}`),
          tipo: 'lembrete_checklist',
          page: 'checklists',
          titulo: 'Lembrete de checklist',
          descricao: `${pendentesHoje.length} checklist(s) aguardando início. Lembrete configurado para ${horarioLembrete.slice(0, 5)}.${cfg?.data?.enviar_email_lembrete ? ' O envio por e-mail está ativado.' : ''}`,
        });

        if (cfg?.data?.enviar_email_lembrete) {
          alertasEmail.push({
            chaveUnica: criarChaveAlerta('lembrete_checklist', `pendentes-${pendentesHoje.length}`),
            tipo: 'lembrete_checklist',
            assunto: `CHECK DIARIO: ${pendentesHoje.length} checklist(s) aguardando inicio`,
            mensagem: `${pendentesHoje.length} checklist(s) aguardando início. Horário de lembrete: ${horaCurta(horarioLembrete)}.`,
            meta: {
              quantidade_pendentes: pendentesHoje.length,
              horario_lembrete: horarioLembrete,
              data_execucao: hoje(),
              checklist_ids: pendentesHoje.map(item => item.id),
            },
          });
        }
      }
    }

    if (alertasEmail.length) {
      const destinatariosResultado = await obterDestinatariosEmailAtivos();
      if (!destinatariosResultado.missing && destinatariosResultado.data.length) {
        await Promise.all(alertasEmail.map(alerta => registrarAlertaEmail(alerta, destinatariosResultado.data)));
        await processarFilaAlertasEmail();
      }
    }
  } catch (e) {}

  if (usuarioEhMasterNotificacoes()) {
    // Para evitar "notificações fantasmas", o master passa a exibir apenas
    // notificações efetivamente ativas no banco no momento da consulta.
    notificacoesHistoricoMaster = filtrarNotificacoesMasterDispensadas(itens).filter(item => !notificacaoFoiLimpaPeloUsuario(item));
    salvarHistoricoNotificacoesMaster(notificacoesHistoricoMaster);
    notificacoesAtuais = notificacoesHistoricoMaster;
  } else {
    notificacoesAtuais = itens.filter(item => !notificacaoFoiLimpaPeloUsuario(item));
  }
  atualizarBadgeTarefasAtraso(obterQuantidadeAtrasosNotificacao());
  renderizarListaNotificacoes();
  sincronizarAvisoNotificacoes();
}

// 
