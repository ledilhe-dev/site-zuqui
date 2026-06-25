// CHECKLISTS
// 
function obterAvisoDiscretoChecklist(lancamento = {}) {
  if (!lancamentoProgramadoHoje(lancamento)) return null;
  if (lancamentoFoiCriadoAposHorarioNoMesmoDia(lancamento)) return null;

  const prazo = obterContextoPrazo(lancamento.horario_limite, ANTECEDENCIA_ALERTA_CHECKLIST_MINUTOS);
  if (prazo.vencido) {
    return {
      classe: 'atrasado',
      texto: `Prazo vencido${horaCurta(lancamento.horario_limite) ? ` desde ${horaCurta(lancamento.horario_limite)}` : ''}`,
    };
  }
  if (prazo.ativo || lancamentoRecemCriadoParaAlerta(lancamento)) {
    return {
      classe: '',
      texto: horaCurta(lancamento.horario_limite)
        ? `Atenção ao prazo: ${horaCurta(lancamento.horario_limite)}`
        : 'Checklist pendente',
    };
  }
  return null;
}

async function carregarChecklists(opcoes = {}) {
  const silencioso = !!opcoes?.silencioso;
  const forcarRender = !!opcoes?.forcarRender;
  const lista = document.getElementById('listaChecklists');
  if (!lista) return;
  const versaoSessaoInicio = versaoSessaoSistema;
  const tokenAtual = ++tokenRequisicaoChecklists;
  try {
    const valorSalvo = localStorage.getItem(STORAGE_CHECKLISTS_FUTUROS_OPEN);
    if (valorSalvo === '1') checklistsFuturosExpandido = true;
    if (valorSalvo === '0') checklistsFuturosExpandido = false;
  } catch (e) {}
  const futurosElAnterior = lista?.querySelector('.checklists-futuros-box');
  if (futurosElAnterior) {
    checklistsFuturosExpandido = !!futurosElAnterior.open;
  }
  const listaTemConteudo = !!lista.querySelector('.lista, .checklists-futuros-box, .empty');
  if (!silencioso && !listaTemConteudo) {
    lista.innerHTML = '<div class="empty">Carregando...</div>';
  }
  await carregarOpcoesFiltroChecklists();
  if (versaoSessaoInicio !== versaoSessaoSistema) return;

  try {
    const cfg = await obterConfiguracoesLoja();
    if (versaoSessaoInicio !== versaoSessaoSistema) return;
    if (!cfg.missing) {
      await garantirLancamentosAutomaticosDoDia(cfg.data || null);
      if (versaoSessaoInicio !== versaoSessaoSistema) return;
    }
  } catch (error) {
    console.warn('Não foi possível preparar os checklists automáticos do dia:', error);
  }

  let query = sb
    .from('checklist_lancamentos')
    .select('*')
    .eq('status', 'pendente')
    .order('lancado_em', { ascending: false });
  query = aplicarFiltroLojaGenericoQuery(query); // isolamento multi-loja

  const { data, error } = await query;
  if (versaoSessaoInicio !== versaoSessaoSistema) return;
  if (tokenAtual !== tokenRequisicaoChecklists) return;

  if (error) {
    if (isMissingLancamentosTableError(error)) {
      lista.innerHTML = '<div class="empty">Execute o SQL da tabela de lançamentos para usar esta fila.</div>';
      return;
    }
    console.error('Erro ao carregar checklists lancados:', error);
    lista.innerHTML = '<div class="empty">Erro ao carregar.</div>';
    return;
  }

  const dataHoje = hoje();
  let rows = (data || []).filter(t => {
    const dataReferencia = String(obterDataProgramadaLancamento(t) || '').trim() || dataHoje;
    if (dataReferencia < dataHoje) return false;
    return lancamentoAtendeFiltroDiaSemana(t, dataReferencia);
  });

  const funcionarioRestritoChecklistId = obterFuncionarioRestritoLogadoId();
  if (funcionarioRestritoChecklistId) {
    rows = rows.filter(t => String(t.funcionario_id || '') === funcionarioRestritoChecklistId);
  } else if (!usuarioPodeVerTodosChecklists() && usuarioSistemaLogado?.id) {
    rows = rows.filter(t => String(t.funcionario_id || '') === String(usuarioSistemaLogado.id || ''));
  }
  const compararLancamentosChecklist = (a, b) => {
    const dataA = String(obterDataProgramadaLancamento(a) || '').trim();
    const dataB = String(obterDataProgramadaLancamento(b) || '').trim();
    if (dataA !== dataB) return dataA.localeCompare(dataB);
    const horaA = String(horaCurta(a?.horario_limite || '') || '99:99');
    const horaB = String(horaCurta(b?.horario_limite || '') || '99:99');
    if (horaA !== horaB) return horaA.localeCompare(horaB);
    return String(a?.nome || '').localeCompare(String(b?.nome || ''), 'pt-BR');
  };
  rows.sort(compararLancamentosChecklist);

  const funcionarioIds = [...new Set(rows.map(t => t.funcionario_id).filter(Boolean))];
  let funcionariosMap = {};
  if (funcionarioIds.length) {
    const { data: funcionariosData } = await sb
      .from('funcionarios')
      .select('id, nome')
      .in('id', funcionarioIds);
    funcionariosMap = Object.fromEntries((funcionariosData || []).map(f => [String(f.id), f.nome]));
  }

  const filtroFuncionarioId = String(document.getElementById('filtroChecklistFuncionario')?.value || '');
  const filtroTarefaId = String(document.getElementById('filtroChecklistTarefa')?.value || '');
  const filtroChecklistDataInicio = String(document.getElementById('filtroChecklistDataInicio')?.value || '').trim();
  const filtroChecklistDataFim = String(document.getElementById('filtroChecklistDataFim')?.value || '').trim();
  const usandoFiltros = !!(filtroFuncionarioId || filtroTarefaId || filtroChecklistDataInicio || filtroChecklistDataFim);

  if (usandoFiltros) {
    rows = rows.filter(t => {
      const bateFuncionario = !filtroFuncionarioId || String(t.funcionario_id || '') === filtroFuncionarioId;
      const bateTarefa = !filtroTarefaId || String(t.tarefa_id || '') === filtroTarefaId;
      const dataReferencia = String(obterDataProgramadaLancamento(t) || '').trim() || dataHoje;
      const bateDataInicio = !filtroChecklistDataInicio || dataReferencia >= filtroChecklistDataInicio;
      const bateDataFim = !filtroChecklistDataFim || dataReferencia <= filtroChecklistDataFim;
      return bateFuncionario && bateTarefa && bateDataInicio && bateDataFim;
    });
  }

  if (!rows.length) {
    lista.innerHTML = usandoFiltros
      ? '<div class="empty">Nenhum checklist encontrado com os filtros informados.</div>'
      : '<div class="empty">Nenhum checklist lancado para hoje.</div>';
    return;
  }

  rows.sort(compararLancamentosChecklist);

  const renderizarCardsChecklist = (itens, comSelecao = false) => '<div class="lista">' + itens.map(t => {
    const aviso = obterAvisoDiscretoChecklist(t);
    const nomeFuncionario = funcionariosMap[String(t.funcionario_id)] ?? '-';
    const dataProgramada = String(obterDataProgramadaLancamento(t) || '').trim();
    const diaSemanaProgramado = formatarDiaSemanaExtenso(dataProgramada);
    const marcado = proximasTarefasSelecionadasIds.has(String(t.id));
    return `
    <div class="item checklist-item${aviso ? ' checklist-alerta-discreto' : ''}">
      ${comSelecao && usuarioTemPermissao('excluir_proximas_tarefas') ? `<div class="checklist-item-check"><input type="checkbox" ${marcado ? 'checked' : ''} title="Selecionar para excluir" onchange="alternarSelecaoProximaTarefa('${t.id}', this.checked)"></div>` : ''}
      <div class="item-info">
        <div class="checklist-titulo-linha">
          <details class="checklist-info-pin">
            <summary title="Como funciona o aceite e a conferência" aria-label="Como funciona o aceite e a conferência">i</summary>
            <div class="checklist-info-pin-texto">Qualquer funcionário pode iniciar a tarefa com o próprio PIN. Para finalizar, é obrigatória a conferência de OUTRO funcionário: quem iniciou não pode finalizar a própria tarefa — outro confere e confirma com a senha dele.</div>
          </details>
          <div class="item-nome">${t.nome}</div>
        </div>
        ${aviso ? `<div class="checklist-card-aviso ${aviso.classe}">${aviso.texto}</div>` : ''}
        ${t.descricao ? `<div class="item-detalhe">${t.descricao}</div>` : ''}
        <ul class="checklist-meta">
          <li>Data programada: ${formatarDataProgramadaBr(dataProgramada)}</li>
          ${t.horario_limite ? `<li style="color:var(--amber)">Prazo máximo: ${t.horario_limite}</li>` : ''}
        </ul>
      </div>
      <div class="checklist-dia-semana-destaque">${escaparHtmlBasico(diaSemanaProgramado)}</div>
      <div class="checklist-responsavel-destaque">
        <div class="checklist-responsavel-label">Funcionário responsável</div>
        <div class="checklist-responsavel-nome">${nomeFuncionario}</div>
      </div>
      <div class="item-actions">
        <button class="btn btn-green" onclick="iniciarChecklistDireto('${t.id}')">Iniciar</button>
        ${usuarioTemPermissao('excluir_checklist_lancado') ? `<button class="btn btn-red" onclick="excluirChecklistLancado('${t.id}')">Excluir</button>` : ''}
      </div>
    </div>`;
  }).join('') + '</div>';

  const rowsHoje = rows.filter(t => {
    const dataReferencia = String(obterDataProgramadaLancamento(t) || '').trim() || dataHoje;
    return dataReferencia === dataHoje;
  });

  const rowsFuturos = rows.filter(t => {
    const dataReferencia = String(obterDataProgramadaLancamento(t) || '').trim() || dataHoje;
    return dataReferencia > dataHoje;
  });

  const campoProximaData = document.getElementById('filtroProximaTarefaData');
  const campoProximaHoraInicio = document.getElementById('filtroProximaTarefaHoraInicio');
  const campoProximaHoraFim = document.getElementById('filtroProximaTarefaHoraFim');
  const campoProximaFuncionario = document.getElementById('filtroProximaTarefaFuncionario');
  const campoProximaTarefa = document.getElementById('filtroProximaTarefaNome');
  const filtroProximaData = String(campoProximaData?.value || '').trim();
  const filtroProximaHoraInicio = String(campoProximaHoraInicio?.value || '').trim();
  const filtroProximaHoraFim = String(campoProximaHoraFim?.value || '').trim();
  const filtroProximaFuncionario = normalizarTextoComparacao(campoProximaFuncionario?.value || '');
  const filtroProximaTarefa = normalizarTextoComparacao(campoProximaTarefa?.value || '');
  const proximaTarefaTemFiltro = !!(filtroProximaData || filtroProximaHoraInicio || filtroProximaHoraFim || filtroProximaFuncionario || filtroProximaTarefa);

  const rowsFuturosFiltrados = rowsFuturos.filter(t => {
    const dataReferencia = String(obterDataProgramadaLancamento(t) || '').trim() || dataHoje;
    const horaReferencia = horaCurta(t?.horario_limite || '');
    const nomeFuncionario = normalizarTextoComparacao(funcionariosMap[String(t.funcionario_id)] || '');
    const nomeTarefa = normalizarTextoComparacao(t?.nome || '');
    if (filtroProximaData && dataReferencia !== filtroProximaData) return false;
    if (filtroProximaHoraInicio && (!horaReferencia || horaReferencia < filtroProximaHoraInicio)) return false;
    if (filtroProximaHoraFim && (!horaReferencia || horaReferencia > filtroProximaHoraFim)) return false;
    if (filtroProximaFuncionario && !nomeFuncionario.includes(filtroProximaFuncionario)) return false;
    if (filtroProximaTarefa && !nomeTarefa.includes(filtroProximaTarefa)) return false;
    return true;
  });

  const htmlFiltrosFuturos = (totalFiltrado, totalGeral) => `
    <div class="checklists-futuros-filtros checklists-futuros-filtros-compacto">
      <input id="filtroProximaTarefaData" class="filtro-compacto-data" type="date" value="${escaparHtmlBasico(filtroProximaData)}" onclick="this.showPicker?.()" onchange="carregarChecklists({ forcarRender: true })" title="Data programada">
      <input id="filtroProximaTarefaHoraInicio" class="filtro-compacto-hora" type="time" value="${escaparHtmlBasico(filtroProximaHoraInicio)}" onchange="carregarChecklists({ forcarRender: true })" title="Horário inicial">
      <input id="filtroProximaTarefaHoraFim" class="filtro-compacto-hora" type="time" value="${escaparHtmlBasico(filtroProximaHoraFim)}" onchange="carregarChecklists({ forcarRender: true })" title="Horário final">
      <input id="filtroProximaTarefaFuncionario" class="filtro-compacto-func" type="text" value="${escaparHtmlBasico(campoProximaFuncionario?.value || '')}" placeholder="Funcionário" oninput="debounceConsumo('filtro_checklist_funcionario', () => carregarChecklists({ forcarRender: true }), 500)">
      <input id="filtroProximaTarefaNome" class="filtro-compacto-tarefa" type="text" value="${escaparHtmlBasico(campoProximaTarefa?.value || '')}" placeholder="Buscar por tarefa" oninput="debounceConsumo('filtro_checklist_tarefa', () => carregarChecklists({ forcarRender: true }), 500)">
      <span class="checklists-futuros-total">Total: ${totalFiltrado}${proximaTarefaTemFiltro ? ` de ${totalGeral}` : ''}</span>
    </div>
    ${usuarioTemPermissao('excluir_proximas_tarefas') ? `
    <div class="checklists-futuros-acoes-massa">
      <button class="btn btn-ghost btn-sm" type="button" onclick="selecionarTodasProximasTarefas()">Selecionar todas</button>
      <button class="btn btn-ghost btn-sm" type="button" onclick="limparSelecaoProximasTarefas()">Desmarcar todas</button>
      <button class="btn btn-red btn-sm" type="button" onclick="excluirProximasTarefasSelecionadas()">Excluir selecionadas</button>
    </div>` : ''}`;

  const htmlHoje = rowsHoje.length
    ? renderizarCardsChecklist(rowsHoje)
    : `<div class="empty">${usandoFiltros ? 'Nenhum checklist de hoje encontrado com os filtros informados.' : 'Nenhum checklist lancado para hoje.'}</div>`;

  const htmlFuturos = rowsFuturos.length
    ? `<details class="checklists-futuros-box"${checklistsFuturosExpandido ? ' open' : ''}>
        <summary>Próxima tarefa (${rowsFuturosFiltrados.length})</summary>
        <div class="checklists-futuros-conteudo">
          ${htmlFiltrosFuturos(rowsFuturosFiltrados.length, rowsFuturos.length)}
          ${rowsFuturosFiltrados.length
            ? renderizarCardsChecklist(rowsFuturosFiltrados, true)
            : '<div class="empty">Nenhuma próxima tarefa encontrada com os filtros selecionados.</div>'}
        </div>
      </details>`
    : '';

  const htmlFinal = htmlHoje + htmlFuturos;
  if (!forcarRender && assinaturaRenderChecklists === htmlFinal) {
    const futurosElExistente = lista.querySelector('.checklists-futuros-box');
    if (futurosElExistente) {
      futurosElExistente.open = !!checklistsFuturosExpandido;
    }
    return;
  }

  assinaturaRenderChecklists = htmlFinal;
  lista.innerHTML = htmlFinal;

  const futurosElAtual = lista.querySelector('.checklists-futuros-box');
  if (futurosElAtual) {
    futurosElAtual.open = !!checklistsFuturosExpandido;
    futurosElAtual.addEventListener('toggle', () => {
      checklistsFuturosExpandido = !!futurosElAtual.open;
      try {
        localStorage.setItem(STORAGE_CHECKLISTS_FUTUROS_OPEN, checklistsFuturosExpandido ? '1' : '0');
      } catch (e) {}
    });
  }
}

