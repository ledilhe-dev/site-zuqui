// ---- NAVIGATION ----
const topTitles = {
  meu_painel: ['Meu Painel', 'Dashboard personalizado'],
  dashboard: ['Dashboard', 'Visao geral do sistema'],
  checklists: ['Iniciar checklist', 'Fila pronta para iniciar'],
  bater_ponto: ['Bater ponto', 'Registro de entrada, intervalo e saída'],
  escala_plantoes: ['Escalas', 'Calendário de trabalho, folgas, domingos e feriados'],
  relatorio_plantao: ['Relatório escala/plantões', 'Plantões lançados, valores combinados e exportações'],
  relatorio_ponto: ['Relatório ponto', 'Consulta de registros por funcionário e período'],
  ponto_ajustes: ['Solicitações de ajuste de ponto', 'Aprovação de pedidos de correção de batida'],
  relatorio_lancamentos: ['Relatório de tarefas', 'Histórico completo de lançamentos e execuções'],
  relatorio_tarefas_cadastradas: ['Relatório de tarefas cadastradas', 'O que está cadastrado: quem cadastrou, período e repetição'],
  relatorio_financeiro: ['Relatório de contas a pagar', 'Análise detalhada de títulos e pagamentos'],
  relatorio_recebimentos: ['Relatório de recebimentos', 'Entradas com usuário e horário de lançamento'],
  relatorio_ajuste_saldo: ['Relatório ajuste de saldo', 'Histórico de ajustes manuais de saldo por conta'],
  financeiro_fornecedores: ['Cadastro de fornecedor', 'Base de fornecedores do financeiro'],
  financeiro_formas_pagamento: ['Formas de pagamento', 'Cadastros utilizados na baixa de títulos'],
  financeiro_contasapagar: ['Cadastro de contas a pagar', 'Lançamentos financeiros por fornecedor'],
  financeiro_baixar_contas: ['Baixar contas', 'Confirmação e ajustes de pagamento'],
  financeiro_conta_financeira: ['Conta financeira', 'Cadastro de contas e extrato de entradas'],
  financeiro_recebiveis: ['Recebíveis', 'Cadastro de pagadores e formas de pagamento'],
  financeiro_grupo_fornecedor: ['Grupos de Fornecedor', 'Agrupe fornecedores por empresa ou holding'],
  financeiro_categorias_compra: ['Categorias de Compra', 'Classifique os lançamentos por categoria'],
  tela_preferida_login: ['Tela de Login Preferida', 'Configure a tela inicial por loja ou usuário'],
  financeiro_cofre: ['Cofre', 'Recebimentos lançados em recebíveis'],
  itens: ['Itens do Checklist', 'Itens por modelo'],
  funcionarios: ['Funcionarios', 'Gestao de equipe'],
  solicitacoes: ['Solicitacoes de acesso', 'Aprove ou rejeite pedidos de entrada'],
  emails: ['Cadastro de envio de e-mail', 'Destinatarios para notificacoes'],
  empresas_saas: ['Empresas / Clientes', 'Cadastro de empresas para vender o sistema'],
  lojas_saas: ['Lojas por empresa', 'Filiais, feriados e configurações'],
  perfis: ['Perfis', 'Permissoes de acesso do sistema'],
  tarefas: ['Cadastro de Checklist', 'Gerenciamento (Admin)'],
  tarefas_rapidas: ['Alertas rápidas', 'Avisos pontuais para a equipe'],
  execucoes: ['Checklist em andamento', 'Pause, retome e finalize tarefas'],
  tarefas_atraso: ['Checklist em atraso', 'Pendências fora do prazo'],
};

function paginaPertenceMenuChecklist(pageId = '') {
  return ['checklists', 'execucoes', 'tarefas_atraso', 'tarefas'].includes(String(pageId || ''));
}

function paginaPertenceMenuRelatorios(pageId = '') {
  return ['relatorio_ponto', 'relatorio_plantao', 'relatorio_lancamentos', 'relatorio_financeiro', 'relatorio_recebimentos', 'relatorio_ajuste_saldo'].includes(String(pageId || ''));
}

function paginaPertenceMenuFinanceiro(pageId = '') {
  return ['financeiro_fornecedores', 'financeiro_formas_pagamento', 'financeiro_contasapagar', 'financeiro_baixar_contas', 'financeiro_conta_financeira', 'financeiro_recebiveis', 'financeiro_grupo_fornecedor', 'financeiro_categorias_compra', 'financeiro_cofre'].includes(String(pageId || ''));
}

function paginaPertenceMenuFuncionarios(pageId = '') {
  return ['funcionarios', 'ponto_ajustes', 'perfis'].includes(String(pageId || ''));
}

function paginaPertenceMenuConfiguracoes(pageId = '') {
  return ['solicitacoes', 'emails', 'forcar_atualizacao_geral'].includes(String(pageId || ''));
}

function paginaPertenceMenuSaas(pageId = '') {
  return ['empresas_saas', 'lojas_saas'].includes(String(pageId || ''));
}

function atualizarEstadoMenuChecklist(expandido = false) {
  const grupo = document.getElementById('menuChecklistGroup');
  if (!grupo) return;
  grupo.classList.toggle('open', !!expandido);
}

function atualizarEstadoMenuRelatorios(expandido = false) {
  const grupo = document.getElementById('menuRelatoriosGroup');
  if (!grupo) return;
  grupo.classList.toggle('open', !!expandido);
}

function atualizarEstadoMenuFinanceiro(expandido = false) {
  const grupo = document.getElementById('menuFinanceiroGroup');
  if (!grupo) return;
  grupo.classList.toggle('open', !!expandido);
}

function atualizarEstadoMenuFuncionarios(expandido = false) {
  const grupo = document.getElementById('menuFuncionariosGroup');
  if (!grupo) return;
  grupo.classList.toggle('open', !!expandido);
}

function atualizarEstadoMenuConfiguracoes(expandido = false) {
  const grupo = document.getElementById('menuConfiguracoesGroup');
  if (!grupo) return;
  grupo.classList.toggle('open', !!expandido);
}

function atualizarEstadoMenuSaas(expandido = false) {
  const grupo = document.getElementById('menuSaasGroup');
  if (!grupo) return;
  grupo.classList.toggle('open', !!expandido);
}

function toggleMenuChecklistSubmenu() {
  const grupo = document.getElementById('menuChecklistGroup');
  if (!grupo) return;
  grupo.classList.toggle('open');
}

function toggleMenuRelatoriosSubmenu() {
  const grupo = document.getElementById('menuRelatoriosGroup');
  if (!grupo) return;
  grupo.classList.toggle('open');
}

function toggleMenuFinanceiroSubmenu() {
  const grupo = document.getElementById('menuFinanceiroGroup');
  if (!grupo) return;
  grupo.classList.toggle('open');
}

