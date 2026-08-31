// RELATÓRIO DE TAREFAS CADASTRADAS
// Deriva os dados dos lançamentos (checklist_lancamentos) por tarefa:
// quem cadastrou/lançou, data de cadastro, início, fim e repetição (dias + intervalo + duração).
// ═══════════════════════════════════════════════════════════════════════════
let _relatorioTarefasCadCache = [];

function resetFiltroRelatorioTarefasCadastradas() {
  ['filtroTarefasCadDataInicio', 'filtroTarefasCadDataFim', 'filtroTarefasCadTarefa', 'filtroTarefasCadCadastrante', 'filtroTarefasCadResponsavel'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  carregarRelatorioTarefasCadastradas();
}

function detectarIntervaloDias(datasOrdenadas = []) {
  // Detecta o menor passo (em dias) entre lançamentos consecutivos. 1 = todos os dias.
  if (datasOrdenadas.length < 2) return null;
  let menor = null;
  for (let i = 1; i < datasOrdenadas.length; i++) {
    const d1 = new Date(datasOrdenadas[i - 1] + 'T00:00:00');
    const d2 = new Date(datasOrdenadas[i] + 'T00:00:00');
    const diff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
    if (diff > 0 && (menor === null || diff < menor)) menor = diff;
  }
  return menor;
}

async function carregarRelatorioTarefasCadastradas() {
  const contextoTenantInicio = capturarContextoTenant();
  const lista = document.getElementById('listaRelatorioTarefasCad');
  if (!lista) return;
  lista.innerHTML = '<div class="empty">Carregando...</div>';
  setMsg('msgRelatorioTarefasCad', '', '');

  const dataInicio = String(document.getElementById('filtroTarefasCadDataInicio')?.value || '').trim();
  const dataFim = String(document.getElementById('filtroTarefasCadDataFim')?.value || '').trim();
  const filtroTarefaId = String(document.getElementById('filtroTarefasCadTarefa')?.value || '').trim();
  const filtroCadastrante = String(document.getElementById('filtroTarefasCadCadastrante')?.value || '').trim().toLowerCase();
  const filtroResponsavel = String(document.getElementById('filtroTarefasCadResponsavel')?.value || '').trim();

  try {
    const lojaAtual = obterLojaAtualParaIsolamento();

    // Tarefas da loja (para incluir até as que não têm lançamento ainda).
    let queryTarefas = sb.from('tarefas').select('id, nome, descricao, funcionario_id, dias_semana, created_at, funcionarios(nome)').order('nome');
    if (lojaAtual) queryTarefas = queryTarefas.eq('loja_id', lojaAtual);
    const { data: tarefasData, error: errTarefas } = await queryTarefas;
    if (errTarefas && !isMissingTableError(errTarefas)) throw errTarefas;

    // Lançamentos (fonte da repetição, datas e quem lançou).
    let queryLanc = sb.from('checklist_lancamentos')
      .select('id, tarefa_id, nome, funcionario_id, dias_semana, data_programada, lancado_em, criado_por_id, criado_por_nome')
      .order('data_programada', { ascending: true })
      .limit(5000);
    if (lojaAtual) queryLanc = queryLanc.eq('loja_id', lojaAtual);
    const { data: lancData, error: errLanc } = await queryLanc;
    if (errLanc && !isMissingLancamentosTableError(errLanc)) throw errLanc;

    // Funcionários para resolver nomes de responsáveis.
    const { data: funcsData } = await sb.from('funcionarios').select('id, nome');
    const funcMap = Object.fromEntries((funcsData || []).map(f => [String(f.id), f.nome]));

    // Agrupa lançamentos por tarefa.
    const lancPorTarefa = {};
    (lancData || []).forEach(l => {
      const tid = String(l.tarefa_id || '');
      if (!tid) return;
      (lancPorTarefa[tid] = lancPorTarefa[tid] || []).push(l);
    });

    // Monta as linhas do relatório (uma por tarefa).
    const linhas = (tarefasData || []).map(t => {
      const tid = String(t.id);
      const lancs = (lancPorTarefa[tid] || []).slice().sort((a, b) =>
        String(a.data_programada || '').localeCompare(String(b.data_programada || '')));
      const datas = lancs.map(l => String(l.data_programada || '').slice(0, 10)).filter(Boolean);
      const datasUnicas = [...new Set(datas)].sort();
      const primeiroLanc = lancs.slice().sort((a, b) =>
        new Date(a.lancado_em || 0) - new Date(b.lancado_em || 0))[0] || null;

      const cadastradoEm = (primeiroLanc?.lancado_em || t.created_at || '') || '';
      const cadastradoPor = primeiroLanc?.criado_por_nome || (t.funcionarios?.nome ? '' : '') || '';
      const inicio = datasUnicas[0] || '';
      const fim = datasUnicas[datasUnicas.length - 1] || '';
      const intervalo = detectarIntervaloDias(datasUnicas);
      const totalDias = (inicio && fim)
        ? (Math.round((new Date(fim + 'T00:00:00') - new Date(inicio + 'T00:00:00')) / (1000 * 60 * 60 * 24)) + 1)
        : 0;
      const diasSemana = lancs[0]?.dias_semana || t.dias_semana || 'todos';

      const repeticaoTexto = lancs.length
        ? `${formatarDias(diasSemana)}${intervalo && intervalo > 1 ? ` · a cada ${intervalo} dia(s)` : (intervalo === 1 ? ' · diária' : '')}${totalDias ? ` · por ${totalDias} dia(s)` : ''}`
        : 'Sem lançamento';

      return {
        tarefa_id: tid,
        nomeTarefa: t.nome || 'Tarefa',
        descricao: t.descricao || '',
        responsavel_id: String(t.funcionario_id || ''),
        responsavel: funcMap[String(t.funcionario_id || '')] || t.funcionarios?.nome || 'Sem responsável',
        cadastradoPor: cadastradoPor || (primeiroLanc ? 'Sistema' : '—'),
        cadastradoEm,
        inicio,
        fim,
        diasSemana,
        intervalo,
        totalDias,
        qtdLancamentos: lancs.length,
        repeticaoTexto,
      };
    });

    // Popular selects de filtro (tarefa, cadastrante, responsável).
    popularFiltrosRelatorioTarefasCad(tarefasData || [], lancData || [], funcMap);

    // Aplicar filtros.
    let filtradas = linhas;
    if (filtroTarefaId) filtradas = filtradas.filter(l => l.tarefa_id === filtroTarefaId);
    if (filtroResponsavel) filtradas = filtradas.filter(l => l.responsavel_id === filtroResponsavel);
    if (filtroCadastrante) filtradas = filtradas.filter(l => String(l.cadastradoPor || '').trim().toLowerCase() === filtroCadastrante);
    if (dataInicio || dataFim) {
      filtradas = filtradas.filter(l => {
        const dataRef = String(l.cadastradoEm || '').slice(0, 10);
        if (!dataRef) return false;
        if (dataInicio && dataRef < dataInicio) return false;
        if (dataFim && dataRef > dataFim) return false;
        return true;
      });
    }

    _relatorioTarefasCadCache = filtradas;

    if (!contextoTenantAindaValido(contextoTenantInicio)) return;
    if (!filtradas.length) {
      lista.innerHTML = '<div class="empty">Nenhuma tarefa cadastrada para os filtros selecionados.</div>';
      return;
    }

    lista.innerHTML = '<div class="lista">' + filtradas.map(l => `
      <div class="item">
        <div class="item-info">
          <div class="item-nome">${escaparHtmlBasico(l.nomeTarefa)}</div>
          ${l.descricao ? `<div class="item-detalhe">${escaparHtmlBasico(l.descricao)}</div>` : ''}
          <div class="item-detalhe">Responsável: ${escaparHtmlBasico(l.responsavel)}</div>
          <div class="item-detalhe">Cadastrado por: ${escaparHtmlBasico(l.cadastradoPor)} · ${l.cadastradoEm ? fmtDate(l.cadastradoEm) : '—'}</div>
          <div class="item-detalhe">Período: ${l.inicio ? formatarDataProgramadaBr(l.inicio) : '—'} até ${l.fim ? formatarDataProgramadaBr(l.fim) : '—'}</div>
          <div class="item-detalhe">Repetição: ${escaparHtmlBasico(l.repeticaoTexto)}</div>
        </div>
        <div class="item-actions">
          <span class="tag ${l.qtdLancamentos ? 'tag-green' : 'tag-amber'}">${l.qtdLancamentos ? l.qtdLancamentos + ' lançamento(s)' : 'Sem lançamento'}</span>
        </div>
      </div>
    `).join('') + '</div>';

    setMsg('msgRelatorioTarefasCad', `${filtradas.length} tarefa(s) no relatório.`, 'ok');
  } catch (error) {
    console.error('Erro ao carregar relatório de tarefas cadastradas:', error);
    lista.innerHTML = '<div class="empty">Erro ao carregar o relatório.</div>';
    setMsg('msgRelatorioTarefasCad', `Não foi possível carregar: ${mensagemErroSupabase(error, 'erro desconhecido')}`, 'err');
  }
}

function popularFiltrosRelatorioTarefasCad(tarefas = [], lancamentos = [], funcMap = {}) {
  // Tarefa
  const selTarefa = document.getElementById('filtroTarefasCadTarefa');
  if (selTarefa) {
    const atual = selTarefa.value;
    const ordenadas = [...tarefas].sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || '')));
    selTarefa.innerHTML = '<option value="">- Todas as tarefas -</option>' +
      ordenadas.map(t => `<option value="${escaparHtmlBasico(String(t.id))}">${escaparHtmlBasico(t.nome || 'Tarefa')}</option>`).join('');
    if (Array.from(selTarefa.options).some(o => o.value === atual)) selTarefa.value = atual;
  }
  // Quem cadastrou
  const selCad = document.getElementById('filtroTarefasCadCadastrante');
  if (selCad) {
    const atual = selCad.value;
    const nomes = [...new Set((lancamentos || []).map(l => String(l.criado_por_nome || '').trim()).filter(Boolean))].sort();
    selCad.innerHTML = '<option value="">- Quem cadastrou (todos) -</option>' +
      nomes.map(n => `<option value="${escaparHtmlBasico(n.toLowerCase())}">${escaparHtmlBasico(n)}</option>`).join('');
    if (Array.from(selCad.options).some(o => o.value === atual)) selCad.value = atual;
  }
  // Responsável
  const selResp = document.getElementById('filtroTarefasCadResponsavel');
  if (selResp) {
    const atual = selResp.value;
    const respIds = [...new Set((tarefas || []).map(t => String(t.funcionario_id || '')).filter(Boolean))];
    const ordenados = respIds.map(id => [id, funcMap[id] || 'Funcionário']).sort((a, b) => String(a[1]).localeCompare(String(b[1])));
    selResp.innerHTML = '<option value="">- Responsável (todos) -</option>' +
      ordenados.map(([id, nome]) => `<option value="${escaparHtmlBasico(id)}">${escaparHtmlBasico(nome)}</option>`).join('');
    if (Array.from(selResp.options).some(o => o.value === atual)) selResp.value = atual;
  }
}