async function carregarOpcoesFiltroChecklists() {
  const selFuncionario = document.getElementById('filtroChecklistFuncionario');
  const selTarefa = document.getElementById('filtroChecklistTarefa');
  if (!selFuncionario || !selTarefa) return;

  const valorFuncionarioAtual = String(selFuncionario.value || '');
  const valorTarefaAtual = String(selTarefa.value || '');

  let queryFuncionariosFiltroChecklists = sb.from('funcionarios').select('id, nome, loja_id, empresa_id').eq('ativo', true);
  queryFuncionariosFiltroChecklists = aplicarFiltroLojaFuncionariosQuery(queryFuncionariosFiltroChecklists).order('nome');

  const [funcionariosRes, tarefasRes] = await Promise.all([
    queryFuncionariosFiltroChecklists,
    sb.from('tarefas').select('id, nome').order('nome'),
  ]);

  const funcionarioRestritoId = obterFuncionarioRestritoLogadoId();
  const restringirAoUsuarioLogado = !funcionarioRestritoId && !usuarioPodeVerTodosChecklists() && usuarioSistemaLogado?.id;
  const funcionarioFiltroId = funcionarioRestritoId || (restringirAoUsuarioLogado ? String(usuarioSistemaLogado.id || '') : '');
  selFuncionario.innerHTML = funcionarioFiltroId ? '' : '<option value="">- Todos os funcionarios -</option>';
  if (!funcionariosRes.error) {
    (funcionariosRes.data || [])
      .filter(item => !funcionarioFiltroId || String(item.id) === funcionarioFiltroId)
      .forEach(item => {
        const opt = document.createElement('option');
        opt.value = String(item.id);
        opt.textContent = item.nome || 'Funcionario';
        selFuncionario.appendChild(opt);
      });
  }
  if (funcionarioFiltroId) {
    selFuncionario.value = funcionarioFiltroId;
    selFuncionario.disabled = true;
  } else {
    selFuncionario.disabled = false;
    selFuncionario.value = [...selFuncionario.options].some(opt => opt.value === valorFuncionarioAtual) ? valorFuncionarioAtual : '';
  }

  selTarefa.innerHTML = '<option value="">- Todas as tarefas -</option>';
  if (!tarefasRes.error || isMissingTableError(tarefasRes.error)) {
    (tarefasRes.data || []).forEach(item => {
      const opt = document.createElement('option');
      opt.value = String(item.id);
      opt.textContent = item.nome || 'Tarefa';
      selTarefa.appendChild(opt);
    });
  }
  selTarefa.value = [...selTarefa.options].some(opt => opt.value === valorTarefaAtual) ? valorTarefaAtual : '';
}

