  // SEGURANÇA: Credenciais hardcoded removidas. Autenticação via Supabase.
  const predefinedUsers = [];

  function setSistemaLogado(logado) {
    const loginScreen = document.getElementById('loginScreen');
    const shell = document.querySelector('.shell');
    if (!loginScreen || !shell) return;
    if (!logado) resetarTelaLoginParaEntrada();
    loginScreen.style.display = logado ? 'none' : 'flex';
    shell.style.display = logado ? 'flex' : 'none';
  }

  function resetarTelaLoginParaEntrada() {
    const fase1 = document.getElementById('loginFase1');
    const picker = document.getElementById('loginStorePicker');
    const solicitacao = document.getElementById('solicitacaoAcessoBox');
    const authBox = document.getElementById('authTokenBox');
    const authContent = document.getElementById('authTokenContent');
    const listaLojas = document.getElementById('loginStoreList');
    const buscaLoja = document.getElementById('loginStoreSearch');

    if (fase1) {
      fase1.style.display = '';
      fase1.classList.remove('saindo', 'entrando');
    }
    if (picker) picker.classList.remove('show', 'saindo', 'entrando');
    if (solicitacao) solicitacao.style.display = 'none';
    if (authBox) authBox.style.display = 'none';
    if (authContent) authContent.style.display = 'none';
    if (listaLojas) listaLojas.innerHTML = '';
    if (buscaLoja) buscaLoja.value = '';
    solicitacaoAcessoVisivel = false;
    window.__loginContextoPendente = null;
    window.__loginLojasPermitidasAtual = [];
    setMsg('msgLogin', '', '');
    setMsg('msgSolicitacaoAcesso', '', '');
    setMsg('msgAuthToken', '', '');
  }

  const topbarNomeLojaCache = new Map();

  function obterNomeLojaSessaoTopbar() {
    const lojaDireta = String(
      usuarioSistemaLogado?.loja_nome
      || usuarioSistemaLogado?.nome_loja
      || usuarioSistemaLogado?.loja_nome_exibicao
      || ''
    ).trim();
    if (lojaDireta) return lojaDireta;

    const nomeLojaConfiguracao = String(document.getElementById('configNomeLoja')?.value || '').trim();
    if (nomeLojaConfiguracao) return nomeLojaConfiguracao;

    return '';
  }

  async function resolverNomeLojaTopbarConfiguracoes() {
    try {
      const { data, error } = await sb
        .from('configuracoes_loja')
        .select('nome_loja')
        .limit(5);
      if (error) return '';
      const nome = (data || []).map(item => String(item?.nome_loja || '').trim()).find(Boolean);
      return nome || '';
    } catch (_) {
      return '';
    }
  }

  async function preencherNomeLojaTopbarPorId(lojaId = '') {
    const lojaNameEl = document.getElementById('topbar-store-name');
    const id = String(lojaId || '').trim();
    if (!lojaNameEl || !id) return '';

    if (topbarNomeLojaCache.has(id)) {
      const nomeCache = topbarNomeLojaCache.get(id) || '';
      lojaNameEl.textContent = nomeCache || '-';
      return nomeCache;
    }

    try {
      let nomeLoja = '';
      const consultaLojas = await sb
        .from('lojas')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!consultaLojas.error && consultaLojas.data) {
        const item = consultaLojas.data;
        nomeLoja = String(item.nome || item.nome_loja || item.descricao || item.codigo || '').trim();
      }

      if (!nomeLoja) {
        const consultaFiliais = await sb
          .from('filiais')
          .select('*')
          .eq('id', id)
          .maybeSingle();
        if (!consultaFiliais.error && consultaFiliais.data) {
          const item = consultaFiliais.data;
          nomeLoja = String(item.nome || item.nome_loja || item.descricao || item.codigo || '').trim();
        }
      }

      if (nomeLoja) {
        topbarNomeLojaCache.set(id, nomeLoja);
        if (String(usuarioSistemaLogado?.loja_id || '') === id) {
          lojaNameEl.textContent = nomeLoja;
        }
        return nomeLoja;
      }
    } catch (_) {
      // Mantém fallback silencioso para não poluir UX da topbar.
    }

    return '';
  }

  function atualizarUsuarioTopbar() {
      const container = document.getElementById('topbarUserInfo');
      const lojaContainer = document.getElementById('topbarStoreInfo');
    const nameEl = document.getElementById('topbar-user-name');
      const lojaNameEl = document.getElementById('topbar-store-name');
      if (!container || !lojaContainer || !nameEl || !lojaNameEl) return;

    if (!usuarioSistemaLogado) {
      container.hidden = true;
        lojaContainer.hidden = true;
      nameEl.textContent = '-';
        lojaNameEl.textContent = '-';
      return;
    }

    const nomeUsuario = usuarioSistemaLogado.tipo === 'admin'
      ? (usuarioSistemaLogado.username || 'Administrador')
      : (usuarioSistemaLogado.nome || usuarioSistemaLogado.username || 'Usuário');

    nameEl.textContent = nomeUsuario;
    
    // Admin global sem loja está no painel SaaS. Ao escolher uma loja, mantém
    // acesso global, mas a topbar deve mostrar a loja selecionada.
    if (contextoEhAdminGlobal()) {
      lojaNameEl.textContent = 'ADMINISTRAÇÃO GLOBAL';
      const lojaLabel = lojaContainer.querySelector('.topbar-user-label');
      if (lojaLabel) lojaLabel.textContent = 'CHECKDIÁRIO';
      const topbarStoreEl = document.getElementById('topbarStoreInfo');
      if (topbarStoreEl) topbarStoreEl.setAttribute('data-admin-mode', 'true');
      document.getElementById('topbarStoreSwitchBtn').style.display = obterLojasPermitidasSessao().length ? 'block' : 'none';
      document.getElementById('topbarStoreSwitchBtn').textContent = 'Entrar em loja';
      container.hidden = false;
      lojaContainer.hidden = false;
      container.style.display = 'flex';
      lojaContainer.style.display = 'inline-flex';
      return;
    }
    
    // Caso contrário, mostrar nome da loja
    lojaNameEl.textContent = obterNomeLojaSessaoTopbar() || '-';
    const topbarStoreEl = document.getElementById('topbarStoreInfo');
    if (topbarStoreEl) topbarStoreEl.removeAttribute('data-admin-mode');
    document.getElementById('topbarStoreSwitchBtn').style.display = 'block';
    document.getElementById('topbarStoreSwitchBtn').textContent = 'Trocar';
    const lojaLabel = lojaContainer.querySelector('.topbar-user-label');
    if (lojaLabel) lojaLabel.textContent = 'Loja logada';
    container.hidden = false;
    lojaContainer.hidden = false;
    container.style.display = 'flex';
    lojaContainer.style.display = 'inline-flex';

    const lojaId = String(usuarioSistemaLogado?.loja_id || '').trim();
    if (lojaId) {
      preencherNomeLojaTopbarPorId(lojaId).then(nome => {
        if (!nome && lojaNameEl.textContent === '-') lojaNameEl.textContent = 'Loja vinculada';
      });
      return;
    }

    if (lojaNameEl.textContent === '-') {
      resolverNomeLojaTopbarConfiguracoes().then(nome => {
        if (nome) lojaNameEl.textContent = nome;
      });
    }
  }

function obterPreferenciasLoginSalvas() {
  const chaves = ['zuqui_login_prefs', 'check_diario_login_prefs'];
  try {
    const bruto = chaves.map(chave => localStorage.getItem(chave) || sessionStorage.getItem(chave)).find(Boolean);
    const preferencias = bruto ? JSON.parse(bruto) : {};
    if (Object.prototype.hasOwnProperty.call(preferencias, 'password')) {
      delete preferencias.password;
      const seguro = JSON.stringify(preferencias);
      chaves.forEach(chave => {
        localStorage.setItem(chave, seguro);
        sessionStorage.setItem(chave, seguro);
      });
    }
    return preferencias;
  } catch (error) {
    chaves.forEach(chave => {
      localStorage.removeItem(chave);
      sessionStorage.removeItem(chave);
    });
    return {};
  }
}

function salvarPreferenciasLogin({ username = '', password = '', salvarSenha = false, manterConectado = false } = {}) {
  const emailNormalizado = String(username || '').trim().toLowerCase();
  const payload = {
    salvarSenha: !!salvarSenha || !!manterConectado,
    manterConectado: !!manterConectado,
    username: (salvarSenha || manterConectado) ? emailNormalizado : '',
  };
  const bruto = JSON.stringify(payload);
  ['zuqui_login_prefs', 'check_diario_login_prefs'].forEach(chave => {
    localStorage.setItem(chave, bruto);
    sessionStorage.setItem(chave, bruto);
  });
}

function obterSessaoPersistenteLoginSalva() {
  const chaves = ['zuqui_auth', 'check_diario_auth_persistente'];
  for (const chave of chaves) {
    try {
      const bruto = localStorage.getItem(chave);
      if (!bruto) continue;
      const sessao = JSON.parse(bruto);
      if (sessao && (sessao.id || sessao.email || sessao.username || sessao.nome)) return sessao;
    } catch (_) {}
  }
  return null;
}

function loginDigitadoConfereComSessaoPersistente(username = '') {
  const sessao = obterSessaoPersistenteLoginSalva();
  if (!sessao) return false;
  const digitado = String(username || '').trim().toLowerCase();
  if (!digitado) return true;
  const candidatos = [sessao.email, sessao.username, sessao.usuario, sessao.nome]
    .map(v => String(v || '').trim().toLowerCase())
    .filter(Boolean);
  return candidatos.includes(digitado);
}

function limparDadosVisuaisDaSessao(mensagem = 'Carregando dados da loja...') {
  if (typeof resetTenantScopedUI === 'function') resetTenantScopedUI('session-or-store-change');
  versaoSessaoSistema += 1;
  tokenRequisicaoChecklists += 1;
  assinaturaRenderChecklists = '';
  notificacoesAtuais = [];
  notificacoesHistoricoMaster = [];
  relatorioLancamentosCache = [];
  relatorioRecebimentosCache = [];
  relatorioPontoFuncionarioCache = {};
  window.__relatorioPontoUltimosRows = [];
  window.__relatorioPontoUltimoPeriodo = '';
  if (typeof limparDashboardFinanceiroTenant === 'function') limparDashboardFinanceiroTenant(mensagem);

  const placeholders = {
    listaChecklists: mensagem,
    listaTarefas: mensagem,
    listaTarefasRapidas: mensagem,
    listaTarefasAtrasoMaster: mensagem,
    listaExecucoes: mensagem,
    listaRelatorioLancamentos: mensagem,
    listaRelatorioPonto: mensagem,
    listaPontoAjustes: mensagem,
    listaFuncionarios: mensagem,
    listaSolicitacoesAcesso: mensagem,
    listaFornecedoresFinanceiro: mensagem,
    listaFormasPagamentoFinanceiro: mensagem,
    listaContasAPagarFinanceiro: mensagem,
    listaRecebiveisFinanceiro: mensagem,
    listaContasFinanceiras: mensagem,
    listaExtratoContaFinanceira: mensagem,
    listaRelatorioFinanceiro: mensagem,
    listaRelatorioRecebimentos: mensagem,
    listaRelatorioAjusteSaldo: mensagem,
    notificacoesLista: 'Nenhuma notificação carregada.',
  };
  dashboardHorasRequestSeq += 1;
  dashboardHorasUltimoResultadoValido = null;

  Object.entries(placeholders).forEach(([id, texto]) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = `<div class="empty">${escaparHtmlBasico(texto)}</div>`;
  });

  const badge = document.getElementById('notificationBadge');
  if (badge) {
    badge.hidden = true;
    badge.textContent = '';
  }
  atualizarBadgeTarefasAtraso(0);
}

registrarResetTenantUI(() => {
  // Estados de edição dos demais módulos operacionais. Cada limpeza é local e
  // idempotente; a autoridade final continua sendo a RLS do novo contexto.
  const cleaners = [
    'limparFormularioTarefa','limparFormularioPerfil','limparFormularioFornecedorFinanceiro',
    'limparFormularioFormaPagamentoFinanceiro','limparFormularioContaFinanceira',
    'limparFormularioRecebivelFinanceiro','limparFormularioContaAPagarFinanceiro',
    'cancelarEdicaoIntegracaoRaffinato','cancelarConsultaSangriasRaffinato',
  ];
  cleaners.forEach(nome => { try { if (typeof window[nome] === 'function') window[nome](); } catch (_) {} });
  try { if (typeof tarefaEmEdicaoId !== 'undefined') tarefaEmEdicaoId=null; } catch (_) {}
  try { if (typeof checklistReferenciaEmEdicaoId !== 'undefined') checklistReferenciaEmEdicaoId=null; } catch (_) {}
  try { if (typeof perfilEmEdicaoId !== 'undefined') perfilEmEdicaoId=null; } catch (_) {}
  try { if (typeof fornecedorFinanceiroEmEdicaoId !== 'undefined') fornecedorFinanceiroEmEdicaoId=null; } catch (_) {}
  try { if (typeof formaPagamentoFinanceiroEmEdicaoId !== 'undefined') formaPagamentoFinanceiroEmEdicaoId=null; } catch (_) {}
  try { if (typeof contaAPagarFinanceiroEmEdicaoId !== 'undefined') contaAPagarFinanceiroEmEdicaoId=null; } catch (_) {}
  try { if (typeof contaFinanceiraEmEdicaoId !== 'undefined') contaFinanceiraEmEdicaoId=null; } catch (_) {}
  try { if (typeof recebivelFinanceiroEmEdicaoId !== 'undefined') recebivelFinanceiroEmEdicaoId=null; } catch (_) {}
  document.querySelectorAll('.overlay.open,[data-tenant-scoped-modal].open').forEach(el=>el.classList.remove('open'));
});

function restaurarPreferenciasLogin() {
  const prefs = obterPreferenciasLoginSalvas();
  const user = document.getElementById('username');
  const pass = document.getElementById('password');
  const save = document.getElementById('savePassword');
  const keep = document.getElementById('keepLoggedIn');

  const temSessaoPersistente = !!obterSessaoPersistenteLoginSalva();
  if (save) save.checked = !!prefs.salvarSenha || temSessaoPersistente;
  if (keep) keep.checked = !!prefs.manterConectado || temSessaoPersistente;
  if ((prefs.salvarSenha || prefs.manterConectado || temSessaoPersistente) && user) {
    const sessao = obterSessaoPersistenteLoginSalva();
    user.value = String(prefs.username || sessao?.email || sessao?.username || '').trim();
  }
  if (pass) pass.value = '';
}

function sincronizarPreferenciasLoginDaTela() {
  const user = document.getElementById('username');
  const pass = document.getElementById('password');
  const save = document.getElementById('savePassword');
  const keep = document.getElementById('keepLoggedIn');
  salvarPreferenciasLogin({
    username: user?.value || '',
    password: pass?.value || '',
    salvarSenha: save?.checked === true,
    manterConectado: keep?.checked === true,
  });
}

function atualizarPreferenciaSalvarSenhaLogin() {
  const pass = document.getElementById('password');
  const save = document.getElementById('savePassword');
  if (!save?.checked && pass) pass.value = '';
  sincronizarPreferenciasLoginDaTela();
}

function configurarPreferenciasLoginTela() {
  const user = document.getElementById('username');
  const pass = document.getElementById('password');
  const save = document.getElementById('savePassword');
  const keep = document.getElementById('keepLoggedIn');

  save?.addEventListener('change', atualizarPreferenciaSalvarSenhaLogin);
  keep?.addEventListener('change', sincronizarPreferenciasLoginDaTela);
  document.querySelector('label[for="savePassword"]')?.addEventListener('click', () => {
    window.setTimeout(atualizarPreferenciaSalvarSenhaLogin, 0);
  });
  document.querySelector('label[for="keepLoggedIn"]')?.addEventListener('click', () => {
    window.setTimeout(sincronizarPreferenciasLoginDaTela, 0);
  });
  user?.addEventListener('input', () => {
    if (save?.checked) sincronizarPreferenciasLoginDaTela();
  });
  pass?.addEventListener('input', () => {
    if (save?.checked) sincronizarPreferenciasLoginDaTela();
  });
  window.addEventListener('beforeunload', sincronizarPreferenciasLoginDaTela);
}

