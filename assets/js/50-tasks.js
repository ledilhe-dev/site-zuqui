// TAREFAS
// 
function obterDiasSelecionados() {
  const dias = [];
  if (document.getElementById('diasSeg')?.checked) dias.push('seg');
  if (document.getElementById('diasTer')?.checked) dias.push('ter');
  if (document.getElementById('diasQua')?.checked) dias.push('qua');
  if (document.getElementById('diasQui')?.checked) dias.push('qui');
  if (document.getElementById('diasSex')?.checked) dias.push('sex');
  if (document.getElementById('diasSab')?.checked) dias.push('sab');
  if (document.getElementById('diasDom')?.checked) dias.push('dom');
  return dias;
}

function atualizarDiasSelecionados() {
  const dias = obterDiasSelecionados();
  const diasNomes = { seg: 'Segunda', ter: 'Terça', qua: 'Quarta', qui: 'Quinta', sex: 'Sexta', sab: 'Sábado', dom: 'Domingo' };
  const texto = dias.length > 0 ? dias.map(d => diasNomes[d]).join(', ') : 'Nenhum dia selecionado';
  const el = document.getElementById('diasSelecionados');
  if (el) el.textContent = 'Dias selecionados: ' + texto;
}

function marcarTodosDias() {
  document.getElementById('diasSeg').checked = true;
  document.getElementById('diasTer').checked = true;
  document.getElementById('diasQua').checked = true;
  document.getElementById('diasQui').checked = true;
  document.getElementById('diasSex').checked = true;
  document.getElementById('diasSab').checked = true;
  document.getElementById('diasDom').checked = true;
  atualizarDiasSelecionados();
}

function limparDias() {
  document.getElementById('diasSeg').checked = false;
  document.getElementById('diasTer').checked = false;
  document.getElementById('diasQua').checked = false;
  document.getElementById('diasQui').checked = false;
  document.getElementById('diasSex').checked = false;
  document.getElementById('diasSab').checked = false;
  document.getElementById('diasDom').checked = false;
  atualizarDiasSelecionados();
}

function preencherDiasSelecionados(diasStr) {
  limparDias();
  if (!diasStr || diasStr === 'todos') return;

  const dias = diasStr.split(',').map(d => d.trim());
  document.getElementById('diasSeg').checked = dias.includes('seg');
  document.getElementById('diasTer').checked = dias.includes('ter');
  document.getElementById('diasQua').checked = dias.includes('qua');
  document.getElementById('diasQui').checked = dias.includes('qui');
  document.getElementById('diasSex').checked = dias.includes('sex');
  document.getElementById('diasSab').checked = dias.includes('sab');
  document.getElementById('diasDom').checked = dias.includes('dom');
  atualizarDiasSelecionados();
}

// 
// TAREFAS
// 
async function carregarSelectFuncionariosTarefa() {
  const sel = document.getElementById('funcionarioTarefa');
  if (!sel) return;
  sel.innerHTML = '<option value=""></option>';
  let queryFuncionariosTarefa = sb.from('funcionarios').select('id, nome, loja_id, empresa_id').eq('ativo', true);
  queryFuncionariosTarefa = aplicarFiltroLojaFuncionariosQuery(queryFuncionariosTarefa).order('nome');
  const { data } = await queryFuncionariosTarefa;
  funcionariosAtivosTarefa = data || [];
  (data || []).forEach(f => {
    const o = document.createElement('option');
    o.value = f.id; o.textContent = f.nome;
    sel.appendChild(o);
  });
}

function formatarDias(diasStr) {
  if (!diasStr || diasStr === 'todos') return 'Todos os dias';
  const diasNomes = { seg: 'Seg', ter: 'Ter', qua: 'Qua', qui: 'Qui', sex: 'Sex', sab: 'Sab', dom: 'Dom' };
  return diasStr.split(',').map(d => diasNomes[d.trim()] || d).join(', ');
}

function escaparHtmlBasico(valor) {
  return String(valor || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function obterFuncionariosLancamentoSelecionados(tarefaId, funcionarioPadrao = '') {
  const idTarefa = String(tarefaId || '');
  const selecionado = selecaoFuncionarioLancamentoPorTarefa[idTarefa];
  if (Array.isArray(selecionado)) {
    return [...new Set(selecionado.map(item => String(item || '').trim()).filter(Boolean))];
  }
  const valor = String(selecionado || '').trim();
  if (!valor) return [];
  if (valor.includes(',')) {
    return [...new Set(valor.split(',').map(item => String(item || '').trim()).filter(Boolean))];
  }
  return [valor];
}

function obterFuncionarioLancamentoSelecionado(tarefaId, funcionarioPadrao = '') {
  const selecionados = obterFuncionariosLancamentoSelecionados(tarefaId, funcionarioPadrao);
  return selecionados[0] || '';
}

function obterResumoSelecaoFuncionarioLancamento(tarefaId) {
  const selecionados = obterFuncionariosLancamentoSelecionados(tarefaId);
  if (!selecionados.length) return 'Nenhum funcionário selecionado';

  const nomes = selecionados.map(id => {
    const funcionario = funcionariosAtivosTarefa.find(item => String(item.id || '') === String(id));
    return String(funcionario?.nome || '').trim();
  }).filter(Boolean);

  if (!nomes.length) return 'Nenhum funcionário selecionado';
  if (nomes.length === 1) return `1 selecionado: ${nomes[0]}`;
  return `${nomes.length} selecionados: ${nomes.slice(0, 2).join(', ')}${nomes.length > 2 ? '...' : ''}`;
}

function atualizarResumoFuncionarioLancamentoNoCard(tarefaId) {
  const idTarefa = String(tarefaId || '');
  if (!idTarefa) return;
  const el = document.getElementById(`resumoFuncionarioLancamento_${idTarefa}`);
  if (!el) return;
  el.textContent = obterResumoSelecaoFuncionarioLancamento(idTarefa);
}

function obterHorarioLancamentoSelecionado(tarefaId, horarioPadrao = '') {
  const idTarefa = String(tarefaId || '');
  const sobrescrito = horarioLancamentoPorTarefa[idTarefa];
  if (sobrescrito) return String(sobrescrito);
  return horaCurta(horarioPadrao || '');
}

function definirHorarioLancamentoTarefa(tarefaId, valor) {
  const idTarefa = String(tarefaId || '');
  if (!idTarefa) return;
  const hora = horaCurta(valor || '');
  if (!hora) {
    delete horarioLancamentoPorTarefa[idTarefa];
    return;
  }
  horarioLancamentoPorTarefa[idTarefa] = hora;
}

// ─── Repetição: dias entre relançamento (intervalo) e duração (se repete por dias) ───
function obterIntervaloLancamentoTarefa(tarefaId) {
  const idTarefa = String(tarefaId || '');
  const valor = parseInt(intervaloLancamentoPorTarefa[idTarefa], 10);
  if (!Number.isFinite(valor) || valor < 1) return 1;
  return valor;
}

function definirIntervaloLancamentoTarefa(tarefaId, valor) {
  const idTarefa = String(tarefaId || '');
  if (!idTarefa) return;
  const num = parseInt(valor, 10);
  if (!Number.isFinite(num) || num < 1) {
    delete intervaloLancamentoPorTarefa[idTarefa];
    return;
  }
  intervaloLancamentoPorTarefa[idTarefa] = Math.min(num, 365);
}

function obterDuracaoLancamentoTarefa(tarefaId) {
  const idTarefa = String(tarefaId || '');
  const valor = parseInt(duracaoLancamentoPorTarefa[idTarefa], 10);
  if (!Number.isFinite(valor) || valor < 1) return 0;
  return valor;
}

function definirDuracaoLancamentoTarefa(tarefaId, valor) {
  const idTarefa = String(tarefaId || '');
  if (!idTarefa) return;
  const num = parseInt(valor, 10);
  if (!Number.isFinite(num) || num < 1) {
    delete duracaoLancamentoPorTarefa[idTarefa];
    return;
  }
  duracaoLancamentoPorTarefa[idTarefa] = Math.min(num, 365);
}

function obterDiasLancamentoSelecionados(tarefaId, diasPadrao = 'todos') {
  const idTarefa = String(tarefaId || '');
  const ordem = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];
  const sobrescrito = diasLancamentoPorTarefa[idTarefa];
  if (Array.isArray(sobrescrito)) {
    return ordem.filter(dia => sobrescrito.includes(dia));
  }
  return [];
}

function obterDiasLancamentoSelecionadosTexto(tarefaId, diasPadrao = 'todos') {
  const dias = obterDiasLancamentoSelecionados(tarefaId, diasPadrao);
  if (!dias.length) return '';
  if (dias.length === 7) return 'todos';
  return dias.join(',');
}

function definirDiaLancamentoTarefa(tarefaId, dia, marcado) {
  const idTarefa = String(tarefaId || '');
  const diaNormalizado = String(dia || '').trim().toLowerCase();
  const ordem = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];
  if (!idTarefa || !ordem.includes(diaNormalizado)) return;

  const atuais = new Set(obterDiasLancamentoSelecionados(idTarefa, 'todos'));
  if (marcado) atuais.add(diaNormalizado);
  else atuais.delete(diaNormalizado);

  diasLancamentoPorTarefa[idTarefa] = ordem.filter(item => atuais.has(item));
}

function marcarTodosDiasLancamentoTarefa(tarefaId) {
  const idTarefa = String(tarefaId || '');
  if (!idTarefa) return;
  const todos = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];
  diasLancamentoPorTarefa[idTarefa] = [...todos];
  document.querySelectorAll(`.dias-lancamento-checkbox[data-tarefa-id="${idTarefa}"]`).forEach(input => {
    input.checked = true;
  });
}

function limparDiasLancamentoTarefa(tarefaId) {
  const idTarefa = String(tarefaId || '');
  if (!idTarefa) return;
  diasLancamentoPorTarefa[idTarefa] = [];
  document.querySelectorAll(`.dias-lancamento-checkbox[data-tarefa-id="${idTarefa}"]`).forEach(input => {
    input.checked = false;
  });
}

function selecionarFuncionarioLancamento(tarefaId, funcionarioId, marcado) {
  const idTarefa = String(tarefaId || '');
  const idFuncionario = String(funcionarioId || '');
  if (!idTarefa || !idFuncionario) return;

  if (marcado) {
    selecaoFuncionarioLancamentoPorTarefa[idTarefa] = idFuncionario;
    document.querySelectorAll(`.funcionario-lancamento-checkbox[data-tarefa-id="${idTarefa}"]`).forEach(input => {
      input.checked = String(input.dataset.funcionarioId || '') === idFuncionario;
    });
    return;
  }

  if (selecaoFuncionarioLancamentoPorTarefa[idTarefa] === idFuncionario) {
    delete selecaoFuncionarioLancamentoPorTarefa[idTarefa];
  }
  atualizarResumoFuncionarioLancamentoNoCard(idTarefa);
}

function renderizarListaModalFuncionariosLancamentoTarefa() {
  const lista = document.getElementById('tarefaFuncionariosLista');
  const buscaEl = document.getElementById('tarefaFuncionariosBusca');
  const resumoEl = document.getElementById('tarefaFuncionariosResumo');
  if (!lista) return;

  const busca = String(buscaEl?.value || '').trim().toLowerCase();
  const selecionadoId = String(tarefaModalFuncionariosSelecionadoId || '').trim();
  const funcionarios = (funcionariosAtivosTarefa || []).filter(item => {
    const nome = String(item?.nome || '').toLowerCase();
    return !busca || nome.includes(busca);
  });

  if (resumoEl) {
    const nomeSelecionado = (funcionariosAtivosTarefa || []).find(item => String(item.id || '') === selecionadoId)?.nome || '';
    resumoEl.textContent = nomeSelecionado
      ? `Selecionado: ${nomeSelecionado}`
      : 'Nenhum funcionário selecionado';
  }

  if (!funcionarios.length) {
    lista.innerHTML = '<div class="empty">Nenhum funcionário encontrado para esta busca.</div>';
    return;
  }

  lista.innerHTML = funcionarios.map(funcionario => {
    const idFuncionario = String(funcionario.id || '');
    const checked = idFuncionario === selecionadoId ? 'checked' : '';
    return `
      <label class="tarefa-modal-funcionarios-item">
        <input
          type="checkbox"
          data-funcionario-id="${escaparHtmlBasico(idFuncionario)}"
          onchange="selecionarFuncionarioLancamentoModal('${escaparHtmlBasico(idFuncionario)}', this.checked)"
          ${checked}
        >
        <span>${escaparHtmlBasico(funcionario.nome || 'Funcionário')}</span>
      </label>
    `;
  }).join('');
}