function limparFiltrosChecklists() {
  const campoFuncionario = document.getElementById('filtroChecklistFuncionario');
  const campoTarefa = document.getElementById('filtroChecklistTarefa');
  const funcionarioRestritoId = obterFuncionarioRestritoLogadoId();
  const funcionarioFiltroId = funcionarioRestritoId || (!usuarioPodeVerTodosChecklists() && usuarioSistemaLogado?.id ? String(usuarioSistemaLogado.id || '') : '');
  if (campoFuncionario) campoFuncionario.value = funcionarioFiltroId || '';
  if (campoTarefa) campoTarefa.value = '';
  carregarChecklists();
}

function filtrarPeriodoChecklists() {
  const dataInicio = document.getElementById('filtroChecklistDataInicio')?.value || '';
  const dataFim = document.getElementById('filtroChecklistDataFim')?.value || '';
  if (!dataInicio && !dataFim) {
    setMsg('msgChecklists', 'Informe pelo menos uma data para filtrar.', 'warn');
    return;
  }
  carregarChecklists({ forcarRender: true });
}

function limparPeriodoChecklists() {
  const campoInicio = document.getElementById('filtroChecklistDataInicio');
  const campoFim = document.getElementById('filtroChecklistDataFim');
  if (campoInicio) campoInicio.value = '';
  if (campoFim) campoFim.value = '';
  carregarChecklists({ forcarRender: true });
}

