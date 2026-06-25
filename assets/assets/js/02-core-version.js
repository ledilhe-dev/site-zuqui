// ---- CONTROLE DE VERSAO / FORCAR ATUALIZACAO ----
let canalControleVersaoSistema = null;
let controleVersaoSistemaInicializado = false;
let controleVersaoUltimoTokenRecebido = '';
let controleVersaoIgnorarProximoToken = '';
let intervaloControleVersaoSistema = null;
let eventosControleVersaoConfigurados = false;

function obterChaveTokenControleVersaoSistema() {
  const empresaId = obterEmpresaIdSessao?.() || usuarioSistemaLogado?.empresa_id || 'global';
  const lojaId = obterLojaIdSessao?.() || usuarioSistemaLogado?.loja_id || 'global';
  return `checkdiario:controle_versao:${empresaId}:${lojaId}`;
}

function usuarioPodeForcarAtualizacaoGeral() {
  if (!usuarioSistemaLogado) return false;
  // Forçar atualização geral = exclusivo do painel administrativo global
  return usuarioSistemaLogado?.tipo === 'admin' && !String(usuarioSistemaLogado?.loja_id || '').trim();
}

function atualizarBotaoForcarAtualizacaoGeral() {
  const btn = document.getElementById('btnForcarAtualizacaoGeral');
  if (!btn) return;
  btn.style.display = usuarioPodeForcarAtualizacaoGeral() ? '' : 'none';
}

function limparSessaoParaAtualizacaoObrigatoria() {
  try {
    Object.keys(localStorage || {}).forEach(chave => {
      if (String(chave).toLowerCase().includes('zuqui') || String(chave).toLowerCase().includes('checkdiario')) {
        localStorage.removeItem(chave);
      }
    });
  } catch (erro) {
    console.warn('Falha ao limpar localStorage para atualização:', erro);
  }

  try {
    Object.keys(sessionStorage || {}).forEach(chave => {
      if (String(chave).toLowerCase().includes('zuqui') || String(chave).toLowerCase().includes('checkdiario')) {
        sessionStorage.removeItem(chave);
      }
    });
  } catch (erro) {
    console.warn('Falha ao limpar sessionStorage para atualização:', erro);
  }
}

async function executarAtualizacaoObrigatoriaSistema(motivo = 'Atualização obrigatória do sistema') {
  try {
    await sb.auth.signOut();
  } catch (erro) {
    console.warn('Falha ao encerrar auth do Supabase:', erro);
  }

  limparSessaoParaAtualizacaoObrigatoria();

  try {
    alert(`${motivo}.

O sistema será recarregado para buscar a versão mais recente.`);
  } catch (_) {}

  try {
    const url = new URL(window.location.href);
    url.searchParams.set('v', `${APP_VERSION}-forcar-atualizacao-cache`);
    url.searchParams.set('t', String(Date.now()));
    url.hash = '';
    window.location.replace(url.toString());
    return;
  } catch (_) {}

  window.location.reload();
}


function normalizarVersaoControleSistema(valor) {
  const texto = String(valor || '').trim();
  const match = texto.match(/\d+\.\d+\.\d+/);
  return match ? match[0] : texto;
}

async function verificarControleVersaoSistema(silencioso = true) {
  if (!usuarioSistemaLogado) return;

  const { data, error } = await sb
    .from('sistema_controle')
    .select('token_atualizacao, atualizado_em')
    .eq('id', 'global')
    .maybeSingle();

  if (error) {
    if (!silencioso) console.warn('Falha ao consultar atualização geral:', error);
    return;
  }

  const tokenAtual = String(data?.token_atualizacao || data?.atualizado_em || '').trim();
  await processarTokenAtualizacaoGeral(tokenAtual);
}

async function processarTokenAtualizacaoGeral(tokenAtual) {
  if (!tokenAtual || !usuarioSistemaLogado) return;

  const chaveToken = obterChaveTokenControleVersaoSistema();
  let tokenSalvo = '';
  try { tokenSalvo = localStorage.getItem(chaveToken) || ''; } catch (_) {}

  if (controleVersaoIgnorarProximoToken === tokenAtual) {
    try { localStorage.setItem(chaveToken, tokenAtual); } catch (_) {}
    controleVersaoIgnorarProximoToken = '';
    controleVersaoUltimoTokenRecebido = tokenAtual;
    return;
  }

  // Primeiro contato apenas registra a referência atual. Assim um usuário novo
  // não entra em ciclo de logout por uma atualização solicitada no passado.
  if (!tokenSalvo) {
    try { localStorage.setItem(chaveToken, tokenAtual); } catch (_) {}
    controleVersaoUltimoTokenRecebido = tokenAtual;
    return;
  }

  if (tokenSalvo === tokenAtual || controleVersaoUltimoTokenRecebido === tokenAtual) return;

  // Persiste antes de deslogar para impedir repetição caso o navegador demore a recarregar.
  try { localStorage.setItem(chaveToken, tokenAtual); } catch (_) {}
  controleVersaoUltimoTokenRecebido = tokenAtual;
  await executarAtualizacaoObrigatoriaSistema('Atualização geral solicitada pelo administrador');
}

