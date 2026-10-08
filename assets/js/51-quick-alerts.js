// TAREFAS RÁPIDAS
//
async function buscarFuncionariosParaAlertaRapido() {
  const empresaId = String(obterEmpresaIdSessao?.() || usuarioSistemaLogado?.empresa_id || '').trim();
  const lojaId = String(obterLojaIdSessao?.() || usuarioSistemaLogado?.loja_id || '').trim();
  const ordenarFuncionarios = (itens = []) => (itens || [])
    .filter(item => item?.id)
    .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'));
  const deduplicarFuncionarios = (itens = []) => {
    const porId = new Map();
    (itens || []).forEach(item => {
      const id = String(item?.id || '').trim();
      if (!id || porId.has(id)) return;
      porId.set(id, item);
    });
    return ordenarFuncionarios(Array.from(porId.values()));
  };

  const consultarFuncionarios = async ({ filtrarLoja = false, ids = [] } = {}) => {
    let query = sb
      .from('funcionarios')
      .select('id, nome, loja_id, empresa_id')
      .eq('ativo', true)
      .order('nome');

    if (empresaId) query = query.eq('empresa_id', empresaId);
    if (filtrarLoja && lojaId) query = query.eq('loja_id', lojaId);
    if (ids.length) query = query.in('id', ids);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  };

  let funcionarios = await consultarFuncionarios({ filtrarLoja: true });
  if (funcionarios.length) return deduplicarFuncionarios(funcionarios);

  if (lojaId) {
    try {
      const { data: vinculos, error: erroVinculos } = await sb
        .from('funcionario_lojas')
        .select('funcionario_id, ativo')
        .eq('loja_id', lojaId)
        .eq('ativo', true);

      if (!erroVinculos && vinculos?.length) {
        const ids = [...new Set(vinculos.map(item => String(item.funcionario_id || '').trim()).filter(Boolean))];
        if (ids.length) {
          funcionarios = await consultarFuncionarios({ ids });
          if (funcionarios.length) return deduplicarFuncionarios(funcionarios);
        }
      } else if (erroVinculos && !String(erroVinculos?.message || '').includes('funcionario_lojas')) {
        console.warn('Falha ao buscar vínculos de funcionários para alerta rápido:', erroVinculos);
      }
    } catch (e) {
      console.warn('Tabela de vínculos de funcionários indisponível para alerta rápido:', e);
    }
  }

  funcionarios = await consultarFuncionarios({ filtrarLoja: false });
  return deduplicarFuncionarios(funcionarios);
}

async function carregarFuncionariosAlertaRapido(silencioso = false) {
  const container = document.getElementById('alertaRapidoFuncionarios');
  if (!container) return;
  if (silencioso && container.querySelector('[data-alerta-funcionario-id]')) {
    return;
  }
  if (!silencioso || !container.querySelector('[data-alerta-funcionario-id]')) {
    container.innerHTML = '<div class="empty">Carregando⬦</div>';
  }

  try {
    const data = await buscarFuncionariosParaAlertaRapido();

    if (!data?.length) {
      container.innerHTML = '<div class="empty">Nenhum funcionário ativo para seleção.</div>';
      return;
    }

    container.innerHTML = data.map(item => `
      <label class="alerta-rapido-check-item">
        <input type="checkbox" data-alerta-funcionario-id="${item.id}" data-alerta-funcionario-nome="${String(item.nome || '').replace(/"/g, '&quot;')}" data-alerta-funcionario-loja-id="${String(item.loja_id || '').replace(/"/g, '&quot;')}" data-alerta-funcionario-empresa-id="${String(item.empresa_id || '').replace(/"/g, '&quot;')}">
        <span>${item.nome}</span>
      </label>
    `).join('');
  } catch (error) {
    console.error('Erro ao carregar funcionários para alerta rápido:', error);
    container.innerHTML = '<div class="empty">Erro ao carregar funcionários.</div>';
  }
}

function coletarFuncionariosSelecionadosAlertaRapido() {
  return Array.from(document.querySelectorAll('[data-alerta-funcionario-id]:checked')).map(input => ({
    id: String(input.getAttribute('data-alerta-funcionario-id') || ''),
    nome: String(input.getAttribute('data-alerta-funcionario-nome') || ''),
    loja_id: String(input.getAttribute('data-alerta-funcionario-loja-id') || '').trim() || null,
    empresa_id: String(input.getAttribute('data-alerta-funcionario-empresa-id') || '').trim() || null,
  })).filter(item => item.id);
}