function toggleMenuFuncionariosSubmenu() {
  const grupo = document.getElementById('menuFuncionariosGroup');
  if (!grupo) return;
  grupo.classList.toggle('open');
}

function toggleMenuConfiguracoesSubmenu() {
  const grupo = document.getElementById('menuConfiguracoesGroup');
  if (!grupo) return;
  grupo.classList.toggle('open');
}

function toggleMenuSaasSubmenu() {
  const grupo = document.getElementById('menuSaasGroup');
  if (!grupo) return;
  grupo.classList.toggle('open');
}

function fecharMenusLaterais() {
  atualizarEstadoMenuChecklist(false);
  atualizarEstadoMenuRelatorios(false);
  atualizarEstadoMenuFinanceiro(false);
  atualizarEstadoMenuFuncionarios(false);
  atualizarEstadoMenuConfiguracoes(false);
  atualizarEstadoMenuSaas(false);
}

function configurarAberturaAutomaticaDatePicker() {
  document.querySelectorAll('input[type="date"]').forEach((input) => {
    if (input.dataset.pickerAuto === '1') return;
    input.dataset.pickerAuto = '1';
    const abrir = () => {
      try {
        if (typeof input.showPicker === 'function') input.showPicker();
      } catch (e) {}
    };
    input.addEventListener('click', abrir);
    input.addEventListener('focus', abrir);
  });
}

function closeMobileMenu() {
  document.body.classList.remove('mobile-nav-open');
  document.querySelector('.sidebar')?.classList.remove('open');
}

function toggleMobileMenu() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;
  const aberto = sidebar.classList.toggle('open');
  document.body.classList.toggle('mobile-nav-open', aberto);
}

function atualizarBotaoDesktopSidebar() {
  const botao = document.getElementById('sidebarCollapseToggle');
  if (!botao) return;
  const recolhido = document.body.classList.contains('sidebar-collapsed');
  botao.textContent = recolhido ? '›' : '‹';
  botao.setAttribute('aria-expanded', String(!recolhido));
  botao.setAttribute('aria-label', recolhido ? 'Mostrar menu lateral' : 'Esconder menu lateral');
  botao.title = recolhido ? 'Mostrar menu lateral' : 'Esconder menu lateral';
}

function toggleDesktopSidebar() {
  const recolhido = document.body.classList.toggle('sidebar-collapsed');
  try { localStorage.setItem('checkdiario:sidebar-recolhida', recolhido ? '1' : '0'); } catch (_) {}
  atualizarBotaoDesktopSidebar();
}

function inicializarDesktopSidebar() {
  let recolhido = false;
  try { recolhido = localStorage.getItem('checkdiario:sidebar-recolhida') === '1'; } catch (_) {}
  document.body.classList.toggle('sidebar-collapsed', recolhido);
  atualizarBotaoDesktopSidebar();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', inicializarDesktopSidebar);
} else {
  inicializarDesktopSidebar();
}

function forcarCampoObservacaoTarefaEmBranco() {
  const campo = document.getElementById('descTarefa');
  if (!campo) return;
  if (!tarefaEmEdicaoId) {
    campo.value = '';
  }
}

function desbloquearCampoDescricaoTarefa(campo) {
  if (!campo) return;
  campo.removeAttribute('readonly');
  if (!tarefaEmEdicaoId) {
    campo.value = '';
  }
}

function forcarCampoBuscaTarefasEmBranco() {
  const campo = document.getElementById('filtroTarefasNome');
  if (!campo) return;
  if (filtroTarefasNomeEditado) return;
  campo.value = '';
  campo.removeAttribute('value');
}

function marcarCampoBuscaTarefasComoEditado(campo = null) {
  const input = campo || document.getElementById('filtroTarefasNome');
  if (!input) return;
  filtroTarefasNomeEditado = String(input.value || '').trim().length > 0;
}

function desbloquearCampoBuscaTarefas(campo) {
  if (!campo) return;
  campo.removeAttribute('readonly');
  if (!filtroTarefasNomeEditado) {
    campo.value = '';
    campo.removeAttribute('value');
  }
}

function redefinirCampoBuscaTarefas() {
  filtroTarefasNomeEditado = false;
  const campo = document.getElementById('filtroTarefasNome');
  if (!campo) return;
  campo.value = '';
  campo.removeAttribute('value');
  campo.setAttribute('readonly', 'readonly');
  window.setTimeout(() => forcarCampoBuscaTarefasEmBranco(), 50);
  window.setTimeout(() => forcarCampoBuscaTarefasEmBranco(), 400);
  window.setTimeout(() => forcarCampoBuscaTarefasEmBranco(), 1200);
}


let escalaPlantoesDataReferencia = new Date();
let escalaPlantoesEventos = [];
let escalaPlantoesDataSelecionada = '';
let escalaPlantoesFuncionariosCache = [];

function doisDigitosEscala(valor){return String(valor).padStart(2,'0');}
function formatarDataIsoLocalEscala(data){return `${data.getFullYear()}-${doisDigitosEscala(data.getMonth()+1)}-${doisDigitosEscala(data.getDate())}`;}
function calcularPascoaEscala(ano){const a=ano%19,b=Math.floor(ano/100),c=ano%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),mes=Math.floor((h+l-7*m+114)/31),dia=((h+l-7*m+114)%31)+1;return new Date(ano,mes-1,dia);}
function adicionarDiasEscala(data,dias){const nova=new Date(data);nova.setDate(nova.getDate()+Number(dias||0));return nova;}
function obterFeriadosNacionaisEscala(ano){const pascoa=calcularPascoaEscala(ano);return [{data:`${ano}-01-01`,nome:'Confraternização Universal'},{data:`${ano}-04-21`,nome:'Tiradentes'},{data:`${ano}-05-01`,nome:'Dia do Trabalhador'},{data:`${ano}-09-07`,nome:'Independência do Brasil'},{data:`${ano}-10-12`,nome:'Nossa Senhora Aparecida'},{data:`${ano}-11-02`,nome:'Finados'},{data:`${ano}-11-15`,nome:'Proclamação da República'},{data:`${ano}-11-20`,nome:'Consciência Negra'},{data:`${ano}-12-25`,nome:'Natal'},{data:formatarDataIsoLocalEscala(adicionarDiasEscala(pascoa,-48)),nome:'Carnaval'},{data:formatarDataIsoLocalEscala(adicionarDiasEscala(pascoa,-47)),nome:'Carnaval'},{data:formatarDataIsoLocalEscala(adicionarDiasEscala(pascoa,-2)),nome:'Sexta-feira Santa'},{data:formatarDataIsoLocalEscala(adicionarDiasEscala(pascoa,60)),nome:'Corpus Christi'}].reduce((acc,item)=>{acc[item.data]=item.nome;return acc;},{});}
function obterInicioFimMesEscala(){const ref=escalaPlantoesDataReferencia||new Date(),ano=ref.getFullYear(),mes=ref.getMonth();return {inicio:formatarDataIsoLocalEscala(new Date(ano,mes,1)),fim:formatarDataIsoLocalEscala(new Date(ano,mes+1,0))};}
function normalizarHoraEscala(valor){return String(valor||'').slice(0,5);}
function formatarDataBRSimplesEscala(dataIso){const [a,m,d]=String(dataIso||'').split('-');return d&&m&&a?`${d}/${m}/${a}`:String(dataIso||'');}
function isMissingEscalaPlantoesTableError(error){const msg=String(error?.message||error?.details||error?.hint||error?.code||'').toLowerCase(); if(msg.includes('empresa_id') || msg.includes('loja_id') || msg.includes('column')) return false; return msg.includes('could not find the table') || (msg.includes('relation') && msg.includes('escala_plantoes') && msg.includes('does not exist')) || msg.includes('schema cache');}