function selecionarFuncionarioLancamentoModal(funcionarioId, marcado) {
  const idFuncionario = String(funcionarioId || '').trim();
  if (!idFuncionario) return;

  if (marcado) {
    tarefaModalFuncionariosSelecionadoId = idFuncionario;
  } else if (String(tarefaModalFuncionariosSelecionadoId) === idFuncionario) {
    tarefaModalFuncionariosSelecionadoId = '';
  }

  document.querySelectorAll('#tarefaFuncionariosLista input[type="checkbox"]').forEach(input => {
    input.checked = String(input.dataset.funcionarioId || '') === String(tarefaModalFuncionariosSelecionadoId || '');
  });
  renderizarListaModalFuncionariosLancamentoTarefa();
}

function abrirModalFuncionariosLancamentoTarefa(tarefaId) {
  const overlay = document.getElementById('tarefaFuncionariosOverlay');
  const buscaEl = document.getElementById('tarefaFuncionariosBusca');
  const msgEl = document.getElementById('tarefaFuncionariosMsg');
  const idTarefa = String(tarefaId || '');
  if (!overlay || !idTarefa) return;

  tarefaModalFuncionariosTarefaId = idTarefa;
  tarefaModalFuncionariosSelecionadoId = obterFuncionarioLancamentoSelecionado(idTarefa, '');

  if (buscaEl) buscaEl.value = '';
  if (msgEl) {
    msgEl.textContent = '';
    msgEl.className = 'msg';
  }

  renderizarListaModalFuncionariosLancamentoTarefa();
  overlay.classList.add('show');
}

function cancelarModalFuncionariosLancamentoTarefa() {
  const overlay = document.getElementById('tarefaFuncionariosOverlay');
  const lista = document.getElementById('tarefaFuncionariosLista');
  const resumo = document.getElementById('tarefaFuncionariosResumo');
  const msg = document.getElementById('tarefaFuncionariosMsg');
  const busca = document.getElementById('tarefaFuncionariosBusca');
  if (overlay) overlay.classList.remove('show');
  if (lista) lista.innerHTML = '<div class="empty">Carregando...</div>';
  if (resumo) resumo.textContent = '';
  if (msg) {
    msg.textContent = '';
    msg.className = 'msg';
  }
  if (busca) busca.value = '';
  tarefaModalFuncionariosTarefaId = '';
  tarefaModalFuncionariosSelecionadoId = '';
}

function aplicarModalFuncionariosLancamentoTarefa() {
  const idTarefa = String(tarefaModalFuncionariosTarefaId || '').trim();
  if (!idTarefa) {
    cancelarModalFuncionariosLancamentoTarefa();
    return;
  }

  if (tarefaModalFuncionariosSelecionadoId) {
    selecaoFuncionarioLancamentoPorTarefa[idTarefa] = String(tarefaModalFuncionariosSelecionadoId);
  } else {
    delete selecaoFuncionarioLancamentoPorTarefa[idTarefa];
  }

  atualizarResumoFuncionarioLancamentoNoCard(idTarefa);
  cancelarModalFuncionariosLancamentoTarefa();
}

function gerarIdMsgLancamentoTarefa(tarefaId) {
  const base = String(tarefaId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `msgLancamentoTarefa_${base}`;
}

function setMsgLancamentoTarefa(tarefaId, mensagem = '', tipo = '') {
  const el = document.getElementById(gerarIdMsgLancamentoTarefa(tarefaId));
  if (!el) return;
  el.textContent = mensagem || '';
  el.className = 'msg' + (tipo ? ` ${tipo}` : '');
}

function renderizarSelecaoFuncionariosLancamento(tarefa) {
  if (!funcionariosAtivosTarefa.length) {
    return '<div class="item-detalhe">Funcionários: nenhum ativo para seleção.</div>';
  }

  const tarefaIdEscapado = escaparHtmlBasico(tarefa.id);
  const diasSelecionados = new Set(obterDiasLancamentoSelecionados(tarefa.id, tarefa.dias_semana || 'todos'));
  const diasOpcao = [
    { key: 'seg', label: 'Seg' },
    { key: 'ter', label: 'Ter' },
    { key: 'qua', label: 'Qua' },
    { key: 'qui', label: 'Qui' },
    { key: 'sex', label: 'Sex' },
    { key: 'sab', label: 'Sab' },
    { key: 'dom', label: 'Dom' },
  ];
  const diasHtml = diasOpcao.map(item => `
      <label class="tarefa-funcionario-option" style="padding:4px 8px">
        <input
          class="dias-lancamento-checkbox"
          type="checkbox"
          data-tarefa-id="${tarefaIdEscapado}"
          onchange="definirDiaLancamentoTarefa('${tarefaIdEscapado}','${item.key}', this.checked)"
          ${diasSelecionados.has(item.key) ? 'checked' : ''}
        >
        <span>${item.label}</span>
      </label>
    `).join('');

  const horarioSelecionado = obterHorarioLancamentoSelecionado(tarefa.id, '');
  const botaoLancarDesktop = tarefa.ativo
    ? `<div class="tarefa-lancamento-bloco tarefa-lancamento-bloco-lancar">
         <button class="btn btn-sm btn-lancar-desktop-destaque" type="button" title="${tarefa.lancada_checklist === true ? 'Lançar tarefa novamente' : 'Lançar tarefa'}" onclick="lancarTarefa('${tarefaIdEscapado}', obterFuncionarioLancamentoSelecionado('${tarefaIdEscapado}', ''), obterHorarioLancamentoSelecionado('${tarefaIdEscapado}', ''), obterDiasLancamentoSelecionadosTexto('${tarefaIdEscapado}', '${tarefa.dias_semana || 'todos'}'))">Lançar</button>
       </div>`
    : '';
  const botaoLancarMobile = tarefa.ativo
    ? `<div class="tarefa-lancar-mobile-wrap">
         <button class="btn btn-sm btn-lancar-mobile-destaque" type="button" title="${tarefa.lancada_checklist === true ? 'Lançar tarefa novamente' : 'Lançar tarefa'}" onclick="lancarTarefa('${tarefaIdEscapado}', obterFuncionarioLancamentoSelecionado('${tarefaIdEscapado}', ''), obterHorarioLancamentoSelecionado('${tarefaIdEscapado}', ''), obterDiasLancamentoSelecionadosTexto('${tarefaIdEscapado}', '${tarefa.dias_semana || 'todos'}'))">Lançar</button>
       </div>`
    : '';
  return `
    <div class="tarefa-funcionarios-inline tarefa-cadastrada-launch">
      <div class="tarefa-lancamento-grid">
        <div class="tarefa-lancamento-bloco tarefa-lancamento-bloco-dias">
          <div class="tarefa-lancamento-topo">
            <span class="tarefa-funcionarios-label">Dias</span>
            <div class="dias-semana-acoes tarefa-dias-acoes">
              <button class="btn btn-ghost btn-sm" type="button" title="Marcar todos os dias" onclick="marcarTodosDiasLancamentoTarefa('${tarefaIdEscapado}')">Todos</button>
              <button class="btn btn-red btn-sm" type="button" title="Limpar todos os dias" onclick="limparDiasLancamentoTarefa('${tarefaIdEscapado}')">Limpar</button>
            </div>
          </div>
          <div class="tarefa-funcionarios-grid">${diasHtml}</div>
        </div>
        <div class="tarefa-lancamento-bloco tarefa-lancamento-bloco-repeticao">
          <span class="tarefa-funcionarios-label">Repetição</span>
          <div class="tarefa-repeticao-campos">
            <label class="tarefa-repeticao-campo">
              <span>A cada (dias)</span>
              <input
                type="number"
                min="1"
                max="365"
                step="1"
                placeholder="1"
                value="${obterIntervaloLancamentoTarefa(tarefa.id) > 1 ? obterIntervaloLancamentoTarefa(tarefa.id) : ''}"
                onchange="definirIntervaloLancamentoTarefa('${tarefaIdEscapado}', this.value)"
                title="Dias entre cada relançamento. Ex.: 1 = todos os dias, 2 = a cada 2 dias."
              >
            </label>
            <label class="tarefa-repeticao-campo">
              <span>Por (dias)</span>
              <input
                type="number"
                min="1"
                max="365"
                step="1"
                placeholder="365"
                value="${obterDuracaoLancamentoTarefa(tarefa.id) > 0 ? obterDuracaoLancamentoTarefa(tarefa.id) : ''}"
                onchange="definirDuracaoLancamentoTarefa('${tarefaIdEscapado}', this.value)"
                title="Por quantos dias a tarefa deve se repetir. Ex.: 365 = durante um ano."
              >
            </label>
          </div>
        </div>
        <div class="tarefa-lancamento-bloco tarefa-lancamento-bloco-horario">
          <span class="tarefa-funcionarios-label">Hora</span>
          <label class="tarefa-lancamento-horario">
            <input
              type="time"
              value="${escaparHtmlBasico(horarioSelecionado)}"
              onchange="definirHorarioLancamentoTarefa('${tarefaIdEscapado}', this.value)"
            >
          </label>
        </div>
        <div class="tarefa-lancamento-bloco tarefa-lancamento-bloco-funcionarios">
          <div class="tarefa-funcionario-acoes">
            <button class="btn btn-ghost btn-sm" type="button" onclick="abrirModalFuncionariosLancamentoTarefa('${tarefaIdEscapado}')">Selecionar funcionário(s)</button>
          </div>
        </div>
        ${botaoLancarDesktop}
      </div>
      ${botaoLancarMobile}
      <div class="msg" id="${gerarIdMsgLancamentoTarefa(tarefa.id)}"></div>
    </div>
  `;
}

function obterStorageFavoritosTarefas() {
  return `zuqui_tarefas_favoritas:${obterChaveUsuarioNotificacoes()}`;
}

function viewportTarefaEhMobile() {
  return window.matchMedia('(max-width: 900px)').matches;
}

function atualizarBotaoFavoritasMinimizadas() {
  const btn = document.getElementById('btnMinimizarFavoritasTarefas');
  if (!btn) return;
  btn.textContent = favoritosTarefasMinimizados ? 'Expandir favoritas' : 'Compactar favoritas';
}

function carregarFavoritosTarefas() {
  try {
    const bruto = localStorage.getItem(obterStorageFavoritosTarefas());
    if (!bruto) return new Set();
    const arr = JSON.parse(bruto);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.map(item => String(item)));
  } catch (e) {
    return new Set();
  }
}

function salvarFavoritosTarefas() {
  try {
    localStorage.setItem(obterStorageFavoritosTarefas(), JSON.stringify(Array.from(tarefasFavoritasIds)));
  } catch (e) {}
}

function normalizarEstadosConsultaTarefas() {
  const idsValidos = new Set((tarefasCadastradasCache || []).map(item => String(item.id)));

  tarefasFavoritasIds = new Set(Array.from(tarefasFavoritasIds).filter(id => idsValidos.has(id)));
  tarefasSelecionadasIds = new Set(Array.from(tarefasSelecionadasIds).filter(id => idsValidos.has(id)));
  tarefasConsultaMarcadasIds = new Set(Array.from(tarefasConsultaMarcadasIds).filter(id => idsValidos.has(id)));
  tarefasConfigLancamentoAbertasIds = new Set(Array.from(tarefasConfigLancamentoAbertasIds).filter(id => idsValidos.has(id)));

  // Segurança operacional: inicia sempre sem marcações automáticas.
  tarefasSelecionadasIds = new Set();
  tarefasConsultaMarcadasIds = new Set();
}