async function enviarAlertaRapido() {
  if (!usuarioPodeEnviarAlertasRapidos()) {
    setMsg('msgAlertasRapidos', 'Somente o perfil administrativo pode enviar alertas rápidos.', 'err');
    return;
  }
  if (envioAlertaRapidoEmAndamento) {
    setMsg('msgAlertasRapidos', 'Envio de alerta já em andamento. Aguarde concluir para evitar duplicidade.', 'ok');
    return;
  }

  const mensagem = String(document.getElementById('mensagemAlertaRapido')?.value || '').trim();
  const selecionados = coletarFuncionariosSelecionadosAlertaRapido();

  if (!mensagem) {
    setMsg('msgAlertasRapidos', 'Digite a mensagem do alerta rápido.', 'err');
    return;
  }
  if (mensagem.length < 4) {
    setMsg('msgAlertasRapidos', 'Digite uma mensagem com pelo menos 4 caracteres.', 'err');
    return;
  }
  if (!selecionados.length) {
    setMsg('msgAlertasRapidos', 'Selecione ao menos um funcionário para receber o alerta.', 'err');
    return;
  }

  const criadoPorNome = usuarioSistemaLogado?.tipo === 'admin'
    ? (usuarioSistemaLogado?.username || 'Administrador')
    : (usuarioSistemaLogado?.nome || usuarioSistemaLogado?.username || 'Administrador');
  const criadoPorId = usuarioSistemaLogado?.tipo === 'funcionario' ? usuarioSistemaLogado?.id : null;
  const lojaIdAlerta = String(obterLojaIdSessao?.() || usuarioSistemaLogado?.loja_id || '').trim() || null;
  const empresaIdAlerta = String(obterEmpresaIdSessao?.() || usuarioSistemaLogado?.empresa_id || '').trim() || null;
  const grupoId = (window.crypto?.randomUUID?.() || `grupo-${Date.now()}`);

  const registros = selecionados.map(item => ({
    grupo_id: grupoId,
    mensagem,
    funcionario_destino_id: item.id,
    funcionario_destino_nome: item.nome || null,
    criado_por_nome: criadoPorNome || 'Administrador',
    criado_por_id: criadoPorId || null,
    ...(item.loja_id || lojaIdAlerta ? { loja_id: item.loja_id || lojaIdAlerta } : {}),
    ...(item.empresa_id || empresaIdAlerta ? { empresa_id: item.empresa_id || empresaIdAlerta } : {}),
    status: 'pendente',
  }));

  envioAlertaRapidoEmAndamento = true;
  try {
    const { error } = await sb.from('alertas_rapidos').insert(registros);
    if (error) {
      if (isMissingQuickAlertsTableError(error)) {
        setMsg('msgAlertasRapidos', 'Rode o SQL da tabela alertas_rapidos antes de usar esta tela.', 'err');
        return;
      }
      setMsg('msgAlertasRapidos', `Não foi possível enviar o alerta: ${mensagemErroSupabase(error, 'erro desconhecido')}`, 'err');
      return;
    }

    const campoMensagem = document.getElementById('mensagemAlertaRapido');
    if (campoMensagem) campoMensagem.value = '';
    document.querySelectorAll('[data-alerta-funcionario-id]').forEach(input => { input.checked = false; });

    setMsg('msgAlertasRapidos', selecionados.length === document.querySelectorAll('[data-alerta-funcionario-id]').length
      ? `Alerta enviado para todos os funcionários ativos (${selecionados.length}).`
      : `Alerta enviado para ${selecionados.length} funcionário(s).`, 'ok');
    await carregarAlertasRapidos();
    await carregarNotificacoes();
  } finally {
    envioAlertaRapidoEmAndamento = false;
  }
}