async function carregarEscalaPlantoes(){
  if(!(escalaPlantoesDataReferencia instanceof Date)||Number.isNaN(escalaPlantoesDataReferencia.getTime()))escalaPlantoesDataReferencia=new Date();
  // Renderiza primeiro para nunca deixar a tela presa em "Carregando calendário".
  renderizarEscalaPlantoes();
  try {
    await carregarPlantoesEscalaMes();
  } catch (error) {
    escalaPlantoesEventos = [];
    setMsg('msgEscalaPlantoes', `Erro ao carregar calendário: ${mensagemErroSupabase(error, 'erro desconhecido')}`, 'err');
  }
  renderizarEscalaPlantoes();
}
function mudarMesEscalaPlantoes(delta){escalaPlantoesDataReferencia=new Date(escalaPlantoesDataReferencia.getFullYear(),escalaPlantoesDataReferencia.getMonth()+Number(delta||0),1);carregarEscalaPlantoes();}
function irParaHojeEscalaPlantoes(){escalaPlantoesDataReferencia=new Date();carregarEscalaPlantoes();}

async function carregarPlantoesEscalaMes(){
  const { inicio, fim } = obterInicioFimMesEscala();
  let query = sb
    .from('escala_plantoes')
    .select('*')
    .gte('data_plantao', inicio)
    .lte('data_plantao', fim)
    .is('deleted_at', null)
    .order('data_plantao', { ascending: true })
    .order('inicio_hora', { ascending: true });
  const lojaId = String(obterLojaIdSessao?.() || usuarioSistemaLogado?.loja_id || '').trim();
  if (lojaId) query = query.eq('loja_id', lojaId);
  const { data, error } = await query;
  if (error) {
    escalaPlantoesEventos = [];
    if (isMissingEscalaPlantoesTableError(error)) {
      setMsg('msgEscalaPlantoes','Rode o SQL da tabela escala_plantoes para salvar e exibir plantões.','err');
    } else {
      setMsg('msgEscalaPlantoes',`Erro ao carregar plantões: ${mensagemErroSupabase(error,'erro desconhecido')}`,'err');
    }
    return;
  }
  const eventos = data || [];
  const idsFuncionarios = [...new Set(eventos.map(item => item.funcionario_id).filter(Boolean))];
  if (idsFuncionarios.length) {
    try {
      let queryFunc = sb.from('funcionarios').select('id, nome').in('id', idsFuncionarios);
      queryFunc = aplicarFiltroLojaFuncionariosQuery(queryFunc);
      const { data: funcs, error: erroFuncs } = await queryFunc;
      if (!erroFuncs) {
        const nomes = Object.fromEntries((funcs || []).map(f => [String(f.id), f.nome || 'Funcionário']));
        eventos.forEach(item => { item.funcionario_nome = nomes[String(item.funcionario_id)] || item.titulo || 'Funcionário'; });
      }
    } catch (e) {
      console.warn('Não foi possível anexar nomes dos funcionários à escala:', e);
    }
  }
  escalaPlantoesEventos = eventos;
}

function agruparEventosEscalaPorDia(){
  return (escalaPlantoesEventos||[]).reduce((acc,item)=>{
    const dataIso=String(item.data_plantao||'').slice(0,10);
    if(!dataIso)return acc;
    if(!acc[dataIso])acc[dataIso]=[];
    acc[dataIso].push(item);
    return acc;
  },{});
}


async function obterLojaAtivaAtualParaEscala() {
  const nomeTopbar = String(document.getElementById('topbar-store-name')?.textContent || '').trim();
  const empresaIdSessao = String(obterEmpresaIdSessao?.() || usuarioSistemaLogado?.empresa_id || '').trim();
  const buscarLoja = async (q) => {
    try {
      const r = await executarSemFiltroLojaTemporario(() => q.maybeSingle());
      if (!r.error && r.data?.id && r.data.ativo !== false) return r.data;
    } catch (_) {}
    return null;
  };
  if (nomeTopbar && nomeTopbar !== '-') {
    let loja = await buscarLoja(sb.from('lojas').select('id, nome, ativo, empresa_id').eq('ativo', true).ilike('nome', nomeTopbar).limit(1));
    if (loja?.id) return loja;
    loja = await buscarLoja(sb.from('lojas').select('id, nome, ativo, empresa_id').eq('ativo', true).ilike('nome', `%${nomeTopbar}%`).limit(1));
    if (loja?.id) return loja;
  }
  const lojaIdSessao = String(obterLojaIdSessao?.() || usuarioSistemaLogado?.loja_id || '').trim();
  if (lojaIdSessao) {
    let q = sb.from('lojas').select('id, nome, ativo, empresa_id').eq('id', lojaIdSessao).eq('ativo', true).limit(1);
    if (empresaIdSessao) q = q.eq('empresa_id', empresaIdSessao);
    const loja = await buscarLoja(q);
    if (loja?.id) return loja;
    return { id: lojaIdSessao, empresa_id: empresaIdSessao || null, ativo: true };
  }
  return null;
}

async function carregarFuncionariosSelectEscala(){
  const select=document.getElementById('escalaPlantaoFuncionario');
  if(!select)return;
  const lojaAtual = await obterLojaAtivaAtualParaEscala();
  const lojaId=String(lojaAtual?.id || '').trim();
  if(!lojaId){
    escalaPlantoesFuncionariosCache=[];
    select.innerHTML='<option value="">Loja logada não identificada</option>';
    setMsg('msgModalEscalaPlantao','Não foi possível identificar a loja logada para carregar funcionários da escala.','err');
    return;
  }
  const { data, error } = await executarSemFiltroLojaTemporario(() => sb
    .from('funcionarios')
    .select('id, nome, loja_id, empresa_id, ativo')
    .eq('ativo', true)
    .eq('loja_id', lojaId)
    .order('nome'));
  if(error){
    escalaPlantoesFuncionariosCache=[];
    select.innerHTML='<option value="">Erro ao carregar funcionários</option>';
    setMsg('msgModalEscalaPlantao',`Erro ao carregar funcionários da filial logada: ${mensagemErroSupabase(error,'erro desconhecido')}`,'err');
    return;
  }
  const funcionariosFiltrados=(data||[]).filter(f => String(f.loja_id||'') === lojaId && f.ativo === true);
  escalaPlantoesFuncionariosCache=funcionariosFiltrados;
  select.innerHTML='<option value="">Selecione...</option>'+funcionariosFiltrados.map(f=>`<option value="${escapeHtml(f.id)}">${escapeHtml(f.nome||'Funcionário')}</option>`).join('');
}