function configurarRealtimeControleVersaoSistema() {
  if (canalControleVersaoSistema) return;

  try {
    canalControleVersaoSistema = sb
      .channel('controle-versao-sistema-global')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'sistema_controle',
        filter: 'id=eq.global',
      }, async (payload) => {
        const novo = payload?.new || {};
        const tokenAtual = String(novo.token_atualizacao || novo.atualizado_em || '').trim();
        await processarTokenAtualizacaoGeral(tokenAtual);
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn('Realtime do controle de versão indisponível.');
        }
      });
  } catch (erro) {
    console.warn('Falha ao configurar Realtime de controle de versão:', erro);
  }
}

function iniciarPollingControleVersaoSistema() {
  if (intervaloControleVersaoSistema) {
    clearInterval(intervaloControleVersaoSistema);
    intervaloControleVersaoSistema = null;
  }

  intervaloControleVersaoSistema = window.setInterval(() => {
    if (!usuarioSistemaLogado) return;
    verificarControleVersaoSistema(true).catch((erro) => {
      console.warn('Falha ao verificar controle de versão por intervalo:', erro);
    });
  }, 5000);
}

function configurarControleVersaoSistema() {
  if (!usuarioSistemaLogado || controleVersaoSistemaInicializado) return;
  controleVersaoSistemaInicializado = true;
  verificarControleVersaoSistema(true);
  configurarRealtimeControleVersaoSistema();
  iniciarPollingControleVersaoSistema();

  if (!eventosControleVersaoConfigurados) {
    eventosControleVersaoConfigurados = true;
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && usuarioSistemaLogado) verificarControleVersaoSistema(true);
    });
    window.addEventListener('online', () => {
      if (usuarioSistemaLogado) verificarControleVersaoSistema(true);
    });
  }
}

async function forcarAtualizacaoGeralUsuarios() {
  if (!usuarioPodeForcarAtualizacaoGeral()) {
    alert('Seu perfil não tem permissão para forçar atualização geral.');
    return;
  }

  const confirmacao = await abrirConfirmacaoSistema({
    title: 'Forçar atualização geral?',
    subtitle: 'Todos os usuários com o sistema aberto serão deslogados e a página será recarregada.',
    body: 'Use esta ação após publicar uma nova versão do sistema.',
    confirmText: 'Forçar atualização',
    confirmClass: 'btn-red',
    cancelText: 'Cancelar',
  });

  if (!confirmacao.confirmado) return;

  const tokenNovo = `${APP_VERSION}-${Date.now()}`;
  controleVersaoIgnorarProximoToken = tokenNovo;
  const payload = {
    id: 'global',
    versao_obrigatoria: APP_VERSION,
    token_atualizacao: tokenNovo,
    atualizado_em: new Date().toISOString(),
    atualizado_por: obterNomeAdminAtual?.() || usuarioSistemaLogado?.nome || usuarioSistemaLogado?.username || 'Administrador',
    atualizado_por_tipo: usuarioSistemaLogado?.tipo || normalizarCodigoPerfil(usuarioSistemaLogado?.perfil?.codigo || '') || 'perfil',
  };

  const { error } = await sb
    .from('sistema_controle')
    .upsert(payload, { onConflict: 'id' });

  if (error) {
    controleVersaoIgnorarProximoToken = '';
    console.error('Erro ao forçar atualização geral:', error);
    alert(`Não foi possível forçar a atualização.\n\nDetalhe: ${error.message || 'verifique a tabela sistema_controle e as policies RLS.'}`);
    return;
  }

  alert('Atualização geral enviada com sucesso. Os usuários com o sistema aberto serão deslogados e recarregados.');

  await executarAtualizacaoObrigatoriaSistema('Atualização geral enviada pelo administrador');
}