function obterTarefasFiltradasConsulta() {
  const filtro = String(document.getElementById('filtroTarefasNome')?.value || '').trim().toLowerCase();
  let dados = tarefasCadastradasCache || [];

  if (mostrarSomenteFavoritasTarefas) {
    dados = dados.filter(item => tarefasFavoritasIds.has(String(item.id)));
  }

  if (filtro) {
    dados = dados.filter(item => {
      const texto = [
        item.nome || '',
        item.descricao || '',
        item.funcionarios?.nome || '',
        item.checklists?.nome || '',
      ].join(' ').toLowerCase();
      return texto.includes(filtro);
    });
  }

  // ── Filtros avançados (rodapé) ──
  const avBusca = String(document.getElementById('filtroTarefaAvBusca')?.value || '').trim().toLowerCase();
  if (avBusca) {
    dados = dados.filter(item => {
      const texto = [item.nome || '', item.descricao || ''].join(' ').toLowerCase();
      return texto.includes(avBusca);
    });
  }

  const avFuncionario = String(document.getElementById('filtroTarefaAvFuncionario')?.value || '').trim();
  if (avFuncionario) {
    dados = dados.filter(item => String(item.funcionario_id || '') === avFuncionario);
  }

  const selTarefa = document.getElementById('filtroTarefaAvTarefa');
  if (selTarefa) {
    const idsSelecionados = Array.from(selTarefa.selectedOptions || []).map(o => String(o.value)).filter(Boolean);
    if (idsSelecionados.length) {
      const setIds = new Set(idsSelecionados);
      dados = dados.filter(item => setIds.has(String(item.id)));
    }
  }

  const avDataInicio = String(document.getElementById('filtroTarefaAvDataInicio')?.value || '').trim();
  const avDataFim = String(document.getElementById('filtroTarefaAvDataFim')?.value || '').trim();
  if (avDataInicio || avDataFim) {
    dados = dados.filter(item => {
      const dataCad = String(item.created_at || item.criado_em || '').slice(0, 10);
      if (!dataCad) return false; // sem data de cadastro não passa no filtro de data
      if (avDataInicio && dataCad < avDataInicio) return false;
      if (avDataFim && dataCad > avDataFim) return false;
      return true;
    });
  }

  return dados;
}

function popularFiltrosAvancadosTarefas() {
  // Evita reconstruir os selects a cada tecla (perde foco/seleção). Só refaz quando a lista de tarefas muda.
  const assinatura = (tarefasCadastradasCache || []).map(t => String(t.id)).sort().join('|');
  if (popularFiltrosAvancadosTarefas._assinatura === assinatura
      && document.getElementById('filtroTarefaAvTarefa')?.options?.length) {
    return;
  }
  popularFiltrosAvancadosTarefas._assinatura = assinatura;

  // Funcionários (a partir do cache de funcionários ativos das tarefas + responsáveis presentes)
  const selFunc = document.getElementById('filtroTarefaAvFuncionario');
  if (selFunc) {
    const valorAtual = selFunc.value;
    const mapaFunc = new Map();
    (funcionariosAtivosTarefa || []).forEach(f => { if (f?.id) mapaFunc.set(String(f.id), f.nome || 'Funcionário'); });
    (tarefasCadastradasCache || []).forEach(t => {
      if (t?.funcionario_id && t?.funcionarios?.nome) mapaFunc.set(String(t.funcionario_id), t.funcionarios.nome);
    });
    const ordenados = Array.from(mapaFunc.entries()).sort((a, b) => String(a[1]).localeCompare(String(b[1])));
    selFunc.innerHTML = '<option value="">- Todos -</option>' +
      ordenados.map(([id, nome]) => `<option value="${escaparHtmlBasico(id)}">${escaparHtmlBasico(nome)}</option>`).join('');
    if (Array.from(selFunc.options).some(o => o.value === valorAtual)) selFunc.value = valorAtual;
  }

  // Tarefas (multi-select)
  const selTarefa = document.getElementById('filtroTarefaAvTarefa');
  if (selTarefa) {
    const selecionadosAntes = new Set(Array.from(selTarefa.selectedOptions || []).map(o => String(o.value)));
    const tarefasOrdenadas = [...(tarefasCadastradasCache || [])].sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || '')));
    selTarefa.innerHTML = tarefasOrdenadas
      .map(t => `<option value="${escaparHtmlBasico(String(t.id))}" ${selecionadosAntes.has(String(t.id)) ? 'selected' : ''}>${escaparHtmlBasico(t.nome || 'Tarefa')}</option>`)
      .join('');
  }
}

function limparMarcacaoConsultaTarefas() {
  tarefasConsultaMarcadasIds = new Set();
  renderizarListaConsultaTarefas();
}

