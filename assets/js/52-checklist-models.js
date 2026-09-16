// MODELOS FIXOS E ASSISTENTE DE PROGRAMAÇÃO DE CHECKLIST
let modelosChecklistCache = [];
let modeloChecklistEmEdicaoId = '';
let conferenciaAgendamentoAtual = null;

async function carregarModelosChecklist() {
  const lojaId = String(obterLojaIdSessao?.() || usuarioSistemaLogado?.loja_id || '').trim();
  let query = sb.from('checklists').select('id,nome,descricao,loja_id,empresa_id,created_at').order('nome');
  if (lojaId) query = query.eq('loja_id', lojaId);
  const { data, error } = await query;
  if (error) {
    setMsg('msgModelosChecklist', `Erro ao carregar modelos: ${mensagemErroSupabase(error, 'erro desconhecido')}`, 'err');
    return;
  }
  modelosChecklistCache = data || [];
  preencherSelectModelosAgendamento();
  renderizarModelosChecklist();
}

function preencherSelectModelosAgendamento() {
  const select = document.getElementById('modeloChecklistAgendamento');
  if (!select) return;
  const atual = select.value;
  select.innerHTML = '<option value="">Selecione um modelo cadastrado</option>' + modelosChecklistCache
    .map(modelo => `<option value="${escaparHtmlBasico(modelo.id)}">${escaparHtmlBasico(modelo.nome)}</option>`).join('');
  if (modelosChecklistCache.some(item => String(item.id) === atual)) select.value = atual;
  atualizarResumoModeloAgendamento();
}

function atualizarResumoModeloAgendamento() {
  const id = String(document.getElementById('modeloChecklistAgendamento')?.value || '');
  const modelo = modelosChecklistCache.find(item => String(item.id) === id);
  const resumo = document.getElementById('resumoModeloAgendamento');
  if (resumo) resumo.textContent = modelo?.descricao || (modelo ? 'Modelo sem orientação complementar.' : 'Selecione um modelo para visualizar sua orientação.');
}

function renderizarModelosChecklist() {
  const lista = document.getElementById('listaModelosChecklist');
  if (!lista) return;
  if (!modelosChecklistCache.length) {
    lista.innerHTML = '<div class="empty">Nenhum modelo cadastrado nesta loja.</div>';
    return;
  }
  lista.innerHTML = `<div class="lista">${modelosChecklistCache.map(modelo => `
    <div class="item"><div class="item-info"><div class="item-nome">${escaparHtmlBasico(modelo.nome)}</div><div class="item-detalhe">${escaparHtmlBasico(modelo.descricao || 'Sem orientação')}</div></div>
    <div class="item-actions"><button class="btn btn-ghost btn-sm" type="button" onclick="editarModeloChecklist('${modelo.id}')">Editar</button><button class="btn btn-red btn-sm" type="button" onclick="excluirModeloChecklist('${modelo.id}')">Excluir</button></div></div>`).join('')}</div>`;
}

async function salvarModeloChecklist() {
  const nome = String(document.getElementById('nomeModeloChecklist')?.value || '').trim();
  const descricao = String(document.getElementById('descricaoModeloChecklist')?.value || '').trim();
  if (!nome || !descricao) { setMsg('msgModelosChecklist', 'Informe o nome e a orientação fixa do modelo.', 'err'); return; }
  let tenant;
  try { tenant = await resolverTenantCadastroChecklist(); }
  catch (error) { setMsg('msgModelosChecklist', mensagemErroSupabase(error, 'Não foi possível identificar a loja.'), 'err'); return; }
  const payload = { nome, descricao, ...tenant };
  const resposta = modeloChecklistEmEdicaoId
    ? await sb.from('checklists').update(payload).eq('id', modeloChecklistEmEdicaoId)
    : await sb.from('checklists').insert([payload]);
  if (resposta.error) { setMsg('msgModelosChecklist', `Não foi possível salvar: ${mensagemErroSupabase(resposta.error, 'erro desconhecido')}`, 'err'); return; }
  limparFormularioModeloChecklist();
  setMsg('msgModelosChecklist', 'Modelo salvo. Ele já está disponível para novas programações.', 'ok');
  await carregarModelosChecklist();
}