async function criarChecklist() {
  const nome = document.getElementById('nomeChecklist').value.trim();
  const descricao = document.getElementById('descChecklist').value.trim();
  if (!nome) { setMsg('msgChecklists', 'Digite um nome para o checklist.', 'err'); return; }
  const { error } = await sb.from('checklists').insert([{ nome, descricao: descricao || null }]);
  if (error) { setMsg('msgChecklists', 'Erro ao criar checklist.', 'err'); return; }
  document.getElementById('nomeChecklist').value = '';
  document.getElementById('descChecklist').value = '';
  setMsg('msgChecklists', 'Checklist criado com sucesso.', 'ok');
  carregarChecklists();
}

async function excluirChecklist(id) {
  if (!usuarioEhAdminOuPerfilAdmin()) {
    setMsg('msgChecklists', 'Somente o perfil Administrador pode excluir checklists.', 'err');
    return;
  }
  if (!confirm('Excluir este checklist? Isso remove também os itens vinculados.')) return;
  const { error } = await sb.from('checklists').delete().eq('id', id);
  if (error) { alert('Erro ao excluir.'); return; }
  carregarChecklists();
}

async function excluirChecklistLancado(id) {
  if (!usuarioTemPermissao('excluir_checklist_lancado')) {
    setMsg('msgChecklists', 'Seu perfil não tem permissão para excluir checklists lançados.', 'err');
    return;
  }

  const confirmacaoSenha = await abrirModalPin({
    titulo: 'Excluir checklist lançado',
    subtitulo: 'Digite a senha master para remover este checklist da fila.',
    textoAcao: 'Validar senha',
    exibirUsuario: false,
    placeholderInput: 'Digite a senha master'
  });
  if (!confirmacaoSenha?.pin) {
    setMsg('msgChecklists', 'Exclusão cancelada.', 'err');
    return;
  }
  if (!(await validarSenhaMasterParaExclusao(confirmacaoSenha.pin))) {
    setMsg('msgChecklists', 'Senha master inválida. Exclusão cancelada.', 'err');
    return;
  }

  const { error } = await sb
    .from('checklist_lancamentos')
    .update({ status: 'cancelado' })
    .eq('id', id)
    .eq('status', 'pendente');

  if (error) {
    setMsg('msgChecklists', `Não foi possível excluir o checklist lançado: ${error.message}`, 'err');
    return;
  }

  setMsg('msgChecklists', 'Checklist removido da fila de hoje.', 'ok');
  carregarChecklists();
  carregarNotificacoes();
}