function montarLinhasExportacaoRelatorioTarefasCad() {
  return (_relatorioTarefasCadCache || []).map(l => ({
    Tarefa: l.nomeTarefa,
    Descricao: l.descricao,
    Responsavel: l.responsavel,
    Cadastrado_por: l.cadastradoPor,
    Data_cadastro: l.cadastradoEm ? fmtDate(l.cadastradoEm) : '',
    Inicio: l.inicio ? formatarDataProgramadaBr(l.inicio) : '',
    Fim: l.fim ? formatarDataProgramadaBr(l.fim) : '',
    Dias_semana: formatarDias(l.diasSemana),
    Intervalo_dias: l.intervalo || '',
    Duracao_dias: l.totalDias || '',
    Repeticao: l.repeticaoTexto,
    Qtd_lancamentos: l.qtdLancamentos,
  }));
}

function exportarRelatorioTarefasCadastradasExcel() {
  const linhas = montarLinhasExportacaoRelatorioTarefasCad();
  if (!linhas.length) {
    setMsg('msgRelatorioTarefasCad', 'Não há tarefas para exportar.', 'err');
    return;
  }
  const headers = Object.keys(linhas[0]);
  const csv = [headers.join(';')].concat(linhas.map(row => headers.map(h => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(';'))).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `relatorio-tarefas-cadastradas-${dataLocalISO()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  setMsg('msgRelatorioTarefasCad', 'Excel exportado com sucesso.', 'ok');
}

function exportarRelatorioTarefasCadastradasPDF() {
  const linhas = montarLinhasExportacaoRelatorioTarefasCad();
  if (!linhas.length) {
    setMsg('msgRelatorioTarefasCad', 'Não há tarefas para exportar em PDF.', 'err');
    return;
  }
  const htmlLinhas = linhas.map(row => `
    <tr>
      <td>${escaparHtmlBasico(row.Tarefa)}</td>
      <td>${escaparHtmlBasico(row.Descricao)}</td>
      <td>${escaparHtmlBasico(row.Responsavel)}</td>
      <td>${escaparHtmlBasico(row.Cadastrado_por)}</td>
      <td>${escaparHtmlBasico(row.Data_cadastro)}</td>
      <td>${escaparHtmlBasico(row.Inicio)}</td>
      <td>${escaparHtmlBasico(row.Fim)}</td>
      <td>${escaparHtmlBasico(row.Repeticao)}</td>
      <td>${escaparHtmlBasico(String(row.Qtd_lancamentos))}</td>
    </tr>
  `).join('');
  const win = window.open('', '_blank');
  if (!win) {
    setMsg('msgRelatorioTarefasCad', 'O navegador bloqueou a janela de PDF.', 'err');
    return;
  }
  const geradoEm = new Date().toLocaleString('pt-BR');
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Relatório de tarefas cadastradas</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}h1{font-size:20px}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #ccc;padding:6px;text-align:left;vertical-align:top}th{background:#f1f5f9}${cssRodapeRelatorioImpressao()}</style></head><body><h1>Relatório de tarefas cadastradas</h1><p>Gerado em ${escaparHtmlBasico(geradoEm)}</p><table><thead><tr><th>Tarefa</th><th>Descrição</th><th>Responsável</th><th>Cadastrado por</th><th>Data cadastro</th><th>Início</th><th>Fim</th><th>Repetição</th><th>Lançamentos</th></tr></thead><tbody>${htmlLinhas}</tbody></table>${htmlRodapeRelatorioImpressao(geradoEm, 'Filtros aplicados na tela de Relatório de tarefas cadastradas')}<script>window.onload=function(){window.print();}<\/script></body></html>`);
  win.document.close();
}