function editarModeloChecklist(id) {
  const modelo = modelosChecklistCache.find(item => String(item.id) === String(id));
  if (!modelo) return;
  modeloChecklistEmEdicaoId = String(id);
  document.getElementById('nomeModeloChecklist').value = modelo.nome || '';
  document.getElementById('descricaoModeloChecklist').value = modelo.descricao || '';
  document.getElementById('tituloModeloChecklist').textContent = 'Editar modelo fixo';
  document.getElementById('btnSalvarModeloChecklist').textContent = 'Salvar alterações';
  document.getElementById('nomeModeloChecklist').focus();
}

function limparFormularioModeloChecklist() {
  modeloChecklistEmEdicaoId = '';
  const nome = document.getElementById('nomeModeloChecklist');
  const descricao = document.getElementById('descricaoModeloChecklist');
  if (nome) nome.value = '';
  if (descricao) descricao.value = '';
  const titulo = document.getElementById('tituloModeloChecklist');
  const botao = document.getElementById('btnSalvarModeloChecklist');
  if (titulo) titulo.textContent = 'Novo modelo fixo';
  if (botao) botao.textContent = 'Cadastrar modelo';
}

async function excluirModeloChecklist(id) {
  const { count } = await sb.from('tarefas').select('id', { count: 'exact', head: true }).eq('checklist_id', id);
  if (Number(count || 0) > 0) { setMsg('msgModelosChecklist', 'Este modelo possui programação vinculada. Exclua a programação na Listagem de checklist primeiro.', 'err'); return; }
  if (!confirm('Excluir este modelo fixo?')) return;
  const { error } = await sb.from('checklists').delete().eq('id', id);
  if (error) { setMsg('msgModelosChecklist', `Não foi possível excluir: ${mensagemErroSupabase(error, 'erro desconhecido')}`, 'err'); return; }
  setMsg('msgModelosChecklist', 'Modelo excluído.', 'ok');
  await carregarModelosChecklist();
}

function obterDadosAgendamentoFormulario() {
  const modeloId = String(document.getElementById('modeloChecklistAgendamento')?.value || '');
  const funcionarioId = String(document.getElementById('funcionarioTarefa')?.value || '');
  const horario = horaCurta(document.getElementById('horarioChecklistAgendamento')?.value || '');
  const intervalo = Math.max(1, Math.min(365, parseInt(document.getElementById('intervaloChecklistAgendamento')?.value || '1', 10) || 1));
  const duracao = Math.max(1, Math.min(365, parseInt(document.getElementById('duracaoChecklistAgendamento')?.value || '7', 10) || 7));
  const dias = obterDiasSelecionados();
  return { modeloId, funcionarioId, horario, intervalo, duracao, dias };
}

function abrirConferenciaAgendamentoChecklist() {
  const dados = obterDadosAgendamentoFormulario();
  const modelo = modelosChecklistCache.find(item => String(item.id) === dados.modeloId);
  const funcionario = funcionariosAtivosTarefa.find(item => String(item.id) === dados.funcionarioId);
  if (!modelo) { setMsg('msgTarefas', 'Selecione o modelo da tarefa.', 'err'); return; }
  if (!funcionario) { setMsg('msgTarefas', 'Selecione o funcionário responsável.', 'err'); return; }
  if (!dados.dias.length) { setMsg('msgTarefas', 'Selecione ao menos um dia da semana.', 'err'); return; }
  if (!dados.horario) { setMsg('msgTarefas', 'Informe o horário limite.', 'err'); return; }
  conferenciaAgendamentoAtual = { ...dados, modelo, funcionario };
  const overlay = document.getElementById('conferenciaAgendamentoOverlay');
  document.getElementById('conferenciaAgendamentoConteudo').innerHTML = `
    <div class="conferencia-checklist-grid"><div><span>Modelo</span><strong>${escaparHtmlBasico(modelo.nome)}</strong></div><div><span>Funcionário</span><strong>${escaparHtmlBasico(funcionario.nome)}</strong></div><div><span>Dias</span><strong>${escaparHtmlBasico(formatarDias(dados.dias.length === 7 ? 'todos' : dados.dias.join(',')))}</strong></div><div><span>Horário limite</span><strong>${escaparHtmlBasico(dados.horario)}</strong></div><div><span>Intervalo</span><strong>A cada ${dados.intervalo} dia(s) corrido(s)</strong></div><div><span>Duração</span><strong>${dados.duracao} dia(s) de horizonte</strong></div></div>
    <div class="checklist-modelo-resumo"><strong>Orientação:</strong> ${escaparHtmlBasico(modelo.descricao || 'Sem orientação')}</div>`;
  overlay?.classList.add('show');
}