// ── Seleção em massa das "Próximas tarefas" (apenas administrador) ──
function alternarSelecaoProximaTarefa(id, marcado) {
  const chave = String(id || '');
  if (!chave) return;
  if (marcado) proximasTarefasSelecionadasIds.add(chave);
  else proximasTarefasSelecionadasIds.delete(chave);
}

function selecionarTodasProximasTarefas() {
  // Marca todas as que estão visíveis nos checkboxes atualmente renderizados.
  const checks = document.querySelectorAll('.checklist-item-check input[type="checkbox"]');
  checks.forEach(chk => {
    chk.checked = true;
    const onchange = chk.getAttribute('onchange') || '';
    const m = onchange.match(/alternarSelecaoProximaTarefa\('([^']+)'/);
    if (m) proximasTarefasSelecionadasIds.add(m[1]);
  });
  if (!checks.length) setMsg('msgChecklists', 'Nenhuma próxima tarefa visível para selecionar.', 'err');
}

function limparSelecaoProximasTarefas() {
  proximasTarefasSelecionadasIds = new Set();
  document.querySelectorAll('.checklist-item-check input[type="checkbox"]').forEach(chk => { chk.checked = false; });
}

async function excluirProximasTarefasSelecionadas() {
  if (!usuarioTemPermissao('excluir_proximas_tarefas')) {
    setMsg('msgChecklists', 'Seu perfil não tem permissão para excluir próximas tarefas.', 'err');
    return;
  }
  const ids = Array.from(proximasTarefasSelecionadasIds);
  if (!ids.length) {
    setMsg('msgChecklists', 'Marque ao menos uma próxima tarefa para excluir.', 'err');
    return;
  }

  const confirmacaoSenha = await abrirModalPin({
    titulo: 'Excluir próximas tarefas',
    subtitulo: `Digite a senha master para excluir ${ids.length} dia(s) selecionado(s) da sequência.`,
    textoAcao: 'Validar senha',
    exibirUsuario: false,
    placeholderInput: 'Digite a senha master'
  });
  if (!confirmacaoSenha?.pin) {
    setMsg('msgChecklists', 'Exclusão cancelada.', 'err');
    return;
  }
  if (!(await validarSenhaMasterParaExclusao(confirmacaoSenha.pin))) {
    setMsg('msgChecklists', 'Senha master inválida. Exclusão cancelada.', 'err');
    return;
  }

  let sucesso = 0;
  let falhas = 0;
  for (const id of ids) {
    try {
      const { error } = await sb
        .from('checklist_lancamentos')
        .update({ status: 'cancelado' })
        .eq('id', id)
        .eq('status', 'pendente');
      if (error) throw error;
      sucesso++;
    } catch (e) {
      console.error('Erro ao excluir lançamento futuro:', id, e);
      falhas++;
    }
  }

  proximasTarefasSelecionadasIds = new Set();
  setMsg('msgChecklists', `Exclusão concluída: ${sucesso} removido(s)${falhas ? `, ${falhas} com erro` : ''}.`, falhas ? 'err' : 'ok');
  carregarChecklists();
  carregarNotificacoes();
}