async function abrirModalCadastroPlantaoEscala(dataIso=''){
  escalaPlantoesDataSelecionada=dataIso || formatarDataIsoLocalEscala(escalaPlantoesDataReferencia || new Date());
  const modal=document.getElementById('modalEscalaPlantao');
  const dataTexto=document.getElementById('escalaModalDataTexto');
  const eventoId=document.getElementById('escalaPlantaoEventoId');
  if(eventoId) eventoId.value='';
  if(dataTexto)dataTexto.textContent=`Data selecionada: ${formatarDataBRSimplesEscala(escalaPlantoesDataSelecionada)}`;
  ['escalaPlantaoInicio','escalaPlantaoFim','escalaPlantaoTitulo','escalaPlantaoValor','escalaPlantaoObservacao'].forEach(id=>{const el=document.getElementById(id); if(el)el.value='';});
  const tipo=document.getElementById('escalaPlantaoTipo'); if(tipo)tipo.value='plantao';
  const btnExcluir=document.getElementById('btnExcluirPlantaoEscala'); if(btnExcluir) btnExcluir.style.display='none';
  const btnSalvar=document.getElementById('btnSalvarPlantaoEscala'); if(btnSalvar) btnSalvar.textContent='Salvar escala';
  setMsg('msgModalEscalaPlantao','','');
  await carregarFuncionariosSelectEscala();
  renderizarItensDiaModalEscala();
  modal?.classList.add('show');
  modal?.setAttribute('aria-hidden','false');
}
function fecharModalCadastroPlantaoEscala(){
  const modal=document.getElementById('modalEscalaPlantao');
  modal?.classList.remove('show');
  modal?.setAttribute('aria-hidden','true');
}

async function salvarPlantaoEscala(){
  const eventoId=String(document.getElementById('escalaPlantaoEventoId')?.value||'').trim();
  const funcionarioId=String(document.getElementById('escalaPlantaoFuncionario')?.value||'').trim();
  const inicio=String(document.getElementById('escalaPlantaoInicio')?.value||'').trim();
  const fim=String(document.getElementById('escalaPlantaoFim')?.value||'').trim();
  const tipo=String(document.getElementById('escalaPlantaoTipo')?.value||'plantao').trim();
  const titulo=String(document.getElementById('escalaPlantaoTitulo')?.value||'').trim();
  const observacao=String(document.getElementById('escalaPlantaoObservacao')?.value||'').trim();
  const valorRaw=String(document.getElementById('escalaPlantaoValor')?.value||'').replace(',','.').trim();
  const valorCombinado=valorRaw ? Number(valorRaw) : null;
  if(valorRaw && (!Number.isFinite(valorCombinado) || valorCombinado < 0)){setMsg('msgModalEscalaPlantao','Informe um valor combinado válido.','err');return;}
  if(!escalaPlantoesDataSelecionada){setMsg('msgModalEscalaPlantao','Selecione um dia no calendário.','err');return;}
  if(!funcionarioId){setMsg('msgModalEscalaPlantao','Selecione o funcionário.','err');return;}
  if(!inicio||!fim){setMsg('msgModalEscalaPlantao','Informe horário de início e fim.','err');return;}
  if(inicio>=fim){setMsg('msgModalEscalaPlantao','O horário final precisa ser maior que o horário inicial.','err');return;}
  const lojaId=String(obterLojaIdSessao?.() || usuarioSistemaLogado?.loja_id || '').trim() || null;
  const empresaId=String(obterEmpresaIdSessao?.() || usuarioSistemaLogado?.empresa_id || '').trim() || null;
  const payload={
    empresa_id: empresaId,
    loja_id: lojaId,
    funcionario_id: funcionarioId,
    data_plantao: escalaPlantoesDataSelecionada,
    inicio_hora: inicio,
    fim_hora: fim,
    tipo,
    titulo: titulo || (tipo === 'plantao' ? 'Plantão' : tipo === 'folga' ? 'Folga' : tipo === 'reuniao' ? 'Reunião' : 'Compromisso'),
    observacao: observacao || null,
    valor_combinado: valorCombinado,
  };
  let resposta;
  if(eventoId){
    let q=sb.from('escala_plantoes').update(payload).eq('id', eventoId);
    if(lojaId) q=q.eq('loja_id', lojaId);
    resposta=await q;
  } else {
    resposta=await sb.from('escala_plantoes').insert([payload]);
  }
  if(resposta.error){
    if(isMissingEscalaPlantoesTableError(resposta.error)) setMsg('msgModalEscalaPlantao','Rode o SQL da tabela escala_plantoes antes de salvar.','err');
    else setMsg('msgModalEscalaPlantao',`Não foi possível salvar: ${mensagemErroSupabase(resposta.error,'erro desconhecido')}`,'err');
    return;
  }
  fecharModalCadastroPlantaoEscala();
  setMsg('msgEscalaPlantoes', eventoId ? 'Escala atualizada no calendário.' : 'Escala salva no calendário.','ok');
  await carregarEscalaPlantoes();
}

function renderizarItensDiaModalEscala(){
  const lista=document.getElementById('escalaPlantaoListaDia');
  if(!lista)return;
  const itens=(escalaPlantoesEventos||[]).filter(item=>String(item.data_plantao||'').slice(0,10)===escalaPlantoesDataSelecionada);
  if(!itens.length){lista.innerHTML='<div class="escala-modal-empty">Nenhum compromisso lançado nesse dia.</div>';return;}
  lista.innerHTML=itens.map(item=>{
    const nome=escapeHtml(item.funcionario_nome||item.titulo||'Funcionário');
    const tipo=escapeHtml(item.tipo||'plantao');
    const valorTxt = item.valor_combinado != null ? ` · R$ ${Number(item.valor_combinado||0).toFixed(2).replace('.', ',')}` : '';
    const texto=`${normalizarHoraEscala(item.inicio_hora)} → ${normalizarHoraEscala(item.fim_hora)} · ${nome}${valorTxt}`;
    return `<button class="escala-modal-item" type="button" onclick="abrirModalEditarPlantaoEscala('${escapeHtml(item.id)}')"><strong>${escapeHtml(texto)}</strong><span>${tipo}</span></button>`;
  }).join('');
}