function fecharConferenciaAgendamentoChecklist() { document.getElementById('conferenciaAgendamentoOverlay')?.classList.remove('show'); }

async function confirmarAgendamentoChecklist() {
  const dados = conferenciaAgendamentoAtual;
  if (!dados) return;
  let tenant;
  try { tenant = await resolverTenantCadastroChecklist(); }
  catch (error) { setMsg('msgConferenciaAgendamento', mensagemErroSupabase(error, 'Loja não identificada.'), 'err'); return; }
  const ator = obterAtorAuditoriaAtual();
  const diasTexto = dados.dias.length === 7 ? 'todos' : dados.dias.join(',');
  const { data, error } = await sb.from('tarefas').insert([{
    nome: dados.modelo.nome, descricao: dados.modelo.descricao || null, checklist_id: dados.modelo.id,
    funcionario_id: dados.funcionarioId, horario_limite: null, dias_semana: diasTexto,
    criado_por_id: ator.funcionarioId, criado_por_nome: ator.nome, ativo: true, lancada_checklist: false, ...tenant,
  }]).select('id').single();
  if (error || !data?.id) { setMsg('msgConferenciaAgendamento', `Não foi possível preparar a programação: ${mensagemErroSupabase(error, 'erro desconhecido')}`, 'err'); return; }
  selecaoFuncionarioLancamentoPorTarefa[data.id] = dados.funcionarioId;
  horarioLancamentoPorTarefa[data.id] = dados.horario;
  diasLancamentoPorTarefa[data.id] = [...dados.dias];
  intervaloLancamentoPorTarefa[data.id] = dados.intervalo;
  duracaoLancamentoPorTarefa[data.id] = dados.duracao;
  fecharConferenciaAgendamentoChecklist();
  const lancou = await lancarTarefa(data.id, dados.funcionarioId, dados.horario, diasTexto);
  if (!lancou) {
    await sb.from('tarefas').delete().eq('id', data.id);
    setMsg('msgTarefas', 'A programação não foi salva porque o lançamento foi cancelado ou não gerou nenhuma ocorrência.', 'err');
    return;
  }
  limparAgendamentoChecklist();
  setMsg('msgTarefas', 'Checklist programado com sucesso. Consulte todas as ocorrências na Listagem de checklist.', 'ok');
}

function limparAgendamentoChecklist() {
  const ids = ['modeloChecklistAgendamento','funcionarioTarefa','horarioChecklistAgendamento'];
  ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const intervalo = document.getElementById('intervaloChecklistAgendamento'); if (intervalo) intervalo.value = '1';
  const duracao = document.getElementById('duracaoChecklistAgendamento'); if (duracao) duracao.value = '7';
  marcarTodosDias(); conferenciaAgendamentoAtual = null; atualizarResumoModeloAgendamento(); setMsg('msgTarefas', '', '');
}

function abrirInfoRepeticaoChecklist() {
  abrirConfirmacaoSistema({ title:'Como funciona a repetição', subtitle:'As regras atuais foram mantidas', body:'<p><strong>Dias da semana:</strong> somente os dias marcados podem gerar ocorrências.</p><p><strong>A cada X dias:</strong> conta dias corridos a partir da primeira data válida. Ex.: 7 mantém o mesmo dia semanal; 14 alterna semanas.</p><p><strong>Durante X dias:</strong> define o horizonte contado a partir de hoje, com limite de 365 dias.</p><p>Se o horário de hoje já passou ou o responsável está fora do turno cadastrado, hoje é ignorado e o próximo ciclo válido é usado. O sistema também avisa quando existe outra tarefa para o mesmo funcionário em uma janela de 20 minutos.</p>', confirmText:'Entendi', cancelText:'Fechar' });
}

function abrirInfoModeloChecklist() {
  abrirConfirmacaoSistema({ title:'Modelo fixo de checklist', subtitle:'Uma biblioteca reutilizável por loja', body:'<p>O modelo guarda somente o nome e a orientação permanente da atividade. Ele não cria datas, repetições ou responsáveis.</p><p>Use “Cadastro de checklist” para programar o modelo para um funcionário.</p>', confirmText:'Entendi', cancelText:'Fechar' });
}