async function toggleChecklist(id, ativo) {
  await sb.from('checklists').update({ ativo: !ativo }).eq('id', id);
  carregarChecklists();
}

// 
// ITENS
// 
async function carregarSelectChecklists() {
  const sel = document.getElementById('checklistSelect');
  sel.innerHTML = '<option value="">- Selecione um checklist -</option>';
  const { data } = await sb.from('checklists').select('*').eq('ativo', true).order('nome');
  (data || []).forEach(c => {
    const o = document.createElement('option');
    o.value = c.id; o.textContent = c.nome;
    sel.appendChild(o);
  });
}

async function carregarItens() {
  const id = document.getElementById('checklistSelect').value;
  const lista = document.getElementById('listaItens');
  if (!id) { lista.innerHTML = '<div class="empty">Selecione um checklist acima</div>'; return; }
  lista.innerHTML = '<div class="empty">Carregando⬦</div>';
  const { data, error } = await sb.from('checklist_itens').select('*').eq('checklist_id', id).order('ordem');
  if (error) { lista.innerHTML = '<div class="empty">Erro ao carregar.</div>'; return; }
  if (!data?.length) { lista.innerHTML = '<div class="empty">Nenhum item cadastrado para este checklist.</div>'; return; }
  lista.innerHTML = '<div class="lista">' + data.map(item => `
    <div class="item">
      <div class="item-info">
        <div class="item-nome">#${item.ordem} - ${item.nome}</div>
        <div class="item-detalhe">${item.obrigatorio ? 'Obrigatório' : 'Opcional'}</div>
      </div>
      <div class="item-actions">
        <button class="btn btn-red" onclick="excluirItem('${item.id}')">Excluir</button>
      </div>
    </div>`).join('') + '</div>';
}

async function criarItem() {
  const checklistId = document.getElementById('checklistSelect').value;
  const nome = document.getElementById('nomeItem').value.trim();
  const ordem = Number(document.getElementById('ordemItem').value || 0);
  const obrigatorio = document.getElementById('obrigatorioItem').value === 'true';
  if (!checklistId) { setMsg('msgItens', 'Selecione um checklist.', 'err'); return; }
  if (!nome) { setMsg('msgItens', 'Digite o nome do item.', 'err'); return; }
  const { error } = await sb.from('checklist_itens').insert([{ checklist_id: checklistId, nome, ordem, obrigatorio }]);
  if (error) { setMsg('msgItens', 'Erro ao criar item.', 'err'); return; }
  document.getElementById('nomeItem').value = '';
  document.getElementById('ordemItem').value = '';
  setMsg('msgItens', 'Item adicionado.', 'ok');
  carregarItens();
}

async function excluirItem(id) {
  if (!confirm('Excluir este item?')) return;
  await sb.from('checklist_itens').delete().eq('id', id);
  carregarItens();
}

// 