function toggleRegistrosRelatorioLancamentos(forcarAberto = null) {
  const body = document.getElementById('relatorioLancamentosRegistrosBody');
  const btn = document.getElementById('btnToggleRegistrosRelatorioLancamentos');
  if (!body) return;
  relatorioLancamentosRegistrosVisiveis = typeof forcarAberto === 'boolean' ? forcarAberto : !!body.hidden;
  body.hidden = !relatorioLancamentosRegistrosVisiveis;
  if (btn) btn.textContent = relatorioLancamentosRegistrosVisiveis ? 'Ocultar registros' : 'Mostrar registros';
}

function obterChaveRelatorioLancamento(item = {}) {
  return String(item.lancamento_id || item.execucao_id || `${item.tarefa_id || ''}|${item.funcionario_responsavel_id || ''}|${item.data_programada || dataLocalISO(item.registrado_em) || ''}|${item.horario_programado || ''}`);
}

function resumirEventosRelatorioLancamentos(eventos = [], contexto = {}) {
  const { lancamentosMap = {}, execucoesMap = {}, tarefasMap = {}, checklistsMap = {}, funcionariosMap = {} } = contexto;
  const grupos = new Map();

  eventos.forEach(item => {
    const chave = obterChaveRelatorioLancamento(item);
    const atual = grupos.get(chave) || {
      chave,
      eventos: [],
      lancamento_id: item.lancamento_id || null,
      execucao_id: item.execucao_id || null,
      tarefa_id: item.tarefa_id || null,
      checklist_id: item.checklist_id || null,
      funcionario_responsavel_id: item.funcionario_responsavel_id || null,
      data_programada: item.data_programada || '',
      horario_programado: item.horario_programado || '',
    };
    atual.eventos.push(item);
    if (!atual.lancamento_id && item.lancamento_id) atual.lancamento_id = item.lancamento_id;
    if (!atual.execucao_id && item.execucao_id) atual.execucao_id = item.execucao_id;
    if (!atual.tarefa_id && item.tarefa_id) atual.tarefa_id = item.tarefa_id;
    if (!atual.checklist_id && item.checklist_id) atual.checklist_id = item.checklist_id;
    if (!atual.funcionario_responsavel_id && item.funcionario_responsavel_id) atual.funcionario_responsavel_id = item.funcionario_responsavel_id;
    if (!atual.data_programada && item.data_programada) atual.data_programada = item.data_programada;
    if (!atual.horario_programado && item.horario_programado) atual.horario_programado = item.horario_programado;
    grupos.set(chave, atual);
  });

  return Array.from(grupos.values()).map(grupo => {
    const lancamento = lancamentosMap[String(grupo.lancamento_id)] || null;
    const execucao = execucoesMap[String(grupo.execucao_id)] || execucoesMap[`lancamento:${String(grupo.lancamento_id || '')}`] || null;
    const eventoLancado = grupo.eventos.find(item => item.tipo_evento === 'lancado') || null;
    const eventoIniciado = grupo.eventos.find(item => item.tipo_evento === 'iniciado') || null;
    const eventoFinalizado = grupo.eventos.find(item => item.tipo_evento === 'finalizado') || null;
    const ultimoEvento = [...grupo.eventos].sort((a, b) => new Date(b.registrado_em || 0).getTime() - new Date(a.registrado_em || 0).getTime())[0] || {};
    const statusExecucao = String(execucao?.status || '').trim().toLowerCase();
    const statusLancamento = String(lancamento?.status || '').trim().toLowerCase();
    const statusBase = eventoFinalizado ? 'finalizado' : eventoIniciado ? 'iniciado' : (statusExecucao || statusLancamento || ultimoEvento.tipo_evento || 'lancado');
    const inicioExecucao = eventoIniciado?.registrado_em || eventoFinalizado?.meta?.inicio_em || execucao?.inicio_confirmado_em || execucao?.iniciado_em || '';
    const fimExecucao = eventoFinalizado?.registrado_em || execucao?.finalizacao_confirmada_em || execucao?.finalizado_em || '';
    const observacaoLancamento = String(lancamento?.observacao_lancamento || '').trim();
    const observacaoRelatorio = observacaoLancamento === 'Lançamento manual registrado no painel.'
      ? ''
      : observacaoLancamento || eventoLancado?.observacao || eventoIniciado?.observacao || eventoFinalizado?.observacao || '';

    return {
      chave: grupo.chave,
      nomeTarefa: eventoLancado?.nome_evento || eventoIniciado?.nome_evento || eventoFinalizado?.nome_evento || lancamento?.nome || tarefasMap[String(grupo.tarefa_id)] || checklistsMap[String(grupo.checklist_id)] || 'Checklist',
      descricao: lancamento?.descricao || '',
      observacao: observacaoRelatorio,
      responsavel: funcionariosMap[String(grupo.funcionario_responsavel_id)] || 'Sem responsável',
      dataProgramada: grupo.data_programada || lancamento?.data_programada || ultimoEvento.data_programada || '',
      horarioProgramado: horaCurta(grupo.horario_programado || lancamento?.horario_limite || '') || '-',
      status: statusBase,
      statusTexto: statusBase === 'finalizado' ? 'Finalizado' : statusBase === 'iniciado' ? 'Iniciado' : statusBase === 'pendente' ? 'Pendente' : tituloEventoLancamento(statusBase),
      lancadoEm: eventoLancado?.registrado_em || lancamento?.lancado_em || '',
      lancadoPor: eventoLancado?.funcionario_ator_nome || lancamento?.criado_por_nome || 'Sistema',
      iniciadoEm: inicioExecucao,
      iniciadoPor: eventoIniciado?.funcionario_ator_nome || funcionariosMap[String(eventoIniciado?.funcionario_ator_id)] || '',
      finalizadoEm: fimExecucao,
      finalizadoPor: eventoFinalizado?.funcionario_ator_nome || funcionariosMap[String(eventoFinalizado?.funcionario_ator_id)] || '',
    };
  }).sort((a, b) => {
    const dataA = new Date(a.finalizadoEm || a.iniciadoEm || a.lancadoEm || a.dataProgramada || 0).getTime();
    const dataB = new Date(b.finalizadoEm || b.iniciadoEm || b.lancadoEm || b.dataProgramada || 0).getTime();
    return dataB - dataA;
  });
}