function salvarSessaoSistema(usuario, { manterConectado = false } = {}) {
  const modo = usuario?.context_mode === 'global_admin' ? 'global_admin' : 'store';
  const usuarioNormalizado = {
    ...usuario,
    context_mode: modo,
    ...(modo === 'global_admin' ? { empresa_id:null, loja_id:null, empresa_nome:null, loja_nome:null } : {}),
    perfil: normalizarPerfilUsuario(usuario?.perfil),
  };
  usuarioSistemaLogado = usuarioNormalizado;
  window.usuarioSistemaLogado = usuarioSistemaLogado;
  window.__sessaoSistema = () => usuarioSistemaLogado;
  limparDadosVisuaisDaSessao('Carregando dados da loja...');
  redefinirEstadoAvisoCentralTarefas();
  atualizarUsuarioTopbar();
  habilitarSomNotificacao();
  const payload = JSON.stringify(usuarioNormalizado);
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
  const chk = document.getElementById('keepLoggedIn');
  if (chk) chk.checked = !!manterConectado;
  reiniciarAssinaturaRealtimeNotificacoes();
  aplicarEmpresaRLS();
}

  async function validarAutoridadeAdminSistemaNoBanco(usuario = null) {
    if (usuario?.tipo !== 'admin') return true;
    const funcionarioId = String(usuario?.id || '').trim();
    const token = String(usuario?.global_admin_token || '').trim();
    if (!funcionarioId || !token) return false;
    try {
      const { data, error } = await sb.rpc('validar_sessao_admin_global', { p_funcionario_id:funcionarioId, p_token:token });
      if (error) {
        console.warn('Não foi possível revalidar o administrador do sistema:', error);
        return null;
      }
      // Ausência temporária por RLS, renovação de sessão ou retomada da aba
      // não significa revogação. Só retorna false quando o banco devolve o
      // cadastro explicitamente inativo ou sem a permissão administrativa.
      return data === true;
    } catch (erro) {
      console.warn('Não foi possível revalidar o administrador do sistema:', erro);
      return null;
    }
  }

  async function revalidarSessaoFuncionarioNoBanco(usuario = null) {
    if (!usuario || usuario.tipo !== 'funcionario') return usuario;

    const funcionarioId = String(usuario.id || '').trim();
    const lojaId = String(usuario.loja_id || '').trim();
    if (!funcionarioId || !lojaId) {
      throw new Error('A sessão não possui funcionário e loja válidos.');
    }

    const funcionarioRes = await executarSemFiltrosTenantTemporario(() => sb
      .from('funcionarios')
      .select('id, nome, email, ativo, perfil_id, loja_id, empresa_id, é_administrador')
      .eq('id', funcionarioId)
      .maybeSingle());
    if (funcionarioRes.error) throw funcionarioRes.error;
    const funcionario = funcionarioRes.data;
    if (!funcionario?.id || funcionario.ativo === false) {
      throw new Error('O funcionário desta sessão não existe ou está inativo.');
    }

    const vinculoRes = await executarSemFiltrosTenantTemporario(() => sb
      .from('funcionario_lojas')
      .select('loja_id, perfil_id, ativo')
      .eq('funcionario_id', funcionarioId)
      .eq('loja_id', lojaId)
      .eq('ativo', true)
      .maybeSingle());
    if (vinculoRes.error) throw vinculoRes.error;
    if (!vinculoRes.data?.perfil_id) {
      throw new Error('O funcionário não possui vínculo ativo com esta loja.');
    }

    const perfilRes = await executarSemFiltrosTenantTemporario(() => sb
      .from('perfis')
      .select('id, nome, codigo, permissoes, loja_id, empresa_id')
      .eq('id', vinculoRes.data.perfil_id)
      .eq('loja_id', lojaId)
      .maybeSingle());
    if (perfilRes.error) throw perfilRes.error;
    if (!perfilRes.data?.id) {
      throw new Error('O perfil vinculado ao funcionário não pertence à loja atual.');
    }

    const ehAdminSistema = funcionario.é_administrador === true;
    return {
      ...usuario,
      tipo: ehAdminSistema ? 'admin' : 'funcionario',
      id: funcionario.id,
      nome: funcionario.nome,
      email: funcionario.email || '',
      username: funcionario.email || funcionario.nome || usuario.username || '',
      é_administrador: ehAdminSistema,
      perfil_id: perfilRes.data.id,
      empresa_id: perfilRes.data.empresa_id || funcionario.empresa_id || usuario.empresa_id || null,
      loja_id: lojaId,
      perfil: normalizarPerfilUsuario(perfilRes.data),
    };
  }

  async function renovarContextoOperacionalPersistido(usuario = null) {
    if (!usuario || usuario.context_mode === 'global_admin') return true;
    const principalId = String(usuario.id || '').trim();
    const token = String(usuario.operational_access_token || '').trim();
    const empresaId = String(usuario.empresa_id || '').trim();
    const lojaId = String(usuario.loja_id || '').trim();
    if (!principalId || !token || !empresaId || !lojaId) return false;
    const { data, error } = await sb.rpc('renovar_contexto_operacional', {
      p_principal_id: principalId,
      p_token: token,
      p_empresa_id: empresaId,
      p_loja_id: lojaId,
      p_global_token: String(usuario.global_admin_token || '').trim() || null,
    });
    if (error) throw error;
    return data === true;
  }

  async function restaurarSessaoSistema() {
    const salvoLocal = localStorage.getItem('zuqui_auth');
    const salvoLocalBackup = localStorage.getItem('check_diario_auth_persistente');
    const salvoSessao = sessionStorage.getItem('zuqui_auth') || sessionStorage.getItem('check_diario_auth_persistente');
    const salvo = salvoLocal || salvoLocalBackup || salvoSessao;

    if (!salvo) {
      limparDadosVisuaisDaSessao('Aguardando login...');
      usuarioSistemaLogado = null;
      window.usuarioSistemaLogado = null;
      atualizarUsuarioTopbar();
      setSistemaLogado(false);
      document.documentElement.classList.remove('admin-fouc-pendente');
      return false;
    }

    try {
      let usuario = JSON.parse(salvo);
      if (usuario?.context_mode !== 'global_admin' && !(await renovarContextoOperacionalPersistido(usuario))) {
        throw new Error('A sessão operacional salva expirou ou perdeu o vínculo com a loja.');
      }
      const autoridadeAdmin = await validarAutoridadeAdminSistemaNoBanco(usuario);
      if (usuario?.tipo === 'admin' && autoridadeAdmin === false) {
        throw new Error('A autorização de administrador do sistema foi revogada.');
      }
      usuario = await revalidarSessaoFuncionarioNoBanco(usuario);
      usuarioSistemaLogado = {
        ...usuario,
        context_mode: usuario.context_mode === 'global_admin' ? 'global_admin' : 'store',
        global_admin_authorized: usuario.tipo === 'admin' ? autoridadeAdmin === true : false,
        ...(usuario.context_mode === 'global_admin' ? { empresa_id:null, loja_id:null, empresa_nome:null, loja_nome:null } : {}),
        perfil: normalizarPerfilUsuario(usuario?.perfil),
      };
      window.usuarioSistemaLogado = usuarioSistemaLogado;
      window.__sessaoSistema = () => usuarioSistemaLogado;
      limparDadosVisuaisDaSessao('Carregando dados da loja...');
      redefinirEstadoAvisoCentralTarefas();
      atualizarUsuarioTopbar();
      habilitarSomNotificacao();
      const chk = document.getElementById('keepLoggedIn');
      if (chk) chk.checked = !!(salvoLocal || salvoLocalBackup);
      persistirSessaoSistemaAtual(!!(salvoLocal || salvoLocalBackup));
      setSistemaLogado(true);
      aplicarPermissoesSistema();
      carregarNotificacoes();
      // Carregar ordem do menu ANTES de abrir a primeira página
      Promise.all([carregarOrdemNavMenu(), carregarTemaInterface()]).then(() => {
        restaurarPaginaAtivaSalvaOuPadrao();
      });
      reiniciarAssinaturaRealtimeNotificacoes();
      aplicarEmpresaRLS();
      if (usuarioSistemaLogado?.tipo === 'admin_loja') {
        atualizarSessaoAdminLojaComPerfilCorreto(!!salvoLocal);
      }
      return !!usuario;
    } catch (e) {
      localStorage.removeItem('zuqui_auth');
      localStorage.removeItem('check_diario_auth_persistente');
      sessionStorage.removeItem('zuqui_auth');
      sessionStorage.removeItem('check_diario_auth_persistente');
      limparDadosVisuaisDaSessao('Aguardando login...');
      usuarioSistemaLogado = null;
      window.usuarioSistemaLogado = null;
      atualizarUsuarioTopbar();
      setSistemaLogado(false);
      document.documentElement.classList.remove('admin-fouc-pendente');
      console.warn('Sessão encerrada durante a revalidação de segurança:', e);
      return false;
    }
  }

  let revalidacaoSessaoSistemaEmAndamento = false;
  async function revalidarSessaoSistemaAtiva() {
    if (revalidacaoSessaoSistemaEmAndamento || !usuarioSistemaLogado) return;
    revalidacaoSessaoSistemaEmAndamento = true;
    try {
      if (usuarioSistemaLogado.tipo === 'admin') {
        const autorizado = await validarAutoridadeAdminSistemaNoBanco(usuarioSistemaLogado);
        if (autorizado === false) {
          await logout();
          setMsg('msgLogin', 'A autorização de administrador do sistema foi revogada. Entre novamente.', 'err');
          return;
        }
        if (usuarioSistemaLogado.context_mode === 'global_admin') return;
      }

      const manterConectado = !!(localStorage.getItem('zuqui_auth') || localStorage.getItem('check_diario_auth_persistente'));
      if (!(await renovarContextoOperacionalPersistido(usuarioSistemaLogado))) {
        throw new Error('A sessão operacional não pôde ser renovada para esta loja.');
      }
      if (usuarioSistemaLogado.tipo !== 'funcionario') {
        persistirSessaoSistemaAtual(manterConectado);
        return;
      }
      usuarioSistemaLogado = await revalidarSessaoFuncionarioNoBanco(usuarioSistemaLogado);
      window.usuarioSistemaLogado = usuarioSistemaLogado;
      window.__sessaoSistema = () => usuarioSistemaLogado;
      persistirSessaoSistemaAtual(manterConectado);
      atualizarUsuarioTopbar();
      aplicarPermissoesSistema();
    } catch (erro) {
      const manterConectado = !!(localStorage.getItem('zuqui_auth') || localStorage.getItem('check_diario_auth_persistente'));
      console.warn('A sessão não pôde ser revalidada agora:', erro);
      if (manterConectado) {
        // Em celular/Safari a aba pode voltar sem rede ou com consulta temporariamente bloqueada por RLS.
        // Mantém a sessão local para não obrigar o usuário a digitar senha toda hora.
        persistirSessaoSistemaAtual(true);
        return;
      }
      await logout();
      setMsg('msgLogin', 'Seu acesso ou perfil foi alterado. Entre novamente.', 'err');
    } finally {
      revalidacaoSessaoSistemaEmAndamento = false;
    }
  }
  window.setInterval(revalidarSessaoSistemaAtiva, 60000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') revalidarSessaoSistemaAtiva();
  });

  async function logout() {
    localStorage.removeItem('zuqui_auth');
    localStorage.removeItem('check_diario_auth_persistente');
    sessionStorage.removeItem('zuqui_auth');
    sessionStorage.removeItem('check_diario_auth_persistente');
    salvarSilenciamentoAlertasCriticosDaSessao(false);
    limparDadosVisuaisDaSessao('Aguardando login...');
    usuarioSistemaLogado = null;
    window.usuarioSistemaLogado = null;
    atualizarUsuarioTopbar();
    redefinirEstadoAvisoCentralTarefas();
    const banner = document.getElementById('overdueAlertBanner');
    if (banner) banner.hidden = true;
    const user = document.getElementById('username');
    const pass = document.getElementById('password');
    const save = document.getElementById('savePassword');
    const chk = document.getElementById('keepLoggedIn');
    const prefs = obterPreferenciasLoginSalvas();
    if (prefs.salvarSenha) {
      if (user) user.value = String(prefs.username || '');
    } else {
      if (user) user.value = '';
    }
    if (pass) pass.value = '';
    if (save) save.checked = !!prefs.salvarSenha;
    if (chk) chk.checked = !!prefs.manterConectado;
    document.querySelectorAll('.nav-btn[data-page]').forEach(btn => { btn.style.display = ''; });
    setSistemaLogado(false);
    reiniciarAssinaturaRealtimeNotificacoes();
  }

  function toggleSolicitacaoAcesso() {
    solicitacaoAcessoVisivel = !solicitacaoAcessoVisivel;
    const box = document.getElementById('solicitacaoAcessoBox');
    if (box) box.style.display = solicitacaoAcessoVisivel ? 'block' : 'none';
    if (!solicitacaoAcessoVisivel) {
      setMsg('msgSolicitacaoAcesso', '', '');
    }
  }

  function configurarPainelAutenticacaoEmail({
    visivel = false,
    titulo = 'Autenticação por e-mail',
    mensagem = '',
    tipoMensagem = '',
    mostrarCamposSenha = false,
  } = {}) {
    const box = document.getElementById('authTokenBox');
    const title = document.getElementById('authTokenTitle');
    const content = document.getElementById('authTokenContent');
    const senha = document.getElementById('novaSenhaToken');
    const confirmar = document.getElementById('confirmarNovaSenhaToken');
    const button = content?.querySelector('button');

    if (!box || !title || !content || !senha || !confirmar || !button) return;

    box.style.display = visivel ? 'block' : 'none';
    title.textContent = titulo;
    content.style.display = visivel ? 'flex' : 'none';
    senha.style.display = mostrarCamposSenha ? '' : 'none';
    confirmar.style.display = mostrarCamposSenha ? '' : 'none';
    button.style.display = mostrarCamposSenha ? '' : 'none';
    setMsg('msgAuthToken', mensagem, tipoMensagem);
  }

  async function processarFluxoAutenticacaoPorToken() {
    const { action, token } = obterContextoTokenAutenticacao();
    const box = document.getElementById('authTokenBox');
    const title = document.getElementById('authTokenTitle');
    const content = document.getElementById('authTokenContent');
    const msg = document.getElementById('msgAuthToken');
    const senha = document.getElementById('novaSenhaToken');
    const confirmar = document.getElementById('confirmarNovaSenhaToken');

    if (!box || !title || !content || !msg || !senha || !confirmar) return;

    configurarPainelAutenticacaoEmail({ visivel: false, titulo: 'Autenticação por e-mail', mensagem: '', tipoMensagem: '', mostrarCamposSenha: false });

    if (!token || !action) return;

    if (action === 'verify_email') {
      if (tokenAutenticacaoEmProcessamento) return;
      tokenAutenticacaoEmProcessamento = true;
      configurarPainelAutenticacaoEmail({
        visivel: true,
        titulo: 'Validando e-mail',
        mensagem: 'Confirmando seu e-mail...',
        tipoMensagem: '',
        mostrarCamposSenha: false,
      });

      try {
        const confirmacaoEmail = await chamarFuncaoAutenticacao({
          action: 'consume_token',
          token,
          tokenType: 'verificacao_email',
        });
        if (confirmacaoEmail?.email) {
          await chamarFuncaoAutenticacao({
            action: 'send_password_reset',
            email: confirmacaoEmail.email,
            redirectUrl: obterUrlBaseAutenticacao(),
          });
        }
        configurarPainelAutenticacaoEmail({
          visivel: true,
          titulo: 'E-mail validado',
          mensagem: 'E-mail validado. Enviamos um segundo link para você criar sua senha de acesso.',
          tipoMensagem: 'ok',
          mostrarCamposSenha: false,
        });
        setMsg('msgLogin', 'E-mail validado com sucesso.', 'ok');
        limparContextoTokenAutenticacao();
      } catch (error) {
        configurarPainelAutenticacaoEmail({
          visivel: true,
          titulo: 'Falha na validação',
          mensagem: error.message || 'Não foi possível validar o e-mail.',
          tipoMensagem: 'err',
          mostrarCamposSenha: false,
        });
      } finally {
        tokenAutenticacaoEmProcessamento = false;
      }
      return;
    }

    if (action === 'reset_password') {
      configurarPainelAutenticacaoEmail({
        visivel: true,
        titulo: 'Definir nova senha',
        mensagem: 'Informe a nova senha para concluir a recuperação.',
        tipoMensagem: '',
        mostrarCamposSenha: true,
      });
    }
  }

  async function salvarNovaSenhaComToken() {
    const { action, token } = obterContextoTokenAutenticacao();
    const novaSenha = document.getElementById('novaSenhaToken')?.value.trim() || '';
    const confirmarSenha = document.getElementById('confirmarNovaSenhaToken')?.value.trim() || '';

    if (action !== 'reset_password' || !token) {
      setMsg('msgAuthToken', 'Link de recuperação inválido.', 'err');
      return;
    }
    if (!novaSenha || novaSenha.length < 8) {
      setMsg('msgAuthToken', 'A nova senha deve ter pelo menos 8 caracteres.', 'err');
      return;
    }
    if (novaSenha !== confirmarSenha) {
      setMsg('msgAuthToken', 'A confirmação da senha não confere.', 'err');
      return;
    }

    try {
      await chamarFuncaoAutenticacao({
        action: 'consume_token',
        token,
        tokenType: 'reset_senha',
        newPassword: novaSenha,
      });
      document.getElementById('novaSenhaToken').value = '';
      document.getElementById('confirmarNovaSenhaToken').value = '';
      configurarPainelAutenticacaoEmail({
        visivel: true,
        titulo: 'Senha atualizada',
        mensagem: 'Senha atualizada. Entre usando seu e-mail e a nova senha.',
        tipoMensagem: 'ok',
        mostrarCamposSenha: false,
      });
      setMsg('msgLogin', 'Senha atualizada com sucesso.', 'ok');
      limparContextoTokenAutenticacao();
    } catch (error) {
      configurarPainelAutenticacaoEmail({
        visivel: true,
        titulo: 'Falha ao redefinir senha',
        mensagem: error.message || 'Não foi possível redefinir a senha.',
        tipoMensagem: 'err',
        mostrarCamposSenha: true,
      });
    }
  }

  async function solicitarAcesso() {
    const nome = document.getElementById('solicitacaoNome')?.value.trim();
    const email = document.getElementById('solicitacaoEmail')?.value.trim().toLowerCase();
    const telefone = document.getElementById('solicitacaoTelefone')?.value.trim() || '';
    const empresaInformada = document.getElementById('solicitacaoEmpresa')?.value.trim() || '';
    const lojaInformada = document.getElementById('solicitacaoLoja')?.value.trim() || '';
    const cnpj = String(document.getElementById('solicitacaoCnpj')?.value || '').replace(/\D/g, '');
    const observacao = document.getElementById('solicitacaoObservacao')?.value.trim() || '';

    if (!nome) {
      setMsg('msgSolicitacaoAcesso', 'Informe seu nome.', 'err');
      return;
    }
    if (!nomePareceCompleto(nome)) {
      setMsg('msgSolicitacaoAcesso', 'Informe um nome com pelo menos 4 caracteres para solicitar acesso.', 'err');
      return;
    }
    if (!email) {
      setMsg('msgSolicitacaoAcesso', 'Informe seu e-mail.', 'err');
      return;
    }
    if (!emailPareceValido(email)) {
      setMsg('msgSolicitacaoAcesso', 'Informe um e-mail valido e real para solicitar acesso.', 'err');
      return;
    }
    if (!empresaInformada) {
      setMsg('msgSolicitacaoAcesso', 'Informe a empresa.', 'err');
      return;
    }
    if (!lojaInformada) {
      setMsg('msgSolicitacaoAcesso', 'Informe a loja ou unidade.', 'err');
      return;
    }
    if (cnpj && cnpj.length !== 14) {
      setMsg('msgSolicitacaoAcesso', 'O CNPJ deve ter 14 números.', 'err');
      return;
    }
    const { data: resultado, error } = await sb.rpc('solicitar_acesso_pendente', {
      p_nome: nome,
      p_email: email,
      p_telefone: telefone || null,
      p_empresa_informada: empresaInformada,
      p_loja_informada: lojaInformada,
      p_cnpj: cnpj || null,
      p_observacao: observacao || null,
    });

    if (error) {
      if (isMissingAccessRequestsTableError(error)) {
        setMsg('msgSolicitacaoAcesso', 'Rode o SQL da tabela solicitacoes_acesso antes de usar este fluxo.', 'err');
        return;
      }
      console.error('Erro ao enviar solicitação de acesso:', error);
      const detalhe = mensagemErroSupabase(error, '');
      const detalheLower = String(detalhe || '').toLowerCase();
      // Mensagens mais claras para as causas mais comuns desse insert público.
      if (detalheLower.includes('row-level security') || detalheLower.includes('rls') || String(error.code || '') === '42501') {
        setMsg('msgSolicitacaoAcesso', 'O banco está bloqueando o envio (política de segurança/RLS na tabela solicitacoes_acesso). Habilite a policy de INSERT público para esta tabela no Supabase.', 'err');
        return;
      }
      setMsg('msgSolicitacaoAcesso', `Não foi possível enviar sua solicitação${detalhe ? `: ${detalhe}` : '.'}`, 'err');
      return;
    }

    if (!resultado?.ok) {
      const mensagens = {
          dados_invalidos: 'Confira os dados informados e tente novamente.',
      };
      setMsg('msgSolicitacaoAcesso', mensagens[resultado?.codigo] || 'Não foi possível enviar sua solicitação.', 'err');
      return;
    }

      document.getElementById('solicitacaoNome').value = '';
      document.getElementById('solicitacaoEmail').value = '';
      document.getElementById('solicitacaoTelefone').value = '';
      document.getElementById('solicitacaoEmpresa').value = '';
      document.getElementById('solicitacaoLoja').value = '';
    document.getElementById('solicitacaoCnpj').value = '';
    document.getElementById('solicitacaoObservacao').value = '';
    setMsg('msgSolicitacaoAcesso', 'Solicitação enviada. Aguarde a aprovação de um administrador.', 'ok');
  }

  async function recuperarSenha() {
    const login = document.getElementById('username')?.value.trim();
    if (!login) {
      setMsg('msgLogin', 'Informe o nome ou e-mail para iniciar a recuperação de senha.', 'err');
      return;
    }
    try {
      const { funcionario, erro, motivo } = await localizarFuncionarioPorLoginParaEmail(login);
      if (erro) throw erro;
      if (motivo === 'ambiguo') {
        setMsg('msgLogin', 'Encontramos mais de um funcionário com esse nome. Informe o e-mail cadastrado.', 'err');
        return;
      }
      if (!funcionario) {
        setMsg('msgLogin', 'Não localizamos funcionário ativo com esse nome ou e-mail.', 'err');
        return;
      }
      const emailFuncionario = String(funcionario.email || '').trim().toLowerCase();
      if (!emailFuncionario || !emailPareceValido(emailFuncionario)) {
        setMsg('msgLogin', 'Não existe e-mail cadastrado. Cadastre um e-mail ou, caso já possua cadastro, solicite ao administrador.', 'err');
        return;
      }
      await chamarFuncaoAutenticacao({
        action: 'send_password_reset',
        email: emailFuncionario,
        redirectUrl: obterUrlBaseAutenticacao(),
      });
      setMsg('msgLogin', `Enviamos o link de autorização de troca de senha para ${emailFuncionario}.`, 'ok');
    } catch (error) {
      setMsg('msgLogin', error.message || 'Não foi possível enviar o link de recuperação.', 'err');
    }
  }

  async function reenviarVerificacaoEmail() {
    const login = document.getElementById('username')?.value.trim();
    if (!login) {
      setMsg('msgLogin', 'Informe o nome ou e-mail para reenviar a verificação.', 'err');
      return;
    }
    try {
      const { funcionario, erro, motivo } = await localizarFuncionarioPorLoginParaEmail(login);
      if (erro) throw erro;
      if (motivo === 'ambiguo') {
        setMsg('msgLogin', 'Encontramos mais de um funcionário com esse nome. Informe o e-mail cadastrado.', 'err');
        return;
      }
      if (!funcionario) {
        setMsg('msgLogin', 'Não localizamos funcionário ativo com esse nome ou e-mail.', 'err');
        return;
      }
      const emailFuncionario = String(funcionario.email || '').trim().toLowerCase();
      if (!emailFuncionario || !emailPareceValido(emailFuncionario)) {
        setMsg('msgLogin', 'Usuário localizado, mas não há e-mail válido cadastrado para reenviar a verificação.', 'err');
        return;
      }
      await enviarVerificacaoEmailFuncionario(emailFuncionario);
      setMsg('msgLogin', `Enviamos um novo link de verificação para ${emailFuncionario}.`, 'ok');
    } catch (error) {
      setMsg('msgLogin', error.message || 'Não foi possível reenviar a verificação.', 'err');
    }
  }


  window.__loginContextoPendente = null;
  window.__loginLojasPermitidasAtual = [];

  function normalizarLojaLogin(loja) {
    if (!loja) return null;
    const id = String(loja.id || loja.loja_id || '').trim();
    if (!id) return null;
    const nome = String(loja.nome || loja.nome_loja || loja.descricao || loja.codigo || loja.slug || 'Loja').trim() || 'Loja';
    return {
      ...loja,
      id,
      nome,
      codigo: String(loja.codigo || loja.slug || '').trim(),
      empresa_id: loja.empresa_id || null,
      ativo: loja.ativo !== false
    };
  }

  async function consultarTabelaSeguroLogin(nomeTabela, montarQuery) {
    try {
      return await executarSemFiltroLojaTemporario(() => montarQuery(sb.from(nomeTabela)));
    } catch (erro) {
      console.warn(`Falha ao consultar ${nomeTabela}:`, erro);
      return { data: null, error: erro };
    }
  }

  async function carregarLojasPermitidasFuncionarioLogin(funcionario) {
    const lojasMap = new Map();
    const funcionarioId = String(funcionario?.id || '').trim();
    const funcionarioLojaId = String(funcionario?.loja_id || '').trim();
    const funcionarioEmpresaId = String(funcionario?.empresa_id || '').trim();

    const adicionarLoja = (loja) => {
      const normalizada = normalizarLojaLogin(loja);
      if (normalizada && normalizada.ativo !== false) {
        lojasMap.set(String(normalizada.id), normalizada);
      }
    };

    async function carregarLojasPorIds(ids) {
      const listaIds = [...new Set((ids || []).map(id => String(id || '').trim()).filter(Boolean))];
      if (!listaIds.length) return;
      const lojasRes = await consultarTabelaSeguroLogin('lojas', q => {
        let query = q.select('*').in('id', listaIds);
        if (funcionarioEmpresaId) query = query.eq('empresa_id', funcionarioEmpresaId);
        return query;
      });
      if (!lojasRes.error && Array.isArray(lojasRes.data)) lojasRes.data.forEach(adicionarLoja);
    }

    // Administrador do Sistema não depende de vínculos individuais: possui
    // acesso a todas as lojas ativas, inclusive de empresas diferentes.
    if (funcionario?.é_administrador === true) {
      const { data: painelGlobal, error: erroPainelGlobal } = await sb.rpc('obter_painel_admin_global', {
        p_funcionario_id: funcionarioId,
        p_token: funcionario.global_admin_token,
      });
      if (erroPainelGlobal) throw erroPainelGlobal;
      (painelGlobal?.lojas || []).filter(loja => loja?.ativo !== false).forEach(adicionarLoja);
      return Array.from(lojasMap.values()).sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'));
    }

    if (funcionarioId) {
      const vinculosFuncionario = await fetchSupabaseLogin('funcionario_lojas', {'select':'loja_id,ativo','funcionario_id':'eq.'+funcionarioId});
      if (!vinculosFuncionario.error && Array.isArray(vinculosFuncionario.data) && vinculosFuncionario.data.length > 0) {
        const idsLojas = [...new Set(vinculosFuncionario.data.filter(v => v?.ativo !== false).map(v => String(v.loja_id||'').trim()).filter(Boolean))];
        if (idsLojas.length > 0) {
            const quotedIds = idsLojas.map(id => '"' + id + '"').join(',');
            const paramsLojas = {'select':'*','id':'in.(' + quotedIds + ')'};
            // Não filtrar por empresa aqui — permitir que vínculos tragam lojas de múltiplas empresas
            const lojasRes = await fetchSupabaseLogin('lojas', paramsLojas);
            if (!lojasRes.error && Array.isArray(lojasRes.data)) lojasRes.data.forEach(adicionarLoja);
          }
      }

      const vinculosUsuario = await consultarTabelaSeguroLogin('usuario_lojas', q => q.select('loja_id, ativo').eq('usuario_id', funcionarioId));
      if (!vinculosUsuario.error && Array.isArray(vinculosUsuario.data)) {
        await carregarLojasPorIds(vinculosUsuario.data.filter(v => v?.ativo !== false).map(v => v.loja_id));
      }
    }

    async function fetchSupabaseLogin(tabela, params) {
    try {
      const url = new URL(SUPABASE_URL + '/rest/v1/' + tabela);
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
      const res = await fetch(url.toString(), {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
          'x-funcionario-id': String(window.__authPrincipalId || ''),
          'x-operational-token': String(window.__authOperationalToken || ''),
          'x-global-admin-token': String(window.__authGlobalToken || ''),
          'Accept': 'application/json'
        }
      });
      if (!res.ok) return { data: null, error: { message: 'HTTP ' + res.status } };
      const data = await res.json();
      return { data, error: null };
    } catch (e) {
      return { data: null, error: { message: e.message } };
    }
  }

    if (funcionarioLojaId) {
      await carregarLojasPorIds([funcionarioLojaId]);
    }

    return Array.from(lojasMap.values()).sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'));
  }

  function montarSessaoFuncionarioPorLoja(funcionario, perfilFuncionario, lojaEscolhida) {
    const loja = normalizarLojaLogin(lojaEscolhida) || null;
    const ehAdminSistema = funcionario.é_administrador === true;
    return {
      tipo: ehAdminSistema ? 'admin' : 'funcionario',
      context_mode: 'store',
      global_admin_authorized: ehAdminSistema && !!funcionario.global_admin_token,
      global_admin_token: funcionario.global_admin_token || null,
      operational_access_token: funcionario.operational_access_token || null,
      id: funcionario.id,
      nome: funcionario.nome,
      username: funcionario.nome || funcionario.email || '',
      é_administrador: ehAdminSistema,
      perfil_id: perfilFuncionario?.id || null,
      loja_id: loja?.id || funcionario.loja_id || null,
      empresa_id: loja?.empresa_id || funcionario.empresa_id || null,
      empresa_nome: loja?.empresa_nome || loja?.nome_empresa || loja?.empresas?.nome || loja?.empresa?.nome || funcionario.empresa_nome || funcionario.nome_empresa || null,
      loja_nome: loja?.nome || funcionario.loja_nome || null,
      perfil: perfilFuncionario,
      lojas_permitidas: Array.isArray(window.__loginLojasPermitidasAtual) ? window.__loginLojasPermitidasAtual : []
    };
  }

  function limparSelecaoLojaLogin() {
    window.__loginContextoPendente = null;
    window.__loginLojasPermitidasAtual = [];
    const picker = document.getElementById('loginStorePicker');
    const lista = document.getElementById('loginStoreList');
    const busca = document.getElementById('loginStoreSearch');
    if (picker) picker.classList.remove('show');
    if (lista) lista.innerHTML = '';
    if (busca) busca.value = '';
  }

  async function obterPerfilFuncionarioParaLoja(funcionario, lojaEscolhida, perfilFallback) {
    const funcionarioId = String(funcionario?.id || '').trim();
    const lojaId = String(lojaEscolhida?.id || lojaEscolhida?.loja_id || '').trim();
    if (!funcionarioId || !lojaId) return null;
    try {
      const vinculoRes = await executarSemFiltrosTenantTemporario(() => sb.from('funcionario_lojas')
        .select('perfil_id, ativo')
        .eq('funcionario_id', funcionarioId)
        .eq('loja_id', lojaId)
        .eq('ativo', true)
        .maybeSingle());
      const perfilId = vinculoRes.data?.perfil_id || null;
      if (!perfilId) return null;
      const perfilRes = await executarSemFiltrosTenantTemporario(() => sb.from('perfis')
        .select('id, nome, codigo, permissoes, loja_id, empresa_id')
        .eq('id', perfilId)
        .maybeSingle());
      if (!perfilRes.data || String(perfilRes.data.loja_id || '') !== lojaId) return null;
      return normalizarPerfilUsuario(perfilRes.data);
    } catch (erro) {
      console.warn('Não foi possível carregar o perfil específico da loja:', erro);
      return null;
    }
  }

  async function finalizarLoginFuncionarioComLoja(contexto, lojaEscolhida) {
    const { funcionario, perfilFuncionario, username, password, salvarSenha, manterConectado, preservarPreferenciasLogin = false } = contexto;
    limparDadosVisuaisDaSessao('Carregando dados da loja...');
    if (!preservarPreferenciasLogin) {
      salvarPreferenciasLogin({ username, password, salvarSenha, manterConectado });
    }
    const ehAdminSistema = funcionario?.é_administrador === true;
    let funcionarioContextualizado = funcionario;
    if (ehAdminSistema) {
      const { data: contextoOperacional, error: erroContexto } = await sb.rpc('emitir_contexto_operacional_admin_global', {
        p_funcionario_id: funcionario.id,
        p_token_global: funcionario.global_admin_token,
        p_loja_id: lojaEscolhida?.id,
      });
      if (erroContexto || !contextoOperacional?.operational_access_token) {
        setMsg('msgLogin', 'Não foi possível abrir um contexto operacional seguro para esta loja.', 'err');
        return;
      }
      funcionarioContextualizado = { ...funcionario, ...contextoOperacional };
      window.__authOperationalToken = contextoOperacional.operational_access_token;
    }
    const perfilDaLoja = ehAdminSistema
      ? normalizarPerfilUsuario({ codigo:'ADM', nome:'Administrador do Sistema', permissoes:obterPermissoesBase('ADM') })
      : await obterPerfilFuncionarioParaLoja(funcionarioContextualizado, lojaEscolhida, perfilFuncionario);
    if (!ehAdminSistema && !perfilDaLoja?.id) {
      setMsg('msgLogin', 'Acesso bloqueado: esta loja ainda não possui um perfil explícito vinculado ao usuário.', 'err');
      return;
    }
    salvarSessaoSistema(montarSessaoFuncionarioPorLoja(funcionarioContextualizado, perfilDaLoja, lojaEscolhida), { manterConectado });
    limparSelecaoLojaLogin();
    setSistemaLogado(true);
    aplicarPermissoesSistema();
    carregarNotificacoes();
    atualizarBotaoTrocarLojaTopbar();
    Promise.all([carregarOrdemNavMenu(), carregarTemaInterface()]).then(() => restaurarPaginaAtivaSalvaOuPadrao());
  }

  function mostrarSelecaoLojaLogin(contexto, lojasPermitidas) {
    window.__loginContextoPendente = contexto;
    window.__loginLojasPermitidasAtual = Array.isArray(lojasPermitidas) ? lojasPermitidas : [];
    const picker = document.getElementById('loginStorePicker');
    const fase1 = document.getElementById('loginFase1');
    const busca = document.getElementById('loginStoreSearch');
    const subtitle = document.getElementById('loginStoreSubtitle');
    if (!picker) return;

    // Animar saída da fase 1
    if (fase1) {
      fase1.classList.add('saindo');
      setTimeout(() => {
        fase1.style.display = 'none';
        fase1.classList.remove('saindo');
        picker.classList.add('show');
        picker.classList.add('entrando');
        setTimeout(() => picker.classList.remove('entrando'), 350);
        if (busca) {
          busca.value = '';
          busca.oninput = () => renderizarListaLojasLogin();
        }
        renderizarListaLojasLogin();
        if (subtitle && contexto?.funcionario?.nome) {
          subtitle.textContent = 'Olá, ' + contexto.funcionario.nome.split(' ')[0] + '! Selecione a loja.';
        }
        window.setTimeout(() => busca?.focus(), 80);
      }, 280);
    } else {
      picker.classList.add('show');
      if (busca) {
        busca.value = '';
        busca.oninput = () => renderizarListaLojasLogin();
      }
      renderizarListaLojasLogin();
      window.setTimeout(() => busca?.focus(), 80);
    }
    setMsg('msgLogin', '', '');
  }

  function voltarParaLoginFase1() {
    const picker = document.getElementById('loginStorePicker');
    const fase1 = document.getElementById('loginFase1');
    if (!picker || !fase1) return;
    picker.classList.remove('show');
    fase1.style.display = '';
    fase1.classList.add('entrando');
    setTimeout(() => fase1.classList.remove('entrando'), 350);
    limparSelecaoLojaLogin();
  }
  window.voltarParaLoginFase1 = voltarParaLoginFase1;

  function renderizarListaLojasLogin() {
    const lista = document.getElementById('loginStoreList');
    const busca = document.getElementById('loginStoreSearch');
    if (!lista) return;
    const termo = normalizarTextoComparacao(busca?.value || '');
    const lojas = (window.__loginLojasPermitidasAtual || []).filter(loja => {
      const alvo = normalizarTextoComparacao(`${loja.nome || ''} ${loja.codigo || ''} ${loja.id || ''}`);
      return !termo || alvo.includes(termo);
    });
    if (!lojas.length && window.__loginContextoPendente?.funcionario?.é_administrador !== true) {
      lista.innerHTML = '<div class="login-store-empty">Nenhuma loja vinculada encontrada para este usuário.</div>';
      return;
    }

    // Botão "PAINEL ADMINISTRATIVO" só aparece se a flag é_administrador=true estiver marcada.
    // Perfil ADM/MASTER sozinho NÃO concede este acesso — é completamente separado.
    const contexto = window.__loginContextoPendente || {};
    const perfilFuncionario = contexto.perfilFuncionario || null;
    const codigoPerfil = perfilFuncionario ? normalizarCodigoPerfil(perfilFuncionario.codigo || '') : '';
    const ehAdminFlag = contexto.funcionario?.é_administrador === true;
    const ehMasterLogin = ehAdminFlag;

    lista.innerHTML = (ehMasterLogin ? `
      <button type="button" class="login-store-option login-store-admin-panel" data-admin-panel="true">
        <div class="login-store-icon">⚙️</div>
        <div class="login-store-info">
          <strong>PAINEL ADMINISTRATIVO</strong>
          <span>Acessar todas as empresas, lojas e usuários (apenas administradores)</span>
        </div>
        <span class="login-store-arrow">›</span>
      </button>
    ` : '') + lojas.map(loja => `
      <button type="button" class="login-store-option" data-loja-id="${escaparHtmlBasico(loja.id)}">
        <div class="login-store-icon">🏪</div>
        <div class="login-store-info">
          <strong>${escaparHtmlBasico(loja.nome || 'Loja')}</strong>
          <span>${escaparHtmlBasico(loja.codigo || loja.slug || loja.id || '')}</span>
        </div>
        <span class="login-store-arrow">›</span>
      </button>
    `).join('');
    lista.querySelectorAll('[data-loja-id]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = String(btn.getAttribute('data-loja-id') || '');
        const loja = (window.__loginLojasPermitidasAtual || []).find(item => String(item.id) === id);
        if (!loja || !window.__loginContextoPendente) {
          setMsg('msgLogin', 'Loja inválida. Tente novamente.', 'err');
          return;
        }
        await finalizarLoginFuncionarioComLoja(window.__loginContextoPendente, loja);
      });
    });
    // evento para abrir o painel administrativo direto do login
    const adminBtn = lista.querySelector('[data-admin-panel]');
    if (adminBtn) {
      adminBtn.addEventListener('click', () => {
        abrirPainelAdministrativoLogin();
      });
    }
  }

  async function abrirPainelAdministrativoLogin() {
    const contexto = window.__loginContextoPendente || null;
    if (!contexto) return setMsg('msgLogin', 'Sessão não identificada.', 'err');
    // Acesso ao painel restrito exclusivamente a funcionários com é_administrador=true
    if (contexto.funcionario?.é_administrador !== true || !(await validarAutoridadeAdminSistemaNoBanco({ ...contexto.funcionario, tipo:'admin' }))) {
      setMsg('msgLogin', 'Acesso ao painel administrativo restrito a administradores.', 'err');
      return;
    }

    // Cria sessão administrativa baseada no funcionário que entrou (apenas front-end)
    const nomeUsuario = contexto.funcionario?.nome || contexto.username || 'Administrador';
    salvarPreferenciasLogin({ username: contexto.username || '', password: contexto.password || '', salvarSenha: contexto.salvarSenha, manterConectado: contexto.manterConectado });
    salvarSessaoSistema({
      tipo: 'admin',
      context_mode: 'global_admin',
      global_admin_authorized: true,
      global_admin_token: contexto.funcionario.global_admin_token,
      operational_access_token: contexto.funcionario.operational_access_token || null,
      id: contexto.funcionario.id,
      nome: contexto.funcionario.nome,
      username: nomeUsuario,
      email: contexto.funcionario.email || null,
      é_administrador: true,
      perfil: normalizarPerfilUsuario({ codigo: 'ADM', nome: 'Administrador do Sistema', permissoes: obterPermissoesBase('ADM') }),
      lojas_permitidas: Array.isArray(window.__loginLojasPermitidasAtual) ? window.__loginLojasPermitidasAtual : []
    }, { manterConectado: !!contexto.manterConectado });
    setSistemaLogado(true);
    aplicarPermissoesSistema();
    carregarNotificacoes();
    limparSelecaoLojaLogin();
    // Abrir a página de administração de empresas por padrão
    salvarPaginaAtiva('dashboard_saas');
    abrirPagina('dashboard_saas', document.querySelector('#navGlobalAdmin [data-page="dashboard_saas"]'));
  }

  function obterLojasPermitidasSessao() {
    const lojas = Array.isArray(usuarioSistemaLogado?.lojas_permitidas) ? usuarioSistemaLogado.lojas_permitidas : [];
    const mapa = new Map();
    lojas.forEach(loja => {
      const normalizada = normalizarLojaLogin(loja);
      if (normalizada && normalizada.ativo !== false) mapa.set(String(normalizada.id), normalizada);
    });
    return Array.from(mapa.values()).sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'));
  }

  function atualizarBotaoTrocarLojaTopbar() {
    const lojaContainer = document.getElementById('topbarStoreInfo');
    const btnLegado = document.getElementById('btnTrocarLojaSessao');
    if (btnLegado) btnLegado.remove();
    if (!lojaContainer || !usuarioSistemaLogado) return;

    const lojas = obterLojasPermitidasSessao();
    const podeTrocar = contextoEhAdminGlobal() ? lojas.length > 0 : (lojas.length > 1 || usuarioSistemaLogado?.global_admin_authorized === true);
    lojaContainer.classList.toggle('is-switchable', podeTrocar);
    lojaContainer.title = podeTrocar ? 'Trocar loja' : 'Loja logada';
    lojaContainer.onclick = podeTrocar ? abrirTrocaLojaTopbar : null;
  }

  function abrirTrocaLojaTopbar() {
    const lojas = obterLojasPermitidasSessao();
    if (contextoEhAdminGlobal() ? lojas.length < 1 : (lojas.length <= 1 && usuarioSistemaLogado?.global_admin_authorized !== true)) return;
    const contexto = {
      funcionario: usuarioSistemaLogado,
      perfilFuncionario: usuarioSistemaLogado.perfil,
      username: usuarioSistemaLogado.nome || usuarioSistemaLogado.username || '',
      password: '',
      salvarSenha: false,
      manterConectado: !!(localStorage.getItem('zuqui_auth') || localStorage.getItem('check_diario_auth_persistente')),
      preservarPreferenciasLogin: true
    };
    const loginScreen = document.getElementById('loginScreen');
    const shell = document.querySelector('.shell');
    if (shell) shell.style.display = 'none';
    if (loginScreen) loginScreen.style.display = 'flex';
    mostrarSelecaoLojaLogin(contexto, lojas);
  }

  async function handleLogin(event) {
    event.preventDefault();
    habilitarSomNotificacao();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const salvarSenha = document.getElementById('savePassword')?.checked === true;
    const manterConectado = document.getElementById('keepLoggedIn')?.checked === true;
    const loginComEmail = username.includes('@');
    setMsg('msgLogin', '', '');

    if (!username) {
      setMsg('msgLogin', 'Preencha o e-mail de acesso.', 'err');
      return;
    }

    if (!password) {
      const temSessaoPersistente = !!obterSessaoPersistenteLoginSalva();
      if (manterConectado && temSessaoPersistente && loginDigitadoConfereComSessaoPersistente(username)) {
        setMsg('msgLogin', 'Entrando com sessão salva...', 'ok');
        const restaurou = await restaurarSessaoSistema();
        if (restaurou) {
          salvarPreferenciasLogin({ username, salvarSenha: true, manterConectado: true });
          return;
        }
      }
      setMsg('msgLogin', 'Digite a senha apenas se a sessão salva não estiver disponível.', 'err');
      return;
    }

    // predefinedUsers está vazio (credenciais removidas por segurança). Login exclusivo via Supabase.

    const { data: funcionario, error } = await executarSemFiltrosTenantTemporario(() => sb.rpc('autenticar_funcionario_contexto', {
      p_identificador: username,
      p_senha: password,
    }));

    if (error) {
      if (String(error.code || '') === '57014' || String(error.message || '').toLowerCase().includes('statement timeout')) {
        setMsg('msgLogin', 'A validação demorou mais que o esperado. Confirme o e-mail de acesso e tente novamente.', 'err');
        return;
      }
      if (isMissingProfilesTableError(error)) {
        setMsg('msgLogin', 'Tabela de perfis indisponível no momento. Tente novamente em alguns segundos.', 'err');
        return;
      }
      console.error('Erro no login:', error);
      setMsg('msgLogin', `Erro ao fazer login: ${mensagemErroSupabase(error, 'erro desconhecido')}`, 'err');
      return;
    }

    if (!funcionario) {
      // Tenta login como admin de loja; a senha é conferida no banco e nunca é retornada.
      if (!loginComEmail) {
        const { data: adminLoja, error: erroAdminLogin } = await executarSemFiltrosTenantTemporario(() => sb.rpc('autenticar_usuario_admin', {
          p_identificador: username,
          p_senha: password,
        }));
        if (erroAdminLogin) console.warn('Falha ao autenticar admin de loja:', erroAdminLogin);
        if (adminLoja) {
          window.__authPrincipalId = adminLoja.id;
          window.__authOperationalToken = adminLoja.operational_access_token || '';
          let nomeLojaAdmin = '';
          const lojaIdAdmin = String(adminLoja.loja_id || '').trim();
          let empresaIdAdmin = String(adminLoja.empresa_id || '').trim();

          if (lojaIdAdmin) {
            try {
              const lojaRes = await executarSemFiltrosTenantTemporario(() => sb
                .from('lojas')
                .select('*')
                .eq('id', lojaIdAdmin)
                .maybeSingle());
              if (!lojaRes.error && lojaRes.data) {
                const loja = lojaRes.data;
                nomeLojaAdmin = String(loja.nome || loja.nome_loja || loja.descricao || loja.codigo || '').trim();
                if (!empresaIdAdmin) empresaIdAdmin = String(loja.empresa_id || '').trim();
              }
            } catch (_) {}

            if (!nomeLojaAdmin) {
              try {
                const filialRes = await executarSemFiltrosTenantTemporario(() => sb
                  .from('filiais')
                  .select('*')
                  .eq('id', lojaIdAdmin)
                  .maybeSingle());
                if (!filialRes.error && filialRes.data) {
                  const filial = filialRes.data;
                  nomeLojaAdmin = String(filial.nome || filial.nome_loja || filial.descricao || filial.codigo || '').trim();
                }
              } catch (_) {}
            }
          }

          const perfilAdminLoja = await obterPerfilAdminLojaSeguro(lojaIdAdmin);
          salvarPreferenciasLogin({ username, password, salvarSenha, manterConectado });
          salvarSessaoSistema({
            tipo: 'admin_loja',
            id: adminLoja.id,
            nome: adminLoja.nome,
            usuario: adminLoja.usuario,
            loja_id: adminLoja.loja_id,
            empresa_id: empresaIdAdmin || null,
            operational_access_token: adminLoja.operational_access_token || null,
            loja_nome: nomeLojaAdmin || 'Loja vinculada',
            perfil: perfilAdminLoja
          }, { manterConectado });
          setSistemaLogado(true);
          aplicarPermissoesSistema();
          carregarNotificacoes();
          Promise.all([carregarOrdemNavMenu(), carregarTemaInterface()]).then(() => restaurarPaginaAtivaSalvaOuPadrao());
          return;
        }
      }
      setMsg('msgLogin', loginComEmail
        ? 'E-mail ou senha incorretos. Use “Esqueci minha senha” se necessário.'
        : 'O acesso ao sistema agora é feito com e-mail e senha. Se você ainda não possui e-mail cadastrado, use “Solicitar acesso” ou peça ao administrador da loja.', 'err');
      return;
    }

    if (funcionario.senha_troca_obrigatoria === true) {
      const emailFuncionario = String(funcionario.email || '').trim().toLowerCase();
      if (!emailFuncionario || !emailPareceValido(emailFuncionario)) {
        setMsg('msgLogin', 'Seu cadastro antigo foi localizado, mas não possui e-mail válido. Use “Solicitar acesso” informando nome, CNPJ da loja e o e-mail que receberá o acesso.', 'err');
        abrirSolicitacaoAcesso();
        return;
      }
      try {
        await chamarFuncaoAutenticacao({
          action: 'send_password_reset',
          email: emailFuncionario,
          redirectUrl: obterUrlBaseAutenticacao(),
        });
        setMsg('msgLogin', `Por segurança, sua senha antiga precisa ser trocada. Enviamos um link para ${emailFuncionario}.`, 'ok');
      } catch (resetError) {
        setMsg('msgLogin', `Seu cadastro foi localizado, mas não foi possível enviar o link de troca: ${resetError.message || resetError}`, 'err');
      }
      return;
    }

    if (loginComEmail && funcionario.email_verificado !== true) {
      setMsg('msgLogin', 'Seu e-mail ainda não foi validado. Use o botão de reenviar verificação e confirme o link recebido.', 'err');
      return;
    }

    window.__authPrincipalId = funcionario.id;
    window.__authOperationalToken = funcionario.operational_access_token || '';
    window.__authGlobalToken = funcionario.global_admin_token || '';
    const perfilFuncionario = normalizarPerfilUsuario(funcionario.perfis);

    const lojasPermitidas = await carregarLojasPermitidasFuncionarioLogin(funcionario);
    window.__loginLojasPermitidasAtual = lojasPermitidas;
    const contextoLoginFuncionario = { funcionario, perfilFuncionario, username, password, salvarSenha, manterConectado };

    if (lojasPermitidas.length > 1) {
      mostrarSelecaoLojaLogin(contextoLoginFuncionario, lojasPermitidas);
      return;
    }

    await finalizarLoginFuncionarioComLoja(contextoLoginFuncionario, lojasPermitidas[0] || null);
  }

  renderizarPermissoesPerfil(Object.fromEntries(PERFIL_PERMISSOES.map(item => [item.key, false])));
  const keepLoggedInCheckbox = document.getElementById('keepLoggedIn');
  if (keepLoggedInCheckbox) keepLoggedInCheckbox.checked = false;
  restaurarPreferenciasLogin();
  configurarPreferenciasLoginTela();
  restaurarSessaoSistema();
  setTimeout(atualizarBotaoTrocarLojaTopbar, 150);
  processarFluxoAutenticacaoPorToken();
  iniciarAtualizacaoAutomatica();
  window.setTimeout(() => {
    forcarCampoObservacaoTarefaEmBranco();
    redefinirCampoBuscaTarefas();
  }, 250);
  document.getElementById('filtroChecklistLancadoBusca')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      filtrarChecklistsLancados();
    }
  });


