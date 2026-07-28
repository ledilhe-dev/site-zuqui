// EXECU-!-"ES
// 
async function montarContextoExecucoes(rows = [], dataRef = hoje()) {
  const funcionarioIds = [...new Set(rows.flatMap(item => [item.funcionario_id, item.usuario_inicio_id, item.usuario_fim_id]).filter(Boolean).map(item => String(item)))];
  const tarefaIds = [...new Set(rows.map(item => item.tarefa_id).filter(Boolean).map(item => String(item)))];
  const checklistIdsBase = [...new Set(rows.map(item => item.checklist_id).filter(Boolean).map(item => String(item)))];
  const lancamentoIds = [...new Set(rows.map(item => item.lancamento_id).filter(Boolean).map(item => String(item)))];

  const [funcionariosResultado, tarefasResultado, lancamentosResultado] = await Promise.all([
    funcionarioIds.length
      ? sb.from('funcionarios').select('id, nome').in('id', funcionarioIds)
      : Promise.resolve({ data: [], error: null }),
    tarefaIds.length
      ? sb.from('tarefas').select('id, nome, descricao, horario_limite, checklist_id').in('id', tarefaIds)
      : Promise.resolve({ data: [], error: null }),
    lancamentoIds.length
      ? sb.from('checklist_lancamentos').select('id, tarefa_id, nome, horario_limite, lancado_em, status, data_programada').in('id', lancamentoIds)
      : tarefaIds.length
      ? sb.from('checklist_lancamentos').select('id, tarefa_id, nome, horario_limite, lancado_em, status, data_programada').in('tarefa_id', tarefaIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (funcionariosResultado.error) throw funcionariosResultado.error;
  if (tarefasResultado.error && !isMissingTableError(tarefasResultado.error)) throw tarefasResultado.error;
  if (lancamentosResultado.error && !isMissingLancamentosTableError(lancamentosResultado.error)) throw lancamentosResultado.error;

  const tarefasData = tarefasResultado.data || [];
  const checklistIds = [...new Set([
    ...checklistIdsBase,
    ...tarefasData.map(item => item.checklist_id).filter(Boolean).map(item => String(item)),
  ])];

  const checklistsResultado = checklistIds.length
    ? await sb.from('checklists').select('id, nome').in('id', checklistIds)
    : { data: [], error: null };

  if (checklistsResultado.error) throw checklistsResultado.error;

  const funcionariosMap = Object.fromEntries((funcionariosResultado.data || []).map(item => [String(item.id), item.nome]));
  const tarefasMap = Object.fromEntries(tarefasData.map(item => [String(item.id), item]));
  const checklistsMap = Object.fromEntries((checklistsResultado.data || []).map(item => [String(item.id), item.nome]));
  const lancamentosOrdenados = (lancamentosResultado.data || [])
    .filter(item => lancamentoIds.length || !dataRef || dataLocalISO(item.lancado_em) === dataRef)
    .sort((a, b) => new Date(b.lancado_em || 0).getTime() - new Date(a.lancado_em || 0).getTime());
  const lancamentosMap = {};

  lancamentosOrdenados.forEach(item => {
    const chave = String(item.id || item.tarefa_id || '');
    if (chave && !lancamentosMap[chave]) {
      lancamentosMap[chave] = item;
    }
  });

  return {
    funcionariosMap,
    tarefasMap,
    checklistsMap,
    lancamentosMap,
  };
}

async function obterLinhasBaseExecucoes(dataExecucao = hoje()) {
  let query = sb
    .from('checklist_execucoes')
    .select('id, funcionario_id, usuario_inicio_id, usuario_fim_id, data_execucao, status, iniciado_em, inicio_confirmado_em, finalizado_em, finalizacao_confirmada_em')
    .in('status', ['aberto', 'pausado', 'finalizado']);

  if (!usuarioPodeVerTodasExecucoes() && usuarioSistemaLogado?.id) {
    query = query.or(`funcionario_id.eq.${usuarioSistemaLogado.id},usuario_inicio_id.eq.${usuarioSistemaLogado.id},usuario_fim_id.eq.${usuarioSistemaLogado.id}`);
  }

  const { data: rows, error } = await query;
  if (error) throw error;
  return (rows || []).filter(item => execucaoPertenceAoFiltroData(item, dataExecucao));
}

async function obterMapaFuncionariosExecucao(rows = []) {
  const ids = [...new Set(rows.flatMap(item => [item.funcionario_id, item.usuario_inicio_id, item.usuario_fim_id]).filter(Boolean).map(item => String(item)))];
  if (!ids.length) return {};

  const { data, error } = await sb.from('funcionarios').select('id, nome').in('id', ids).order('nome');
  if (error) throw error;

  return Object.fromEntries((data || []).map(item => [String(item.id), item.nome]));
}

function preencherSelectFunilExecucao(selectEl, opcoes = [], placeholder = '', valorAtual = '') {
  if (!selectEl) return '';

  const valorNormalizado = valorAtual ? String(valorAtual) : '';
  selectEl.innerHTML = '';

  const baseOption = document.createElement('option');
  baseOption.value = '';
  baseOption.textContent = placeholder;
  selectEl.appendChild(baseOption);

  let valorExiste = false;
  opcoes.forEach(opcao => {
    const el = document.createElement('option');
    el.value = opcao.id;
    el.textContent = opcao.nome;
    if (String(opcao.id) === valorNormalizado) {
      valorExiste = true;
    }
    selectEl.appendChild(el);
  });

  selectEl.value = valorExiste ? valorNormalizado : '';
  return selectEl.value || '';
}

async function carregarSelectExecucao() {
  await aplicarFunilExecucoes(false);
}

function aplicarFunilExecucoesComReset() {
  execucoesPaginaAtual = 1;
  return aplicarFunilExecucoes();
}

function obterDataHoraReferenciaExecucao(execucao) {
  return execucao?.finalizacao_confirmada_em
    || execucao?.finalizado_em
    || execucao?.inicio_confirmado_em
    || execucao?.iniciado_em
    || null;
}

function execucaoPertenceAoFiltroData(execucao, dataFiltro = '') {
  const data = String(dataFiltro || '').trim();
  if (!data) return true;

  const datasPossiveis = [
    execucao?.data_execucao,
    execucao?.inicio_confirmado_em ? dataLocalISO(execucao.inicio_confirmado_em) : '',
    execucao?.iniciado_em ? dataLocalISO(execucao.iniciado_em) : '',
    execucao?.finalizacao_confirmada_em ? dataLocalISO(execucao.finalizacao_confirmada_em) : '',
    execucao?.finalizado_em ? dataLocalISO(execucao.finalizado_em) : '',
  ].map(item => String(item || '').trim()).filter(Boolean);

  return datasPossiveis.includes(data);
}

function execucaoDentroDoFiltroHora(execucao, horaInicio = '', horaFim = '') {
  if (!horaInicio && !horaFim) return true;
  const referencia = obterDataHoraReferenciaExecucao(execucao);
  if (!referencia) return false;
  const dataRef = new Date(referencia);
  if (Number.isNaN(dataRef.getTime())) return false;
  const minutosAtual = (dataRef.getHours() * 60) + dataRef.getMinutes();
  const minutosInicio = horarioParaMinutos(horaInicio);
  const minutosFim = horarioParaMinutos(horaFim);
  if (minutosInicio !== null && minutosAtual < minutosInicio) return false;
  if (minutosFim !== null && minutosAtual > minutosFim) return false;
  return true;
}

function renderizarPaginacaoExecucoes(totalItens = 0, itensPorPagina = 20, paginaAtual = 1) {
  const container = document.getElementById('execucoesPaginacao');
  if (!container) return;

  const totalPaginas = Math.max(1, Math.ceil(totalItens / Math.max(1, itensPorPagina)));
  if (totalItens <= 0 || totalPaginas <= 1) {
    container.innerHTML = '';
    return;
  }

  const paginaAnterior = Math.max(1, paginaAtual - 1);
  const proximaPagina = Math.min(totalPaginas, paginaAtual + 1);
  const textoResumo = `Aba ${paginaAtual} de ${totalPaginas} · ${totalItens} registros`;

  container.innerHTML = `
    <span style="font-size:12px;color:var(--text-muted);align-self:center">${textoResumo}</span>
    <button class="btn btn-ghost btn-sm" type="button" ${paginaAtual <= 1 ? 'disabled' : ''} onclick="mudarPaginaExecucoes(${paginaAnterior})">Aba anterior</button>
    <button class="btn btn-ghost btn-sm" type="button" ${paginaAtual >= totalPaginas ? 'disabled' : ''} onclick="mudarPaginaExecucoes(${proximaPagina})">Próxima aba</button>
  `;
}

function mudarPaginaExecucoes(novaPagina = 1) {
  execucoesPaginaAtual = Math.max(1, Number(novaPagina) || 1);
  carregarExecucoes();
}

async function aplicarFunilExecucoes(carregarLista = true) {
  const selResponsavel = document.getElementById('execFuncionarioSelect');
  const selInicio = document.getElementById('execUsuarioInicioSelect');
  const selFim = document.getElementById('execUsuarioFimSelect');
  const campoData = document.getElementById('filtroDataExec');
  const campoHoraInicio = document.getElementById('filtroHoraInicioExec');
  const campoHoraFim = document.getElementById('filtroHoraFimExec');
  if (!selResponsavel || !selInicio || !selFim || !campoData) return;

  const dataExecucao = campoData.value || hoje();
  const horaInicio = campoHoraInicio?.value || '';
  const horaFim = campoHoraFim?.value || '';
  const valorResponsavelAtual = selResponsavel.value || '';
  const valorInicioAtual = selInicio.value || '';
  const valorFimAtual = selFim.value || '';

  const rowsBase = await obterLinhasBaseExecucoes(dataExecucao);
  const rows = (rowsBase || []).filter(item => execucaoDentroDoFiltroHora(item, horaInicio, horaFim));
  const funcionariosMap = await obterMapaFuncionariosExecucao(rows);

  const montarOpcoes = (linhas, campo) => {
    const ids = [...new Set((linhas || []).map(item => item[campo]).filter(Boolean).map(item => String(item)))];
    return ids
      .map(id => ({ id, nome: funcionariosMap[id] || 'Usuário' }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  };

  const opcoesResponsavel = montarOpcoes(rows, 'funcionario_id');
  const valorResponsavel = preencherSelectFunilExecucao(selResponsavel, opcoesResponsavel, '- Usuário da tarefa -', valorResponsavelAtual);

  const rowsFiltradasResponsavel = valorResponsavel
    ? rows.filter(item => String(item.funcionario_id || '') === valorResponsavel)
    : rows;
  const opcoesInicio = montarOpcoes(rowsFiltradasResponsavel, 'usuario_inicio_id');
  const valorInicio = preencherSelectFunilExecucao(selInicio, opcoesInicio, '- Usuário iniciou -', valorInicioAtual);

  const rowsFiltradasInicio = valorInicio
    ? rowsFiltradasResponsavel.filter(item => String(item.usuario_inicio_id || '') === valorInicio)
    : rowsFiltradasResponsavel;
  const opcoesFim = montarOpcoes(rowsFiltradasInicio, 'usuario_fim_id');
  preencherSelectFunilExecucao(selFim, opcoesFim, '- Usuário finalizou -', valorFimAtual);

  if (carregarLista) {
    await carregarExecucoes();
  }
}

function resetFiltroData(load = true) {
  execucoesPaginaAtual = 1;
  document.getElementById('filtroDataExec').value = hoje();
  const horaInicio = document.getElementById('filtroHoraInicioExec');
  const horaFim = document.getElementById('filtroHoraFimExec');
  const selResponsavel = document.getElementById('execFuncionarioSelect');
  const selInicio = document.getElementById('execUsuarioInicioSelect');
  const selFim = document.getElementById('execUsuarioFimSelect');
  if (horaInicio) horaInicio.value = '';
  if (horaFim) horaFim.value = '';
  if (selResponsavel) selResponsavel.value = '';
  if (selInicio) selInicio.value = '';
  if (selFim) selFim.value = '';
  if (load) aplicarFunilExecucoes();
}

async function carregarExecucoes() {
  const lista = document.getElementById('listaExecucoes');
  const paginacao = document.getElementById('execucoesPaginacao');
  lista.innerHTML = '<div class="empty">Carregando⬦</div>';
  const data = document.getElementById('filtroDataExec').value || hoje();
  const horaInicio = document.getElementById('filtroHoraInicioExec')?.value || '';
  const horaFim = document.getElementById('filtroHoraFimExec')?.value || '';
  const itensPorPagina = Number(document.getElementById('execItensPorPagina')?.value || 20);
  const funcionarioId = document.getElementById('execFuncionarioSelect')?.value || '';
  const usuarioInicioId = document.getElementById('execUsuarioInicioSelect')?.value || '';
  const usuarioFimId = document.getElementById('execUsuarioFimSelect')?.value || '';

  try {
    let query = sb
      .from('checklist_execucoes')
      .select('id, lancamento_id, tarefa_id, checklist_id, funcionario_id, usuario_inicio_id, usuario_fim_id, iniciado_em, inicio_confirmado_em, finalizado_em, finalizacao_confirmada_em, status, data_execucao')
      .in('status', ['aberto', 'pausado', 'finalizado'])
      .order('iniciado_em', { ascending: false });

    if (!usuarioPodeVerTodasExecucoes() && usuarioSistemaLogado?.id) {
      query = query.or(`funcionario_id.eq.${usuarioSistemaLogado.id},usuario_inicio_id.eq.${usuarioSistemaLogado.id},usuario_fim_id.eq.${usuarioSistemaLogado.id}`);
    }

    const { data: rowsBrutas, error } = await query;
    if (error) throw error;

    // Isolamento multi-loja: execucoes não têm loja_id, então filtramos pelas tarefas da loja atual.
    let rowsIsoladas = rowsBrutas || [];
    const lojaAtualExec = obterLojaAtualParaIsolamento();
    if (lojaAtualExec) {
      try {
        const tarefaIdsExec = [...new Set((rowsBrutas || []).map(r => r.tarefa_id).filter(Boolean).map(String))];
        const lancIdsExec = [...new Set((rowsBrutas || []).map(r => r.lancamento_id).filter(Boolean).map(String))];
        const tarefasDaLoja = new Set();
        const lancamentosDaLoja = new Set();
        const consultas = [];
        if (tarefaIdsExec.length) {
          consultas.push(executarSemFiltroLojaTemporario(() => sb.from('tarefas').select('id, loja_id').in('id', tarefaIdsExec))
            .then(res => (res.data || []).forEach(t => { if (String(t.loja_id || '') === lojaAtualExec) tarefasDaLoja.add(String(t.id)); })));
        }
        if (lancIdsExec.length) {
          consultas.push(executarSemFiltroLojaTemporario(() => sb.from('checklist_lancamentos').select('id, loja_id').in('id', lancIdsExec))
            .then(res => (res.data || []).forEach(l => { if (String(l.loja_id || '') === lojaAtualExec) lancamentosDaLoja.add(String(l.id)); })));
        }
        if (consultas.length) {
          await Promise.all(consultas);
          rowsIsoladas = (rowsBrutas || []).filter(r => {
            const tOk = r.tarefa_id && tarefasDaLoja.has(String(r.tarefa_id));
            const lOk = r.lancamento_id && lancamentosDaLoja.has(String(r.lancamento_id));
            // Mantém se a tarefa OU o lançamento pertencem à loja atual.
            // Registros antigos sem tarefa/lançamento vinculado permanecem visíveis para não sumir histórico.
            if (!r.tarefa_id && !r.lancamento_id) return true;
            return tOk || lOk;
          });
        }
      } catch (eIso) {
        console.warn('Não foi possível isolar execuções por loja (mantendo lista completa):', eIso);
      }
    }

    const rows = rowsIsoladas.filter(item => {
      if (!execucaoPertenceAoFiltroData(item, data)) return false;
      if (!execucaoDentroDoFiltroHora(item, horaInicio, horaFim)) return false;
      if (funcionarioId && String(item.funcionario_id || '') !== String(funcionarioId)) return false;
      if (usuarioInicioId && String(item.usuario_inicio_id || '') !== String(usuarioInicioId)) return false;
      if (usuarioFimId && String(item.usuario_fim_id || '') !== String(usuarioFimId)) return false;
      return true;
    });

    if (!rows?.length) {
      lista.innerHTML = '<div class="empty">Nenhuma execução com os filtros selecionados.</div>';
      if (paginacao) paginacao.innerHTML = '';
      return;
    }

    const totalItens = rows.length;
    const totalPaginas = Math.max(1, Math.ceil(totalItens / Math.max(1, itensPorPagina)));
    if (execucoesPaginaAtual > totalPaginas) execucoesPaginaAtual = totalPaginas;
    const inicioPagina = (execucoesPaginaAtual - 1) * itensPorPagina;
    const fimPagina = inicioPagina + itensPorPagina;
    const rowsPagina = rows.slice(inicioPagina, fimPagina);

    const { funcionariosMap, tarefasMap, checklistsMap, lancamentosMap } = await montarContextoExecucoes(rowsPagina, data);

    lista.innerHTML = '<div class="lista">' + rowsPagina.map(e => {
      const tarefa = tarefasMap[String(e.tarefa_id)] || null;
      const lancamento = lancamentosMap[String(e.lancamento_id)] || lancamentosMap[String(e.tarefa_id)] || null;
      const nomeExecucao = tarefa?.nome || lancamento?.nome || checklistsMap[String(e.checklist_id)] || 'Execução';
      const nomeResponsavel = funcionariosMap[String(e.funcionario_id)] || '-';
      const nomeOperadorInicio = funcionariosMap[String(e.usuario_inicio_id)] || '-';
      const nomeOperadorFim = funcionariosMap[String(e.usuario_fim_id)] || '-';
      const horarioPrevisto = horaCurta(tarefa?.horario_limite || lancamento?.horario_limite) || '-';
      const horarioInicio = fmtDate(e.inicio_confirmado_em || e.iniciado_em);
      const horarioFinalizacao = fmtDate(e.finalizacao_confirmada_em || e.finalizado_em);
      const statusTexto = e.status === 'pausado' ? 'Pausado' : e.status === 'finalizado' ? 'Finalizado' : 'Em andamento';

      return `
    <div class="item">
      <div class="item-info">
        <div class="item-nome">${nomeExecucao}</div>
        <div class="item-detalhe">Responsável principal: ${nomeResponsavel}</div>
        <div class="item-detalhe">Horário previsto para iniciar: ${horarioPrevisto}</div>
        <div class="item-detalhe">Operador que iniciou: ${nomeOperadorInicio} · ${horarioInicio}</div>
        <div class="item-detalhe">Operador que finalizou: ${nomeOperadorFim} · ${horarioFinalizacao}</div>
        <div class="item-detalhe">Status: ${statusTexto}</div>
      </div>
      <div class="item-actions">
        ${tagStatus(e.status)}
        ${e.status === 'aberto' ? `<button class="btn btn-amber btn-sm" onclick="pausarExecucao('${e.id}')">Pausar</button>` : ''}
        ${e.status === 'pausado' ? `<button class="btn btn-ghost btn-sm" onclick="despausarExecucao('${e.id}')">Despausar</button>` : ''}
        ${e.status !== 'finalizado' ? `<button class="btn btn-green btn-sm" onclick="finalizarExecucaoDireta('${e.id}')">Finalizar</button>` : ''}
        ${e.status !== 'finalizado' ? `<button class="btn btn-ghost btn-sm" onclick="abrirModal('${e.id}')">Abrir</button>` : `<button class="btn btn-ghost btn-sm" onclick="abrirModal('${e.id}')">Ver</button>`}
      </div>
    </div>`;
    }).join('') + '</div>';

    renderizarPaginacaoExecucoes(totalItens, itensPorPagina, execucoesPaginaAtual);
  } catch (error) {
    console.error('Erro ao carregar execuções:', error);
    lista.innerHTML = '<div class="empty">Erro ao carregar.</div>';
    if (paginacao) paginacao.innerHTML = '';
    setMsg('msgExecucoes', `Não foi possível carregar as execuções: ${error.message || 'erro desconhecido'}`, 'err');
  }
}

async function carregarTarefasAtrasoMaster() {
  const lista = document.getElementById('listaTarefasAtraso');
  if (!lista) return;
  lista.innerHTML = '<div class="empty">Carregando⬦</div>';

  if (!usuarioEhMasterNotificacoes()) {
    lista.innerHTML = '<div class="empty">Acesso permitido apenas para usuário master.</div>';
    setMsg('msgTarefasAtraso', 'Sem permissão para visualizar esta aba.', 'err');
    return;
  }

  try {
    const carregarLancamentosPendentesAtraso = async () => {
      let consultaCompletaQuery = sb
        .from('checklist_lancamentos')
        .select('id, nome, horario_limite, dias_semana, funcionario_id, checklist_id, lancado_em, created_at, data_programada')
        .eq('status', 'pendente')
        .order('lancado_em', { ascending: false });
      consultaCompletaQuery = aplicarFiltroLojaGenericoQuery(consultaCompletaQuery); // isolamento multi-loja
      const consultaCompleta = await consultaCompletaQuery;

      if (!consultaCompleta.error) return consultaCompleta.data || [];

      const mensagemErro = String(consultaCompleta.error?.message || '').toLowerCase();
      if (!mensagemErro.includes('created_at') && !mensagemErro.includes('data_programada')) {
        throw consultaCompleta.error;
      }

      let consultaFallbackQuery = sb
        .from('checklist_lancamentos')
        .select('id, nome, horario_limite, dias_semana, funcionario_id, checklist_id, lancado_em, data_programada')
        .eq('status', 'pendente')
        .order('lancado_em', { ascending: false });
      consultaFallbackQuery = aplicarFiltroLojaGenericoQuery(consultaFallbackQuery); // isolamento multi-loja
      const consultaFallback = await consultaFallbackQuery;

      if (consultaFallback.error) throw consultaFallback.error;
      return (consultaFallback.data || []).map(item => ({ ...item, created_at: null }));
    };

    const [lancamentosPendentes, execucoesRes, funcionariosRes, checklistsRes] = await Promise.all([
      carregarLancamentosPendentesAtraso(),
      sb
        .from('checklist_execucoes')
        .select('id, status, iniciado_em, inicio_confirmado_em, data_execucao, funcionario_id, checklist_id, tarefa_id, lancamento_id')
        .in('status', ['aberto', 'pausado'])
        .eq('data_execucao', hoje())
        .order('iniciado_em', { ascending: false }),
      sb.from('funcionarios').select('id, nome'),
      sb.from('checklists').select('id, nome'),
    ]);

    if (execucoesRes.error) throw execucoesRes.error;
    if (funcionariosRes.error) throw funcionariosRes.error;
    if (checklistsRes.error) throw checklistsRes.error;

    const funcionariosMap = Object.fromEntries((funcionariosRes.data || []).map(item => [String(item.id), item.nome]));
    const checklistsMap = Object.fromEntries((checklistsRes.data || []).map(item => [String(item.id), item.nome]));

    // Para admin_loja: filtrar lancamentos apenas da loja do usuário (via funcionariosMap já filtrado pelo override)
    const funcionariosIdsDaLoja = new Set(Object.keys(funcionariosMap));
    const lancamentosPendentesFiltrados = (usuarioSistemaLogado?.tipo === 'admin_loja')
      ? (lancamentosPendentes || []).filter(item => item.funcionario_id && funcionariosIdsDaLoja.has(String(item.funcionario_id)))
      : (lancamentosPendentes || []);

    const tarefasIds = [...new Set((execucoesRes.data || []).map(item => item.tarefa_id).filter(Boolean).map(item => String(item)))];
    let tarefasMap = {};

    if (tarefasIds.length) {
      const tarefasRes = await sb
        .from('tarefas')
        .select('id, nome, horario_limite')
        .in('id', tarefasIds);
      if (tarefasRes.error && !isMissingTableError(tarefasRes.error)) throw tarefasRes.error;
      tarefasMap = Object.fromEntries((tarefasRes.data || []).map(item => [String(item.id), item]));
    }

    const lancamentosIdsExecucao = [...new Set((execucoesRes.data || []).map(item => item.lancamento_id).filter(Boolean).map(item => String(item)))];
    let lancamentosMap = {};

    if (lancamentosIdsExecucao.length) {
      const lancamentosRes = await sb
        .from('checklist_lancamentos')
        .select('id, horario_limite')
        .in('id', lancamentosIdsExecucao);
      if (lancamentosRes.error && !isMissingLancamentosTableError(lancamentosRes.error)) throw lancamentosRes.error;
      lancamentosMap = Object.fromEntries((lancamentosRes.data || []).map(item => [String(item.id), item]));
    }

    const lancamentosComExecucaoAtivaIds = new Set((execucoesRes.data || [])
      .map(item => item.lancamento_id)
      .filter(Boolean)
      .map(item => String(item)));

    const lancamentosAtrasados = lancamentosPendentesFiltrados.filter(item => {
      if (!lancamentoProgramadoHoje(item)) return false;
      if (!tarefaDisponivelHoje(item.dias_semana)) return false;
      if (lancamentosComExecucaoAtivaIds.has(String(item.id || ''))) return false;
      if (lancamentoFoiCriadoAposHorarioNoMesmoDia(item)) return false;
      const prazo = obterContextoPrazo(item.horario_limite, ANTECEDENCIA_ALERTA_CHECKLIST_MINUTOS);
      return prazo.vencido;
    }).map(item => ({
      tipo: 'nao_iniciado',
      id: item.id,
      nome: checklistsMap[String(item.checklist_id)] || item.nome || 'Checklist',
      responsavel: funcionariosMap[String(item.funcionario_id)] || 'Sem responsável',
      horario: horaCurta(item.horario_limite) || '-',
      dataProgramada: formatarDataProgramadaBr(obterDataProgramadaLancamento(item)),
      detalhe: 'Não iniciado no prazo',
      page: 'checklists',
    }));

    const execucoesAtrasadas = (execucoesRes.data || []).filter(item => execucaoPrecisaLembreteFinalizacao(item)).map(item => ({
      tipo: 'nao_finalizado',
      id: item.id,
      nome: tarefasMap[String(item.tarefa_id)]?.nome || checklistsMap[String(item.checklist_id)] || 'Checklist',
      responsavel: funcionariosMap[String(item.funcionario_id)] || 'Sem responsável',
      horario: horaCurta(tarefasMap[String(item.tarefa_id)]?.horario_limite || lancamentosMap[String(item.lancamento_id)]?.horario_limite) || '-',
      dataProgramada: formatarDataProgramadaBr(item.data_execucao || hoje()),
      detalhe: item.status === 'pausado' ? 'Pausado sem finalização' : 'Aberto sem finalização',
      page: 'execucoes',
    }));

    const atrasos = [...lancamentosAtrasados, ...execucoesAtrasadas];
    atualizarBadgeTarefasAtraso(atrasos.length);

    if (!atrasos.length) {
      lista.innerHTML = '<div class="empty">Nenhuma tarefa em atraso no momento.</div>';
      setMsg('msgTarefasAtraso', 'Sem pendências críticas agora.', 'ok');
      return;
    }

    lista.innerHTML = '<div class="lista">' + atrasos.map(item => `
      <div class="item">
        <div class="item-info">
          <div class="item-nome">${item.nome}</div>
          <div class="item-detalhe">Responsável: ${item.responsavel} · Data: ${item.dataProgramada || '-'} · Horário: ${item.horario}</div>
          <div class="item-detalhe">${item.detalhe}</div>
        </div>
        <div class="item-actions">
          ${item.tipo === 'nao_finalizado' ? '<span class="tag tag-amber">Sem finalização</span>' : '<span class="tag tag-red">Não iniciada</span>'}
          <button class="btn btn-ghost btn-sm" onclick="abrirPagina('${item.page}', document.querySelector('.nav-btn[data-page=\\'${item.page}\\']'))">Abrir</button>
        </div>
      </div>
    `).join('') + '</div>';

    setMsg('msgTarefasAtraso', `${atrasos.length} pendência(s) crítica(s) encontrada(s).`, 'err');
  } catch (error) {
    console.error('Erro ao carregar tarefas em atraso:', error);
    lista.innerHTML = '<div class="empty">Erro ao carregar tarefas em atraso.</div>';
    const msgErro = error?.message ? `Não foi possível carregar os atrasos: ${error.message}` : 'Não foi possível carregar os atrasos.';
    setMsg('msgTarefasAtraso', msgErro, 'err');
  }
}

async function pausarExecucao(id) {
  await sb.from('checklist_execucoes').update({ status: 'pausado' }).eq('id', id);
  carregarExecucoes();
}

async function despausarExecucao(id) {
  await sb.from('checklist_execucoes').update({ status: 'aberto' }).eq('id', id);
  carregarExecucoes();
}

async function finalizarExecucaoDireta(id) {
  const operador = obterFuncionarioOperadorAtual();
  if (!operador) {
    setMsg('msgExecucoes', 'Faça login com um funcionário para finalizar esta tarefa.', 'err');
    return;
  }

  const { data: execucao, error: errExecucao } = await sb
    .from('checklist_execucoes')
    .select('id, lancamento_id, tarefa_id, checklist_id, funcionario_id, status, data_execucao, usuario_inicio_id')
    .eq('id', id)
    .single();

  if (errExecucao || !execucao) {
    setMsg('msgExecucoes', 'Execução não encontrada.', 'err');
    return;
  }

  const confirmacao = await confirmarAcaoComPin({
    funcionario: null,
    titulo: 'Conferência para finalizar',
    subtitulo: 'Para finalizar, outro funcionário deve conferir a tarefa e confirmar com a própria senha. Quem iniciou não pode finalizar.',
    textoAcao: 'Conferir e finalizar',
    // Regra de conferência validada DENTRO do modal: quem iniciou não pode finalizar.
    validarFuncionarioConfirmado: (func) => {
      if (execucao.usuario_inicio_id && String(func.id) === String(execucao.usuario_inicio_id)) {
        return 'Esta tarefa foi iniciada por este mesmo funcionário. A finalização precisa ser CONFERIDA e confirmada por OUTRO funcionário. Peça a outro colega para digitar a senha dele.';
      }
      return null;
    },
  });

  if (!confirmacao) return;

  const { error } = await sb.from('checklist_execucoes').update({
    status: 'finalizado',
    finalizado_em: confirmacao.confirmadoEm,
    usuario_fim_id: confirmacao.funcionarioId,
    finalizacao_confirmada_em: confirmacao.confirmadoEm,
  }).eq('id', id);

  if (error) {
    if (isMissingExecutionRegistrySchemaError(error)) {
      setMsg('msgExecucoes', 'Falta atualizar o banco com as novas colunas de início e finalização. Rode a nova migration do Supabase.', 'err');
      return;
    }
    setMsg('msgExecucoes', `Erro ao finalizar execução: ${error.message}`, 'err');
    return;
  }

  try {
    await registrarMovimentacaoExecucao({
      execucaoId: execucao.id,
      tipoAcao: 'finalizacao',
      funcionarioId: confirmacao.funcionarioId,
      funcionarioResponsavelId: execucao.funcionario_id || null,
      tarefaId: execucao.tarefa_id || null,
      checklistId: execucao.checklist_id || null,
      registradoEm: confirmacao.confirmadoEm,
    });
  } catch (movError) {
    if (!isMissingExecutionRegistrySchemaError(movError)) {
      console.warn('Não foi possível registrar o usuário que finalizou:', movError);
    }
  }

  try {
    await registrarEventoLancamento({
      lancamentoId: execucao.lancamento_id || null,
      execucaoId: execucao.id,
      tarefaId: execucao.tarefa_id || null,
      checklistId: execucao.checklist_id || null,
      funcionarioResponsavelId: execucao.funcionario_id || null,
      funcionarioAtorId: confirmacao.funcionarioId,
      funcionarioAtorNome: confirmacao.nomeFuncionario,
      tipoEvento: 'finalizado',
      origemEvento: operador.origem || 'sistema',
      dataProgramada: execucao.data_execucao || hoje(),
      registradoEm: confirmacao.confirmadoEm,
      observacao: `Checklist finalizado por ${confirmacao.nomeFuncionario}.`,
    });
  } catch (erroAuditoria) {
    console.warn('Não foi possível auditar a finalização da tarefa:', erroAuditoria);
  }

  try {
    await garantirRelancamentoSemanalAposFinalizacao(execucao, {
      funcionarioId: confirmacao.funcionarioId,
      nome: confirmacao.nomeFuncionario,
    });
  } catch (erroRelancamento) {
    console.warn('Não foi possível relançar a tarefa para a próxima semana:', erroRelancamento);
  }

  await enviarEmailChecklistFinalizado(id);
  pararSomNotificacao();
  carregarExecucoes();
  carregarChecklists();
  carregarNotificacoes();
  setMsg('msgExecucoes', `Execução finalizada por ${confirmacao.nomeFuncionario}.`, 'ok');
}

async function garantirRelancamentoSemanalAposFinalizacao(execucao = {}, ator = {}) {
  // [DESATIVADO] Regra antiga de relançamento automático semanal após a finalização.
  // Removida porque não era segura e conflita com a nova repetição definida pelo usuário
  // (intervalo "a cada X dias" + duração "por X dias") configurada no lançamento.
  return null;
}

async function garantirRelancamentoSemanalAposFinalizacaoLegado(execucao = {}, ator = {}) {
  const lancamentoId = String(execucao?.lancamento_id || '').trim();
  if (!lancamentoId) return null;

  const { data: lancamento, error: erroLancamento } = await sb
    .from('checklist_lancamentos')
    .select('id, tarefa_id, checklist_id, funcionario_id, nome, descricao, horario_limite, dias_semana, data_programada, loja_id, empresa_id')
    .eq('id', lancamentoId)
    .maybeSingle();

  if (erroLancamento || !lancamento) {
    if (erroLancamento) console.warn('Não foi possível consultar lançamento para repetição semanal:', erroLancamento);
    return null;
  }

  const dataBase = String(lancamento.data_programada || execucao.data_execucao || hoje()).trim();
  const proximaData = adicionarDiasDataISO(dataBase, 7);
  const tarefaId = lancamento.tarefa_id || execucao.tarefa_id || null;
  const funcionarioId = lancamento.funcionario_id || execucao.funcionario_id || null;
  const horarioLimite = horaCurta(lancamento.horario_limite || '');
  if (!proximaData || !tarefaId || !funcionarioId || !horarioLimite) return null;

  const { data: existentes, error: erroExistentes } = await sb
    .from('checklist_lancamentos')
    .select('id, status')
    .eq('tarefa_id', tarefaId)
    .eq('funcionario_id', funcionarioId)
    .eq('data_programada', proximaData)
    .limit(1);

  if (erroExistentes && !isMissingLancamentosTableError(erroExistentes)) throw erroExistentes;
  if ((existentes || []).some(item => lancamentoContaComoExistenteParaAgenda(item))) return existentes[0] || null;

  const payload = {
    tarefa_id: tarefaId,
    checklist_id: lancamento.checklist_id || execucao.checklist_id || null,
    funcionario_id: funcionarioId,
    nome: lancamento.nome || 'Checklist',
    descricao: lancamento.descricao || null,
    horario_limite: horarioLimite,
    dias_semana: lancamento.dias_semana || 'todos',
    data_programada: proximaData,
    lancado_em: new Date().toISOString(),
    criado_por_id: ator?.funcionarioId || null,
    criado_por_nome: ator?.nome || 'Automático',
    origem_lancamento: 'automatico',
    observacao_lancamento: 'Relançamento automático semanal após finalização.',
    empresa_id: lancamento.empresa_id || execucao.empresa_id || obterEmpresaIdSessao?.() || usuarioSistemaLogado?.empresa_id || null,
    loja_id: lancamento.loja_id || execucao.loja_id || obterLojaIdSessao?.() || usuarioSistemaLogado?.loja_id || null,
    status: 'pendente',
  };

  const { data: criado, error: erroCriar } = await sb
    .from('checklist_lancamentos')
    .insert([payload])
    .select('id, tarefa_id, checklist_id, funcionario_id, data_programada, horario_limite')
    .single();

  if (erroCriar) throw erroCriar;

  try {
    await registrarEventoLancamento({
      lancamentoId: criado.id,
      tarefaId: criado.tarefa_id,
      checklistId: criado.checklist_id,
      funcionarioResponsavelId: criado.funcionario_id,
      funcionarioAtorId: ator?.funcionarioId || null,
      funcionarioAtorNome: ator?.nome || 'Automático',
      tipoEvento: 'lancado',
      origemEvento: 'automatico',
      dataProgramada: criado.data_programada,
      horarioProgramado: criado.horario_limite,
      observacao: 'Relançamento automático semanal após finalização.',
      meta: { automatico: true, relancamento_semanal: true, lancamento_origem_id: lancamentoId },
    });
  } catch (erroAuditoria) {
    console.warn('Não foi possível auditar relançamento semanal:', erroAuditoria);
  }

  return criado;
}

async function excluirExecucao(id) {
  if (!confirm('Excluir esta execução e todas as respostas...')) return;
  await sb.from('checklist_execucoes').delete().eq('id', id);
  carregarExecucoes();
}

// 
// MODAL DE EXECU-!ÒO (responder itens)
// 
async function abrirModal(execId) {
  execucaoAtualId = execId;
  document.getElementById('modalOverlay').classList.add('show');
  document.getElementById('modalBody').innerHTML = '<div class="empty">Carregando...</div>';
  document.getElementById('modalTitle').textContent = 'Checklist';
  document.getElementById('modalSubtitle').textContent = '';
  document.getElementById('modalProgress').textContent = '';

  // Carrega execução + checklist
  const { data: exec } = await sb
    .from('checklist_execucoes')
    .select('id, lancamento_id, tarefa_id, checklist_id, funcionario_id, usuario_inicio_id, usuario_fim_id, iniciado_em, inicio_confirmado_em, finalizado_em, finalizacao_confirmada_em, status, data_execucao')
    .eq('id', execId)
    .single();

  if (exec) {
    const { funcionariosMap, tarefasMap, checklistsMap, lancamentosMap } = await montarContextoExecucoes([exec], exec.data_execucao || hoje());
    const tarefa = tarefasMap[String(exec.tarefa_id)] || null;
    const lancamento = lancamentosMap[String(exec.lancamento_id)] || lancamentosMap[String(exec.tarefa_id)] || null;
    const nomeExecucao = tarefa?.nome || lancamento?.nome || checklistsMap[String(exec.checklist_id)] || 'Checklist';
    const horarioPrevisto = horaCurta(tarefa?.horario_limite || lancamento?.horario_limite) || '-';
    const nomeResponsavel = funcionariosMap[String(exec.funcionario_id)] || '-';
    const nomeOperadorInicio = funcionariosMap[String(exec.usuario_inicio_id)] || '-';
    const nomeOperadorFim = funcionariosMap[String(exec.usuario_fim_id)] || '-';

    document.getElementById('modalTitle').textContent = nomeExecucao;
    document.getElementById('modalSubtitle').textContent = `Responsável: ${nomeResponsavel} · Previsto: ${horarioPrevisto} · Iniciado por: ${nomeOperadorInicio}${exec.finalizado_em || exec.finalizacao_confirmada_em ? ' · Finalizado por: ' + nomeOperadorFim : ''} · ${exec.status === 'finalizado' ? 'Finalizado' : 'Em andamento'}`;
    document.getElementById('btnFinalizar').style.display = exec.status === 'finalizado' ? 'none' : '';
  }

  // Carrega respostas com itens
  const { data: respostas } = await sb
    .from('checklist_respostas')
    .select('*, checklist_itens(nome, obrigatorio, ordem)')
    .eq('execucao_id', execId)
    .order('checklist_itens(ordem)');

  itensExecucao = respostas || [];
  renderizarModalItens(exec?.status);
}

function renderizarModalItens(status) {
  const body = document.getElementById('modalBody');
  if (!itensExecucao.length) { body.innerHTML = '<div class="empty">Nenhum item nesta execucao.</div>'; return; }

  const total = itensExecucao.length;
  const concluidos = itensExecucao.filter(r => r.concluido).length;
  const pct = Math.round((concluidos / total) * 100);

  document.getElementById('modalProgress').innerHTML = `
    ${concluidos}/${total} itens concluidos
    <div class="progress-bar-wrap" style="width:140px;display:inline-block;vertical-align:middle;margin-left:8px">
      <div class="progress-bar-fill" style="width:${pct}%"></div>
    </div>
  `;

  const readonly = status === 'finalizado';

  body.innerHTML = itensExecucao.map((r, i) => `
    <div class="exec-item ${r.concluido ? 'checked' : ''}" id="exec-item-${i}">
      <div class="checkbox-custom ${r.concluido ? 'checked' : ''}" ${readonly ? '' : `onclick="toggleItemModal(${i})"`} id="chk-${i}"></div>
      <div style="flex:1">
        <div class="nome-item">${r.checklist_itens?.nome ?? '-'} ${r.checklist_itens?.obrigatorio ? '' : '<span class="tag tag-gray" style="font-size:10px">opcional</span>'}</div>
        <textarea class="obs-input" id="obs-${i}" placeholder="Observacao (opcional)"${readonly ? ' disabled' : ''}>${r.observacao ?? ''}</textarea>
      </div>
    </div>
  `).join('');
}

function toggleItemModal(i) {
  const r = itensExecucao[i];
  r.concluido = !r.concluido;

  const chk = document.getElementById(`chk-${i}`);
  const wrap = document.getElementById(`exec-item-${i}`);
  chk.classList.toggle('checked', r.concluido);
  wrap.classList.toggle('checked', r.concluido);

  const total = itensExecucao.length;
  const concluidos = itensExecucao.filter(x => x.concluido).length;
  const pct = Math.round((concluidos / total) * 100);
  document.getElementById('modalProgress').innerHTML = `
    ${concluidos}/${total} itens concluidos
    <div class="progress-bar-wrap" style="width:140px;display:inline-block;vertical-align:middle;margin-left:8px">
      <div class="progress-bar-fill" style="width:${pct}%"></div>
    </div>
  `;
}

async function finalizarExecucao() {
  if (!execucaoAtualId) return;

  const operador = obterFuncionarioOperadorAtual();
  if (!operador) {
    setMsg('msgExecucoes', 'Faça login com um funcionário para finalizar esta tarefa.', 'err');
    return;
  }

  const { data: execucao, error: errExecucao } = await sb
    .from('checklist_execucoes')
    .select('id, lancamento_id, tarefa_id, checklist_id, funcionario_id, status, data_execucao, usuario_inicio_id')
    .eq('id', execucaoAtualId)
    .single();

  if (errExecucao || !execucao) {
    setMsg('msgExecucoes', 'Execução não encontrada.', 'err');
    return;
  }

  // Salva respostas
  const updates = itensExecucao.map((r, i) => ({
    id: r.id,
    concluido: r.concluido,
    observacao: (document.getElementById(`obs-${i}`)?.value || null),
    respondido_em: new Date().toISOString(),
  }));

  for (const u of updates) {
    await sb.from('checklist_respostas').update({
      concluido: u.concluido,
      observacao: u.observacao,
      respondido_em: u.respondido_em,
    }).eq('id', u.id);
  }

  const confirmacao = await confirmarAcaoComPin({
    funcionario: null,
    titulo: 'Conferência para finalizar',
    subtitulo: 'Para finalizar, outro funcionário deve conferir a tarefa e confirmar com a própria senha. Quem iniciou não pode finalizar.',
    textoAcao: 'Conferir e finalizar',
    // Regra de conferência validada DENTRO do modal: quem iniciou não pode finalizar.
    validarFuncionarioConfirmado: (func) => {
      if (execucao.usuario_inicio_id && String(func.id) === String(execucao.usuario_inicio_id)) {
        return 'Esta tarefa foi iniciada por este mesmo funcionário. A finalização precisa ser CONFERIDA e confirmada por OUTRO funcionário. Peça a outro colega para digitar a senha dele.';
      }
      return null;
    },
  });

  if (!confirmacao) return;

  // Finaliza execução
  const { error } = await sb.from('checklist_execucoes').update({
    status: 'finalizado',
    finalizado_em: confirmacao.confirmadoEm,
    usuario_fim_id: confirmacao.funcionarioId,
    finalizacao_confirmada_em: confirmacao.confirmadoEm,
  }).eq('id', execucaoAtualId);

  if (error) {
    if (isMissingExecutionRegistrySchemaError(error)) {
      setMsg('msgExecucoes', 'Falta atualizar o banco com as novas colunas de início e finalização. Rode a nova migration do Supabase.', 'err');
      return;
    }
    setMsg('msgExecucoes', `Erro ao finalizar execução: ${error.message}`, 'err');
    return;
  }

  try {
    await registrarMovimentacaoExecucao({
      execucaoId: execucao.id,
      tipoAcao: 'finalizacao',
      funcionarioId: confirmacao.funcionarioId,
      funcionarioResponsavelId: execucao.funcionario_id || null,
      tarefaId: execucao.tarefa_id || null,
      checklistId: execucao.checklist_id || null,
      registradoEm: confirmacao.confirmadoEm,
    });
  } catch (movError) {
    if (!isMissingExecutionRegistrySchemaError(movError)) {
      console.warn('Não foi possível registrar o usuário que finalizou no histórico:', movError);
    }
  }

  try {
    await registrarEventoLancamento({
      lancamentoId: execucao.lancamento_id || null,
      execucaoId: execucao.id,
      tarefaId: execucao.tarefa_id || null,
      checklistId: execucao.checklist_id || null,
      funcionarioResponsavelId: execucao.funcionario_id || null,
      funcionarioAtorId: confirmacao.funcionarioId,
      funcionarioAtorNome: confirmacao.nomeFuncionario,
      tipoEvento: 'finalizado',
      origemEvento: operador.origem || 'sistema',
      dataProgramada: execucao.data_execucao || hoje(),
      registradoEm: confirmacao.confirmadoEm,
      observacao: `Checklist finalizado por ${confirmacao.nomeFuncionario}.`,
    });
  } catch (erroAuditoria) {
    console.warn('Não foi possível auditar a finalização no modal:', erroAuditoria);
  }

  try {
    await garantirRelancamentoSemanalAposFinalizacao(execucao, {
      funcionarioId: confirmacao.funcionarioId,
      nome: confirmacao.nomeFuncionario,
    });
  } catch (erroRelancamento) {
    console.warn('Não foi possível relançar a tarefa para a próxima semana:', erroRelancamento);
  }

  await enviarEmailChecklistFinalizado(execucaoAtualId);

  pararSomNotificacao();
  fecharModal();
  carregarExecucoes();
  carregarChecklists();
  carregarNotificacoes();
  setMsg('msgExecucoes', `Execução finalizada por ${confirmacao.nomeFuncionario}!`, 'ok');
}

function fecharModal() {
  document.getElementById('modalOverlay').classList.remove('show');
  execucaoAtualId = null;
  itensExecucao = [];
}

// Fechar modal clicando fora
document.getElementById('modalOverlay').addEventListener('click', function(e) {
  if (e.target === this) fecharModal();
});

document.getElementById('pinActionOverlay').addEventListener('click', function(e) {
  if (e.target === this) fecharModalPin();
});

document.getElementById('modalInfoRegraChecklist').addEventListener('click', function(e) {
  if (e.target === this) fecharInfoRegraChecklist();
});

document.getElementById('formaPagamentoOverlay').addEventListener('click', function(e) {
  if (e.target === this) fecharModalFormaPagamentoFinanceiro();
});

document.getElementById('contaFinanceiraBaixaOverlay').addEventListener('click', function(e) {
  if (e.target === this) fecharModalContaFinanceiraBaixa();
});

document.getElementById('ajusteSaldoCofreOverlay').addEventListener('click', function(e) {
  if (e.target === this) fecharModalAjusteSaldoCofre();
});

document.getElementById('confirmacaoFinanceiraOverlay').addEventListener('click', function(e) {
  if (e.target === this) fecharModalConfirmacaoFinanceira('cancelar');
});

document.getElementById('pontoPendenteOverlay').addEventListener('click', function(e) {
  if (e.target === this) fecharModalPendenciaPonto('cancelar');
});

document.addEventListener('click', function(e) {
  const panel = document.getElementById('notificationPanel');
  const button = document.querySelector('.notification-btn');
  if (!panel || !button) return;
  if (!panel.contains(e.target) && !button.contains(e.target)) {
    togglePainelNotificacoes(false);
  }
});

window.addEventListener('resize', function() {
  if (window.innerWidth > 900) {
    closeMobileMenu();
  }
});

window.addEventListener('pageshow', function() {
  redefinirCampoBuscaTarefas();
});

function atualizarRelogioTopbar() {
  const el = document.getElementById('topbar-clock-time');
  if (!el) return;
  el.textContent = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date());
}

function criarDataLocal(year, monthIndex, day) {
  return new Date(year, monthIndex, day, 12, 0, 0, 0);
}

const CONFIG_QUINTO_DIA_UTIL = {
  considerarSabadoComoDiaUtil: true,
  incluirFeriadosMoveisFacultativos: false,
  // Adicione datas locais no formato YYYY-MM-DD quando necessário.
  feriadosLocaisEmpresa: [],
};

const cacheFeriadosAno = new Map();

function chaveDataLocal(data) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function somarDiasLocal(data, dias) {
  return criarDataLocal(data.getFullYear(), data.getMonth(), data.getDate() + dias);
}

function calcularPascoaGregoriana(ano) {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return criarDataLocal(ano, mes, dia);
}

function obterFeriadosFolhaBrasil(ano) {
  if (cacheFeriadosAno.has(ano)) return cacheFeriadosAno.get(ano);

  const feriados = new Set([
    chaveDataLocal(criarDataLocal(ano, 0, 1)),
    chaveDataLocal(criarDataLocal(ano, 3, 21)),
    chaveDataLocal(criarDataLocal(ano, 4, 1)),
    chaveDataLocal(criarDataLocal(ano, 8, 7)),
    chaveDataLocal(criarDataLocal(ano, 9, 12)),
    chaveDataLocal(criarDataLocal(ano, 10, 2)),
    chaveDataLocal(criarDataLocal(ano, 10, 15)),
    chaveDataLocal(criarDataLocal(ano, 10, 20)),
    chaveDataLocal(criarDataLocal(ano, 11, 25)),
  ]);

  if (CONFIG_QUINTO_DIA_UTIL.incluirFeriadosMoveisFacultativos) {
    const pascoa = calcularPascoaGregoriana(ano);
    [
      somarDiasLocal(pascoa, -48),
      somarDiasLocal(pascoa, -47),
      somarDiasLocal(pascoa, -2),
      somarDiasLocal(pascoa, 60),
    ].forEach(data => feriados.add(chaveDataLocal(data)));
  }

  if (Array.isArray(CONFIG_QUINTO_DIA_UTIL.feriadosLocaisEmpresa)) {
    CONFIG_QUINTO_DIA_UTIL.feriadosLocaisEmpresa.forEach(dataIso => {
      if (typeof dataIso !== 'string') return;
      const chave = dataIso.trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(chave)) return;
      if (Number(chave.slice(0, 4)) !== ano) return;
      feriados.add(chave);
    });
  }

  cacheFeriadosAno.set(ano, feriados);

  return feriados;
}

function dataEhDiaUtilBrasil(data) {
  const diaSemana = data.getDay();
  if (diaSemana === 0) return false;
  if (!CONFIG_QUINTO_DIA_UTIL.considerarSabadoComoDiaUtil && diaSemana === 6) return false;
  return !obterFeriadosFolhaBrasil(data.getFullYear()).has(chaveDataLocal(data));
}

function calcularQuintoDiaUtilMes(ano, mesIndex) {
  let uteis = 0;
  let data = criarDataLocal(ano, mesIndex, 1);
  while (data.getMonth() === mesIndex) {
    if (dataEhDiaUtilBrasil(data)) {
      uteis += 1;
      if (uteis === 5) return data;
    }
    data = somarDiasLocal(data, 1);
  }
  return null;
}

function obterProximoQuintoDiaUtil(referencia = new Date()) {
  const hojeLocal = criarDataLocal(referencia.getFullYear(), referencia.getMonth(), referencia.getDate());
  let alvo = calcularQuintoDiaUtilMes(hojeLocal.getFullYear(), hojeLocal.getMonth());
  if (!alvo || hojeLocal.getTime() > alvo.getTime()) {
    alvo = calcularQuintoDiaUtilMes(hojeLocal.getFullYear(), hojeLocal.getMonth() + 1);
  }
  return { alvo, hojeLocal };
}

function atualizarQuintoDiaUtilTopbar() {
  const el = document.getElementById('topbar-business-day-date');
  if (!el) return;

  const { alvo, hojeLocal } = obterProximoQuintoDiaUtil();
  if (!alvo) {
    el.textContent = '--/--';
    el.className = 'topbar-business-day-date';
    return;
  }

  el.textContent = `${String(alvo.getDate()).padStart(2, '0')}/${String(alvo.getMonth() + 1).padStart(2, '0')}`;
  const diasRestantes = Math.round((alvo.getTime() - hojeLocal.getTime()) / 86400000);
  el.className = 'topbar-business-day-date';
  if ([1, 2, 3].includes(diasRestantes)) {
    el.classList.add(`status-${diasRestantes}`);
  }
}

function registrarServiceWorkerPwa() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker-v4.js?v=3.2.34', { scope: './', updateViaCache: 'none' })
      .catch(error => {
        console.warn('Falha ao registrar Service Worker do PWA:', error);
      });
  });
}

['click', 'keydown', 'touchstart'].forEach(eventName => {
  window.addEventListener(eventName, habilitarSomNotificacao, { once: true });
});