async function carregarRelatorioLancamentos(opcoes = {}) {
  const contextoTenantInicio = capturarContextoTenant();
  const silencioso = opcoes?.silencioso === true;
  const lista = document.getElementById('listaRelatorioLancamentos');
  const body = document.getElementById('relatorioLancamentosRegistrosBody');
  const btnToggle = document.getElementById('btnToggleRegistrosRelatorioLancamentos');
  const campoDataInicio = document.getElementById('filtroLancamentoDataInicio');
  const campoDataFim = document.getElementById('filtroLancamentoDataFim');
  const campoEvento = document.getElementById('filtroLancamentoEvento');
  const campoFuncionario = document.getElementById('filtroLancamentoFuncionario');
  const campoBusca = document.getElementById('filtroLancamentoBusca');
  if (!lista) return;
  if (body) body.hidden = !relatorioLancamentosRegistrosVisiveis;
  if (btnToggle) btnToggle.textContent = relatorioLancamentosRegistrosVisiveis ? 'Ocultar registros' : 'Mostrar registros';

  if (campoDataInicio && !campoDataInicio.value) campoDataInicio.value = hoje();
  if (campoDataFim && !campoDataFim.value) campoDataFim.value = hoje();

  if (!silencioso || !String(lista.innerHTML || '').trim()) {
    lista.innerHTML = '<div class="empty">Carregando...</div>';
  }

  const dataInicio = campoDataInicio?.value || '';
  const dataFim = campoDataFim?.value || '';
  const tipoEvento = String(campoEvento?.value || '').trim();
  const funcionarioId = String(campoFuncionario?.value || '').trim();
  const busca = String(campoBusca?.value || '').trim().toLowerCase();

  try {
    const [funcionariosRes, eventosRes] = await Promise.all([
          sb.from('funcionarios').select('id, nome').order('nome'),
          (() => {
            let query = sb
              .from('checklist_lancamento_eventos')
              .select('id, lancamento_id, execucao_id, tarefa_id, checklist_id, funcionario_responsavel_id, funcionario_ator_id, funcionario_ator_nome, tipo_evento, origem_evento, data_programada, horario_programado, registrado_em, observacao, meta')
              .order('data_programada', { ascending: false })
              .order('registrado_em', { ascending: false })
              .limit(500);

            if (tipoEvento) query = query.eq('tipo_evento', tipoEvento);
            if (funcionarioId) query = query.eq('funcionario_responsavel_id', funcionarioId);
            return query;
          })(),
    ]);

    if (funcionariosRes.error) throw funcionariosRes.error;
    if (eventosRes.error) {
      if (isMissingLaunchEventsTableError(eventosRes.error)) {
        lista.innerHTML = '<div class="empty">Rode a nova migration de auditoria para habilitar este relatório.</div>';
        setMsg('msgRelatorioLancamentos', 'Tabela checklist_lancamento_eventos não encontrada no banco.', 'err');
        return;
      }
      throw eventosRes.error;
    }

    const funcionarios = funcionariosRes.data || [];
    const valorFuncionarioAtual = String(campoFuncionario?.value || '');
    if (campoFuncionario) {
      campoFuncionario.innerHTML = '<option value="">- Todos os responsáveis -</option>' + funcionarios
        .map(item => `<option value="${item.id}">${escaparHtmlBasico(item.nome || 'Funcionário')}</option>`)
        .join('');
      campoFuncionario.value = funcionarios.some(item => String(item.id) === valorFuncionarioAtual) ? valorFuncionarioAtual : '';
    }

    const funcionariosMap = Object.fromEntries(funcionarios.map(item => [String(item.id), item.nome]));
    let eventos = eventosRes.data || [];

    if (!eventos.length) {
      const [lancamentosRes, execucoesRes] = await Promise.all([
        (() => {
          let query = sb
            .from('checklist_lancamentos')
            .select('id, tarefa_id, checklist_id, funcionario_id, nome, horario_limite, data_programada, lancado_em, criado_por_nome');
          if (dataInicio) query = query.gte('data_programada', dataInicio);
          if (dataFim) query = query.lte('data_programada', dataFim);
          if (funcionarioId) query = query.eq('funcionario_id', funcionarioId);
          return query.limit(500);
        })(),
        (() => {
          let query = sb
            .from('checklist_execucoes')
            .select('id, lancamento_id, tarefa_id, checklist_id, funcionario_id, usuario_inicio_id, usuario_fim_id, data_execucao, iniciado_em, inicio_confirmado_em, finalizado_em, finalizacao_confirmada_em, status')
            .order('data_execucao', { ascending: false });
          if (dataInicio) query = query.gte('data_execucao', dataInicio);
          if (dataFim) query = query.lte('data_execucao', dataFim);
          if (funcionarioId) query = query.eq('funcionario_id', funcionarioId);
          return query.limit(500);
        })(),
      ]);

      if (lancamentosRes.error && !isMissingLancamentosTableError(lancamentosRes.error)) throw lancamentosRes.error;
      if (execucoesRes.error && !isMissingTableError(execucoesRes.error)) throw execucoesRes.error;

      const lancamentosData = lancamentosRes.data || [];
      const execucoesData = execucoesRes.data || [];
      const eventosFallback = [];

      if (!tipoEvento || tipoEvento === 'lancado') {
        lancamentosData.forEach(item => {
          eventosFallback.push({
            id: `fallback-lancado-${item.id}`,
            lancamento_id: item.id,
            execucao_id: null,
            tarefa_id: item.tarefa_id || null,
            checklist_id: item.checklist_id || null,
            funcionario_responsavel_id: item.funcionario_id || null,
            funcionario_ator_id: null,
            funcionario_ator_nome: item.criado_por_nome || 'Sistema',
            tipo_evento: 'lancado',
            origem_evento: 'fallback_lancamentos',
            data_programada: item.data_programada || dataLocalISO(item.lancado_em),
            horario_programado: item.horario_limite || null,
            registrado_em: item.lancado_em || combinarDataHorarioEmIso(item.data_programada || hoje(), item.horario_limite || '12:00'),
            observacao: 'Lançamento recuperado diretamente da agenda.',
            meta: { fallback: true },
            nome_evento: item.nome || '',
          });
        });
      }

      if (!tipoEvento || tipoEvento === 'iniciado' || tipoEvento === 'finalizado') {
        execucoesData.forEach(item => {
          const inicio = item.inicio_confirmado_em || item.iniciado_em || null;
          const fim = item.finalizacao_confirmada_em || item.finalizado_em || null;

          if ((!tipoEvento || tipoEvento === 'iniciado') && inicio) {
            eventosFallback.push({
              id: `fallback-iniciado-${item.id}`,
              lancamento_id: item.lancamento_id || null,
              execucao_id: item.id,
              tarefa_id: item.tarefa_id || null,
              checklist_id: item.checklist_id || null,
              funcionario_responsavel_id: item.funcionario_id || null,
              funcionario_ator_id: item.usuario_inicio_id || null,
              funcionario_ator_nome: '',
              tipo_evento: 'iniciado',
              origem_evento: 'fallback_execucoes',
              data_programada: item.data_execucao || dataLocalISO(inicio),
              horario_programado: null,
              registrado_em: inicio,
              observacao: 'Início recuperado diretamente das execuções.',
            meta: { fallback: true, inicio_em: inicio, fim_em: fim },
          });
          }

          if ((!tipoEvento || tipoEvento === 'finalizado') && fim) {
            eventosFallback.push({
              id: `fallback-finalizado-${item.id}`,
              lancamento_id: item.lancamento_id || null,
              execucao_id: item.id,
              tarefa_id: item.tarefa_id || null,
              checklist_id: item.checklist_id || null,
              funcionario_responsavel_id: item.funcionario_id || null,
              funcionario_ator_id: item.usuario_fim_id || null,
              funcionario_ator_nome: '',
              tipo_evento: 'finalizado',
              origem_evento: 'fallback_execucoes',
              data_programada: item.data_execucao || dataLocalISO(fim),
              horario_programado: null,
              registrado_em: fim,
              observacao: 'Finalização recuperada diretamente das execuções.',
            meta: { fallback: true, inicio_em: inicio, fim_em: fim },
          });
          }
        });
      }

      eventos = eventosFallback
        .sort((a, b) => new Date(b.registrado_em || 0).getTime() - new Date(a.registrado_em || 0).getTime())
        .slice(0, 500);
    }

    const tarefaIds = [...new Set(eventos.map(item => item.tarefa_id).filter(Boolean).map(item => String(item)))];
    const checklistIds = [...new Set(eventos.map(item => item.checklist_id).filter(Boolean).map(item => String(item)))];
    const lancamentoIds = [...new Set(eventos.map(item => item.lancamento_id).filter(Boolean).map(item => String(item)))];
    const execucaoIds = [...new Set(eventos.map(item => item.execucao_id).filter(Boolean).map(item => String(item)))];

    let tarefasMap = {};
    let checklistsMap = {};
    let lancamentosMap = {};
    let execucoesMap = {};

    if (tarefaIds.length) {
      const { data: tarefasData, error: tarefasError } = await sb.from('tarefas').select('id, nome').in('id', tarefaIds);
      if (tarefasError && !isMissingTableError(tarefasError)) throw tarefasError;
      tarefasMap = Object.fromEntries((tarefasData || []).map(item => [String(item.id), item.nome]));
    }

    if (checklistIds.length) {
      const { data: checklistsData, error: checklistsError } = await sb.from('checklists').select('id, nome').in('id', checklistIds);
      if (checklistsError) throw checklistsError;
      checklistsMap = Object.fromEntries((checklistsData || []).map(item => [String(item.id), item.nome]));
    }

    if (lancamentoIds.length) {
      const { data: lancamentosData, error: lancamentosError } = await sb
        .from('checklist_lancamentos')
        .select('id, nome, descricao, status, data_programada, horario_limite, lancado_em, criado_por_nome, observacao_lancamento')
        .in('id', lancamentoIds);
      if (lancamentosError && !isMissingLancamentosTableError(lancamentosError)) throw lancamentosError;
      lancamentosMap = Object.fromEntries((lancamentosData || []).map(item => [String(item.id), item]));
    }

    if (execucaoIds.length || lancamentoIds.length) {
      let execQuery = sb
        .from('checklist_execucoes')
        .select('id, lancamento_id, iniciado_em, inicio_confirmado_em, finalizado_em, finalizacao_confirmada_em, status')
        .limit(500);

      if (execucaoIds.length) {
        execQuery = execQuery.in('id', execucaoIds);
      } else {
        execQuery = execQuery.in('lancamento_id', lancamentoIds);
      }

      const { data: execucoesData, error: execucoesError } = await execQuery;
      if (execucoesError && !isMissingTableError(execucoesError)) throw execucoesError;
      (execucoesData || []).forEach(item => {
        execucoesMap[String(item.id)] = item;
        if (item.lancamento_id && !execucoesMap[`lancamento:${String(item.lancamento_id)}`]) {
          execucoesMap[`lancamento:${String(item.lancamento_id)}`] = item;
        }
      });
    }

    const eventosFiltrados = eventos.filter(item => {
      const lancamento = lancamentosMap[String(item.lancamento_id)] || null;
      const datasReferencia = [
        item.data_programada,
        item.registrado_em ? dataLocalISO(item.registrado_em) : '',
        lancamento?.data_programada || '',
        lancamento?.lancado_em ? dataLocalISO(lancamento.lancado_em) : '',
      ].map(valor => String(valor || '').trim()).filter(Boolean);
      const temDataNoPeriodo = datasReferencia.some(dataRef => {
        if (dataInicio && dataRef < dataInicio) return false;
        if (dataFim && dataRef > dataFim) return false;
        return true;
      });
      if (!temDataNoPeriodo) return false;

      if (!busca) return true;
      const nomeTarefa = item.nome_evento || lancamento?.nome || tarefasMap[String(item.tarefa_id)] || checklistsMap[String(item.checklist_id)] || '';
      const textoBusca = [
        nomeTarefa,
        lancamento?.descricao || '',
        item.observacao || '',
        lancamento?.observacao_lancamento || '',
        item.funcionario_ator_nome || '',
        funcionariosMap[String(item.funcionario_responsavel_id)] || '',
        tituloEventoLancamento(item.tipo_evento),
      ].join(' ').toLowerCase();
      return textoBusca.includes(busca);
    });

    const registrosRelatorio = resumirEventosRelatorioLancamentos(eventosFiltrados, {
      lancamentosMap,
      execucoesMap,
      tarefasMap,
      checklistsMap,
      funcionariosMap,
    });
    if (!contextoTenantAindaValido(contextoTenantInicio)) return;
    relatorioLancamentosCache = registrosRelatorio;

    if (!registrosRelatorio.length) {
      const vazioHtml = '<div class="empty">Nenhum evento encontrado com os filtros selecionados.</div>';
      if (lista.innerHTML !== vazioHtml) lista.innerHTML = vazioHtml;
      setMsg('msgRelatorioLancamentos', '', '');
      return;
    }

    const novoHtml = '<div class="lista">' + registrosRelatorio.map(item => {
          const dataProgramada = formatarDataProgramadaBr(item.dataProgramada || '');
          const horariosExecucaoHtml = (item.iniciadoEm || item.finalizadoEm)
            ? `<div class="relatorio-horarios-execucao">
                ${item.iniciadoEm ? `<span class="relatorio-horario-chip inicio"><strong>Início</strong> ${escaparHtmlBasico(fmtDate(item.iniciadoEm))}</span>` : ''}
                ${item.finalizadoEm ? `<span class="relatorio-horario-chip fim"><strong>Fim</strong> ${escaparHtmlBasico(fmtDate(item.finalizadoEm))}</span>` : ''}
              </div>`
            : '';
          return `
            <div class="item relatorio-tarefa-card">
              <div class="item-info">
                <div class="item-nome">${escaparHtmlBasico(item.nomeTarefa)} · ${escaparHtmlBasico(item.statusTexto)}</div>
                ${item.observacao ? `<div class="item-detalhe">Observação: ${escaparHtmlBasico(item.observacao)}</div>` : ''}
                ${item.descricao ? `<div class="item-detalhe">${escaparHtmlBasico(item.descricao)}</div>` : ''}
                <div class="item-detalhe">Responsável: ${escaparHtmlBasico(item.responsavel)}</div>
                <div class="item-detalhe">Agendado para: ${escaparHtmlBasico(dataProgramada)} · Horário: ${escaparHtmlBasico(item.horarioProgramado)}</div>
                <div class="item-detalhe">Lançado pelo usuário: ${escaparHtmlBasico(item.lancadoPor || '-')} ${item.lancadoEm ? `· ${escaparHtmlBasico(fmtDate(item.lancadoEm))}` : ''}</div>
                <div class="item-detalhe">Iniciado pelo usuário: ${escaparHtmlBasico(item.iniciadoPor || '-')} ${item.iniciadoEm ? `· ${escaparHtmlBasico(fmtDate(item.iniciadoEm))}` : ''}</div>
                <div class="item-detalhe">Finalizado pelo usuário: ${escaparHtmlBasico(item.finalizadoPor || '-')} ${item.finalizadoEm ? `· ${escaparHtmlBasico(fmtDate(item.finalizadoEm))}` : ''}</div>
              </div>
              <div class="item-actions relatorio-tarefa-lateral">
                ${horariosExecucaoHtml}
                ${tagEventoLancamento(item.status)}
              </div>
            </div>
          `;
    }).join('') + '</div>';
    if (lista.innerHTML !== novoHtml) {
      lista.innerHTML = novoHtml;
    }

    setMsg('msgRelatorioLancamentos', `${registrosRelatorio.length} tarefa(s) encontrada(s).`, 'ok');
  } catch (error) {
    console.error('Erro ao carregar relatório de lançamentos:', error);
    if (!silencioso) lista.innerHTML = '<div class="empty">Erro ao carregar o relatório de tarefas.</div>';
    setMsg('msgRelatorioLancamentos', `Não foi possível carregar o relatório: ${mensagemErroSupabase(error, 'erro desconhecido')}`, 'err');
  }
}

// 