async function abrirModalEditarPlantaoEscala(id){
  const item=(escalaPlantoesEventos||[]).find(ev=>String(ev.id)===String(id));
  if(!item){setMsg('msgModalEscalaPlantao','Item da escala não encontrado.','err');return;}
  escalaPlantoesDataSelecionada=String(item.data_plantao||'').slice(0,10);
  await carregarFuncionariosSelectEscala();
  const eventoId=document.getElementById('escalaPlantaoEventoId'); if(eventoId) eventoId.value=item.id||'';
  const dataTexto=document.getElementById('escalaModalDataTexto'); if(dataTexto)dataTexto.textContent=`Editando: ${formatarDataBRSimplesEscala(escalaPlantoesDataSelecionada)}`;
  const funcionario=document.getElementById('escalaPlantaoFuncionario'); if(funcionario) funcionario.value=item.funcionario_id||'';
  const inicio=document.getElementById('escalaPlantaoInicio'); if(inicio) inicio.value=normalizarHoraEscala(item.inicio_hora);
  const fim=document.getElementById('escalaPlantaoFim'); if(fim) fim.value=normalizarHoraEscala(item.fim_hora);
  const tipo=document.getElementById('escalaPlantaoTipo'); if(tipo) tipo.value=item.tipo||'plantao';
  const titulo=document.getElementById('escalaPlantaoTitulo'); if(titulo) titulo.value=item.titulo||'';
  const valor=document.getElementById('escalaPlantaoValor'); if(valor) valor.value=(item.valor_combinado ?? '') === null ? '' : (item.valor_combinado ?? '');
  const obs=document.getElementById('escalaPlantaoObservacao'); if(obs) obs.value=item.observacao||'';
  const btnExcluir=document.getElementById('btnExcluirPlantaoEscala'); if(btnExcluir) btnExcluir.style.display='inline-flex';
  const btnSalvar=document.getElementById('btnSalvarPlantaoEscala'); if(btnSalvar) btnSalvar.textContent='Salvar alteração';
  renderizarItensDiaModalEscala();
  const modal=document.getElementById('modalEscalaPlantao'); modal?.classList.add('show'); modal?.setAttribute('aria-hidden','false');
}

async function excluirPlantaoEscala(){
  const id=String(document.getElementById('escalaPlantaoEventoId')?.value||'').trim();
  if(!id){setMsg('msgModalEscalaPlantao','Nenhum item selecionado para excluir.','err');return;}
  const respostaPin = typeof abrirModalPin === 'function'
    ? await abrirModalPin({ titulo:'Excluir escala', subtitulo:'Informe o PIN de um usuário autorizado.', textoUsuario:'Apenas perfis com permissão para excluir itens da Agenda podem confirmar.', textoAcao:'Excluir', placeholderInput:'PIN' })
    : { pin: window.prompt('Digite o PIN/senha para excluir:') };
  if(!respostaPin || !respostaPin.pin){setMsg('msgModalEscalaPlantao','Exclusão cancelada.','err');return;}
  const lojaId=String(obterLojaIdSessao?.() || usuarioSistemaLogado?.loja_id || '').trim();
  const autorizacaoExclusao = typeof validarPinExclusaoAgenda === 'function'
    ? await validarPinExclusaoAgenda(respostaPin.pin, lojaId)
    : { funcionario: null, motivo: 'pin_invalido' };
  const usuarioExclusao = autorizacaoExclusao.funcionario;
  if(!usuarioExclusao?.id){
    const texto = autorizacaoExclusao.motivo === 'sem_permissao'
      ? 'PIN reconhecido, mas este perfil não permite excluir itens da Agenda.'
      : 'PIN inválido ou usuário sem vínculo ativo com esta loja.';
    setMsg('msgModalEscalaPlantao', texto + ' A escala não foi excluída.','err');return;
  }
  let q=sb.from('escala_plantoes').update({
    deleted_at: new Date().toISOString(),
    deleted_by_funcionario_id: usuarioExclusao.id,
    deleted_by_nome: usuarioExclusao.nome || 'Funcionário',
    updated_at: new Date().toISOString()
  }).eq('id', id);
  if(lojaId) q=q.eq('loja_id', lojaId);
  const { error } = await q;
  if(error){setMsg('msgModalEscalaPlantao',`Não foi possível excluir: ${mensagemErroSupabase(error,'erro desconhecido')}. Rode o SQL dos campos de exclusão se ainda não rodou.`,'err');return;}
  fecharModalCadastroPlantaoEscala();
  setMsg('msgEscalaPlantoes',`Item excluído da escala por ${usuarioExclusao.nome || 'Funcionário'}.`,'ok');
  await carregarEscalaPlantoes();
}

function renderizarEscalaPlantoes(){
  const grid=document.getElementById('escalaCalendarioGrid'),titulo=document.getElementById('escalaMesTitulo');
  if(!grid||!titulo)return;
  const ref=escalaPlantoesDataReferencia||new Date();
  const ano=ref.getFullYear();
  const mes=ref.getMonth();
  const hojeIso=formatarDataIsoLocalEscala(new Date());
  const nomesMeses=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  titulo.textContent=`${nomesMeses[mes]} de ${ano}`;

  const exibirFeriados=document.getElementById('escalaFiltroFeriados')?.checked!==false;
  const exibirDomingos=document.getElementById('escalaFiltroDomingos')?.checked!==false;
  const feriados=obterFeriadosNacionaisEscala(ano);
  const primeiroDiaMes=new Date(ano,mes,1);
  const ultimoDiaMes=new Date(ano,mes+1,0);
  const diasNoMes=ultimoDiaMes.getDate();
  const primeiroDiaSemana=primeiroDiaMes.getDay();
  const diasSemana=['DOM.','SEG.','TER.','QUA.','QUI.','SEX.','SÁB.'];
  const eventosPorDia=agruparEventosEscalaPorDia();
  let html=diasSemana.map(nome=>`<div class="escala-dia-semana">${nome}</div>`).join('');

  // Células vazias antes do dia 1. Não mostra dias do mês anterior para evitar confusão.
  for(let i=0;i<primeiroDiaSemana;i++){
    html+=`<div class="escala-dia escala-dia-vazio" aria-hidden="true"></div>`;
  }

  for(let dia=1;dia<=diasNoMes;dia++){
    const data=new Date(ano,mes,dia);
    const dataIso=formatarDataIsoLocalEscala(data);
    const domingo=data.getDay()===0;
    const nomeFeriado=exibirFeriados?feriados[dataIso]:'';
    const eventos=eventosPorDia[dataIso]||[];
    const classes=['escala-dia',domingo&&exibirDomingos?'domingo':'',nomeFeriado?'feriado':'',dataIso===hojeIso?'hoje':''].filter(Boolean).join(' ');
    const feriadoHtml=nomeFeriado?`<div class="escala-feriado-label" title="${escapeHtml(nomeFeriado)}">${escapeHtml(nomeFeriado)}</div>`:'';
    const eventosHtml=eventos.slice(0,4).map(ev=>{
      const nome=ev.funcionario_nome||ev.titulo||'Funcionário';
      const valorTxt = ev.valor_combinado != null ? ` · R$ ${Number(ev.valor_combinado||0).toFixed(2).replace('.', ',')}` : '';
      const texto=`${normalizarHoraEscala(ev.inicio_hora)} ${nome}${valorTxt}`.trim();
      return `<button class="escala-evento ${escapeHtml(ev.tipo||'plantao')}" type="button" title="${escapeHtml(texto)}" onclick="event.stopPropagation(); abrirModalEditarPlantaoEscala('${escapeHtml(ev.id)}')">${escapeHtml(texto)}</button>`;
    }).join('');
    const maisHtml=eventos.length>4?`<button class="escala-evento" type="button" onclick="event.stopPropagation()">mais +${eventos.length-4}</button>`:'';
    html+=`<div class="${classes}" data-data="${dataIso}" onclick="abrirModalCadastroPlantaoEscala('${dataIso}')"><div class="escala-dia-numero">${dia}</div>${feriadoHtml}${eventosHtml}${maisHtml}</div>`;
  }

  // Completa a última semana com células vazias. Não mostra dias do próximo mês.
  const totalCelulas=primeiroDiaSemana+diasNoMes;
  const sobra=totalCelulas%7;
  if(sobra){
    for(let i=sobra;i<7;i++) html+=`<div class="escala-dia escala-dia-vazio" aria-hidden="true"></div>`;
  }
  grid.innerHTML=html;
}

