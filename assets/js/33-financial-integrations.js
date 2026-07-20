// Modulo estrutural de Integracoes Financeiras. Provedores e Finance AI permanecem desativados na Fase 1.
const INTEGRACOES_FINANCEIRAS_PAGINAS = {
  integracoes_financeiras_dashboard: { titulo: 'Dashboard Financeiro', descricao: 'Visao consolidada das futuras conexoes financeiras.' },
  integracoes_financeiras_contas: { titulo: 'Contas Bancarias', descricao: 'Contas importadas ou cadastradas manualmente.' },
  integracoes_financeiras_cartoes: { titulo: 'Cartoes', descricao: 'Cartoes e faturas vinculados as instituicoes.' },
  integracoes_financeiras_movimentacoes: { titulo: 'Movimentacoes', descricao: 'Extrato normalizado de contas e cartoes.' },
  integracoes_financeiras_categorias: { titulo: 'Categorias', descricao: 'Classificacao de receitas e despesas.' },
  integracoes_financeiras_fornecedores: { titulo: 'Fornecedores', descricao: 'Contrapartes identificadas nas movimentacoes.' },
  integracoes_financeiras_conciliacao: { titulo: 'Conciliacao', descricao: 'Correspondencia entre movimentacoes e registros internos.' },
  integracoes_financeiras_regras: { titulo: 'Regras Automaticas', descricao: 'Regras declarativas para classificacao futura.' },
  integracoes_financeiras_configuracoes: { titulo: 'Configuracoes', descricao: 'Conexoes, provedores e historico de sincronizacao.' },
};

const integracoesFinanceirasProviders = Object.freeze({
  manual: { id: 'manual', nome: 'Manual', disponivel: false },
  open_finance: { id: 'open_finance', nome: 'Open Finance', disponivel: false },
  pluggy: { id: 'pluggy', nome: 'Pluggy', disponivel: false },
  belvo: { id: 'belvo', nome: 'Belvo', disponivel: false },
});

const FinanceAI = Object.freeze({
  disponivel: false,
  capacidades: ['classificar_compras', 'detectar_duplicidades', 'detectar_assinaturas', 'sugerir_categorias', 'identificar_padroes', 'gerar_insights'],
  async analisar() { throw new Error('Finance AI ainda nao esta habilitado.'); },
});

function renderizarDashboardIntegracoesFinanceiras(container) {
  const indicadores = ['Saldo', 'Receitas', 'Despesas', 'Faturas', 'Contas conectadas', 'Ultima sincronizacao'];
  container.innerHTML = `
    <div class="if-status-banner"><span class="if-status-dot"></span>Modulo preparado. Nenhuma integracao externa esta ativa.</div>
    <div class="if-metrics">${indicadores.map(item => `<div class="stat-card"><div class="stat-label">${item}</div><div class="stat-value">--</div><div class="if-stat-note">Aguardando conexao</div></div>`).join('')}</div>
    <div class="card if-recent-card"><div class="card-title">Movimentacoes recentes</div><div class="empty">As movimentacoes sincronizadas aparecerao aqui.</div></div>`;
}

function renderizarPaginaEstruturalIntegracoesFinanceiras(container, pagina) {
  container.innerHTML = `
    <div class="card if-structure-card">
      <div class="if-structure-head"><div><div class="card-title">${pagina.titulo}</div><div class="page-sub">${pagina.descricao}</div></div><span class="if-phase-badge">Fase 1</span></div>
      <div class="empty">Estrutura pronta para receber dados em uma proxima fase.</div>
    </div>`;
}

function carregarPaginaIntegracoesFinanceiras(pageId) {
  const pagina = INTEGRACOES_FINANCEIRAS_PAGINAS[pageId];
  const container = document.querySelector(`#${pageId} .if-page-content`);
  if (!pagina || !container || container.dataset.rendered === 'true') return;
  if (pageId === 'integracoes_financeiras_dashboard') renderizarDashboardIntegracoesFinanceiras(container);
  else renderizarPaginaEstruturalIntegracoesFinanceiras(container, pagina);
  container.dataset.rendered = 'true';
}

window.INTEGRACOES_FINANCEIRAS_PAGINAS = INTEGRACOES_FINANCEIRAS_PAGINAS;
window.integracoesFinanceirasProviders = integracoesFinanceirasProviders;
window.FinanceAI = FinanceAI;
window.carregarPaginaIntegracoesFinanceiras = carregarPaginaIntegracoesFinanceiras;