/* ==== AJUSTE FINAL: PONTO ADM, ANULAÇÃO E RELATÓRIO FECHADO ==== */
let adminAjusteManualPontoTipoAtual = 'adicionar';
let relatorioPontoRegistrosVisiveis = false;
window.__relatorioPontoUltimosRows = [];
window.__relatorioPontoUltimoPeriodo = '';

function escapeHtmlPonto(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function toggleRegistrosRelatorioPonto(forcarAberto = null) {
  const body = document.getElementById('relatorioPontoRegistrosBody');
  const btn = document.getElementById('btnToggleRegistrosRelatorioPonto');
  if (!body) return;
  relatorioPontoRegistrosVisiveis = typeof forcarAberto === 'boolean' ? forcarAberto : !!body.hidden;
  body.hidden = !relatorioPontoRegistrosVisiveis;
  if (btn) btn.textContent = relatorioPontoRegistrosVisiveis ? 'Ocultar registros' : 'Mostrar registros';
}

function selecionarTipoAjusteManualAdminPonto(tipo = 'adicionar') {
  adminAjusteManualPontoTipoAtual = tipo === 'anular' ? 'anular' : 'adicionar';
  document.getElementById('adminAjusteTipoAdicionar')?.classList.toggle('ativo', adminAjusteManualPontoTipoAtual === 'adicionar');
  document.getElementById('adminAjusteTipoAnular')?.classList.toggle('ativo', adminAjusteManualPontoTipoAtual === 'anular');
  const horarioLabel = document.getElementById('adminAjustePontoHorarioLabel');
  const horarioInput = document.getElementById('adminAjustePontoHorario');
  const batidaLabel = document.getElementById('adminAjustePontoBatidaLabel');
  if (horarioLabel) {
    horarioLabel.hidden = adminAjusteManualPontoTipoAtual === 'anular';
    horarioLabel.childNodes[0].textContent = 'Horário correto ';
  }
  if (horarioInput && adminAjusteManualPontoTipoAtual === 'anular') horarioInput.value = '';
  if (batidaLabel) batidaLabel.hidden = adminAjusteManualPontoTipoAtual !== 'anular';
  const motivo = document.getElementById('adminAjustePontoMotivo');
  if (motivo) {
    motivo.placeholder = adminAjusteManualPontoTipoAtual === 'anular'
      ? 'Exemplo: batida duplicada ou lançada no horário errado; conferido pelo administrador'
      : 'Exemplo: funcionária esqueceu de bater; horário conferido pelo administrador';
  }
  if (adminAjusteManualPontoTipoAtual === 'anular') atualizarBatidasDisponiveisAnulacaoPonto();
}

function montarListaBatidasPonto(registro, intervalos = []) {
  const lista = [];
  if (registro?.entrada_em) lista.push({ tipo: 'entrada', iso: registro.entrada_em, label: 'Entrada' });

  if (registro?.inicio_intervalo_em) lista.push({ tipo: 'intervalo_inicio', iso: registro.inicio_intervalo_em, label: 'Início intervalo 1' });
  if (registro?.retorno_intervalo_em) lista.push({ tipo: 'intervalo_retorno', iso: registro.retorno_intervalo_em, label: 'Retorno intervalo 1' });

  [...(intervalos || [])]
    .sort((a, b) => (Number(a.ordem || 0) - Number(b.ordem || 0)) || (new Date(a.inicio_em || 0) - new Date(b.inicio_em || 0)))
    .forEach((intervalo, idx) => {
      const numero = Number(intervalo.ordem || 0) || idx + 2;
      const inicioJaIncluido = lista.some(item => item.iso && new Date(item.iso).getTime() === new Date(intervalo.inicio_em || 0).getTime());
      const retornoJaIncluido = lista.some(item => item.iso && new Date(item.iso).getTime() === new Date(intervalo.retorno_em || 0).getTime());
      if (intervalo.inicio_em && !inicioJaIncluido) lista.push({ tipo: 'intervalo_inicio', iso: intervalo.inicio_em, label: `Início intervalo ${numero}` });
      if (intervalo.retorno_em && !retornoJaIncluido) lista.push({ tipo: 'intervalo_retorno', iso: intervalo.retorno_em, label: `Retorno intervalo ${numero}` });
    });

  if (registro?.saida_em) lista.push({ tipo: 'saida', iso: registro.saida_em, label: 'Saída' });
  return lista.filter(item => item.iso).sort((a, b) => new Date(a.iso).getTime() - new Date(b.iso).getTime());
}

async function obterRegistroPontoComIntervalosPorFuncionarioData(funcionarioId, dataPonto) {
  const { data: registro, error } = await sb
    .from('ponto_registros')
    .select('id, funcionario_id, data_ponto, entrada_em, inicio_intervalo_em, retorno_intervalo_em, saida_em, created_at, loja_id, empresa_id')
    .eq('funcionario_id', funcionarioId)
    .eq('data_ponto', dataPonto)
    .maybeSingle();
  if (error) throw error;
  if (!registro?.id) return { registro: null, intervalos: [] };
  const { data: intervalos, error: erroInt } = await sb
    .from('ponto_intervalos')
    .select('id, ponto_registro_id, ordem, inicio_em, retorno_em')
    .eq('ponto_registro_id', registro.id)
    .order('ordem', { ascending: true });
  if (erroInt && !isMissingTimeClockIntervalsTableError(erroInt)) throw erroInt;
  return { registro, intervalos: isMissingTimeClockIntervalsTableError(erroInt) ? [] : (intervalos || []) };
}

async function atualizarBatidasDisponiveisAnulacaoPonto() {
  const select = document.getElementById('adminAjustePontoBatida');
  if (!select || adminAjusteManualPontoTipoAtual !== 'anular') return;
  const funcionarioId = String(document.getElementById('adminAjustePontoFuncionario')?.value || '').trim();
  const dataAjuste = String(document.getElementById('adminAjustePontoData')?.value || '').trim();
  select.innerHTML = '<option value="">Carregando batidas...</option>';
  if (!funcionarioId || !dataAjuste) {
    select.innerHTML = '<option value="">Selecione funcionário e data</option>';
    return;
  }
  try {
    const { registro, intervalos } = await obterRegistroPontoComIntervalosPorFuncionarioData(funcionarioId, dataAjuste);
    const batidas = montarListaBatidasPonto(registro, intervalos);
    if (!batidas.length) {
      select.innerHTML = '<option value="">Nenhuma batida encontrada nessa data</option>';
      return;
    }
    select.innerHTML = '<option value="">- Selecione a batida errada -</option>' + batidas.map(item => {
      const hora = formatarHoraPonto(item.iso);
      return `<option value="${escapeHtmlPonto(item.iso)}">${escapeHtmlPonto(item.label)} · ${escapeHtmlPonto(hora)}</option>`;
    }).join('');
  } catch (_) {
    select.innerHTML = '<option value="">Erro ao carregar batidas</option>';
  }
}

async function anularBatidaPontoAdmin({ funcionarioId, dataAjuste, batidaIso }) {
  const { registro, intervalos } = await obterRegistroPontoComIntervalosPorFuncionarioData(funcionarioId, dataAjuste);
  if (!registro?.id) return { ok: false, mensagem: 'Nenhum registro de ponto encontrado para essa data.' };
  const batidasAtuais = montarListaBatidasPonto(registro, intervalos).map(item => item.iso);
  const alvo = new Date(batidaIso).getTime();
  const indiceAlvo = batidasAtuais.findIndex(iso => new Date(iso).getTime() === alvo);
  if (indiceAlvo < 0) return { ok: false, mensagem: 'Batida selecionada não foi encontrada.' };
  const batidas = batidasAtuais.filter((_, indice) => indice !== indiceAlvo);
  batidas.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  const jornadaFechada = batidas.length % 2 === 0;
  const entradaEm = batidas[0] || null;
  const saidaEm = jornadaFechada ? batidas[batidas.length - 1] : null;
  const miolo = batidas.slice(1, jornadaFechada ? -1 : batidas.length);
  const paresIntervalo = [];
  for (let i = 0; i < miolo.length; i += 2) {
    paresIntervalo.push({ inicio_em: miolo[i] || null, retorno_em: miolo[i + 1] || null });
  }
  const primeiroIntervalo = paresIntervalo[0] || {};
  const inicioIntervaloEm = primeiroIntervalo.inicio_em || null;
  const retornoIntervaloEm = primeiroIntervalo.retorno_em || null;
  const novosIntervalos = paresIntervalo.slice(1).map((item, idx) => ({
    ponto_registro_id: registro.id,
    ordem: idx + 2,
    inicio_em: item.inicio_em,
    retorno_em: item.retorno_em,
  }));

  const estadoOriginalRegistro = {
    entrada_em: registro.entrada_em || null,
    inicio_intervalo_em: registro.inicio_intervalo_em || null,
    retorno_intervalo_em: registro.retorno_intervalo_em || null,
    saida_em: registro.saida_em || null,
  };
  const restaurarJornadaOriginal = async () => {
    await sb.from('ponto_registros').update(estadoOriginalRegistro)
      .eq('id', registro.id)
      .eq('funcionario_id', funcionarioId)
      .eq('data_ponto', dataAjuste);
    await sb.from('ponto_intervalos').delete().eq('ponto_registro_id', registro.id);
    if (intervalos.length) {
      await sb.from('ponto_intervalos').insert(intervalos.map((item, idx) => ({
        ponto_registro_id: registro.id,
        ordem: Number(item.ordem || 0) || idx + 2,
        inicio_em: item.inicio_em || null,
        retorno_em: item.retorno_em || null,
      })));
    }
  };

  const { error: erroAtualiza } = await sb.from('ponto_registros')
    .update({ entrada_em: entradaEm, inicio_intervalo_em: inicioIntervaloEm, retorno_intervalo_em: retornoIntervaloEm, saida_em: saidaEm })
    .eq('id', registro.id)
    .eq('funcionario_id', funcionarioId)
    .eq('data_ponto', dataAjuste);
  if (erroAtualiza) return { ok: false, mensagem: mensagemErroSupabase(erroAtualiza, 'erro desconhecido') };

  const { error: erroDelete } = await sb.from('ponto_intervalos').delete().eq('ponto_registro_id', registro.id);
  if (erroDelete && !isMissingTimeClockIntervalsTableError(erroDelete)) {
    await restaurarJornadaOriginal();
    return { ok: false, mensagem: `Não foi possível reorganizar os intervalos: ${mensagemErroSupabase(erroDelete, 'erro desconhecido')}` };
  }
  if (novosIntervalos.length) {
    const { error: erroInsert } = await sb.from('ponto_intervalos').insert(novosIntervalos);
    if (erroInsert) {
      await restaurarJornadaOriginal();
      return { ok: false, mensagem: `Não foi possível recriar os intervalos: ${mensagemErroSupabase(erroInsert, 'erro desconhecido')}` };
    }
  }

  try {
    const { data: auditorias } = await sb.from('ponto_batidas_auditoria')
      .select('id')
      .eq('ponto_registro_id', registro.id)
      .eq('registrado_em', batidaIso)
      .limit(1);
    const auditoriaId = auditorias?.[0]?.id;
    if (auditoriaId) {
      await sb.from('ponto_batidas_auditoria').update({
        origem_registro: 'anulado_ajuste_manual_admin',
      }).eq('id', auditoriaId);
    }
  } catch (erroAuditoria) {
    console.warn('Não foi possível identificar a batida anulada na auditoria:', erroAuditoria);
  }

  return {
    ok: true,
    mensagem: `Batida das ${formatarHoraPonto(batidaIso)} removida da jornada e preservada no histórico. Jornada recalculada.`,
  };
}

async function carregarAjustesAprovadosPontoPorPeriodo(dataInicio = '', dataFim = '', funcionarioId = '') {
  try {
    let query = sb.from('ponto_ajustes_solicitacoes').select('*').eq('status', 'aprovado').order('aprovado_em', { ascending: false });
    if (dataInicio) query = query.gte('data_ajuste', dataInicio);
    if (dataFim) query = query.lte('data_ajuste', dataFim);
    if (funcionarioId) query = query.eq('funcionario_id', funcionarioId);
    const { data, error } = await query;
    if (error) return [];
    return data || [];
  } catch (_) { return []; }
}

function montarMapaAjustesPonto(ajustes = []) {
  const mapa = {};
  (ajustes || []).forEach(item => {
    const chave = `${String(item.funcionario_id || '')}|${String(item.data_ajuste || '')}`;
    if (!mapa[chave]) mapa[chave] = [];
    mapa[chave].push(item);
  });
  return mapa;
}

function montarHtmlAjustesPonto(ajustes = []) {
  if (!ajustes?.length) return '';
  return `<span class="ponto-ajuste-badge">Ponto ajustado/editado</span>` +
    `<div class="ponto-ajuste-historico">` + ajustes.map(item => {
      const tipo = String(item.motivo || '').includes('[ANULACAO MANUAL ADMIN]') ? 'Anulação manual' : 'Ajuste manual';
      const horario = formatarHorarioAjustePonto(item.horario_ajuste);
      const quando = formatarDataHoraSolicitacaoPonto(item.aprovado_em || item.solicitado_em || item.created_at);
      const admin = item.aprovado_por_nome || 'Administrador';
      const motivo = String(item.motivo || '').replace('[AJUSTE MANUAL ADMIN]', '').replace('[ANULACAO MANUAL ADMIN]', '').trim();
      return `<span class="ponto-ajuste-linha"><strong>${escapeHtmlPonto(tipo)}</strong>: ${escapeHtmlPonto(item.data_ajuste || '-')} às ${escapeHtmlPonto(horario)}</span>` +
        `<span class="ponto-ajuste-linha"><strong>Ajustado/editado por:</strong> ${escapeHtmlPonto(admin)}</span>` +
        `<span class="ponto-ajuste-linha"><strong>Data e hora:</strong> ${escapeHtmlPonto(quando)}</span>` +
        (motivo ? `<span class="ponto-ajuste-linha"><strong>Motivo:</strong> ${escapeHtmlPonto(motivo)}</span>` : '');
    }).join('') + `</div>`;
}

function abrirModalAjusteManualAdminPonto(funcionarioId = '', tipoInicial = 'adicionar', dataInicial = '') {
  if (!usuarioPodeAcessar('ponto_ajustes')) {
    setMsg('msgPonto', 'Seu perfil não possui permissão para ajustar o ponto.', 'err');
    return;
  }
  const modal = document.getElementById('modalAjusteManualAdminPonto');
  if (!modal) return;
  const sel = document.getElementById('adminAjustePontoFuncionario');
  const data = document.getElementById('adminAjustePontoData');
  const horario = document.getElementById('adminAjustePontoHorario');
  const senha = document.getElementById('adminAjustePontoSenha');
  const motivo = document.getElementById('adminAjustePontoMotivo');
  const tipoAjuste = tipoInicial === 'anular' ? 'anular' : 'adicionar';
  selecionarTipoAjusteManualAdminPonto(tipoAjuste);
  carregarSelectFuncionariosPonto().then(() => {
    if (sel && funcionarioId) sel.value = String(funcionarioId);
    if (tipoAjuste === 'anular') atualizarBatidasDisponiveisAnulacaoPonto();
  }).catch(() => {});
  if (sel && funcionarioId) sel.value = String(funcionarioId);
  if (data) data.value = dataInicial || dataLocalISO();
  if (horario) horario.value = '';
  if (senha) senha.value = '';
  if (motivo) motivo.value = '';
  setMsg('msgAjusteManualAdminPonto', '', '');
  modal.hidden = false;
  if (tipoAjuste === 'anular') atualizarBatidasDisponiveisAnulacaoPonto();
  setTimeout(() => {
    if (sel && !sel.value) {
      sel.focus();
      return;
    }
    if (tipoAjuste === 'anular') {
      document.getElementById('adminAjustePontoBatida')?.focus();
      return;
    }
    horario?.focus();
  }, 80);
}

async function salvarAjusteManualAdminPonto() {
  if (!usuarioPodeAcessar('ponto_ajustes')) {
    setMsg('msgAjusteManualAdminPonto', 'Seu perfil não possui permissão para ajustar o ponto.', 'err');
    return;
  }

  const funcionarioId = String(document.getElementById('adminAjustePontoFuncionario')?.value || '').trim();
  const dataAjuste = String(document.getElementById('adminAjustePontoData')?.value || '').trim();
  const horarioAjuste = String(document.getElementById('adminAjustePontoHorario')?.value || '').trim();
  const batidaAnular = String(document.getElementById('adminAjustePontoBatida')?.value || '').trim();
  const senha = String(document.getElementById('adminAjustePontoSenha')?.value || '').trim();
  const motivo = String(document.getElementById('adminAjustePontoMotivo')?.value || '').trim();
  const tipo = adminAjusteManualPontoTipoAtual === 'anular' ? 'anular' : 'adicionar';
  const opcaoFuncionario = document.getElementById('adminAjustePontoFuncionario')?.selectedOptions?.[0] || null;
  const lojaFuncionarioSelecionado = String(opcaoFuncionario?.dataset?.lojaId || '').trim();

  const horarioObrigatorio = tipo === 'adicionar' && !horarioAjuste;
  if (!funcionarioId || !dataAjuste || horarioObrigatorio || !senha || !motivo || (tipo === 'anular' && !batidaAnular)) {
    setMsg('msgAjusteManualAdminPonto', tipo === 'anular'
      ? 'Preencha funcionário, data, batida errada, senha do administrador e motivo.'
      : 'Preencha funcionário, data, horário, senha do administrador e motivo.', 'err');
    return;
  }

  try {
    // A opção foi carregada pela lista já isolada por loja. Usar esse contexto
    // estável evita combinar o filtro automático do Supabase com uma segunda
    // leitura de sessão/topbar que pode estar sendo atualizada em paralelo.
    const criarConsultaFuncionario = () => sb
      .from('funcionarios')
      .select('id, nome, loja_id, ativo');
    let qFuncionarioLoja = typeof criarConsultaPontoComLojaExplicita === 'function'
      ? criarConsultaPontoComLojaExplicita(criarConsultaFuncionario)
      : criarConsultaFuncionario();
    qFuncionarioLoja = qFuncionarioLoja
      .eq('id', funcionarioId)
      .eq('ativo', true);
    if (lojaFuncionarioSelecionado) {
      qFuncionarioLoja = qFuncionarioLoja.eq('loja_id', lojaFuncionarioSelecionado);
    }
    const { data: funcionarioLoja, error: erroFuncionarioLoja } = await qFuncionarioLoja.maybeSingle();
    if (erroFuncionarioLoja) throw erroFuncionarioLoja;
    if (!funcionarioLoja) {
      setMsg('msgAjusteManualAdminPonto', 'Não foi possível confirmar o funcionário nesta loja. Atualize a tela e tente novamente.', 'err');
      return;
    }
    if (lojaFuncionarioSelecionado && String(funcionarioLoja.loja_id || '').trim() !== lojaFuncionarioSelecionado) {
      setMsg('msgAjusteManualAdminPonto', 'O vínculo de loja do funcionário mudou. Atualize a tela antes de ajustar o ponto.', 'err');
      return;
    }
  } catch (error) {
    setMsg('msgAjusteManualAdminPonto', `Não foi possível validar a loja do funcionário: ${mensagemErroSupabase(error, 'erro desconhecido')}`, 'err');
    return;
  }

  setMsg('msgAjusteManualAdminPonto', 'Validando senha do administrador...', 'ok');
  let senhaOk = false;
  try { senhaOk = await validarSenhaAdministradorParaAjustePonto(senha); }
  catch (error) {
    setMsg('msgAjusteManualAdminPonto', `Não foi possível validar a senha: ${mensagemErroSupabase(error, 'erro desconhecido')}`, 'err');
    return;
  }
  if (!senhaOk) {
    setMsg('msgAjusteManualAdminPonto', 'PIN operacional inválido ou sem permissão para ajustar o ponto.', 'err');
    return;
  }

  const funcionarioNome = relatorioPontoFuncionarioCache[funcionarioId]
    || document.getElementById('adminAjustePontoFuncionario')?.selectedOptions?.[0]?.textContent
    || 'Funcionário';

  setMsg('msgAjusteManualAdminPonto', tipo === 'anular' ? 'Anulando batida...' : 'Aplicando ajuste no ponto...', 'ok');
  let resultado;
  let solicitacaoManual;
  if (tipo === 'anular') {
    resultado = await anularBatidaPontoAdmin({ funcionarioId, dataAjuste, batidaIso: batidaAnular });
    const horarioBatidaAnulada = formatarHoraPonto(batidaAnular);
    solicitacaoManual = {
      funcionario_id: funcionarioId, funcionario_nome: funcionarioNome, data_ajuste: dataAjuste,
      horario_ajuste: horarioBatidaAnulada, motivo: `[ANULACAO MANUAL ADMIN] Batida original ${horarioBatidaAnulada} removida da jornada. ${motivo}`,
      status: 'aprovado', aprovado_em: new Date().toISOString(), aprovado_por_id: obterIdAdminAtual(), aprovado_por_nome: obterNomeAdminAtual(),
    };
  } else {
    solicitacaoManual = {
      funcionario_id: funcionarioId, funcionario_nome: funcionarioNome, data_ajuste: dataAjuste,
      horario_ajuste: horarioAjuste, motivo: `[AJUSTE MANUAL ADMIN] ${motivo}`,
      status: 'aprovado', aprovado_em: new Date().toISOString(), aprovado_por_id: obterIdAdminAtual(), aprovado_por_nome: obterNomeAdminAtual(),
    };
    resultado = await aplicarAjusteAprovadoNoPonto(solicitacaoManual);
  }

  if (!resultado.ok) {
    setMsg('msgAjusteManualAdminPonto', `Não foi possível concluir: ${resultado.mensagem}`, 'err');
    return;
  }

  try {
    const { error: erroHistorico } = await sb.from('ponto_ajustes_solicitacoes').insert([solicitacaoManual]);
    if (erroHistorico) throw erroHistorico;
  } catch (e) {
    setMsg('msgAjusteManualAdminPonto', `A batida foi preservada, mas o histórico não foi salvo. Corrija os dados e tente novamente; o ponto não será duplicado. ${mensagemErroSupabase(e, '')}`, 'err');
    return;
  }

  setMsg('msgPonto', `${tipo === 'anular' ? 'Batida anulada' : 'Ajuste manual aplicado'} para ${funcionarioNome}. ${resultado.mensagem}`, 'ok');
  fecharModalAjusteManualAdminPonto();
  await carregarResumoPontoHoje(obterFuncionarioRestritoLogadoIdParaPonto() || '');
  await carregarHorasDashboard();
  if (obterPaginaAtivaAtual() === 'relatorio_ponto') await carregarRelatorioPonto();
  if (obterPaginaAtivaAtual() === 'ponto_ajustes') await carregarAjustesPonto();
}

const carregarResumoPontoHojeOriginalComAjuste = carregarResumoPontoHoje;
carregarResumoPontoHoje = async function(funcionarioId = '') {
  await carregarResumoPontoHojeOriginalComAjuste(funcionarioId);
  const container = document.getElementById('pontoResumoHoje');
  if (!container) return;
  const hoje = obterDataResumoPontoSelecionada();
  const ajustes = await carregarAjustesAprovadosPontoPorPeriodo(hoje, hoje, funcionarioId || '');
  if (!ajustes.length) return;
  const nomesAjustados = new Set(ajustes.map(a => String(a.funcionario_nome || relatorioPontoFuncionarioCache[String(a.funcionario_id)] || '').toUpperCase().trim()).filter(Boolean));
  container.querySelectorAll('.ponto-resumo-linha').forEach(linha => {
    const nomeEl = linha.querySelector('.ponto-resumo-nome');
    const nome = String(nomeEl?.childNodes?.[0]?.textContent || nomeEl?.textContent || '').toUpperCase().trim();
    if (!nomesAjustados.has(nome)) return;
    linha.classList.add('ponto-ajustado-admin');
    const sequenciaEl = linha.querySelector('.ponto-resumo-sequencia');
    if (sequenciaEl && !sequenciaEl.querySelector('.ponto-ajuste-badge')) {
      const ajustesNome = ajustes.filter(a => String(a.funcionario_nome || relatorioPontoFuncionarioCache[String(a.funcionario_id)] || '').toUpperCase().trim() === nome);
      sequenciaEl.insertAdjacentHTML('afterbegin', montarHtmlAjustesPonto(ajustesNome));
    }
  });
};

async function carregarRelatorioPonto() {
  const lista = document.getElementById('listaRelatorioPonto');
  if (!lista) return;
  lista.innerHTML = '<div class="empty">Carregando⬦</div>';
  const body = document.getElementById('relatorioPontoRegistrosBody');
  const btnToggle = document.getElementById('btnToggleRegistrosRelatorioPonto');
  if (body && !relatorioPontoRegistrosVisiveis) body.hidden = true;
  if (btnToggle) btnToggle.textContent = relatorioPontoRegistrosVisiveis ? 'Ocultar registros' : 'Mostrar registros';

  await carregarSelectFuncionariosPonto();
  const funcionarioRestritoId = obterFuncionarioRestritoLogadoIdParaPonto();
  const funcionarioFiltroEl = document.getElementById('filtroPontoFuncionario');
  const funcionariosSelecionados = funcionarioFiltroEl?.classList?.contains('relatorio-check-filter')
    ? obterValoresCheckboxFiltroRelatorioFinanceiro('filtroPontoFuncionario')
    : [String(funcionarioFiltroEl?.value || '').trim()].filter(Boolean);
  const funcionarioIds = funcionarioRestritoId ? [String(funcionarioRestritoId)] : funcionariosSelecionados;
  const funcionarioId = funcionarioIds.length === 1 ? funcionarioIds[0] : '';
  const dataInicioEl = document.getElementById('filtroPontoDataInicio');
  const dataFimEl = document.getElementById('filtroPontoDataFim');
  if (dataInicioEl && dataFimEl && !dataInicioEl.value && !dataFimEl.value) {
    const hojeLocal = dataLocalISO();
    dataInicioEl.value = hojeLocal;
    dataFimEl.value = hojeLocal;
  }
  const dataInicio = dataInicioEl?.value || '';
  const dataFim = dataFimEl?.value || '';
  const horaInicio = document.getElementById('filtroPontoHoraInicio')?.value || '';
  const horaFim = document.getElementById('filtroPontoHoraFim')?.value || '';
  const funcionariosFiltroTexto = obterRotulosCheckboxFiltroRelatorioFinanceiro('filtroPontoFuncionario', 'Todos os funcionários');
  const infoPeriodo = `Período: ${dataInicio || '-'} até ${dataFim || '-'} | Funcionários: ${funcionariosFiltroTexto}.`;
  let query = sb.from('ponto_registros').select('id, funcionario_id, data_ponto, entrada_em, saida_em, created_at, loja_id, empresa_id').order('data_ponto', { ascending: false }).order('entrada_em', { ascending: false });
  if (funcionarioIds.length === 1) query = query.eq('funcionario_id', funcionarioIds[0]);
  if (funcionarioIds.length > 1) query = query.in('funcionario_id', funcionarioIds);
  if (dataInicio) query = query.gte('data_ponto', dataInicio);
  if (dataFim) query = query.lte('data_ponto', dataFim);
  const { data, error } = await query;
  if (error) {
    if (isMissingTimeClockTableError(error)) {
      lista.innerHTML = '<div class="empty">Rode o SQL da tabela ponto_registros para habilitar o relatório de ponto.</div>';
      setMsg('msgRelatorioPonto', 'Tabela ponto_registros não encontrada no banco.', 'err');
      return;
    }
    lista.innerHTML = '<div class="empty">Erro ao carregar relatório de ponto.</div>';
    setMsg('msgRelatorioPonto', 'Não foi possível carregar o relatório de ponto.', 'err');
    return;
  }
  let rows = data || [];
  rows = await complementarRegistrosPontoSemFiltroLoja(rows, {
    inicio: dataInicio,
    fim: dataFim,
    funcionarioId: funcionarioIds,
    campos: 'id, funcionario_id, data_ponto, entrada_em, inicio_intervalo_em, retorno_intervalo_em, saida_em, created_at, loja_id, empresa_id',
  });
  if (dataInicio && dataFim && dataInicio === dataFim) {
    rows = await complementarRegistrosPontoSemFiltroLojaPorCreatedAtDia(rows, {
      diaIso: dataInicio,
      funcionarioId: funcionarioIds,
      campos: 'id, funcionario_id, data_ponto, entrada_em, inicio_intervalo_em, retorno_intervalo_em, saida_em, created_at, loja_id, empresa_id',
    });
  }
  rows = await filtrarRegistrosPontoPorFuncionariosVisiveis(rows, funcionarioIds);
  rows = await anexarNomesFuncionariosARegistrosPonto(rows);
  const registrosIds = rows.map(item => item.id).filter(Boolean);
  let intervalosPorRegistro = {};
  if (registrosIds.length) {
    const { data: intervalosData, error: intervalosError } = await sb.from('ponto_intervalos').select('id, ponto_registro_id, ordem, inicio_em, retorno_em').in('ponto_registro_id', registrosIds).order('ordem', { ascending: true });
    if (intervalosError && !isMissingTimeClockIntervalsTableError(intervalosError)) {
      setMsg('msgRelatorioPonto', 'Não foi possível carregar os intervalos de ponto.', 'err');
      return;
    }
    (intervalosData || []).forEach(item => {
      const chave = String(item.ponto_registro_id);
      if (!intervalosPorRegistro[chave]) intervalosPorRegistro[chave] = [];
      intervalosPorRegistro[chave].push(item);
    });
  }
  rows = rows.map(item => ({ ...item, intervalos_ponto: intervalosPorRegistro[String(item.id)] || [] }));
  rows = rows.filter(item => registroAtendeFiltroHorario(item, horaInicio, horaFim));
  const ajustes = await carregarAjustesAprovadosPontoPorPeriodo(dataInicio, dataFim, funcionarioId);
  const ajustesMapa = montarMapaAjustesPonto(ajustes);
  rows = rows.map(item => ({ ...item, ajustes_admin: ajustesMapa[`${String(item.funcionario_id || '')}|${String(item.data_ponto || '')}`] || [] }));
  window.__relatorioPontoUltimosRows = rows;
  window.__relatorioPontoUltimoPeriodo = infoPeriodo;
  atualizarPainelRelatorioPonto(rows, infoPeriodo);
  if (!rows.length) {
    lista.innerHTML = '<div class="empty">Nenhum registro de ponto encontrado com os filtros informados.</div>';
    setMsg('msgRelatorioPonto', '', '');
    return;
  }
  lista.innerHTML = '<div class="lista">' + rows.map(item => {
    const nomeFuncionario = item.funcionarios?.nome || relatorioPontoFuncionarioCache[String(item.funcionario_id)] || 'Funcionário';
    const resumoJornada = obterResumoJornadaPonto(item, item.intervalos_ponto || []);
    const ajustesHtml = montarHtmlAjustesPonto(item.ajustes_admin || []);
    return `<div class="item${item.ajustes_admin?.length ? ' ponto-ajustado-admin' : ''}">
        <div class="item-info"><div class="item-nome">${escapeHtmlPonto(nomeFuncionario)} · ${formatarDataPonto(item.data_ponto)}</div><div class="item-detalhe">Entrada: ${formatarHoraPonto(item.entrada_em)} · ${montarResumoIntervalos(item.intervalos_ponto || [])} · Saída: ${formatarHoraPonto(item.saida_em)}</div><div class="item-detalhe">Status: ${resumoJornada.status}</div><div class="item-detalhe">Total trabalhado no dia: ${resumoJornada.totalTexto}</div>${ajustesHtml}</div>
        <div class="item-actions">${resumoJornada.proximaAcao === 'Retorno' ? '<span class="tag tag-amber">Fora</span>' : '<span class="tag tag-green">Em jornada</span>'}</div>
      </div>`;
  }).join('') + '</div>';
  setMsg('msgRelatorioPonto', `${rows.length} registro(s) encontrado(s).`, 'ok');
}

function montarLinhasExportacaoRelatorioPonto() {
  const rows = window.__relatorioPontoUltimosRows || [];
  return rows.map(item => {
    const nome = item.funcionarios?.nome || relatorioPontoFuncionarioCache[String(item.funcionario_id)] || 'Funcionário';
    const resumo = obterResumoJornadaPonto(item, item.intervalos_ponto || []);
    const ajustes = (item.ajustes_admin || []).map(aj => {
      const tipo = String(aj.motivo || '').includes('[ANULACAO MANUAL ADMIN]') ? 'Anulação manual ADM' : 'Ajuste manual ADM';
      return `${tipo} em ${aj.data_ajuste || '-'} às ${formatarHorarioAjustePonto(aj.horario_ajuste)} por ${aj.aprovado_por_nome || 'Administrador'} (${formatarDataHoraSolicitacaoPonto(aj.aprovado_em || aj.solicitado_em)})`;
    }).join(' | ');
    return { Funcionario: nome, Data: item.data_ponto || '', Entrada: formatarHoraPonto(item.entrada_em), Intervalos: montarResumoIntervalos(item.intervalos_ponto || []).replace(/<[^>]+>/g, ''), Saida: formatarHoraPonto(item.saida_em), Status: resumo.status, Total: resumo.totalTexto, Ajustes_ADM: ajustes || 'Sem ajuste manual ADM' };
  });
}

function exportarRelatorioPontoExcel() {
  const linhas = montarLinhasExportacaoRelatorioPonto();
  if (!linhas.length) { setMsg('msgRelatorioPonto', 'Nenhum registro para exportar.', 'err'); return; }
  const headers = Object.keys(linhas[0]);
  const csv = [headers.join(';')].concat(linhas.map(row => headers.map(h => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(';'))).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `relatorio-ponto-${dataLocalISO()}.csv`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

function exportarRelatorioPontoPDF() {
  const linhas = montarLinhasExportacaoRelatorioPonto();
  if (!linhas.length) { setMsg('msgRelatorioPonto', 'Nenhum registro para exportar.', 'err'); return; }
  const htmlLinhas = linhas.map(row => `<tr><td>${escapeHtmlPonto(row.Funcionario)}</td><td>${escapeHtmlPonto(row.Data)}</td><td>${escapeHtmlPonto(row.Entrada)}</td><td>${escapeHtmlPonto(row.Intervalos)}</td><td>${escapeHtmlPonto(row.Saida)}</td><td>${escapeHtmlPonto(row.Status)}</td><td>${escapeHtmlPonto(row.Total)}</td><td>${escapeHtmlPonto(row.Ajustes_ADM)}</td></tr>`).join('');
  const win = window.open('', '_blank');
  if (!win) { setMsg('msgRelatorioPonto', 'O navegador bloqueou a janela de PDF.', 'err'); return; }
  const geradoEm = new Date().toLocaleString('pt-BR');
  const filtrosRodape = window.__relatorioPontoUltimoPeriodo || 'Filtros aplicados na tela de Relatório ponto';
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Relatório de ponto</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}h1{font-size:20px}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #ccc;padding:6px;text-align:left;vertical-align:top}th{background:#f1f5f9}${cssRodapeRelatorioImpressao()}</style></head><body><h1>Relatório de ponto</h1><p>${escapeHtmlPonto(window.__relatorioPontoUltimoPeriodo || '')}</p><table><thead><tr><th>Funcionário</th><th>Data</th><th>Entrada</th><th>Intervalos</th><th>Saída</th><th>Status</th><th>Total</th><th>Ajustes ADM</th></tr></thead><tbody>${htmlLinhas}</tbody></table>${htmlRodapeRelatorioImpressao(geradoEm, filtrosRodape)}<script>window.onload=function(){window.print();}<\/script>


</body></html>`);
  win.document.close();
}

  configurarAberturaAutomaticaDatePicker();
  configurarEnterCadastrosFinanceiros();
  // Verificação obrigatória de versão desativada temporariamente.


/* === FIX 3.1.38: ponto com 2 intervalos reais no front ===
   Regra atual:
   1) entrada
   2) saída intervalo 1
   3) retorno intervalo 1
   4) saída intervalo 2
   5) retorno intervalo 2
   6) saída final
   Observação: não usa mais a RPC registrar_ponto_funcionario_v2, porque ela podia estar limitada a 1 intervalo.
*/
async function registrarPontoFuncionario() {
  if (!usuarioPodeAcessar('bater_ponto')) {
    setMsg('msgPonto', 'Seu perfil não possui permissão para bater ponto.', 'err');
    return;
  }
  const funcionarioRestritoId = obterFuncionarioRestritoLogadoIdParaPonto();
  const terminalCompartilhadoPonto = usuarioLogadoEhTerminalCompartilhadoPonto();
  const restringirPontoAoUsuarioLogado = funcionarioRestritoId && !terminalCompartilhadoPonto;
  const campoPin = document.getElementById('pontoPinInput');
  const pin = String(campoPin?.value || '').trim();

  let funcionario = null;
  try {
    if (restringirPontoAoUsuarioLogado) {
      funcionario = await obterFuncionarioLogadoParaPonto();
    } else {
      if (!pin) {
        setMsg('msgPonto', 'Digite o PIN do funcionário.', 'err');
        return;
      }
      funcionario = await obterFuncionarioAtivoPorPin(pin);
    }
  } catch (error) {
    setMsg('msgPonto', `Não foi possível validar o funcionário: ${mensagemErroSupabase(error, 'erro desconhecido')}`, 'err');
    return;
  }

  if (!funcionario?.id) {
    setMsg('msgPonto', restringirPontoAoUsuarioLogado ? 'Usuário não encontrado ou inativo.' : 'PIN inválido.', 'err');
    return;
  }

  const funcionarioId = String(funcionario.id);
  relatorioPontoFuncionarioCache[funcionarioId] = funcionario.nome || 'Funcionário';

  const agora = new Date().toISOString();
  const dataHoje = dataLocalISO();
  const lojaId = usuarioSistemaLogado?.loja_id || funcionario.loja_id || lojaAtualId || null;
  const empresaId = usuarioSistemaLogado?.empresa_id || funcionario.empresa_id || empresaAtualId || null;
  const auditoriaPonto = await obterGeolocalizacaoAtualPonto();

  const BLOQUEIO_BATIDA_MS = 10 * 60 * 1000;
  const chaveBloqueioLocal = `zuqui_ultima_batida_ponto_${funcionarioId}`;

  function avisarBatidaBloqueada(isoUltimaBatida) {
    const nomeAviso = funcionario.nome || 'FUNCIONÁRIO';
    const horaAviso = (typeof formatarHoraPonto === 'function')
      ? formatarHoraPonto(isoUltimaBatida)
      : new Date(isoUltimaBatida).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    setMsg('msgPonto', `PONTO BATIDO HÁ MENOS DE 10 MINUTOS: ${nomeAviso} às ${horaAviso}. AGUARDE PARA REGISTRAR NOVAMENTE.`, 'err ponto-alerta-dez-minutos');
    falarAlertaPontoBatidoMenosDezMinutos(nomeAviso);
    if (campoPin) campoPin.value = '';
  }

  try {
    const brutoLocal = localStorage.getItem(chaveBloqueioLocal);
    const ultimaLocal = brutoLocal ? JSON.parse(brutoLocal) : null;
    const msLocal = ultimaLocal?.iso ? new Date(ultimaLocal.iso).getTime() : NaN;
    if (Number.isFinite(msLocal) && Date.now() >= msLocal && (Date.now() - msLocal) < BLOQUEIO_BATIDA_MS) {
      avisarBatidaBloqueada(ultimaLocal.iso);
      return;
    }
  } catch (_) {}

  try {
    const { data: auditoriaHoje, error: erroAuditoriaHoje } = await sb
      .from('ponto_batidas_auditoria')
      .select('registrado_em, tipo_batida, origem_registro')
      .eq('funcionario_id', funcionarioId)
      .gte('registrado_em', `${dataHoje}T00:00:00`)
      .lt('registrado_em', `${dataHoje}T23:59:59`)
      .order('registrado_em', { ascending: false })
      .limit(10);

    if (!erroAuditoriaHoje) {
      const batidasValidas = (auditoriaHoje || [])
        .filter(item => {
          const tipo = String(item?.tipo_batida || '').toLowerCase();
          const origem = String(item?.origem_registro || '').toLowerCase();
          const veioDeAjuste = origem.includes('ajuste') || origem.includes('manual') || tipo.includes('ajuste') || tipo.includes('manual');
          return !veioDeAjuste && item?.registrado_em;
        })
        .map(item => ({ iso: item.registrado_em, ms: new Date(item.registrado_em).getTime() }))
        .filter(item => Number.isFinite(item.ms))
        .sort((a, b) => a.ms - b.ms);

      const ultimaBatida = batidasValidas[batidasValidas.length - 1] || null;
      if (ultimaBatida && Date.now() >= ultimaBatida.ms && (Date.now() - ultimaBatida.ms) < BLOQUEIO_BATIDA_MS) {
        localStorage.setItem(chaveBloqueioLocal, JSON.stringify({ iso: ultimaBatida.iso, funcionarioId, nome: funcionario.nome || '' }));
        avisarBatidaBloqueada(ultimaBatida.iso);
        return;
      }
    } else {
      console.warn('Auditoria de batidas indisponível para bloqueio de 10 minutos:', erroAuditoriaHoje);
    }
  } catch (erroValidacaoDezMinutos) {
    console.warn('Não foi possível validar bloqueio real de batida em 10 minutos:', erroValidacaoDezMinutos);
  }

  // Reserva atômica no banco: impede dois cliques, abas ou dispositivos de
  // gravarem simultaneamente antes de a auditoria da primeira batida existir.
  let tokenReservaBatida = '';
  try {
    const { data: tokenReserva, error: erroReserva } = await executarSemFiltrosTenantTemporario(() => sb.rpc('reservar_batida_ponto', {
      p_funcionario_id: funcionarioId,
    }));
    if (erroReserva) throw erroReserva;
    const tokenReservaTexto = String(tokenReserva ?? '').trim();
    tokenReservaBatida = ['null', 'undefined'].includes(tokenReservaTexto.toLowerCase()) ? '' : tokenReservaTexto;
    if (!tokenReservaBatida) {
      avisarBatidaBloqueada(agora);
      return;
    }
    localStorage.setItem(chaveBloqueioLocal, JSON.stringify({ iso: agora, funcionarioId, nome: funcionario.nome || '' }));
  } catch (erroReserva) {
    setMsg('msgPonto', `Não foi possível validar o intervalo mínimo entre batidas: ${mensagemErroSupabase(erroReserva, 'erro desconhecido')}`, 'err');
    return;
  }

  async function liberarReservaBatidaSeFalhar() {
    if (!tokenReservaBatida) return;
    try {
      await executarSemFiltrosTenantTemporario(() => sb.rpc('liberar_reserva_batida_ponto', {
        p_funcionario_id: funcionarioId,
        p_token: tokenReservaBatida,
      }));
    } catch (_) {}
    tokenReservaBatida = '';
  }

  async function buscarRegistroPontoAbertoOuDoDia() {
    // Regra definitiva do ponto: 1 registro por funcionário/dia em ponto_registros.
    // Não filtra por loja_id aqui, porque registros antigos/ajustados podem estar sem loja
    // ou com loja divergente. Filtrar por loja fazia o sistema não encontrar o ponto aberto
    // e criar uma nova entrada indevida no mesmo dia.
    const selecionarCampos = 'id, funcionario_id, data_ponto, entrada_em, inicio_intervalo_em, retorno_intervalo_em, saida_em, created_at, loja_id, empresa_id';

    // Suspende tambem o filtro automatico de empresa. O indice unico legado e
    // global por funcionario/data; alguns registros antigos da ZUQUI ficaram
    // com empresa_id/loja_id divergentes e, quando ocultos pelo filtro do
    // frontend, provocavam uma nova tentativa de INSERT e o erro 23505.
    let resp = await executarSemFiltrosTenantTemporario(() => sb
      .from('ponto_registros')
      .select(selecionarCampos)
      .eq('funcionario_id', funcionarioId)
      .eq('data_ponto', dataHoje)
      .order('created_at', { ascending: true })
      .limit(20));
    if (resp.error) throw resp.error;

    const registrosDoDia = resp.data || [];
    if (!registrosDoDia.length) return null;

    const abertos = registrosDoDia.filter(r => !r.saida_em);
    if (abertos.length) {
      // Usa sempre o primeiro aberto do dia para continuar a sequência.
      // Isso evita transformar a próxima batida em nova entrada.
      return abertos[0];
    }

    // Se todos estão fechados, devolve o primeiro registro do dia para bloquear nova entrada
    // ou permitir mensagem de ponto já fechado, sem criar duplicidade.
    return registrosDoDia[0] || null;
  }

  async function carregarIntervalosDoRegistro(registroId) {
    if (!registroId) return [];
    try {
      const { data, error } = await sb
        .from('ponto_intervalos')
        .select('id, ponto_registro_id, ordem, inicio_em, retorno_em')
        .eq('ponto_registro_id', registroId)
        .order('ordem', { ascending: true });
      if (error) {
        if (isMissingTimeClockIntervalsTableError(error)) return [];
        throw error;
      }
      return data || [];
    } catch (error) {
      if (isMissingTimeClockIntervalsTableError(error)) return [];
      throw error;
    }
  }

  async function atualizarRegistroPonto(registroId, camposBasicos, tipoAuditoria) {
    const campos = {
      ...camposBasicos,
      updated_at: agora,
      ...montarCamposAuditoriaPonto(auditoriaPonto, tipoAuditoria),
    };
    return executarSemFiltrosTenantTemporario(() => executarComFallbackColunasPonto(
      (payload) => sb.from('ponto_registros').update(payload).eq('id', registroId).select('id').maybeSingle(),
      campos,
      { ...camposBasicos, updated_at: agora },
    ));
  }

  async function registrarAuditoriaSegura(pontoRegistroId, tipoBatida) {
    if (!pontoRegistroId || !tipoBatida) return;
    try {
      await registrarAuditoriaBatidaPonto({
        pontoRegistroId,
        funcionarioId,
        tipoBatida,
        registradoEm: agora,
        meta: auditoriaPonto,
      });
    } catch (auditError) {
      console.warn('Auditoria do ponto não registrada:', auditError);
    }
  }

  let registro = null;
  let tipoBatidaRegistrada = '';
  let tipoAvisoPonto = 'iniciado';
  let pontoRegistroAuditoriaId = '';
  let descricaoBatida = 'PONTO REGISTRADO';

  try {
    registro = await buscarRegistroPontoAbertoOuDoDia();

    if (!registro) {
      // A abertura passa por RPC SECURITY DEFINER: o banco valida novamente o
      // PIN e usa loja/empresa do cadastro ativo do funcionario. Assim a RLS
      // continua protegendo a tabela sem bloquear terminais com claim antigo.
      const respostaEntrada = await executarSemFiltrosTenantTemporario(() => sb.rpc('abrir_ponto_funcionario_seguro', {
        p_funcionario_id: funcionarioId,
        p_pin: pin,
        p_data: dataHoje,
        p_entrada_em: agora,
      }));
      if (respostaEntrada.error) {
        throw respostaEntrada.error;
      }
      if (respostaEntrada.data?.criado === false) {
        registro = await buscarRegistroPontoAbertoOuDoDia();
        if (!registro?.id) throw new Error('O ponto do dia existe, mas nao pode ser carregado pelo terminal.');
      } else {
        pontoRegistroAuditoriaId = respostaEntrada.data?.id || '';
        tipoBatidaRegistrada = 'entrada';
        tipoAvisoPonto = 'iniciado';
        descricaoBatida = 'PONTO REGISTRADO';
      }
    }

    if (registro) {
      pontoRegistroAuditoriaId = registro.id;
      const intervalosExtras = await carregarIntervalosDoRegistro(registro.id);
      const ultimoExtra = intervalosExtras[intervalosExtras.length - 1] || null;

      if (!registro.entrada_em) {
        const { error } = await atualizarRegistroPonto(registro.id, { entrada_em: agora, saida_em: null, loja_id: lojaId, empresa_id: empresaId }, 'entrada');
        if (error) throw error;
        tipoBatidaRegistrada = 'entrada';
        tipoAvisoPonto = 'iniciado';
        descricaoBatida = 'PONTO REGISTRADO';
      } else if (registro.saida_em && registro.inicio_intervalo_em && !registro.retorno_intervalo_em) {
        // Correção segura: em alguns casos com ajuste manual, o retorno do intervalo foi salvo em saida_em.
        // Quando o funcionário bater novamente, repara o retorno e registra esta batida como saída final.
        const retornoLegado = registro.saida_em;
        const { error } = await atualizarRegistroPonto(
          registro.id,
          { retorno_intervalo_em: retornoLegado, saida_em: agora, loja_id: lojaId, empresa_id: empresaId },
          'saida_reparada_apos_retorno_legado'
        );
        if (error) throw error;
        try {
          await registrarAuditoriaBatidaPonto({
            pontoRegistroId: registro.id,
            funcionarioId,
            tipoBatida: 'retorno_intervalo_1_reparado',
            registradoEm: retornoLegado,
            meta: auditoriaPonto,
          });
        } catch (auditError) {
          console.warn('Auditoria do retorno reparado não registrada:', auditError);
        }
        tipoBatidaRegistrada = 'saida';
        tipoAvisoPonto = 'parado';
        descricaoBatida = 'PONTO FECHADO';
      } else if (registro.saida_em) {
        await liberarReservaBatidaSeFalhar();
        setMsg('msgPonto', 'Ponto já fechado hoje para este funcionário.', 'err');
        if (campoPin) campoPin.value = '';
        return;
      } else if (!registro.inicio_intervalo_em && !registro.retorno_intervalo_em) {
        const saidaFinalSemIntervalo = batidaPontoProximaDoFimDoTurno(funcionario, agora);
        if (saidaFinalSemIntervalo) {
          const { error } = await atualizarRegistroPonto(registro.id, { saida_em: agora, loja_id: lojaId, empresa_id: empresaId }, 'saida');
          if (error) throw error;
          tipoBatidaRegistrada = 'saida';
          tipoAvisoPonto = 'parado';
          descricaoBatida = 'PONTO FECHADO';
        } else {
          const { error } = await atualizarRegistroPonto(registro.id, { inicio_intervalo_em: agora, loja_id: lojaId, empresa_id: empresaId }, 'saida_intervalo_1');
          if (error) throw error;
          tipoBatidaRegistrada = 'saida_intervalo_1';
          tipoAvisoPonto = 'parado';
          descricaoBatida = 'INTERVALO 1 INICIADO';
        }
      } else if (registro.inicio_intervalo_em && !registro.retorno_intervalo_em) {
        const { error } = await atualizarRegistroPonto(registro.id, { retorno_intervalo_em: agora, loja_id: lojaId, empresa_id: empresaId }, 'retorno_intervalo_1');
        if (error) throw error;
        tipoBatidaRegistrada = 'retorno_intervalo_1';
        tipoAvisoPonto = 'iniciado';
        descricaoBatida = 'RETORNO 1 REGISTRADO';
      } else if (registro.inicio_intervalo_em && registro.retorno_intervalo_em && !ultimoExtra) {
        // 4ª batida: inicia o 2º intervalo, exceto quando estiver claramente no fim do turno.
        const saidaFinalDepoisDeUmIntervalo = batidaPontoProximaDoFimDoTurno(funcionario, agora);
        if (saidaFinalDepoisDeUmIntervalo) {
          const { error } = await atualizarRegistroPonto(registro.id, { saida_em: agora, loja_id: lojaId, empresa_id: empresaId }, 'saida');
          if (error) throw error;
          tipoBatidaRegistrada = 'saida';
          tipoAvisoPonto = 'parado';
          descricaoBatida = 'PONTO FECHADO';
        } else {
          const payloadIntervalo2 = { ponto_registro_id: registro.id, ordem: 2, inicio_em: agora, retorno_em: null };
          const { error } = await sb.from('ponto_intervalos').insert([payloadIntervalo2]);
          if (error) throw error;
          tipoBatidaRegistrada = 'saida_intervalo_2';
          tipoAvisoPonto = 'parado';
          descricaoBatida = 'INTERVALO 2 INICIADO';
        }
      } else if (ultimoExtra && ultimoExtra.inicio_em && !ultimoExtra.retorno_em) {
        const { error } = await sb
          .from('ponto_intervalos')
          .update({ retorno_em: agora })
          .eq('id', ultimoExtra.id);
        if (error) throw error;
        await atualizarRegistroPonto(registro.id, { loja_id: lojaId, empresa_id: empresaId }, 'retorno_intervalo_2');
        tipoBatidaRegistrada = 'retorno_intervalo_2';
        tipoAvisoPonto = 'iniciado';
        descricaoBatida = 'RETORNO 2 REGISTRADO';
      } else if (ultimoExtra && ultimoExtra.inicio_em && ultimoExtra.retorno_em) {
        const { error } = await atualizarRegistroPonto(registro.id, { saida_em: agora, loja_id: lojaId, empresa_id: empresaId }, 'saida');
        if (error) throw error;
        tipoBatidaRegistrada = 'saida';
        tipoAvisoPonto = 'parado';
        descricaoBatida = 'PONTO FECHADO';
      } else {
        await liberarReservaBatidaSeFalhar();
        setMsg('msgPonto', 'Sequência de ponto inconsistente. Verifique o ajuste manual do dia.', 'err');
        if (campoPin) campoPin.value = '';
        return;
      }
    }
  } catch (error) {
    await liberarReservaBatidaSeFalhar();
    setMsg('msgPonto', `Não foi possível registrar o ponto: ${mensagemErroSupabase(error, 'erro desconhecido')}`, 'err');
    return;
  }

  await registrarAuditoriaSegura(pontoRegistroAuditoriaId, tipoBatidaRegistrada);

  try {
    localStorage.setItem(chaveBloqueioLocal, JSON.stringify({
      iso: agora,
      funcionarioId,
      nome: funcionario.nome || ''
    }));
  } catch (_) {}

  setMsg('msgPonto', `${descricaoBatida} "${funcionario.nome || 'FUNCIONÁRIO'}"`, 'ok');
  exibirAvisoPontoRegistrado(funcionario.nome || 'FUNCIONÁRIO', tipoAvisoPonto);

  if (campoPin) campoPin.value = '';
  if (timeoutLimpezaPinPonto) {
    clearTimeout(timeoutLimpezaPinPonto);
    timeoutLimpezaPinPonto = null;
  }
  await carregarResumoPontoHoje(restringirPontoAoUsuarioLogado ? funcionarioRestritoId : '');
  await carregarHorasDashboard();
  if (obterPaginaAtivaAtual() === 'relatorio_ponto') {
    await carregarRelatorioPonto();
  }
}


/* === FIX 3.1.32: ajuste manual de ponto sem duplicate key na fonte ===
   Mantém 1 linha por funcionário/dia em ponto_registros.
   Se o registro já existir, nunca tenta criar outra linha: carrega/atualiza e reorganiza a sequência.
*/
async function aplicarAjusteAprovadoNoPonto(solicitacao) {
  const funcionarioId = String(solicitacao?.funcionario_id || '').trim();
  const dataAjuste = String(solicitacao?.data_ajuste || '').trim();
  const horarioAjuste = String(solicitacao?.horario_ajuste || '').trim().slice(0, 5);

  if (!funcionarioId || !dataAjuste || !/^\d{2}:\d{2}$/.test(horarioAjuste)) {
    return { ok: false, mensagem: 'Solicitação sem funcionário, data ou horário válidos.' };
  }

  const ajusteIso = new Date(`${dataAjuste}T${horarioAjuste}:00`).toISOString();
  if (!ajusteIso || Number.isNaN(new Date(ajusteIso).getTime())) {
    return { ok: false, mensagem: 'Horário do ajuste inválido.' };
  }

  const normalizarIso = (valor) => {
    if (!valor) return '';
    const d = new Date(valor);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString();
  };

  const ordenarUnicos = (valores = []) => {
    const mapa = new Map();
    valores.map(normalizarIso).filter(Boolean).forEach((iso) => mapa.set(iso, iso));
    return [...mapa.values()].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  };

  async function buscarRegistroSeguro() {
    const { data, error } = await sb
      .from('ponto_registros')
      .select('id, funcionario_id, data_ponto, entrada_em, inicio_intervalo_em, retorno_intervalo_em, saida_em, created_at, loja_id, empresa_id')
      .eq('funcionario_id', funcionarioId)
      .eq('data_ponto', dataAjuste)
      .order('created_at', { ascending: true })
      .limit(1);
    if (error) throw error;
    return (data || [])[0] || null;
  }

  let funcionarioInfo = null;
  try {
    const { data } = await sb
      .from('funcionarios')
      .select('id, nome, loja_id, empresa_id')
      .eq('id', funcionarioId)
      .maybeSingle();
    funcionarioInfo = data || null;
  } catch (_) {}

  const tenantLojaId = solicitacao?.loja_id || funcionarioInfo?.loja_id || lojaAtualId || null;
  const tenantEmpresaId = solicitacao?.empresa_id || funcionarioInfo?.empresa_id || empresaAtualId || null;

  try {
    let registro = await buscarRegistroSeguro();
    let intervalos = [];

    if (registro?.id) {
      try {
        const { data: intervalosData, error: erroInt } = await sb
          .from('ponto_intervalos')
          .select('id, ponto_registro_id, ordem, inicio_em, retorno_em')
          .eq('ponto_registro_id', registro.id)
          .order('ordem', { ascending: true });
        if (erroInt && !isMissingTimeClockIntervalsTableError(erroInt)) throw erroInt;
        intervalos = isMissingTimeClockIntervalsTableError(erroInt) ? [] : (intervalosData || []);
      } catch (erroInt) {
        if (!isMissingTimeClockIntervalsTableError(erroInt)) throw erroInt;
      }
    }

    if (!registro?.id) {
      const payloadNovo = {
        funcionario_id: funcionarioId,
        data_ponto: dataAjuste,
        entrada_em: ajusteIso,
        inicio_intervalo_em: null,
        retorno_intervalo_em: null,
        saida_em: null,
      };
      if (tenantEmpresaId) payloadNovo.empresa_id = tenantEmpresaId;
      if (tenantLojaId) payloadNovo.loja_id = tenantLojaId;

      const { error: erroInsert } = await sb.from('ponto_registros').insert([payloadNovo]);
      if (!erroInsert) return { ok: true, mensagem: 'Ajuste manual criou a entrada do dia.' };

      if (String(erroInsert.code || '') !== '23505') {
        return { ok: false, mensagem: mensagemErroSupabase(erroInsert, 'erro desconhecido') };
      }

      // Se a linha já existe, não tentamos inserir de novo. Recarrega e atualiza.
      registro = await buscarRegistroSeguro();
      if (!registro?.id) {
        // Último recurso: em bancos com política/filtro que oculta a linha existente, aplica como saída final.
        const payloadSaida = { saida_em: ajusteIso, updated_at: new Date().toISOString() };
        if (tenantEmpresaId) payloadSaida.empresa_id = tenantEmpresaId;
        if (tenantLojaId) payloadSaida.loja_id = tenantLojaId;
        const { data: atualizados, error: erroUpdateDireto } = await sb
          .from('ponto_registros')
          .update(payloadSaida)
          .eq('funcionario_id', funcionarioId)
          .eq('data_ponto', dataAjuste)
          .select('id');
        if (erroUpdateDireto) return { ok: false, mensagem: mensagemErroSupabase(erroUpdateDireto, 'erro desconhecido') };
        if ((atualizados || []).length) return { ok: true, mensagem: 'Ajuste aplicado no registro existente do dia.' };
        return { ok: false, mensagem: 'Já existe registro nesse dia, mas o sistema não conseguiu ler/atualizar a linha existente. Verifique loja_id/empresa_id/RLS do ponto.' };
      }
    }

    const batidasExistentes = ordenarUnicos(
      montarListaBatidasPonto(registro, intervalos).map(item => item.iso)
    );
    const ajusteMs = new Date(ajusteIso).getTime();
    const ajusteJaExistia = batidasExistentes.some(iso =>
      Math.abs(new Date(iso).getTime() - ajusteMs) <= 2 * 60 * 1000
    );
    const batidas = ordenarUnicos([
      ...batidasExistentes,
      ...(ajusteJaExistia ? [] : [ajusteIso]),
    ]);

    const entradaEm = batidas[0] || null;
    let inicioIntervaloEm = null;
    let retornoIntervaloEm = null;
    let saidaEm = null;
    const novosIntervalos = [];

    if (batidas.length === 2) {
      // 2 batidas: entrada + saída/intervalo aberto, mantendo compatibilidade com o fluxo atual.
      saidaEm = batidas[1];
    } else if (batidas.length === 3) {
      // FIX 3.1.51: 3 batidas significam entrada + saída para intervalo + retorno,
      // portanto a jornada fica aberta após o retorno, sem saída final.
      inicioIntervaloEm = batidas[1];
      retornoIntervaloEm = batidas[2];
      saidaEm = null;
    } else if (batidas.length >= 4) {
      inicioIntervaloEm = batidas[1];
      retornoIntervaloEm = batidas[2];
      saidaEm = batidas.length % 2 === 0 ? batidas[batidas.length - 1] : null;
      const extras = saidaEm ? batidas.slice(3, -1) : batidas.slice(3);
      for (let i = 0; i + 1 < extras.length; i += 2) {
        novosIntervalos.push({
          ponto_registro_id: registro.id,
          ordem: novosIntervalos.length + 2,
          inicio_em: extras[i],
          retorno_em: extras[i + 1],
        });
      }
    }

    const payloadUpdate = {
      entrada_em: entradaEm,
      inicio_intervalo_em: inicioIntervaloEm,
      retorno_intervalo_em: retornoIntervaloEm,
      saida_em: saidaEm,
      updated_at: new Date().toISOString(),
    };
    if (tenantEmpresaId) payloadUpdate.empresa_id = tenantEmpresaId;
    if (tenantLojaId) payloadUpdate.loja_id = tenantLojaId;

    const { error: erroUpdate } = await sb
      .from('ponto_registros')
      .update(payloadUpdate)
      .eq('id', registro.id);
    if (erroUpdate) return { ok: false, mensagem: mensagemErroSupabase(erroUpdate, 'erro desconhecido') };

    try {
      const { error: erroDelete } = await sb.from('ponto_intervalos').delete().eq('ponto_registro_id', registro.id);
      if (erroDelete && !isMissingTimeClockIntervalsTableError(erroDelete)) {
        return { ok: false, mensagem: `Registro principal ajustado, mas houve erro ao limpar intervalos antigos: ${mensagemErroSupabase(erroDelete, 'erro desconhecido')}` };
      }
      if (novosIntervalos.length) {
        const { error: erroInsertInt } = await sb.from('ponto_intervalos').insert(novosIntervalos);
        if (erroInsertInt) return { ok: false, mensagem: `Registro principal ajustado, mas houve erro ao recriar intervalos extras: ${mensagemErroSupabase(erroInsertInt, 'erro desconhecido')}` };
      }
    } catch (erroIntervalo) {
      if (!isMissingTimeClockIntervalsTableError(erroIntervalo)) throw erroIntervalo;
    }

    return {
      ok: true,
      ajusteJaExistia,
      mensagem: ajusteJaExistia
        ? 'A batida desta tentativa já estava gravada; apenas o histórico foi concluído, sem duplicar o ponto.'
        : 'Ajuste manual aplicado editando o registro existente e reorganizando a sequência.'
    };
  } catch (error) {
    return { ok: false, mensagem: mensagemErroSupabase(error, 'erro desconhecido') };
  }
}