function limparFiltrosAvancadosTarefas() {
  ['filtroTarefaAvDataInicio', 'filtroTarefaAvDataFim', 'filtroTarefaAvBusca', 'filtroTarefaAvFuncionario'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const selTarefa = document.getElementById('filtroTarefaAvTarefa');
  if (selTarefa) Array.from(selTarefa.options).forEach(o => { o.selected = false; });
  filtrarTarefasCadastradas();
}

async function excluirTarefasSelecionadas() {
  if (!usuarioTemPermissao('excluir_tarefas_massa')) {
    setMsg('msgTarefas', 'Seu perfil não tem permissão para excluir tarefas em massa.', 'err');
    return;
  }
  if (!tarefasDisponiveis) {
    setMsg('msgTarefas', 'Recurso de tarefas indisponível. A tabela "tarefas" não existe no Supabase.', 'err');
    return;
  }
  const ids = Array.from(tarefasConsultaMarcadasIds);
  if (!ids.length) {
    setMsg('msgTarefas', 'Marque ao menos uma tarefa para excluir em massa.', 'err');
    return;
  }

  const confirmacaoSenha = await abrirModalPin({
    titulo: 'Exclusão em massa de tarefas',
    subtitulo: `Digite a senha master para excluir ${ids.length} tarefa(s) selecionada(s).`,
    textoAcao: 'Validar senha',
    exibirUsuario: false,
    placeholderInput: 'Digite a senha master'
  });
  if (!confirmacaoSenha?.pin) {
    setMsg('msgTarefas', 'Exclusão em massa cancelada.', 'err');
    return;
  }
  if (!(await validarSenhaMasterParaExclusao(confirmacaoSenha.pin))) {
    setMsg('msgTarefas', 'Senha master inválida. Exclusão cancelada.', 'err');
    return;
  }
  if (!confirm(`Confirma a exclusão de ${ids.length} tarefa(s)? Esta ação não pode ser desfeita.`)) return;

  let sucesso = 0;
  let falhas = 0;
  for (const id of ids) {
    try {
      const { error: errLanc } = await sb.from('checklist_lancamentos').delete().eq('tarefa_id', id);
      if (errLanc && !isMissingLancamentosTableError(errLanc)) throw errLanc;
      const { error: errExec } = await sb.from('checklist_execucoes').update({ tarefa_id: null }).eq('tarefa_id', id);
      if (errExec) throw errExec;
      const { error: errDel } = await sb.from('tarefas').delete().eq('id', id);
      if (errDel) throw errDel;
      sucesso++;
      if (tarefaEmEdicaoId === id) limparFormularioTarefa();
    } catch (error) {
      console.error('Erro ao excluir tarefa em massa:', id, error);
      falhas++;
    }
  }

  tarefasConsultaMarcadasIds = new Set();
  tarefasSelecionadasIds = new Set();
  setMsg('msgTarefas', `Exclusão concluída: ${sucesso} excluída(s)${falhas ? `, ${falhas} com erro` : ''}.`, falhas ? 'err' : 'ok');
  carregarTarefas();
  carregarChecklistsTarefas();
  carregarChecklists();
}

function atualizarResumoConsultaTarefas(totalFiltrado = 0) {
  const resumo = document.getElementById('resumoConsultaTarefas');
  if (!resumo) return;
  const marcadas = tarefasConsultaMarcadasIds.size;
  const exibidas = tarefasFavoritasIds.size;
  const textoFavoritas = mostrarSomenteFavoritasTarefas ? ' · filtro: favoritas' : '';
  resumo.textContent = `${totalFiltrado} na lista · ${marcadas} marcadas · ${exibidas} favoritas exibidas abaixo${textoFavoritas}`;
}

function marcarConsultaTarefa(id, marcado) {
  const chave = String(id || '');
  if (!chave) return;
  if (marcado) tarefasConsultaMarcadasIds.add(chave);
  else tarefasConsultaMarcadasIds.delete(chave);
  const dadosFiltrados = obterTarefasFiltradasConsulta();
  atualizarResumoConsultaTarefas(dadosFiltrados.length);
}

function toggleFavoritaTarefa(id) {
  const chave = String(id || '');
  if (!chave) return;
  if (tarefasFavoritasIds.has(chave)) tarefasFavoritasIds.delete(chave);
  else tarefasFavoritasIds.add(chave);
  salvarFavoritosTarefas();
  filtrarTarefasCadastradas();
}

function renderizarListaConsultaTarefas() {
  const lista = document.getElementById('listaConsultaTarefas');
  if (!lista) return;

  const dadosFiltrados = obterTarefasFiltradasConsulta();
  atualizarResumoConsultaTarefas(dadosFiltrados.length);

  if (!dadosFiltrados.length) {
    lista.innerHTML = '<div class="empty">Nenhuma tarefa encontrada na consulta.</div>';
    return;
  }

  lista.innerHTML = dadosFiltrados.map(item => {
    const id = String(item.id || '');
    const marcada = tarefasConsultaMarcadasIds.has(id);
    const favorita = tarefasFavoritasIds.has(id);
    const configuracaoAberta = tarefasConfigLancamentoAbertasIds.has(id);
    const descricaoCurta = String(item.descricao || '').trim();
    const descricaoExibicao = descricaoCurta || 'Sem descrição';
    return `
      <div class="tarefas-consulta-item">
        <div class="tarefas-consulta-item-main">
          <input type="checkbox" ${marcada ? 'checked' : ''} onchange="marcarConsultaTarefa('${id}', this.checked)">
          <div class="tarefas-consulta-item-main-texto">
            <div class="tarefas-consulta-item-nome" title="${escaparHtmlBasico(item.nome || '')}">
              ${escaparHtmlBasico(item.nome || 'Tarefa sem nome')}
            </div>
            <div class="tarefas-consulta-item-descricao ${descricaoCurta ? '' : 'vazia'}" title="${escaparHtmlBasico(descricaoExibicao)}">${escaparHtmlBasico(descricaoExibicao)}</div>
          </div>
          <button class="btn btn-ghost btn-sm btn-fav-star ${favorita ? '' : 'inativo'}" type="button" title="${favorita ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}" onclick="toggleFavoritaTarefa('${id}')">${favorita ? '★' : '☆'}</button>
        </div>
        <div class="tarefas-consulta-item-acoes">
          <button class="btn btn-ghost btn-sm" type="button" onclick="toggleConfigLancamentoTarefa('${id}')">${configuracaoAberta ? 'Ocultar opções' : 'Opções de lançamento'}</button>
          <button class="btn btn-ghost btn-sm" type="button" title="Editar tarefa" onclick="editarTarefa('${id}')">Editar</button>
          <button class="btn btn-red btn-sm btn-excluir-x" type="button" title="Excluir tarefa" aria-label="Excluir tarefa" onclick="excluirTarefa('${id}')">×</button>
        </div>
        ${configuracaoAberta ? `<div class="tarefas-consulta-item-config">${renderizarSelecaoFuncionariosLancamento(item)}</div>` : ''}
      </div>
    `;
  }).join('');
}

function aplicarSelecaoConsultaTarefas() {
  if (!tarefasConsultaMarcadasIds.size) {
    setMsg('msgTarefas', 'Marque ao menos uma tarefa na lista para exibir.', 'err');
    return;
  }
  tarefasSelecionadasIds = new Set(Array.from(tarefasConsultaMarcadasIds));
  renderizarListaTarefas();
  setMsg('msgTarefas', `${tarefasSelecionadasIds.size} tarefa(s) selecionada(s) para exibição.`, 'ok');
}

function selecionarTodasTarefasConsulta() {
  const dadosFiltrados = obterTarefasFiltradasConsulta();
  tarefasConsultaMarcadasIds = new Set(dadosFiltrados.map(item => String(item.id)));
  renderizarListaConsultaTarefas();
}

function toggleSomenteFavoritasTarefas() {
  mostrarSomenteFavoritasTarefas = !mostrarSomenteFavoritasTarefas;
  renderizarListaConsultaTarefas();
}

function toggleMinimizarFavoritasTarefas() {
  favoritosTarefasMinimizados = !favoritosTarefasMinimizados;
  atualizarBotaoFavoritasMinimizadas();
  renderizarListaTarefas();
}

function abrirConfigLancamentoTarefa(id) {
  const chave = String(id || '');
  if (!chave) return;

  tarefasConfigLancamentoAbertasIds = new Set([chave]);
  renderizarListaConsultaTarefas();
  renderizarListaTarefas();

  if (viewportTarefaEhMobile()) {
    window.setTimeout(() => {
      const alvo = document.querySelector(`.dias-lancamento-checkbox[data-tarefa-id="${chave}"]`)?.closest('.tarefas-consulta-item-config');
      alvo?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 30);
  }
}

function toggleConfigLancamentoTarefa(id) {
  const chave = String(id || '');
  if (!chave) return;
  let abriuAgora = false;
  if (tarefasConfigLancamentoAbertasIds.has(chave)) {
    tarefasConfigLancamentoAbertasIds.delete(chave);
  } else {
    tarefasConfigLancamentoAbertasIds = new Set([chave]);
    abriuAgora = true;
  }
  renderizarListaConsultaTarefas();
  renderizarListaTarefas();

  if (abriuAgora && viewportTarefaEhMobile()) {
    window.setTimeout(() => {
      const alvo = document.querySelector(`.dias-lancamento-checkbox[data-tarefa-id="${chave}"]`)?.closest('.tarefas-consulta-item-config');
      alvo?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 30);
  }
}

function renderizarCardTarefaCadastrada(t) {
  const favorita = tarefasFavoritasIds.has(String(t.id));
  return `
    <div class="item tarefa-cadastrada-item">
      <div class="tarefa-cadastrada-header">
        <div class="tarefa-cadastrada-header-main">
          <div class="tarefa-cadastrada-info-topo">
            <div class="item-nome">${t.nome}</div>
          </div>
          <div class="tarefa-cadastrada-meta">
            <span><strong>Resp.</strong> ${t.funcionarios?.nome ?? '-'}</span>
            ${t.checklists?.nome ? `<span><strong>Check</strong> ${t.checklists.nome}</span>` : ''}
            ${t.horario_limite ? `<span style="color:var(--amber)"><strong>Prazo</strong> ${t.horario_limite}</span>` : ''}
            ${t.dias_semana ? `<span><strong>Base</strong> ${formatarDias(t.dias_semana)}</span>` : ''}
          </div>
          ${t.descricao ? `<div class="item-detalhe">${t.descricao}</div>` : ''}
        </div>
        <div class="item-actions tarefa-cadastrada-actions">
          <button class="btn btn-ghost btn-sm btn-fav-star ${favorita ? '' : 'inativo'}" type="button" title="${favorita ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}" onclick="toggleFavoritaTarefa('${t.id}')">${favorita ? '★' : '☆'}</button>
          ${t.ativo ? `<button class="btn btn-amber btn-sm" title="${t.lancada_checklist === true ? 'Lançar tarefa novamente' : 'Lançar tarefa'}" onclick="lancarTarefa('${t.id}', obterFuncionarioLancamentoSelecionado('${t.id}', ''), obterHorarioLancamentoSelecionado('${t.id}', ''), obterDiasLancamentoSelecionadosTexto('${t.id}', '${t.dias_semana || 'todos'}'))">Lançar</button>` : ''}
          <button class="btn btn-red btn-sm btn-excluir-x" title="Excluir tarefa" aria-label="Excluir tarefa" onclick="excluirTarefa('${t.id}')">×</button>
        </div>
      </div>
    </div>`;
}

function renderizarListaTarefas() {
  const lista = document.getElementById('listaTarefas');
  if (!lista) return;
  atualizarBotaoFavoritasMinimizadas();

  const favoritas = (tarefasCadastradasCache || []).filter(item => tarefasFavoritasIds.has(String(item.id)));

  if (!favoritas.length) {
    lista.innerHTML = '<div class="empty">Nenhuma tarefa favorita. Clique na estrela na lista acima para fixar.</div>';
    return;
  }

  if (favoritosTarefasMinimizados) {
    lista.innerHTML = `
      <div class="tarefas-favoritas-header">
        <div class="tarefas-favoritas-titulo">Favoritas minimizadas (${favoritas.length})</div>
      </div>
    `;
    return;
  }

  lista.innerHTML = `
    <div class="tarefas-favoritas-header">
      <div class="tarefas-favoritas-titulo">Favoritas</div>
    </div>
    <div class="lista">${favoritas.map(renderizarCardTarefaCadastrada).join('')}</div>
  `;
}

function filtrarTarefasCadastradas() {
  if (!Array.isArray(tarefasCadastradasCache)) return;
  popularFiltrosAvancadosTarefas();
  renderizarListaConsultaTarefas();
  renderizarListaTarefas();
}

function limparFiltroTarefasCadastradas() {
  const input = document.getElementById('filtroTarefasNome');
  if (input) {
    input.value = '';
    input.removeAttribute('value');
  }
  filtroTarefasNomeEditado = false;
  mostrarSomenteFavoritasTarefas = false;
  renderizarListaConsultaTarefas();
}

async function garantirChecklistReferenciaDaTarefa({ tarefaId, nome, descricao = null, checklistIdPreferido = null }) {
  if (!tarefaId) return null;

  const nomeChecklist = String(nome || '').trim() || 'Checklist';
  const descricaoChecklist = String(descricao || '').trim() || null;

  const verificarChecklist = async (id) => {
    const checklistId = String(id || '').trim();
    if (!checklistId) return null;
    const { data, error } = await sb
      .from('checklists')
      .select('id')
      .eq('id', checklistId)
      .maybeSingle();
    if (error) throw error;
    return data?.id ? String(data.id) : null;
  };

  let checklistIdValido = null;
  try {
    checklistIdValido = await verificarChecklist(checklistIdPreferido);
  } catch (error) {
    if (!isMissingTableError(error)) throw error;
    return null;
  }

  if (!checklistIdValido) {
    const { data: tarefaAtual, error: erroTarefaAtual } = await sb
      .from('tarefas')
      .select('checklist_id')
      .eq('id', tarefaId)
      .maybeSingle();
    if (erroTarefaAtual && !isMissingTableError(erroTarefaAtual)) throw erroTarefaAtual;
    checklistIdValido = await verificarChecklist(tarefaAtual?.checklist_id || null);
  }

  if (!checklistIdValido) {
    const { data: checklistCriado, error: erroCriarChecklist } = await sb
      .from('checklists')
      .insert([{ nome: nomeChecklist, descricao: descricaoChecklist }])
      .select('id')
      .single();
    if (erroCriarChecklist) throw erroCriarChecklist;
    checklistIdValido = String(checklistCriado?.id || '');
  } else {
    await sb
      .from('checklists')
      .update({ nome: nomeChecklist, descricao: descricaoChecklist })
      .eq('id', checklistIdValido);
  }

  if (!checklistIdValido) return null;

  const { error: erroVincularChecklist } = await sb
    .from('tarefas')
    .update({ checklist_id: checklistIdValido })
    .eq('id', tarefaId);
  if (erroVincularChecklist) throw erroVincularChecklist;

  return checklistIdValido;
}

async function resolverTenantCadastroChecklist() {
  let lojaId = String(obterLojaIdSessao?.() || usuarioSistemaLogado?.loja_id || '').trim();
  let empresaId = String(obterEmpresaIdSessao?.() || usuarioSistemaLogado?.empresa_id || '').trim();

  const selectLoja = document.getElementById('lojaTarefaCadastro');
  if (!lojaId && selectLoja && selectLoja.style.display !== 'none') {
    const option = selectLoja.selectedOptions?.[0] || null;
    lojaId = String(selectLoja.value || '').trim();
    empresaId = String(option?.dataset?.empresaId || empresaId || '').trim();
  }

  if (lojaId && !empresaId) {
    const { data: lojaAtual, error } = await executarSemFiltroLojaTemporario(() => sb
      .from('lojas')
      .select('id, empresa_id')
      .eq('id', lojaId)
      .maybeSingle());
    if (!error && lojaAtual?.empresa_id) empresaId = String(lojaAtual.empresa_id || '').trim();
  }

  if (!lojaId || !empresaId) {
    const lojasPermitidas = typeof obterLojasPermitidasSessao === 'function' ? obterLojasPermitidasSessao() : [];
    if (lojasPermitidas.length === 1) {
      lojaId = String(lojasPermitidas[0]?.id || '').trim();
      empresaId = String(lojasPermitidas[0]?.empresa_id || empresaId || '').trim();
      if (lojaId && !empresaId) {
        const { data: lojaAtual, error } = await executarSemFiltroLojaTemporario(() => sb
          .from('lojas')
          .select('id, empresa_id')
          .eq('id', lojaId)
          .maybeSingle());
        if (!error && lojaAtual?.empresa_id) empresaId = String(lojaAtual.empresa_id || '').trim();
      }
    }
  }

  if (!lojaId || !empresaId) {
    throw new Error('Selecione uma loja para cadastrar o checklist. Se nenhuma loja aparecer, vincule este usuário a uma loja ativa.');
  }

  return { loja_id: lojaId, empresa_id: empresaId };
}

async function carregarSelectLojaTarefaCadastro() {
  const select = document.getElementById('lojaTarefaCadastro');
  if (!select) return;

  const lojaSessao = String(obterLojaIdSessao?.() || usuarioSistemaLogado?.loja_id || '').trim();
  if (lojaSessao) {
    select.style.display = 'none';
    select.innerHTML = '<option value="">Loja</option>';
    return;
  }

  let lojas = [];
  try {
    const lojasSessao = typeof obterLojasPermitidasSessao === 'function' ? obterLojasPermitidasSessao() : [];
    if (lojasSessao.length) {
      lojas = lojasSessao.map(loja => ({
        id: String(loja?.id || loja?.loja_id || '').trim(),
        nome: String(loja?.nome || loja?.nome_loja || 'Loja').trim() || 'Loja',
        empresa_id: String(loja?.empresa_id || '').trim(),
      })).filter(loja => loja.id);
    } else if (usuarioSistemaLogado?.tipo === 'admin') {
      const { data, error } = await executarSemFiltrosTenantTemporario(() => sb
        .from('lojas')
        .select('id, nome, empresa_id, ativo')
        .eq('ativo', true)
        .order('nome'));
      if (error) throw error;
      lojas = (data || []).map(loja => ({
        id: String(loja.id || '').trim(),
        nome: String(loja.nome || 'Loja').trim() || 'Loja',
        empresa_id: String(loja.empresa_id || '').trim(),
      })).filter(loja => loja.id);
    }
  } catch (error) {
    console.warn('Não foi possível carregar lojas para cadastro de checklist:', error);
  }

  select.style.display = '';
  select.innerHTML = '<option value="">Selecione a loja</option>' + lojas.map(loja => (
    `<option value="${escaparHtmlBasico(loja.id)}" data-empresa-id="${escaparHtmlBasico(loja.empresa_id || '')}">${escaparHtmlBasico(loja.nome)}</option>`
  )).join('');
  if (lojas.length === 1) select.value = lojas[0].id;
}

async function criarChecklistReferenciaCadastroTarefa({ nome, descricao = null, tenant = null } = {}) {
  const nomeChecklist = String(nome || '').trim() || 'Checklist';
  const descricaoChecklist = String(descricao || '').trim() || null;
  const tenantChecklist = tenant || await resolverTenantCadastroChecklist();

  const { data, error } = await sb
    .from('checklists')
    .insert([{ nome: nomeChecklist, descricao: descricaoChecklist, ...tenantChecklist }])
    .select('id')
    .single();

  if (error) throw error;
  return String(data?.id || '').trim() || null;
}

async function carregarTarefas() {
  const lista = document.getElementById('listaTarefas');
  if (!lista) return;
  lista.innerHTML = '<div class="empty">Carregando⬦</div>';

  try {
    let queryFuncionariosAtivosTarefas = sb
      .from('funcionarios')
      .select('id, nome, loja_id, empresa_id')
      .eq('ativo', true);
    queryFuncionariosAtivosTarefas = aplicarFiltroLojaFuncionariosQuery(queryFuncionariosAtivosTarefas).order('nome');
    const { data: funcionariosAtivos } = await queryFuncionariosAtivosTarefas;
    funcionariosAtivosTarefa = funcionariosAtivos || [];

    // Isolamento multi-loja: só carrega tarefas da loja logada (evita vazamento entre lojas).
    const lojaSessaoTarefas = String(obterLojaIdSessao?.() || usuarioSistemaLogado?.loja_id || '').trim();
    let queryTarefas = sb.from('tarefas').select('*, funcionarios(nome), checklists(nome)').order('nome');
    if (lojaSessaoTarefas) {
      queryTarefas = queryTarefas.eq('loja_id', lojaSessaoTarefas);
    }
    const { data, error } = await queryTarefas;

    if (error) {
      console.error('Erro ao carregar tarefas:', error);
      lista.innerHTML = '<div class="empty">Erro ao carregar tarefas. Verifique a conexão com o banco de dados.</div>';
      return;
    }

    tarefasCadastradasCache = data || [];
    tarefasFavoritasIds = carregarFavoritosTarefas();
    normalizarEstadosConsultaTarefas();
    filtrarTarefasCadastradas();
  } catch (err) {
    console.error('Erro inesperado ao carregar tarefas:', err);
    lista.innerHTML = '<div class="empty">Erro inesperado ao carregar tarefas. Tente novamente mais tarde.</div>';
  }
}

async function carregarChecklistsTarefas() {
  const lista = document.getElementById('listaChecklistsTarefas');
  if (!lista) return;

  lista.innerHTML = '<div class="empty">Carregando⬦</div>';

  try {
    let queryLancTarefas = sb
      .from('checklist_lancamentos')
      .select('id, nome, descricao, horario_limite, funcionario_id, status, lancado_em, data_programada, criado_por_nome, observacao_lancamento')
      .order('lancado_em', { ascending: false })
      .limit(300);
    queryLancTarefas = aplicarFiltroLojaGenericoQuery(queryLancTarefas); // isolamento multi-loja
    const { data, error } = await queryLancTarefas;

    if (error) {
      if (isMissingLancamentosTableError(error)) {
        lista.innerHTML = '<div class="empty">Rode o SQL da tabela checklist_lancamentos para habilitar esta lista.</div>';
        return;
      }
      console.error('Erro ao carregar checklists cadastrados:', error);
      lista.innerHTML = '<div class="empty">Erro ao carregar checklists lançados.</div>';
      return;
    }

    if (!data?.length) {
      checklistsLancadosCache = [];
      checklistsLancadosFuncionariosMap = {};
      checklistsLancadosUltimaListaFiltrada = [];
      window.checklistsLancadosFiltradosIds = [];
      lista.innerHTML = '<div class="empty">Nenhum checklist lançado.</div>';
      return;
    }

    const funcionarioIds = [...new Set((data || []).map(item => item.funcionario_id).filter(Boolean).map(item => String(item)))];
    let funcionariosMap = {};

    if (funcionarioIds.length) {
      const { data: funcionariosData } = await sb
        .from('funcionarios')
        .select('id, nome')
        .in('id', funcionarioIds);
      funcionariosMap = Object.fromEntries((funcionariosData || []).map(item => [String(item.id), item.nome]));

      const filtroFuncionarioAtual = String(document.getElementById('filtroChecklistLancadoFuncionario')?.value || '');
      const selFuncionario = document.getElementById('filtroChecklistLancadoFuncionario');
      if (selFuncionario) {
        const nomesOrdenados = (funcionariosData || [])
          .map(item => ({ id: String(item.id), nome: String(item.nome || 'Funcionário') }))
          .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

        selFuncionario.innerHTML = '<option value="">- Todos os funcionários -</option>' + nomesOrdenados
          .map(item => `<option value="${item.id}">${item.nome}</option>`)
          .join('');

        selFuncionario.value = nomesOrdenados.some(item => item.id === filtroFuncionarioAtual) ? filtroFuncionarioAtual : '';
      }
    } else {
      const selFuncionario = document.getElementById('filtroChecklistLancadoFuncionario');
      if (selFuncionario) selFuncionario.innerHTML = '<option value="">- Todos os funcionários -</option>';
    }
    checklistsLancadosCache = data || [];
    checklistsLancadosFuncionariosMap = funcionariosMap || {};
    aplicarFiltroListaChecklistsLancados();
  } catch (err) {
    console.error('Erro inesperado ao carregar checklists cadastrados:', err);
    checklistsLancadosCache = [];
    checklistsLancadosFuncionariosMap = {};
    checklistsLancadosUltimaListaFiltrada = [];
    window.checklistsLancadosFiltradosIds = [];
    lista.innerHTML = '<div class="empty">Erro inesperado ao carregar checklists lançados.</div>';
  }
}

function obterFiltrosChecklistsLancadosAtuais() {
  const filtroBusca = String(document.getElementById('filtroChecklistLancadoBusca')?.value || '').trim().toLowerCase();
  const filtroFuncionario = String(document.getElementById('filtroChecklistLancadoFuncionario')?.value || '');
  const filtroStatus = String(document.getElementById('filtroChecklistLancadoStatus')?.value || '').trim().toLowerCase();
  return { filtroBusca, filtroFuncionario, filtroStatus };
}

function aplicarFiltroListaChecklistsLancados() {
  const lista = document.getElementById('listaChecklistsTarefas');
  if (!lista) return;

  const { filtroBusca, filtroFuncionario, filtroStatus } = obterFiltrosChecklistsLancadosAtuais();
  const dadosFiltrados = (checklistsLancadosCache || []).filter(c => {
    const statusAtual = String(c.status || 'pendente').toLowerCase();
    const funcionarioAtual = String(c.funcionario_id || '');
    const textoBase = `${String(c.nome || '')} ${String(c.descricao || '')}`.toLowerCase();

    if (filtroBusca && !textoBase.includes(filtroBusca)) return false;
    if (filtroStatus && statusAtual !== filtroStatus) return false;
    if (filtroFuncionario && funcionarioAtual !== filtroFuncionario) return false;
    return true;
  });

  checklistsLancadosUltimaListaFiltrada = dadosFiltrados;
  window.checklistsLancadosFiltradosIds = dadosFiltrados.map(item => String(item.id));

  if (!dadosFiltrados.length) {
    lista.innerHTML = '<div class="empty">Nenhum checklist lançado com os filtros selecionados.</div>';
    return;
  }

  lista.innerHTML = '<div class="lista">' + dadosFiltrados.map(c => `
    <div class="item">
      <div class="item-info">
        <div class="item-nome">${c.nome}</div>
        <div class="item-detalhe">Funcionário: ${checklistsLancadosFuncionariosMap[String(c.funcionario_id)] || '-'}</div>
        <div class="item-detalhe">Agendado para: ${formatarDataProgramadaBr(obterDataProgramadaLancamento(c))}</div>
        <div class="item-detalhe">Horário: ${c.horario_limite || '-'}</div>
        <div class="item-detalhe">${c.descricao || 'Checklist lançado no sistema.'}</div>
        <div class="item-detalhe">Lançado em: ${c.lancado_em ? fmtDate(c.lancado_em) : '-'}</div>
        <div class="item-detalhe">Por: ${c.criado_por_nome || 'Sistema'}</div>
        ${c.observacao_lancamento ? `<div class="item-detalhe">Obs.: ${c.observacao_lancamento}</div>` : ''}
      </div>
      <div class="item-actions">
        ${c.status === 'finalizado'
          ? '<span class="tag tag-green">Finalizado</span>'
          : c.status === 'iniciado'
          ? '<span class="tag tag-amber">Iniciado</span>'
          : '<span class="tag tag-gray">Pendente</span>'}
        <button class="btn btn-red btn-sm" onclick="excluirChecklistCadastradoTarefa('${c.id}')">Excluir</button>
      </div>
    </div>`).join('') + '</div>';
}

function filtrarChecklistsLancados() {
  if (!Array.isArray(checklistsLancadosCache) || !checklistsLancadosCache.length) {
    carregarChecklistsTarefas();
    return;
  }
  aplicarFiltroListaChecklistsLancados();
}

function limparFiltrosChecklistsLancados() {
  const campoBusca = document.getElementById('filtroChecklistLancadoBusca');
  const campoFuncionario = document.getElementById('filtroChecklistLancadoFuncionario');
  const campoStatus = document.getElementById('filtroChecklistLancadoStatus');
  if (campoBusca) campoBusca.value = '';
  if (campoFuncionario) campoFuncionario.value = '';
  if (campoStatus) campoStatus.value = '';
  carregarChecklistsTarefas();
}

function forcarCampoBuscaChecklistsLancadosEmBranco() {
  const campoBusca = document.getElementById('filtroChecklistLancadoBusca');
  if (!campoBusca) return;
  if (filtroChecklistLancadoBuscaEditado) return;
  campoBusca.value = '';
  campoBusca.removeAttribute('value');
}

function marcarCampoBuscaChecklistLancadoComoEditado(campo = null) {
  filtroChecklistLancadoBuscaEditado = true;
  const input = campo || document.getElementById('filtroChecklistLancadoBusca');
  if (!input) return;
}

function redefinirCampoBuscaChecklistLancado() {
  filtroChecklistLancadoBuscaEditado = false;
  const campoBusca = document.getElementById('filtroChecklistLancadoBusca');
  if (!campoBusca) return;
  campoBusca.value = '';
  campoBusca.removeAttribute('value');
  window.setTimeout(() => forcarCampoBuscaChecklistsLancadosEmBranco(), 50);
  window.setTimeout(() => forcarCampoBuscaChecklistsLancadosEmBranco(), 400);
  window.setTimeout(() => forcarCampoBuscaChecklistsLancadosEmBranco(), 1200);
}

async function validarSenhaMasterParaExclusao(senha = '') {
  const valor = String(senha || '').trim();
  if (!valor) return false;

  const usuariosPredefinidos = (typeof predefinedUsers !== 'undefined' && Array.isArray(predefinedUsers))
    ? predefinedUsers
    : [];

  const mestres = usuariosPredefinidos.filter(item => {
    const username = String(item?.username || '').toLowerCase();
    return username === 'admin' || username === 'master';
  });

  const referencia = mestres.length ? mestres : usuariosPredefinidos;
  if (referencia.some(item => String(item?.password || '') === valor)) {
    return true;
  }

  const perfilCodigo = String(usuarioSistemaLogado?.perfil?.codigo || '').toUpperCase();
  const perfilNome = String(usuarioSistemaLogado?.perfil?.nome || '').toLowerCase();
  const ehAdminLoja = usuarioSistemaLogado?.tipo === 'admin_loja' || usuarioSistemaLogado?.tipo === 'admin';
  const adminPorPerfil = perfilCodigo === 'ADM' || perfilCodigo === 'MASTER' || perfilNome.includes('admin');
  if (!adminPorPerfil && !ehAdminLoja) return false;

  const idUsuario = String(usuarioSistemaLogado?.id || '').trim();
  const emailUsuario = String(usuarioSistemaLogado?.email || '').trim().toLowerCase();
  if (!idUsuario && !emailUsuario) return false;

  try {
    // Importante: busca SEM o filtro de loja/empresa. Um admin com acesso a várias
    // lojas tem registros diferentes por loja; estando logado em uma loja, o filtro
    // padrão impediria de ler o registro/PIN da outra, causando "senha inválida".
    // Aceitamos o PIN de QUALQUER registro ativo do mesmo usuário (por id ou e-mail).
    const { data, error } = await executarSemFiltrosTenantTemporario(() => {
      let query = sb.from('funcionarios').select('id, pin, ativo, email');
      if (idUsuario && emailUsuario) {
        query = query.or(`id.eq.${idUsuario},email.eq.${emailUsuario}`);
      } else if (idUsuario) {
        query = query.eq('id', idUsuario);
      } else {
        query = query.eq('email', emailUsuario);
      }
      return query;
    });
    if (error || !Array.isArray(data) || !data.length) return false;
    // Confere o PIN em qualquer registro ATIVO do usuário.
    return data.some(reg => reg?.ativo === true && String(reg?.pin || '') === valor);
  } catch (error) {
    console.warn('Falha ao validar senha master para exclusão:', error);
    return false;
  }
}

async function excluirChecklistsLancadosFiltrados() {
  aplicarFiltroListaChecklistsLancados();
  const ids = (window.checklistsLancadosFiltradosIds || []).filter(Boolean);
  if (!ids.length) {
    setMsg('msgTarefas', 'Não há checklists lançados para excluir com os filtros atuais.', 'err');
    return;
  }

  const confirmacaoSenha = await abrirModalPin({
    titulo: 'Confirmação de exclusão',
    subtitulo: 'Digite a senha master para excluir os checklists filtrados.',
    textoAcao: 'Validar senha',
    exibirUsuario: false,
    placeholderInput: 'Digite a senha master'
  });
  if (!confirmacaoSenha?.pin) {
    setMsg('msgTarefas', 'Exclusão cancelada.', 'err');
    return;
  }

  if (!(await validarSenhaMasterParaExclusao(confirmacaoSenha.pin))) {
    setMsg('msgTarefas', 'Senha master inválida. Exclusão cancelada.', 'err');
    return;
  }

  const confirmar = confirm(`Excluir ${ids.length} checklist(s) lançado(s) filtrado(s)?\n\nEsta ação remove também execuções e respostas vinculadas.`);
  if (!confirmar) return;

  try {
    const { data: execucoes, error: erroExecucoes } = await sb
      .from('checklist_execucoes')
      .select('id')
      .in('lancamento_id', ids);

    if (erroExecucoes && !isMissingTableError(erroExecucoes)) {
      throw erroExecucoes;
    }

    const execucaoIds = (execucoes || []).map(item => item.id).filter(Boolean);

    if (execucaoIds.length) {
      const { error: erroMovimentacoes } = await sb
        .from('checklist_execucao_usuarios')
        .delete()
        .in('execucao_id', execucaoIds);
      if (erroMovimentacoes && !isMissingExecutionUsersTableError(erroMovimentacoes)) {
        throw erroMovimentacoes;
      }

      const { error: erroRespostas } = await sb
        .from('checklist_respostas')
        .delete()
        .in('execucao_id', execucaoIds);
      if (erroRespostas && !isMissingTableError(erroRespostas)) {
        throw erroRespostas;
      }

      const { error: erroDeleteExecucoes } = await sb
        .from('checklist_execucoes')
        .delete()
        .in('id', execucaoIds);
      if (erroDeleteExecucoes && !isMissingTableError(erroDeleteExecucoes)) {
        throw erroDeleteExecucoes;
      }
    }

    const { error: erroDeleteLancamentos } = await sb
      .from('checklist_lancamentos')
      .delete()
      .in('id', ids);
    if (erroDeleteLancamentos) {
      throw erroDeleteLancamentos;
    }
  } catch (error) {
    console.error('Erro ao excluir checklists lançados filtrados:', error);
    setMsg('msgTarefas', `Não foi possível excluir os checklists filtrados: ${mensagemErroSupabase(error, 'erro desconhecido')}`, 'err');
    return;
  }

  setMsg('msgTarefas', `${ids.length} checklist(s) lançado(s) excluído(s).`, 'ok');
  window.checklistsLancadosFiltradosIds = [];
  carregarChecklistsTarefas();
  carregarChecklists();
  carregarExecucoes();
  carregarNotificacoes();
}

async function excluirChecklistCadastradoTarefa(id) {
  if (!confirm('Excluir este checklist lançado?')) return;

  const { error } = await sb.from('checklist_lancamentos').delete().eq('id', id);
  if (error) {
    if (isMissingLancamentosTableError(error)) {
      setMsg('msgTarefas', 'Falta criar a tabela checklist_lancamentos.', 'err');
      return;
    }
    setMsg('msgTarefas', `Não foi possível excluir: ${mensagemErroSupabase(error, 'erro desconhecido')}`, 'err');
    return;
  }

  setMsg('msgTarefas', 'Checklist lançado excluído.', 'ok');
  carregarChecklistsTarefas();
  carregarChecklists();
  carregarNotificacoes();
}

async function criarTarefa() {
  if (!tarefasDisponiveis) {
    setMsg('msgTarefas', 'Recurso de tarefas indisponível. A tabela "tarefas" não existe no Supabase.', 'err');
    return;
  }
  const nome = document.getElementById('nomeTarefa').value.trim();
  const descricao = document.getElementById('descTarefa').value.trim();
  const funcionarioId = document.getElementById('funcionarioTarefa').value || null;
  if (!nome) { setMsg('msgTarefas', 'Digite o nome da tarefa.', 'err'); return; }
  if (!descricao) { setMsg('msgTarefas', 'Digite a observação da tarefa.', 'err'); return; }

  const diasStr = 'todos';
  const editandoAgora = !!tarefaEmEdicaoId;
  let checklistRefEdicao = checklistReferenciaEmEdicaoId || null;
  let checklistCriadoAntesDaTarefa = null;
  let tenantCadastroChecklist = null;
  try {
    tenantCadastroChecklist = await resolverTenantCadastroChecklist();
  } catch (erroTenant) {
    setMsg('msgTarefas', mensagemErroSupabase(erroTenant, 'Selecione uma loja para cadastrar o checklist.'), 'err');
    await carregarSelectLojaTarefaCadastro();
    return;
  }
  if (!editandoAgora && !checklistRefEdicao) {
    try {
      checklistRefEdicao = await criarChecklistReferenciaCadastroTarefa({ nome, descricao, tenant: tenantCadastroChecklist });
      checklistCriadoAntesDaTarefa = checklistRefEdicao;
    } catch (erroChecklistInicial) {
      console.error('Erro ao criar checklist de referência antes da tarefa:', erroChecklistInicial);
      setMsg('msgTarefas', `Erro ao preparar checklist: ${mensagemErroSupabase(erroChecklistInicial, 'erro desconhecido')}`, 'err');
      return;
    }
  }
  const payload = {
    nome,
    descricao,
    checklist_id: checklistRefEdicao,
    horario_limite: null,
    dias_semana: diasStr,
    funcionario_id: funcionarioId,
    ...tenantCadastroChecklist,
  };
  const query = editandoAgora
    ? sb.from('tarefas').update(payload).eq('id', tarefaEmEdicaoId).select()
    : sb.from('tarefas').insert([{ ...payload, ativo: true, lancada_checklist: false }]).select();

  const { data, error } = await query;
  console.log('Resposta criarTarefa:', { data, error, tarefaEmEdicaoId });
  if (error) {
    if (isMissingTableError(error)) {
      tarefasDisponiveis = false;
      setMsg('msgTarefas', 'Recurso de tarefas indisponível. A tabela "tarefas" não existe no Supabase.', 'err');
      return;
    }
    if (checklistCriadoAntesDaTarefa) {
      try {
        await sb.from('checklists').delete().eq('id', checklistCriadoAntesDaTarefa);
      } catch (erroLimpezaChecklist) {
        console.warn('Não foi possível limpar checklist criado antes da falha da tarefa:', erroLimpezaChecklist);
      }
    }
    setMsg('msgTarefas', `${editandoAgora ? 'Erro ao salvar alterações' : 'Erro ao criar tarefa'}: ${mensagemErroSupabase(error, 'erro desconhecido')}`, 'err');
    return;
  }

  const tarefaSalva = data?.[0] || null;
  if (!tarefaSalva?.id) {
    setMsg('msgTarefas', 'Tarefa salva, mas sem retorno de ID. Tente novamente.', 'err');
    return;
  }
  const tarefaSalvaId = String(tarefaSalva.id);
  tarefasConfigLancamentoAbertasIds.add(tarefaSalvaId);

  let checklistReferencia = null;
  try {
    checklistReferencia = await garantirChecklistReferenciaDaTarefa({
      tarefaId: tarefaSalva.id,
      nome: payload.nome,
      descricao: payload.descricao,
      checklistIdPreferido: tarefaSalva.checklist_id || checklistRefEdicao || null,
    });
  } catch (erroVinculoChecklist) {
    console.error('Erro ao garantir referência de checklist da tarefa:', erroVinculoChecklist);
    setMsg('msgTarefas', `Tarefa salva, mas nao foi possivel vincular checklist: ${mensagemErroSupabase(erroVinculoChecklist, 'erro desconhecido')}`, 'err');
    await carregarTarefas();
    return;
  }

  if (!checklistReferencia) {
    setMsg('msgTarefas', 'Tarefa salva, mas não foi possível preparar o checklist vinculado.', 'err');
    await carregarTarefas();
    return;
  }

  if (editandoAgora) {
    try {
      await sb
        .from('checklist_lancamentos')
        .update({
          checklist_id: checklistReferencia,
          nome: payload.nome,
          descricao: payload.descricao,
        })
        .eq('tarefa_id', tarefaSalva.id)
        .eq('status', 'pendente');
    } catch (syncError) {
      console.warn('Não foi possível sincronizar lançamentos pendentes da tarefa:', syncError);
    }
  }

  limparFormularioTarefa();
  setMsg('msgTarefas', editandoAgora
    ? 'Tarefa atualizada.'
    : 'Tarefa cadastrada. Agora clique em "Lançar tarefa" para aparecer em Checklists lançados.', 'ok');
  carregarTarefas();
  carregarChecklistsTarefas();
}

function limparFormularioTarefa() {
  tarefaEmEdicaoId = null;
  checklistReferenciaEmEdicaoId = null;
  document.getElementById('nomeTarefa').value = '';
  document.getElementById('descTarefa').value = '';
  document.getElementById('descTarefa').setAttribute('readonly', 'readonly');
  document.getElementById('funcionarioTarefa').value = '';
  const btnSalvar = document.getElementById('btnSalvarTarefa');
  const btnCancelar = document.getElementById('btnCancelarEdicaoTarefa');
  if (btnSalvar) btnSalvar.textContent = 'Salvar';
  if (btnCancelar) btnCancelar.style.display = 'none';
}

async function editarTarefa(id) {
  const { data: tarefa, error } = await sb
    .from('tarefas')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !tarefa) {
    console.error('Erro ao carregar tarefa para edição:', error);
    setMsg('msgTarefas', 'Não foi possível carregar a tarefa para edição.', 'err');
    return;
  }

  tarefaEmEdicaoId = id;
  checklistReferenciaEmEdicaoId = tarefa.checklist_id || null;
  document.getElementById('nomeTarefa').value = tarefa.nome || '';
  document.getElementById('descTarefa').value = tarefa.descricao || '';
  document.getElementById('descTarefa').removeAttribute('readonly');
  document.getElementById('funcionarioTarefa').value = tarefa.funcionario_id || '';

  const btnSalvar = document.getElementById('btnSalvarTarefa');
  const btnCancelar = document.getElementById('btnCancelarEdicaoTarefa');
  if (btnSalvar) btnSalvar.textContent = 'Salvar';
  if (btnCancelar) btnCancelar.style.display = 'inline-flex';
  setMsg('msgTarefas', `Editando tarefa: ${tarefa.nome}.`, 'ok');
}

function cancelarEdicaoTarefa() {
  limparFormularioTarefa();
  setMsg('msgTarefas', 'Edição cancelada.', 'ok');
}

function fecharConfigLancamentoTarefa(id = '') {
  const chave = String(id || '').trim();
  if (chave) tarefasConfigLancamentoAbertasIds.delete(chave);
  else tarefasConfigLancamentoAbertasIds.clear();
  renderizarListaConsultaTarefas();
  renderizarListaTarefas();
}

async function localizarConflitosLancamentoManual({ funcionarioId = '', lancamentosParaCriar = [] } = {}) {
  const funcionario = String(funcionarioId || '').trim();
  const datas = [...new Set((lancamentosParaCriar || []).map(item => String(item.data_programada || '').trim()).filter(Boolean))];
  if (!funcionario || !datas.length) return [];

  const { data, error } = await sb
    .from('checklist_lancamentos')
    .select('id, nome, horario_limite, data_programada, lancado_em, created_at, status')
    .eq('funcionario_id', funcionario)
    .in('data_programada', datas)
    .limit(500);

  if (error) throw error;

  const existentes = (data || []).filter(item => lancamentoContaComoExistenteParaAgenda(item));
  const conflitos = [];

  lancamentosParaCriar.forEach(novo => {
    const dataNovo = String(novo.data_programada || '').trim();
    const horaNovo = horaCurta(novo.horario_limite || '');
    const minutosNovo = horarioParaMinutos(horaNovo);
    if (!dataNovo || minutosNovo === null) return;

    existentes.forEach(existente => {
      const dataExistente = String(obterDataProgramadaLancamento(existente) || '').trim();
      const horaExistente = horaCurta(existente.horario_limite || '');
      const minutosExistente = horarioParaMinutos(horaExistente);
      if (dataExistente !== dataNovo || minutosExistente === null) return;

      const diferenca = Math.abs(minutosNovo - minutosExistente);
      if (diferenca <= JANELA_CONFLITO_LANCAMENTO_MANUAL_MINUTOS) {
        conflitos.push({
          novaTarefa: novo.nome || 'Nova tarefa',
          novaData: dataNovo,
          novaHora: horaNovo,
          tarefaExistente: existente.nome || 'Tarefa já lançada',
          horaExistente,
          diferenca,
        });
      }
    });
  });

  return conflitos;
}

function montarHtmlConflitosLancamentoManual(conflitos = [], funcionarioNome = '') {
  const itens = conflitos.slice(0, 5).map(item => `
    <li>
      <strong>${escaparHtmlBasico(formatarDataProgramadaBr(item.novaData))}</strong>:
      ${escaparHtmlBasico(item.novaTarefa)} às ${escaparHtmlBasico(item.novaHora)}
      conflita com ${escaparHtmlBasico(item.tarefaExistente)} às ${escaparHtmlBasico(item.horaExistente)}
      (${item.diferenca} min de diferença).
    </li>
  `).join('');
  const restante = conflitos.length > 5 ? `<p>Há mais ${conflitos.length - 5} conflito(s) além dos listados.</p>` : '';
  return `
    <p>Já existe tarefa lançada para ${escaparHtmlBasico(funcionarioNome || 'este funcionário')} até ${JANELA_CONFLITO_LANCAMENTO_MANUAL_MINUTOS} minutos antes ou depois do horário escolhido.</p>
    <ul style="margin:8px 0 0 18px;padding:0">${itens}</ul>
    ${restante}
    <p style="margin-top:10px"><strong>Deseja lançar mesmo assim?</strong></p>
  `;
}

async function lancarTarefa(id, funcionarioIdOverride = '', horarioOverride = '', diasSemanaOverride = '') {
  if (!tarefasDisponiveis) {
    setMsg('msgTarefas', 'Recurso de tarefas indisponível. A tabela "tarefas" não existe no Supabase.', 'err');
    return;
  }

  const tarefaIdChave = String(id || '').trim();
  if (!tarefaIdChave) {
    setMsg('msgTarefas', 'Tarefa inválida para lançamento.', 'err');
    return;
  }
  if (lancamentosManuaisEmAndamento.has(tarefaIdChave)) {
    setMsg('msgTarefas', 'Lançamento já em andamento para esta tarefa. Aguarde alguns segundos.', 'ok');
    setMsgLancamentoTarefa(tarefaIdChave, 'Lançamento em andamento. Aguarde concluir para evitar duplicidade.', 'ok');
    return;
  }
  lancamentosManuaisEmAndamento.add(tarefaIdChave);

  try {

  setMsgLancamentoTarefa(id, '', '');

  const { data: tarefa, error: errTarefa } = await sb
    .from('tarefas')
    .select('id, nome, descricao, funcionario_id, checklist_id, horario_limite, dias_semana, ativo, loja_id, empresa_id')
    .eq('id', id)
    .single();

  if (errTarefa || !tarefa) {
    console.error('Erro ao carregar tarefa para lançamento:', errTarefa);
    setMsg('msgTarefas', 'Não foi possível carregar a tarefa para lançamento.', 'err');
    return;
  }

  const funcionarioSelecionado = String(funcionarioIdOverride || '').trim();
  if (!funcionarioSelecionado) {
    abrirConfigLancamentoTarefa(id);
    setMsg('msgTarefas', 'Selecione um funcionário nas opções de lançamento antes de lançar.', 'err');
    setMsgLancamentoTarefa(id, 'Marque um funcionário no card antes de lançar.', 'err');
    return;
  }
  const horarioSelecionado = horaCurta(horarioOverride || '');
  if (!horarioSelecionado) {
    abrirConfigLancamentoTarefa(id);
    setMsg('msgTarefas', 'Defina o horário nas opções de lançamento antes de lançar.', 'err');
    setMsgLancamentoTarefa(id, 'Informe o horário no card da tarefa antes de lançar.', 'err');
    return;
  }

  const diasLancamento = String(diasSemanaOverride || '').trim().toLowerCase();
  if (!diasLancamento) {
    abrirConfigLancamentoTarefa(id);
    setMsg('msgTarefas', 'Selecione ao menos um dia nas opções de lançamento antes de lançar.', 'err');
    setMsgLancamentoTarefa(id, 'Selecione pelo menos um dia da semana antes de lançar.', 'err');
    return;
  }
  const diasPermitidos = diasSemanaParaConjunto(diasLancamento || '');
  if (!diasPermitidos.size) {
    abrirConfigLancamentoTarefa(id);
    setMsg('msgTarefas', 'Selecione ao menos um dia nas opções de lançamento antes de lançar.', 'err');
    setMsgLancamentoTarefa(id, 'Selecione pelo menos um dia no card da tarefa antes de lançar.', 'err');
    return;
  }
  // Repetição configurada no card: intervalo (a cada X dias) e duração (por X dias).
  const intervaloRepeticao = obterIntervaloLancamentoTarefa(id);
  const duracaoRepeticao = obterDuracaoLancamentoTarefa(id);
  // Quando o usuário define "por X dias", esse horizonte substitui o padrão de 7 dias.
  const horizonteAgendamento = duracaoRepeticao > 0
    ? (duracaoRepeticao - 1)
    : HORIZONTE_AGENDAMENTO_MANUAL_DIAS;
  const { data: funcionarioTurno, error: erroFuncionarioTurno } = await sb
    .from('funcionarios')
    .select('id, nome, horario_trabalho_inicio, horario_trabalho_fim')
    .eq('id', funcionarioSelecionado)
    .single();

  if (erroFuncionarioTurno) {
    if (isMissingWorkShiftColumnsError(erroFuncionarioTurno)) {
      setMsg('msgTarefas', 'Rode o SQL das colunas de turno (horario_trabalho_inicio/fim) na tabela funcionarios.', 'err');
      setMsgLancamentoTarefa(id, 'Faltam as colunas de turno no cadastro de funcionários.', 'err');
      return;
    }
    console.error('Erro ao validar turno do funcionário:', erroFuncionarioTurno);
    setMsg('msgTarefas', 'Não foi possível validar o turno do funcionário antes do lançamento.', 'err');
    setMsgLancamentoTarefa(id, 'Erro ao validar turno do funcionário.', 'err');
    return;
  }

  const hojeData = new Date();
  hojeData.setHours(0, 0, 0, 0);
  const turnoFuncionarioPreenchido = funcionarioPossuiTurnoPreenchido(funcionarioTurno);
  const ignorarHojePorTurno = turnoFuncionarioPreenchido && !funcionarioDentroDoTurnoOperacional(funcionarioTurno);
  const ignorarHojePorHorario = !!horarioSelecionado && horarioJaPassouHoje(horarioSelecionado);
  const ignorarHoje = ignorarHojePorTurno || ignorarHojePorHorario;
  const agoraIso = new Date().toISOString();
  const atorAuditoria = obterAtorAuditoriaAtual();

  const consultarLancamentosExistentes = async (comCreatedAt = true, comStatus = true) => {
    const camposBase = comCreatedAt ? ['id', 'lancado_em', 'created_at', 'data_programada', 'horario_limite'] : ['id', 'lancado_em', 'horario_limite'];
    const campos = [...camposBase, ...(comStatus ? ['status'] : [])].join(', ');
    const { data, error } = await sb
      .from('checklist_lancamentos')
      .select(campos)
      .eq('tarefa_id', tarefa.id)
      .eq('funcionario_id', funcionarioSelecionado);
    return { data, error };
  };

  let { data: existentes, error: erroExistentes } = await consultarLancamentosExistentes(true, true);
  if (erroExistentes && (
    String(erroExistentes.message || '').toLowerCase().includes('created_at')
    || String(erroExistentes.message || '').toLowerCase().includes('data_programada')
    || String(erroExistentes.message || '').toLowerCase().includes('status')
  )) {
    const erroTexto = String(erroExistentes.message || '').toLowerCase();
    ({ data: existentes, error: erroExistentes } = await consultarLancamentosExistentes(false, !erroTexto.includes('status')));
  }

  if (erroExistentes && !isMissingLancamentosTableError(erroExistentes)) {
    setMsg('msgTarefas', `Erro ao validar lançamentos existentes: ${mensagemErroSupabase(erroExistentes, 'erro desconhecido')}`, 'err');
    return;
  }

  const chavesExistentes = new Set(
    (existentes || [])
      .filter(item => lancamentoContaComoExistenteParaAgenda(item))
      .map(item => {
        const data = obterDataProgramadaLancamento(item) || dataLocalISO(item.lancado_em || item.created_at);
        if (!data) return null;
        // Chave inclui o horário: permite a mesma tarefa em vários horários no mesmo dia.
        const hora = horaCurta(item.horario_limite || '') || 'sem-hora';
        return `${tarefa.id}::${funcionarioSelecionado}::${data}::${hora}`;
      })
      .filter(Boolean)
  );

  const lancamentosParaCriar = [];
  let pulouHojePorHorario = false;
  let pulouHojePorTurno = false;
  let ocorrenciaValida = -1; // contador de dias-válidos para aplicar o intervalo

  for (let offset = 0; offset <= horizonteAgendamento; offset++) {
    const dataAlvo = new Date(hojeData);
    dataAlvo.setDate(hojeData.getDate() + offset);
    const diaToken = diaSemanaTokenDaData(dataAlvo);
    if (!diaToken || !diasPermitidos.has(diaToken)) continue;

    // Conta apenas dias que batem com os dias da semana selecionados e aplica o
    // intervalo "a cada X dias" (1 = todos, 2 = pula um, etc.).
    ocorrenciaValida++;
    if (intervaloRepeticao > 1 && (ocorrenciaValida % intervaloRepeticao !== 0)) continue;

    if (offset === 0 && ignorarHoje) {
      pulouHojePorTurno = ignorarHojePorTurno;
      pulouHojePorHorario = ignorarHojePorHorario;
      continue;
    }

    const dataIsoLocal = dataLocalISO(dataAlvo);
    const horaChave = horaCurta(horarioSelecionado || '') || 'sem-hora';
    const chave = `${tarefa.id}::${funcionarioSelecionado}::${dataIsoLocal}::${horaChave}`;
    if (chavesExistentes.has(chave)) continue;

    lancamentosParaCriar.push({
      tarefa_id: tarefa.id,
      checklist_id: tarefa.checklist_id || null,
      funcionario_id: funcionarioSelecionado || null,
      nome: tarefa.nome,
      descricao: tarefa.descricao || null,
      horario_limite: horarioSelecionado || null,
      dias_semana: diasLancamento || 'todos',
      data_programada: dataIsoLocal,
      lancado_em: agoraIso,
      criado_por_id: atorAuditoria.funcionarioId,
      criado_por_nome: atorAuditoria.nome,
      origem_lancamento: 'manual',
      observacao_lancamento: pulouHojePorTurno && dataIsoLocal !== hoje()
        ? `Hoje foi ignorado porque o funcionário está fora do turno cadastrado (${horaCurta(funcionarioTurno?.horario_trabalho_inicio)} às ${horaCurta(funcionarioTurno?.horario_trabalho_fim)} no horário local).`
        : pulouHojePorHorario && dataIsoLocal !== hoje()
          ? `Hoje foi ignorado porque o horário ${horarioSelecionado} já havia passado.`
          : null,
      empresa_id: tarefa.empresa_id || obterEmpresaIdSessao?.() || usuarioSistemaLogado?.empresa_id || null,
      loja_id: tarefa.loja_id || obterLojaIdSessao?.() || usuarioSistemaLogado?.loja_id || null,
      status: 'pendente',
    });
  }

  if (pulouHojePorHorario || pulouHojePorTurno) {
    try {
      const motivoIgnorado = pulouHojePorTurno ? 'fora_turno_funcionario' : 'horario_expirado';
      const observacaoIgnorado = pulouHojePorTurno
        ? `Hoje foi ignorado porque o funcionário está fora do turno cadastrado (${horaCurta(funcionarioTurno?.horario_trabalho_inicio)} às ${horaCurta(funcionarioTurno?.horario_trabalho_fim)} no horário local). O sistema agendou apenas o próximo ciclo válido.`
        : `Hoje foi ignorado porque o lançamento ocorreu após ${horarioSelecionado}. O sistema agendou apenas o próximo ciclo válido.`;

      await registrarEventoLancamento({
        tarefaId: tarefa.id,
        checklistId: tarefa.checklist_id || null,
        funcionarioResponsavelId: funcionarioSelecionado,
        funcionarioAtorId: atorAuditoria.funcionarioId,
        funcionarioAtorNome: atorAuditoria.nome,
        tipoEvento: 'agendamento_ignorado',
        origemEvento: atorAuditoria.origem,
        dataProgramada: hoje(),
        horarioProgramado: horarioSelecionado,
        registradoEm: agoraIso,
        observacao: observacaoIgnorado,
        meta: {
          motivo: motivoIgnorado,
          hora_lancamento: agoraHoraMinuto(),
          hora_lancamento_utc: agoraHoraMinutoUTC(),
          hora_lancamento_local: agoraHoraMinutoOperacional(),
          turno_inicio_local: horaCurta(funcionarioTurno?.horario_trabalho_inicio || ''),
          turno_fim_local: horaCurta(funcionarioTurno?.horario_trabalho_fim || ''),
        },
      });
    } catch (erroAuditoria) {
      console.warn('Não foi possível registrar o agendamento ignorado:', erroAuditoria);
    }
  }

  if (!lancamentosParaCriar.length) {
    const mensagemSemNovoLancamento = pulouHojePorTurno
      ? 'Hoje foi ignorado porque o funcionário está fora do turno cadastrado. Os próximos dias já estavam agendados.'
      : pulouHojePorHorario
        ? 'Hoje foi ignorado porque o horário já passou. Os próximos dias já estavam agendados.'
        : 'Nenhum novo lançamento criado. Esta tarefa já estava agendada para os próximos dias.';
    setMsg('msgTarefas', mensagemSemNovoLancamento, 'ok');
    setMsgLancamentoTarefa(id, mensagemSemNovoLancamento, 'ok');
    return;
  }

  let conflitosLancamento = [];
  try {
    conflitosLancamento = await localizarConflitosLancamentoManual({
      funcionarioId: funcionarioSelecionado,
      lancamentosParaCriar,
    });
  } catch (erroConflitos) {
    console.error('Erro ao validar janela de 20 minutos para lançamento:', erroConflitos);
    setMsg('msgTarefas', `Não foi possível validar conflitos de horário: ${mensagemErroSupabase(erroConflitos, 'erro desconhecido')}`, 'err');
    setMsgLancamentoTarefa(id, 'Erro ao validar conflitos de horário antes do lançamento.', 'err');
    return;
  }

  if (conflitosLancamento.length) {
    const confirmacaoConflito = await abrirConfirmacaoSistema({
      title: 'Tarefa próxima já lançada',
      subtitle: 'Conflito de horário para o funcionário',
      body: montarHtmlConflitosLancamentoManual(conflitosLancamento, funcionarioTurno?.nome || ''),
      confirmText: 'Sim, lançar',
      confirmClass: 'btn-green',
      neutralText: 'Não, ajustar',
      neutralClass: 'btn-amber',
      cancelText: 'Cancelar',
      cancelClass: 'btn-red',
    });

    if (confirmacaoConflito?.acao === 'neutro') {
      abrirConfigLancamentoTarefa(id);
      setMsg('msgTarefas', 'Ajuste a data, horário ou funcionário antes de lançar.', 'err');
      setMsgLancamentoTarefa(id, 'Existe tarefa lançada dentro da janela de 20 minutos. Ajuste as opções antes de lançar.', 'err');
      return;
    }

    if (!confirmacaoConflito?.confirmado) {
      fecharConfigLancamentoTarefa(id);
      setMsg('msgTarefas', 'Lançamento cancelado.', 'ok');
      setMsgLancamentoTarefa(id, '', '');
      return;
    }
  }

  const { data: lancamentosCriados, error } = await sb.from('checklist_lancamentos').insert(lancamentosParaCriar).select('id, tarefa_id, checklist_id, funcionario_id, data_programada, horario_limite');

  if (error) {
    if (isMissingLancamentosTableError(error)) {
      setMsg('msgTarefas', 'Falta criar a tabela checklist_lancamentos. Rode o SQL que eu te envio.', 'err');
      return;
    }
    console.error('Erro ao lançar tarefa:', error);
    setMsg('msgTarefas', `Erro ao lançar tarefa: ${error.message}`, 'err');
    return;
  }

  try {
    await Promise.all((lancamentosCriados || []).map(item => registrarEventoLancamento({
      lancamentoId: item.id,
      tarefaId: item.tarefa_id,
      checklistId: item.checklist_id,
      funcionarioResponsavelId: item.funcionario_id,
      funcionarioAtorId: atorAuditoria.funcionarioId,
      funcionarioAtorNome: atorAuditoria.nome,
      tipoEvento: 'lancado',
      origemEvento: atorAuditoria.origem,
      dataProgramada: item.data_programada,
      horarioProgramado: item.horario_limite,
      registradoEm: agoraIso,
      observacao: pulouHojePorTurno
        ? 'Lançamento manual criado após ignorar o dia corrente por funcionário fora do turno cadastrado.'
        : pulouHojePorHorario
          ? 'Lançamento manual criado após ignorar o dia corrente por horário expirado.'
          : 'Lançamento manual registrado.',
      meta: {
        dias_semana: diasLancamento || 'todos',
        turno_validado_local: turnoFuncionarioPreenchido,
        turno_inicio_local: horaCurta(funcionarioTurno?.horario_trabalho_inicio || ''),
        turno_fim_local: horaCurta(funcionarioTurno?.horario_trabalho_fim || ''),
      },
    })));
  } catch (erroAuditoria) {
    console.warn('Não foi possível registrar a auditoria do lançamento manual:', erroAuditoria);
  }

  const mensagemSucesso = pulouHojePorTurno
    ? `Hoje foi ignorado (funcionário fora do turno cadastrado no horário local). ${lancamentosParaCriar.length} lançamento(s) agendado(s) para os próximos dias.`
    : pulouHojePorHorario
      ? `Hoje foi ignorado (horário já passou). ${lancamentosParaCriar.length} lançamento(s) agendado(s) para os próximos dias.`
      : `${lancamentosParaCriar.length} lançamento(s) enviado(s) para a aba Checklists.`;
  setMsg('msgTarefas', mensagemSucesso, 'ok');
  setMsgLancamentoTarefa(id, mensagemSucesso, 'ok');
  carregarTarefas();
  carregarChecklistsTarefas();
  carregarChecklists();
  carregarNotificacoes();
  } finally {
    lancamentosManuaisEmAndamento.delete(tarefaIdChave);
  }
}

async function excluirTarefa(id) {
  if (!tarefasDisponiveis) {
    setMsg('msgTarefas', 'Recurso de tarefas indisponível. A tabela "tarefas" não existe no Supabase.', 'err');
    return;
  }
  const confirmacaoSenha = await abrirModalPin({
    titulo: 'Confirmação de exclusão',
    subtitulo: 'Digite a senha master para excluir a tarefa cadastrada.',
    textoAcao: 'Validar senha',
    exibirUsuario: false,
    placeholderInput: 'Digite a senha master'
  });
  if (!confirmacaoSenha?.pin) {
    setMsg('msgTarefas', 'Exclusão cancelada.', 'err');
    return;
  }

  if (!(await validarSenhaMasterParaExclusao(confirmacaoSenha.pin))) {
    setMsg('msgTarefas', 'Senha master inválida. Exclusão cancelada.', 'err');
    return;
  }

  if (!confirm('Excluir esta tarefa?')) return;

  try {
    const { error: errLanc } = await sb.from('checklist_lancamentos').delete().eq('tarefa_id', id);
    if (errLanc && !isMissingLancamentosTableError(errLanc)) {
      throw errLanc;
    }

    const { error: errExec } = await sb.from('checklist_execucoes').update({ tarefa_id: null }).eq('tarefa_id', id);
    if (errExec) {
      throw errExec;
    }

    const { error: errDel } = await sb.from('tarefas').delete().eq('id', id);
    if (errDel) {
      throw errDel;
    }
  } catch (error) {
    console.error('Erro ao excluir tarefa:', error);
    setMsg('msgTarefas', `Não foi possível excluir a tarefa: ${error.message}`, 'err');
    return;
  }

  if (tarefaEmEdicaoId === id) {
    limparFormularioTarefa();
  }
  setMsg('msgTarefas', 'Tarefa excluída.', 'ok');
  carregarTarefas();
  carregarChecklistsTarefas();
  carregarChecklists();
}

async function toggleTarefa(id, ativo) {
  if (!tarefasDisponiveis) {
    setMsg('msgTarefas', 'Recurso de tarefas indisponível. A tabela "tarefas" não existe no Supabase.', 'err');
    return;
  }
  await sb.from('tarefas').update({ ativo: !ativo }).eq('id', id);
  carregarTarefas();
}

//