function abrirPagina(id, botao) {
  if (usuarioSistemaLogado && !usuarioPodeAcessar(id)) return;
  if (id === 'itens') {
    id = 'tarefas';
    botao = document.querySelector('.nav-btn[data-page="tarefas"]');
  }
  closeMobileMenu();
  console.log('abrirPagina called with', id);
  document.querySelectorAll('.pagina').forEach(p => p.classList.remove('ativa'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('ativo'));
  const paginaAtual = document.getElementById(id);
  if (!paginaAtual) {
    console.warn('Página não encontrada:', id);
    return;
  }
  paginaAtual.classList.add('ativa');
  if (botao) botao.classList.add('ativo');
  const [tituloFallback] = topTitles[id] || ['', ''];
  const tituloPagina = paginaAtual.querySelector(':scope > .page-title')?.textContent?.trim() || tituloFallback;
  document.getElementById('topbar-title').textContent = tituloPagina;
  document.getElementById('topbar-sub').textContent = '';
  salvarPaginaAtiva(id);
  if (id === 'meu_painel') carregarMeuPainel();
  if (id === 'dashboard') carregarDashboard();
  if (id === 'checklists') { carregarChecklists(); }
  if (id === 'bater_ponto') { carregarBaterPonto(); }
  if (id === 'escala_plantoes') { carregarEscalaPlantoes(); }
  if (id === 'relatorio_plantao') { if (typeof renderizarRelatorioEscalaPlantoes === 'function') renderizarRelatorioEscalaPlantoes(); }
  if (id === 'relatorio_ponto') { carregarRelatorioPonto(); }
  if (id === 'ponto_ajustes') { carregarAjustesPonto(); }
  if (id === 'relatorio_lancamentos') { carregarRelatorioLancamentos(); }
  if (id === 'relatorio_tarefas_cadastradas') { carregarRelatorioTarefasCadastradas(); }
  if (id === 'relatorio_financeiro') {
    renderizarFiltroLojasCheckbox('filtroLojasRelatorioFinanceiro', 'carregarRelatorioFinanceiro()');
    carregarRelatorioFinanceiro();
    Promise.all([carregarGruposFornecedor(), carregarCategoriasCompra()]);
  }
  if (id === 'relatorio_recebimentos') { carregarRelatorioRecebimentos(); }
  if (id === 'relatorio_ajuste_saldo') { carregarRelatorioAjusteSaldo(); }
  if (id === 'financeiro_fornecedores') {
    limparFormularioFornecedorFinanceiro();
    carregarFornecedoresFinanceiro();
    carregarGruposFornecedor();
  }
  if (id === 'financeiro_formas_pagamento') {
    limparFormularioFormaPagamentoFinanceiro();
    carregarFormasPagamentoFinanceiro();
  }
  if (id === 'financeiro_contasapagar') {
    limparFormularioContaAPagarFinanceiro();
    resetarFiltrosContasAPagarFinanceiro({ manterListaVisivel: false });
    renderizarFiltroLojasCheckbox('filtroLojasContasAPagarFinanceiro', 'carregarContasAPagarFinanceiro()');
    carregarFornecedoresFinanceiro();
    carregarContasAPagarFinanceiro();
    Promise.all([carregarGruposFornecedor(), carregarCategoriasCompra()]);
  }
  if (id === 'financeiro_baixar_contas') {
    carregarFormasPagamentoFinanceiro({ render: false, silencioso: true });
    carregarBaixarContasFinanceiro();
  }
  if (id === 'financeiro_conta_financeira') {
    limparFormularioContaFinanceira();
    renderizarFiltroLojasCheckbox('filtroLojasContasFinanceiras', 'carregarContasFinanceiras(); carregarExtratoContaFinanceira()');
    carregarContasFinanceiras();
    carregarExtratoContaFinanceira();
  }
  if (id === 'financeiro_recebiveis') {
    carregarFornecedoresFinanceiro();
    carregarFormasPagamentoFinanceiro({ render: false, silencioso: true }).then(() => preencherSelectRecebivelFormasPagamentoFinanceiro());
    carregarContasFinanceiras({ render: false, silencioso: true }).then(() => preencherSelectRecebivelContasFinanceiras());
    carregarRecebiveisFinanceiro();
    iniciarTelaRecFuturos();
  }
  if (id === 'financeiro_grupo_fornecedor') {
    carregarGruposFornecedor();
  }
  if (id === 'financeiro_categorias_compra') {
    carregarCategoriasCompra();
  }
  if (id === 'tela_preferida_login') {
    iniciarTelaPreferidaLogin();
  }
  if (id === 'financeiro_cofre') {
    renderizarFiltroLojasCheckbox('filtroLojasCofreFinanceiro', 'carregarCofreFinanceiro()');
    carregarCofreFinanceiro();
  }
  if (id === 'funcionarios') {
    limparFormularioFuncionario();
    renderizarFiltroLojasCheckbox('filtroLojasFuncionarios', 'carregarFuncionarios()');
    carregarFuncionarios();
    carregarSelectPerfisFuncionario();
  }
  if (id === 'solicitacoes') { carregarSolicitacoesAcesso(); }
  if (id === 'emails') { carregarDestinatariosEmail(); }
  if (id === 'empresas_saas') { carregarEmpresasSaas(); }
  if (id === 'lojas_saas') {
    carregarEmpresasSaas({ render: false, silencioso: true })
      .then(() => Promise.all([carregarLojasSaas(), carregarConfiguracoesLoja()]))
      .then(() => inicializarCopiarDadosEntreLojasSaas());
  }
  if (id === 'perfis') { renderizarPermissoesPerfil(); carregarPerfis(); }
  if (id === 'tarefas') {
    atualizarBotaoFavoritasMinimizadas();
    carregarSelectLojaTarefaCadastro();
    carregarSelectFuncionariosTarefa();
    redefinirCampoBuscaTarefas();
    carregarTarefas();
    forcarCampoObservacaoTarefaEmBranco();
  }
  if (id === 'tarefas_rapidas') { carregarTarefasRapidas(); }
  if (id === 'execucoes') { resetFiltroData(false); carregarSelectExecucao(); carregarExecucoes(); }
  if (id === 'tarefas_atraso') { carregarTarefasAtrasoMaster(); }
  carregarNotificacoes();
  iniciarAtualizacaoAutomatica();
}

function obterPaginaAtivaAtual() {
  return document.querySelector('.pagina.ativa')?.id || 'dashboard';
}

function existeSessaoAtivaParaAtualizacao() {
  return !!usuarioSistemaLogado;
}

function paginaExigeAtualizacaoVisualAutomatica(pageId = obterPaginaAtivaAtual()) {
  return ['checklists', 'execucoes', 'tarefas_rapidas', 'tarefas_atraso'].includes(pageId);
}

function obterIntervaloAtualizacaoMs(pageId = obterPaginaAtivaAtual()) {
  if (pageId === 'checklists') return INTERVALO_ATUALIZACAO_CHECKLIST_MS;
  return INTERVALO_ATUALIZACAO_PADRAO_MS;
}

function obterDescricaoCicloAtualizacao(pageId = obterPaginaAtivaAtual()) {
  return `ciclo de ${Math.round(obterIntervaloAtualizacaoMs(pageId) / 1000)}s`;
}

function atualizarIndicadorSincronizacao(estado = 'idle', texto = '') {
  const badge = document.getElementById('syncStatus');
  const text = document.getElementById('syncStatusText');
  if (!badge || !text) return;

  badge.classList.remove('is-idle', 'is-syncing', 'is-error');

  if (estado === 'syncing') {
    badge.classList.add('is-syncing');
  } else if (estado === 'error') {
    badge.classList.add('is-error');
  } else {
    badge.classList.add('is-idle');
  }

  text.textContent = texto;
}

function agendarAtualizacaoPaginaAtivaTempoReal() {
  if (!existeSessaoAtivaParaAtualizacao()) return;
  if (!paginaExigeAtualizacaoVisualAutomatica(obterPaginaAtivaAtual())) return;
  if (timeoutAtualizacaoPaginaRealtime) {
    clearTimeout(timeoutAtualizacaoPaginaRealtime);
  }
  timeoutAtualizacaoPaginaRealtime = window.setTimeout(() => {
    atualizarPaginaAtivaAutomaticamente();
  }, 180);
}

function formatarTempoSincronizacao() {
  if (!ultimoSucessoSincronizacaoEm) {
    return existeSessaoAtivaParaAtualizacao()
      ? 'Aguardando primeira atualização'
      : 'Aguardando sessão ativa';
  }

  const segundos = Math.max(0, Math.floor((Date.now() - ultimoSucessoSincronizacaoEm) / 1000));
  if (segundos <= 3) return 'Atualizado agora';
  if (segundos < 60) return `Atualizado há ${segundos}s`;

  const minutos = Math.floor(segundos / 60);
  return `Atualizado há ${minutos} min`;
}

function iniciarRelogioSincronizacao() {
  if (intervaloStatusSincronizacao) {
    clearInterval(intervaloStatusSincronizacao);
  }

  intervaloStatusSincronizacao = window.setInterval(() => {
    if (!existeSessaoAtivaParaAtualizacao()) {
      atualizarIndicadorSincronizacao('idle', 'Aguardando sessão ativa');
      return;
    }

    atualizarIndicadorSincronizacao('idle', formatarTempoSincronizacao());
  }, 30000);
}

async function atualizarPaginaAtivaAutomaticamente() {
  if (!existeSessaoAtivaParaAtualizacao()) {
    atualizarIndicadorSincronizacao('idle', 'Aguardando sessão ativa');
    return;
  }

  try {
    atualizarIndicadorSincronizacao('syncing', 'Sincronizando agora...');
    const paginaAtiva = obterPaginaAtivaAtual();
    if (paginaAtiva === 'dashboard') await carregarDashboard();
    if (paginaAtiva === 'checklists') await carregarChecklists();
    if (paginaAtiva === 'bater_ponto') await carregarBaterPonto();
    if (paginaAtiva === 'relatorio_ponto') await carregarRelatorioPonto();
    if (paginaAtiva === 'ponto_ajustes') await carregarAjustesPonto();
    if (paginaAtiva === 'relatorio_lancamentos') await carregarRelatorioLancamentos({ silencioso: true });
    if (paginaAtiva === 'relatorio_financeiro') await carregarRelatorioFinanceiro();
    if (paginaAtiva === 'relatorio_recebimentos') await carregarRelatorioRecebimentos();
    if (paginaAtiva === 'relatorio_ajuste_saldo') await carregarRelatorioAjusteSaldo();
    if (paginaAtiva === 'itens' && document.getElementById('checklistSelect')?.value) {
      await carregarItens();
    }
    if (paginaAtiva === 'funcionarios') await carregarFuncionarios();
    if (paginaAtiva === 'solicitacoes') await carregarSolicitacoesAcesso();
    if (paginaAtiva === 'emails') await carregarDestinatariosEmail();
    if (paginaAtiva === 'perfis') await carregarPerfis();
    if (paginaAtiva === 'tarefas') {
      await carregarTarefas();
    }
    if (paginaAtiva === 'tarefas_rapidas') await carregarTarefasRapidas();
    if (paginaAtiva === 'execucoes') await carregarExecucoes();
    if (paginaAtiva === 'tarefas_atraso') await carregarTarefasAtrasoMaster();
    await carregarNotificacoes();
    ultimoSucessoSincronizacaoEm = Date.now();
    atualizarIndicadorSincronizacao('idle', 'Atualizado agora');
  } catch (error) {
    atualizarIndicadorSincronizacao('error', 'Falha na atualização automática');
    console.warn('Falha na atualização automática da tela ativa:', error);
  }
}

function iniciarAtualizacaoAutomatica() {
  // Consumo otimizado: não cria polling de tela nem consulta de notificações por intervalo.
  // Antes havia notificações a cada 5s e telas a cada 10/20s.
  // Agora a atualização ocorre ao abrir a tela, ao executar uma ação e pelos canais Realtime já configurados.
  if (intervaloAtualizacaoPaginaAtiva) {
    clearInterval(intervaloAtualizacaoPaginaAtiva);
    intervaloAtualizacaoPaginaAtiva = null;
  }
  if (intervaloAtualizacaoNotificacoes) {
    clearInterval(intervaloAtualizacaoNotificacoes);
    intervaloAtualizacaoNotificacoes = null;
  }
  if (intervaloStatusSincronizacao) {
    clearInterval(intervaloStatusSincronizacao);
    intervaloStatusSincronizacao = null;
  }

  atualizarIndicadorSincronizacao(
    'idle',
    existeSessaoAtivaParaAtualizacao() ? 'Atualização sob demanda/Realtime' : 'Aguardando sessão ativa'
  );
  iniciarRelogioSincronizacao();
}

function lancamentoPodeGerarAlertaTempoReal(lancamento = null) {
  if (!lancamento) return false;
  if (String(lancamento.status || '').toLowerCase() !== 'pendente') return false;
  if (!tarefaDisponivelHoje(lancamento.dias_semana)) return false;
  if (!lancamentoProgramadoHoje(lancamento)) {
    // Compatibilidade para bases antigas sem datas preenchidas no lançamento.
    if (lancamento.lancado_em || lancamento.created_at) return false;
  }
  if (!checklistDentroJanelaAlerta(lancamento.horario_limite) && !lancamentoRecemCriadoParaAlerta(lancamento)) return false;
  if (lancamentoFoiCriadoAposHorarioNoMesmoDia(lancamento)) return false;
  return true;
}

function injetarAlertaChecklistTempoReal(lancamento = null) {
  if (!usuarioPodeVerNotificacaoChecklist()) return;
  if (!lancamentoPodeGerarAlertaTempoReal(lancamento)) return;

  const chave = criarChaveAlerta('checklist_pendente', lancamento.id);
  if (notificacoesAtuais.some(item => item?.chave === chave)) return;

  const nomeChecklist = String(lancamento.nome || 'Checklist');
  const horarioProgramado = horaCurta(lancamento.horario_limite) || 'não informado';
  const dataProgramada = formatarDataNotificacaoLancamento(lancamento);
  const resumoDataHora = montarResumoDataHoraNotificacao(dataProgramada, horarioProgramado);

  notificacoesAtuais.unshift({
    chave,
    tipo: 'checklist_pendente',
    page: 'checklists',
    titulo: 'Checklist pendente aguardando início',
    descricao: `${nomeChecklist} · ${resumoDataHora}.`,
    meta: {
      nomeTarefa: nomeChecklist,
      nomeFuncionario: 'Responsável',
      horarioProgramado,
      dataProgramada,
    },
  });

  avisoCentralTarefasFechado = false;
  renderizarListaNotificacoes();
  sincronizarAvisoNotificacoes();
}

function agendarAtualizacaoChecklistsTempoReal() {
  if (obterPaginaAtivaAtual() !== 'checklists') return;
  if (timeoutAtualizacaoChecklistsRealtime) {
    clearTimeout(timeoutAtualizacaoChecklistsRealtime);
  }
  timeoutAtualizacaoChecklistsRealtime = window.setTimeout(() => {
    carregarChecklists({ silencioso: true }).catch(error => {
      console.warn('Falha ao atualizar checklists via Realtime:', error);
    });
  }, 140);
}


let timeoutAtualizacaoNotificacoesRealtime = null;

function montarOpcoesRealtimeTenant(evento, tabela) {
  const opcoes = { event: evento, schema: 'public', table: tabela };
  try {
    const lojaId = String(obterLojaIdSessao?.() || usuarioSistemaLogado?.loja_id || '').trim();
    const empresaId = String(obterEmpresaIdSessao?.() || usuarioSistemaLogado?.empresa_id || '').trim();
    if (lojaId && TABELAS_COM_LOJA_ID.has(tabela)) {
      opcoes.filter = `loja_id=eq.${lojaId}`;
    } else if (empresaId && TABELAS_COM_EMPRESA_ID.has(tabela)) {
      opcoes.filter = `empresa_id=eq.${empresaId}`;
    }
  } catch (erro) {
    console.warn('Filtro Realtime por tenant não aplicado:', tabela, erro);
  }
  return opcoes;
}

function agendarAtualizacaoNotificacoesRealtime() {
  if (!existeSessaoAtivaParaAtualizacao()) return;
  if (timeoutAtualizacaoNotificacoesRealtime) {
    clearTimeout(timeoutAtualizacaoNotificacoesRealtime);
  }
  timeoutAtualizacaoNotificacoesRealtime = window.setTimeout(() => {
    carregarNotificacoes().catch(error => {
      console.warn('Falha ao atualizar notificações via Realtime:', error);
    });
    if (obterPaginaAtivaAtual() === 'tarefas_rapidas') {
      carregarTarefasRapidas(true).catch(error => {
        console.warn('Falha ao atualizar alertas rápidos via Realtime:', error);
      });
    }
  }, 900);
}

function reiniciarAssinaturaRealtimeNotificacoes() {
  try {
    if (canalNotificacoesRealtime) {
      sb.removeChannel(canalNotificacoesRealtime);
      canalNotificacoesRealtime = null;
    }
  } catch (e) {}

  if (!existeSessaoAtivaParaAtualizacao()) return;

  const canalNome = `zuqui-notificacoes-${obterChaveUsuarioNotificacoes()}`;
  const atualizarNotificacoes = () => {
    if (!existeSessaoAtivaParaAtualizacao()) return;
    agendarAtualizacaoNotificacoesRealtime();
  };

  canalNotificacoesRealtime = sb
    .channel(canalNome)
    .on('postgres_changes', montarOpcoesRealtimeTenant('INSERT', 'checklist_lancamentos'), (payload) => {
      injetarAlertaChecklistTempoReal(payload?.new || null);
      atualizarNotificacoes();
      agendarAtualizacaoChecklistsTempoReal();
    })
    .on('postgres_changes', montarOpcoesRealtimeTenant('UPDATE', 'checklist_lancamentos'), () => {
      atualizarNotificacoes();
      agendarAtualizacaoChecklistsTempoReal();
    })
    .on('postgres_changes', montarOpcoesRealtimeTenant('DELETE', 'checklist_lancamentos'), () => {
      atualizarNotificacoes();
      agendarAtualizacaoChecklistsTempoReal();
    })
    .on('postgres_changes', montarOpcoesRealtimeTenant('*', 'checklist_execucoes'), atualizarNotificacoes)
    .on('postgres_changes', montarOpcoesRealtimeTenant('*', 'alertas_rapidos'), atualizarNotificacoes)
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        agendarAtualizacaoNotificacoesRealtime();
      }
    });
}