async function carregarAlertasRapidos(apenasFuncionario = false, silencioso = false) {
  const lista = document.getElementById('listaAlertasRapidos');
  const tituloLista = document.getElementById('tituloListaAlertaRapido');
  if (!lista) return;
  if (!silencioso) lista.innerHTML = '<div class="empty">Carregando⬦</div>';

  try {
    if (apenasFuncionario) {
      const destino = obterFuncionarioDestinoAlertaRapidoAtual();
      if (tituloLista) {
        tituloLista.textContent = 'Alertas rápidos pendentes';
      }
      if (!usuarioPodeReceberAlertaRapido()) {
        assinaturaSomAlertaRapidoLista = '';
        lista.innerHTML = '<div class="empty">Seu perfil não possui a permissão "Receber notificação de alerta rápido".</div>';
        return;
      }
      if (!destino.id && !destino.nome) {
        assinaturaSomAlertaRapidoLista = '';
        lista.innerHTML = '<div class="empty">Não foi possível identificar o funcionário logado para buscar alertas rápidos.</div>';
        return;
      }
      const data = await buscarAlertasRapidosPendentesParaDestino(destino);
      if (!data?.length) {
        assinaturaSomAlertaRapidoLista = '';
        lista.innerHTML = '<div class="empty">Nenhum alerta rápido pendente.</div>';
        return;
      }

      const assinaturaAtual = (data || [])
        .map(item => String(item.grupo_id || item.id || ''))
        .sort()
        .join('|');

      if (assinaturaAtual && assinaturaAtual !== assinaturaSomAlertaRapidoLista) {
        tocarSomAlertaRapidoNotificacao(true);
        assinaturaSomAlertaRapidoLista = assinaturaAtual;
      }

      lista.innerHTML = '<div class="lista">' + data.map(item => {
        const mensagem = String(item.mensagem || '').trim();
        const destinoId = String(item.funcionario_destino_id || destino.id || '');
        const nomeDestino = String(item.funcionario_destino_nome || 'Funcionário');
        const grupoId = String(item.grupo_id || '');
        const mensagemAttr = mensagem.replace(/"/g, '&quot;');
        const nomeDestinoAttr = nomeDestino.replace(/"/g, '&quot;');
        return `
          <div class="item alerta-rapido-card">
            <div class="item-info">
              <div class="alerta-rapido-funcionario-grande">${nomeDestino}</div>
              <div class="alerta-rapido-mensagem-grande">${mensagem || '-'}</div>
              <div class="item-detalhe">Enviado em: ${fmtDate(item.criado_em)} · Destino: ${nomeDestino}</div>
              <div class="item-detalhe">Qualquer funcionário pode finalizar este aviso com o próprio PIN.</div>
            </div>
            <div class="item-actions">
              <button
                class="btn btn-red btn-sm"
                type="button"
                onclick="confirmarAlertaRapidoDaLista(this)"
                data-alerta-id="${item.id}"
                data-alerta-grupo-id="${grupoId}"
                data-alerta-mensagem="${mensagemAttr}"
                data-alerta-destino-id="${destinoId}"
                data-alerta-destino-nome="${nomeDestinoAttr}"
              >Finalizar com PIN</button>
            </div>
          </div>
        `;
      }).join('') + '</div>';
      return;
    }

    if (tituloLista) {
      tituloLista.textContent = 'Relatório oculto de alertas rápidos';
    }

    atualizarVisibilidadeAlertasRapidosEnviados();
    if (!alertasRapidosListaEnviadosVisivel) {
      lista.innerHTML = '<div class="empty">Relatório salvo e oculto. Clique em "Mostrar relatório" para consultar alertas enviados, pendentes e confirmados.</div>';
      return;
    }

    const filtroStatus = String(document.getElementById('filtroStatusAlertaRapido')?.value || '').trim().toLowerCase();
    const lojaId = String(obterLojaIdSessao?.() || usuarioSistemaLogado?.loja_id || '').trim();
    const consultarListaAdmin = async (campoData = 'criado_em') => {
      let query = sb
        .from('alertas_rapidos')
        .select(`id, grupo_id, mensagem, funcionario_destino_nome, status, ${campoData}, criado_por_nome, confirmado_em, confirmado_por_nome`)
        .order(campoData, { ascending: false })
        .limit(200);

      if (lojaId) {
        query = query.eq('loja_id', lojaId);
      }

      if (filtroStatus === 'pendente' || filtroStatus === 'confirmado') {
        query = query.eq('status', filtroStatus);
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

    let { data, error } = await consultarListaAdmin('criado_em');
    if (error && String(error?.message || '').toLowerCase().includes('criado_em')) {
      ({ data, error } = await consultarListaAdmin('created_at'));
    }

    if (error) {
      if (isMissingQuickAlertsTableError(error)) {
        lista.innerHTML = '<div class="empty">Rode o SQL da tabela alertas_rapidos para habilitar esta tela.</div>';
        return;
      }
      throw error;
    }

    if (!data?.length) {
      lista.innerHTML = '<div class="empty">Nenhum alerta rápido enviado.</div>';
      return;
    }

    const grupos = new Map();
    (data || []).forEach(item => {
      const chaveGrupo = String(item.grupo_id || item.id || '');
      const atual = grupos.get(chaveGrupo);
      if (!atual) {
        grupos.set(chaveGrupo, {
          ...item,
          destinos: [item.funcionario_destino_nome || '-'],
          quantidadeDestinos: 1,
        });
        return;
      }

      atual.quantidadeDestinos += 1;
      if (item.funcionario_destino_nome) {
        atual.destinos.push(item.funcionario_destino_nome);
      }
      if (item.status === 'confirmado') {
        atual.status = 'confirmado';
        atual.confirmado_em = item.confirmado_em || atual.confirmado_em;
        atual.confirmado_por_nome = item.confirmado_por_nome || atual.confirmado_por_nome;
      }
    });

    const dataAgrupada = Array.from(grupos.values());

    lista.innerHTML = '<div class="lista">' + dataAgrupada.map(item => `
      <div class="item">
        <div class="item-info">
          <div class="item-nome">ALERTA: ${item.mensagem}</div>
          <div class="item-detalhe">Ver aviso: ${item.destinos.filter(Boolean).join(', ') || '-'} (${item.quantidadeDestinos}) · Enviado por: ${item.criado_por_nome || '-'} · ${fmtDate(item.criado_em)}</div>
          <div class="item-detalhe">${item.status === 'confirmado'
            ? `Aceito por ${item.confirmado_por_nome || '-'} às ${fmtDate(item.confirmado_em)}`
            : 'Aguardando confirmação por PIN'
          }</div>
        </div>
        <div class="item-actions">
          ${item.status === 'confirmado'
            ? '<span class="tag tag-green">Confirmado</span>'
            : '<span class="tag tag-amber">Pendente</span>'
          }
          <button class="btn btn-red btn-sm" type="button" onclick="excluirAlertaRapido('${item.id}', '${String(item.grupo_id || '').replace(/'/g, "\\'")}')">Excluir</button>
        </div>
      </div>
    `).join('') + '</div>';
  } catch (error) {
    console.error('Erro ao carregar alertas rápidos:', error);
    lista.innerHTML = '<div class="empty">Erro ao carregar alertas rápidos.</div>';
  }
}

async function confirmarAlertaRapidoDaLista(botao) {
  const alertaId = String(botao?.getAttribute('data-alerta-id') || '').trim();
  const grupoId = String(botao?.getAttribute('data-alerta-grupo-id') || '').trim();
  const mensagem = String(botao?.getAttribute('data-alerta-mensagem') || '').trim();
  const funcionarioDestinoId = String(botao?.getAttribute('data-alerta-destino-id') || '').trim();
  const funcionarioDestinoNome = String(botao?.getAttribute('data-alerta-destino-nome') || '').trim();
  if (!alertaId) return;

  const chave = criarChaveAlerta('alerta_rapido', grupoId || alertaId);
  const index = notificacoesAtuais.findIndex(item => item?.chave === chave);
  const item = {
    chave,
    tipo: 'alerta_rapido',
    meta: {
      alertaRapidoId: alertaId,
      alertaRapidoGrupoId: grupoId,
      mensagem: mensagem || 'Alerta rápido',
      funcionarioDestinoId: String(funcionarioDestinoId || ''),
      nomeFuncionario: funcionarioDestinoNome || '',
    },
    descricao: mensagem || 'Alerta rápido',
  };
  await confirmarAlertaRapidoNotificacao(item, index);
  await carregarAlertasRapidos(true);
}

async function limparAlertasRapidosConfirmados() {
  if (!usuarioPodeGerenciarAlertasRapidos()) {
    setMsg('msgAlertasRapidos', 'Somente usuários ADM podem limpar alertas rápidos.', 'err');
    return;
  }
  if (!confirm('Limpar alertas rápidos já confirmados?')) return;
  const { error } = await sb
    .from('alertas_rapidos')
    .delete()
    .eq('status', 'confirmado');

  if (error) {
    if (isMissingQuickAlertsTableError(error)) {
      setMsg('msgAlertasRapidos', 'Rode o SQL da tabela alertas_rapidos antes de usar esta tela.', 'err');
      return;
    }
    setMsg('msgAlertasRapidos', `Não foi possível limpar os confirmados: ${mensagemErroSupabase(error, 'erro desconhecido')}`, 'err');
    return;
  }

  setMsg('msgAlertasRapidos', 'Alertas confirmados removidos.', 'ok');
  await carregarAlertasRapidos();
}

async function excluirAlertaRapido(id, grupoId = '') {
  if (!id) return;
  if (!usuarioPodeGerenciarAlertasRapidos()) {
    setMsg('msgAlertasRapidos', 'Somente usuários ADM podem excluir alertas rápidos.', 'err');
    return;
  }
  if (!confirm('Excluir este alerta rápido?')) return;

  const executarExclusao = () => {
    let query = sb.from('alertas_rapidos').delete();
    const grupo = String(grupoId || '').trim();
    query = grupo ? query.eq('grupo_id', grupo) : query.eq('id', id);
    return query.select('id');
  };

  let { data: excluidos, error } = await executarExclusao();

  if (!error && !excluidos?.length) {
    const fallback = await executarSemFiltroLojaTemporario(executarExclusao);
    excluidos = fallback.data || [];
    error = fallback.error || null;
  }

  if (error) {
    if (isMissingQuickAlertsTableError(error)) {
      setMsg('msgAlertasRapidos', 'Rode o SQL da tabela alertas_rapidos antes de usar esta tela.', 'err');
      return;
    }
    setMsg('msgAlertasRapidos', `Não foi possível excluir o alerta: ${mensagemErroSupabase(error, 'erro desconhecido')}`, 'err');
    return;
  }

  if (!excluidos?.length) {
    setMsg('msgAlertasRapidos', 'Nenhum alerta foi excluído. Atualize a lista e tente novamente.', 'err');
    await carregarAlertasRapidos();
    return;
  }

  setMsg('msgAlertasRapidos', `Alerta excluído (${excluidos.length} destino(s)).`, 'ok');
  await carregarAlertasRapidos();
  await carregarNotificacoes();
}

function atualizarVisibilidadeAlertasRapidosEnviados() {
  const controles = document.getElementById('alertasRapidosAdminControles');
  const botao = document.getElementById('btnToggleAlertasRapidosEnviados');
  if (controles) controles.style.display = alertasRapidosListaEnviadosVisivel ? '' : 'none';
  if (botao) botao.textContent = alertasRapidosListaEnviadosVisivel ? 'Ocultar relatório' : 'Mostrar relatório';
}

function toggleAlertasRapidosEnviados() {
  alertasRapidosListaEnviadosVisivel = !alertasRapidosListaEnviadosVisivel;
  atualizarVisibilidadeAlertasRapidosEnviados();
  if (alertasRapidosListaEnviadosVisivel) {
    carregarAlertasRapidos(false);
  } else {
    const lista = document.getElementById('listaAlertasRapidos');
    if (lista) lista.innerHTML = '<div class="empty">Relatório salvo e oculto. Clique em "Mostrar relatório" para consultar alertas enviados, pendentes e confirmados.</div>';
  }
}

async function carregarTarefasRapidas(silencioso = false) {
  if (!usuarioSistemaLogado || !usuarioPodeAcessarAlertasRapidos()) return;
  const cardEnvio = document.getElementById('cardAlertaRapidoEnvio');
  const controlesAdmin = document.getElementById('alertasRapidosAdminControles');
  const tituloLista = document.getElementById('tituloListaAlertaRapido');
  const botaoToggleEnviados = document.getElementById('btnToggleAlertasRapidosEnviados');
  const modoGestao = usuarioPodeEnviarAlertasRapidos();

  if (cardEnvio) cardEnvio.style.display = modoGestao ? '' : 'none';
  if (botaoToggleEnviados) botaoToggleEnviados.style.display = modoGestao ? '' : 'none';
  if (tituloLista) tituloLista.textContent = modoGestao ? 'Alertas enviados' : 'Meus alertas rápidos pendentes';

  if (modoGestao) {
    atualizarVisibilidadeAlertasRapidosEnviados();
    await Promise.all([
      carregarFuncionariosAlertaRapido(silencioso),
      carregarAlertasRapidos(false, silencioso),
    ]);
  } else {
    if (controlesAdmin) controlesAdmin.style.display = 'none';
    await carregarAlertasRapidos(true, silencioso);
  }
}

async function confirmarAlertaRapidoNotificacao(item, index) {
  if (!usuarioPodeConfirmarAlertaRapido()) {
    alert('Seu perfil não possui permissão para confirmar alertas rápidos.');
    return;
  }
  const alertaId = item?.meta?.alertaRapidoId || item?.meta?.alertaId || null;
  const grupoId = String(item?.meta?.alertaRapidoGrupoId || '');
  const funcionarioDestinoId = String(item?.meta?.funcionarioDestinoId || '');
  const mensagem = String(item?.meta?.mensagem || item?.descricao || 'Alerta rápido');
  if (!alertaId) return;

  const confirmacao = await confirmarAcaoComPin({
    funcionario: null,
    titulo: 'Confirmar alerta rápido',
    subtitulo: `ALERTA: ${mensagem}. Qualquer funcionário ativo pode confirmar com o próprio PIN.`,
    textoAcao: 'Finalizar alerta',
  });

  if (!confirmacao) return;

  const payloadConfirmacao = {
    status: 'confirmado',
    confirmado_por_id: confirmacao.funcionarioId,
    confirmado_por_nome: confirmacao.nomeFuncionario,
    confirmado_em: confirmacao.confirmadoEm,
  };

  let query = sb
    .from('alertas_rapidos')
    .update(payloadConfirmacao)
    .eq('status', 'pendente');

  query = grupoId ? query.eq('grupo_id', grupoId) : query.eq('id', alertaId);

  let { data: confirmados, error } = await query.select('id');

  if (!error && !confirmados?.length && funcionarioDestinoId) {
    const fallback = await executarSemFiltroLojaTemporario(() => sb
      .from('alertas_rapidos')
      .update(payloadConfirmacao)
      .eq('status', 'pendente')
      .eq('id', alertaId)
      .eq('funcionario_destino_id', funcionarioDestinoId)
      .select('id'));
    confirmados = fallback.data || [];
    error = fallback.error || null;
  }

  if (error) {
    alert(`Não foi possível confirmar o alerta: ${mensagemErroSupabase(error, 'erro desconhecido')}`);
    return;
  }

  marcarNotificacoesComoLidas([item.chave]);
  notificacoesAtuais = notificacoesAtuais.filter((_, itemIndex) => itemIndex !== index);
  renderizarListaNotificacoes();
  sincronizarAvisoNotificacoes();
  togglePainelNotificacoes(false);
  if (obterPaginaAtivaAtual() === 'tarefas_rapidas') {
    await carregarAlertasRapidos();
  }
}


async function iniciarChecklistDireto(lancamentoId) {
  const operador = obterFuncionarioOperadorAtual(false);
  if (!operador) {
    setMsg('msgChecklists', 'Faça login com um funcionário para aceitar esta tarefa.', 'err');
    return;
  }

  const { data: lancamentoAtual, error: errLancamento } = await sb
    .from('checklist_lancamentos')
    .select('id, tarefa_id, nome, descricao, funcionario_id, checklist_id, status, data_programada, horario_limite, empresa_id, loja_id')
    .eq('id', lancamentoId)
    .single();

  if (errLancamento || !lancamentoAtual) {
    console.error('Erro ao buscar lançamento:', errLancamento);
    setMsg('msgChecklists', 'Lançamento não encontrado.', 'err');
    return;
  }

  if (lancamentoAtual.status !== 'pendente') {
    setMsg('msgChecklists', 'Esta tarefa já foi iniciada em outro dispositivo. Atualize a tela.', 'err');
    carregarChecklists();
    carregarExecucoes();
    return;
  }

  const dataProgramada = String(lancamentoAtual.data_programada || '').trim();
  const dataHoje = hoje();
  if (dataProgramada && dataProgramada > dataHoje) {
    setMsg('msgChecklists', `Este checklist está programado para ${formatarDataProgramadaBr(dataProgramada)} e ainda não pode ser iniciado.`, 'err');
    return;
  }

  const confirmacao = await confirmarAcaoComPin({
    funcionario: null,
    titulo: 'Aceitar checklist',
    subtitulo: `Qualquer funcionário ativo pode confirmar com a própria senha para iniciar ${lancamentoAtual.nome}.`,
    textoAcao: 'Iniciar tarefa',
  });

  if (!confirmacao) return;

  const { data: lancamento, error: errReserva } = await sb
    .from('checklist_lancamentos')
    .update({ status: 'iniciado' })
    .eq('id', lancamentoId)
    .eq('status', 'pendente')
    .select('id, tarefa_id, nome, descricao, funcionario_id, checklist_id, status')
    .single();

  if (errReserva || !lancamento) {
    setMsg('msgChecklists', 'Esta tarefa acabou de ser iniciada por outro usuário.', 'err');
    carregarChecklists();
    carregarExecucoes();
    return;
  }

  const payload = {
    lancamento_id: lancamento.id,
    tarefa_id: lancamento.tarefa_id || null,
    checklist_id: lancamento.checklist_id || null,
    funcionario_id: lancamento.funcionario_id || null,
    usuario_inicio_id: confirmacao.funcionarioId,
    inicio_confirmado_em: confirmacao.confirmadoEm,
    data_execucao: hoje(),
    status: 'aberto',
    // A execução pertence necessariamente ao mesmo tenant do lançamento que
    // acabou de ser lido/reservado sob RLS. Não dependa de cache de sessão para
    // preencher estes campos sensíveis.
    empresa_id: lancamentoAtual.empresa_id,
    loja_id: lancamentoAtual.loja_id
  };

  const { data: exec, error } = await sb
    .from('checklist_execucoes')
    .insert([payload])
    .select()
    .single();

  if (error) {
    try {
      await sb.from('checklist_lancamentos').update({ status: 'pendente' }).eq('id', lancamento.id).eq('status', 'iniciado');
    } catch (e) {}
    if (isMissingExecutionRegistrySchemaError(error)) {
      setMsg('msgChecklists', 'Falta atualizar o banco com as novas colunas de início e finalização. Rode a nova migration do Supabase.', 'err');
      return;
    }
    console.error('Erro ao iniciar tarefa:', error);
    setMsg('msgChecklists', `Erro ao iniciar tarefa: ${error.message}`, 'err');
    return;
  }

  try {
    await registrarMovimentacaoExecucao({
      execucaoId: exec.id,
      tipoAcao: 'inicio',
      funcionarioId: confirmacao.funcionarioId,
      funcionarioResponsavelId: lancamento.funcionario_id || null,
      tarefaId: lancamento.tarefa_id || null,
      checklistId: lancamento.checklist_id || null,
      registradoEm: confirmacao.confirmadoEm,
    });
  } catch (movError) {
    if (isMissingExecutionRegistrySchemaError(movError)) {
      setMsg('msgChecklists', 'A tarefa foi iniciada, mas falta atualizar o banco para registrar quem iniciou.', 'err');
    } else {
      console.warn('Não foi possível registrar o usuário que iniciou a tarefa:', movError);
    }
  }

  try {
    await registrarEventoLancamento({
      lancamentoId: lancamento.id,
      execucaoId: exec.id,
      tarefaId: lancamento.tarefa_id || null,
      checklistId: lancamento.checklist_id || null,
      funcionarioResponsavelId: lancamento.funcionario_id || null,
      funcionarioAtorId: confirmacao.funcionarioId,
      funcionarioAtorNome: confirmacao.nomeFuncionario,
      tipoEvento: 'iniciado',
      origemEvento: operador.origem || 'sistema',
      dataProgramada: lancamento.data_programada || hoje(),
      horarioProgramado: lancamento.horario_limite || null,
      registradoEm: confirmacao.confirmadoEm,
      observacao: `Checklist iniciado por ${confirmacao.nomeFuncionario}.`,
    });
  } catch (erroAuditoria) {
    console.warn('Não foi possível auditar o início da tarefa:', erroAuditoria);
  }

  pararSomNotificacao();

  setMsg('msgChecklists', `Tarefa iniciada por ${confirmacao.nomeFuncionario}: ${lancamento.nome}.`, 'ok');
  abrirPagina('execucoes', document.querySelector(".nav-btn[onclick*='execucoes']"));
}

async function iniciarTarefaAgendada(tarefaId) {
  return iniciarChecklistDireto(tarefaId);
}

function diaSemanaAtual() {
  const dias = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
  return dias[new Date().getDay()];
}

function tarefaDisponivelHoje(diasSemana, dataRef = hoje()) {
  if (!diasSemana || diasSemana === 'todos') return true;
  const dataBase = String(dataRef || '').trim();
  const diaToken = dataBase
    ? diaSemanaTokenDaData(new Date(`${dataBase}T00:00:00`))
    : diaSemanaAtual();
  if (!diaToken) return true;
  return diasSemana.split(',').map(d => d.trim()).includes(diaToken);
}


//
