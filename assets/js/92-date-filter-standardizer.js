/* Padroniza consultas por data: um calendário e um critério por bloco de filtro. */
(function () {
  'use strict';

  const LABELS = {
    cadastro: 'Data de cadastro', vencimento: 'Data de vencimento', atualizacao: 'Data de atualização',
    pagamento: 'Data de pagamento', recebimento: 'Data de recebimento', prevista: 'Data prevista',
    ajuste: 'Data do ajuste', lancamento: 'Data do lançamento', execucao: 'Data de execução',
    data: 'Data'
  };

  const OPCOES_ESPECIAIS = {
    financeiro_baixar_contas: [
      ['vencimento', 'Data de vencimento'], ['cadastro', 'Data de cadastro'],
      ['atualizacao', 'Data de atualização'], ['pagamento', 'Data de pagamento']
    ],
    financeiro_recebiveis: [
      ['prevista', 'Data prevista'], ['cadastro', 'Data de cadastro'],
      ['recebimento', 'Data de recebimento']
    ],
    financeiro_cofre: [
      ['movimento', 'Data do movimento'], ['compra', 'Data da compra'],
      ['vencimento', 'Data de vencimento'], ['pagamento', 'Data de pagamento'],
      ['cadastro_conta', 'Cadastro da conta'], ['atualizacao_conta', 'Atualização da conta'],
      ['recebimento', 'Data de recebimento'], ['atualizacao_recebimento', 'Atualização do recebimento'],
      ['ajuste', 'Data do ajuste']
    ],
    relatorio_financeiro: [
      ['vencimento', 'Data de vencimento'], ['compra', 'Data da compra'],
      ['pagamento', 'Data de pagamento'], ['cadastro', 'Data de cadastro'],
      ['atualizacao', 'Data de atualização']
    ],
    relatorio_recebimentos: [
      ['cadastro', 'Data de cadastro'], ['atualizacao', 'Data de atualização'],
      ['prevista', 'Data prevista'], ['recebimento', 'Data de recebimento']
    ],
    relatorio_ajuste_saldo: [
      ['ajuste', 'Data do ajuste']
    ]
  };

  function normalizar(texto) {
    return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  function hojeLocalISO() {
    const agora = new Date();
    const local = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function preencherPeriodosVaziosComHoje() {
    const hoje = hojeLocalISO();
    document.querySelectorAll('input[type="date"]').forEach(campo => {
      if (campo.value) return;
      const label = campo.closest('label')?.textContent || document.querySelector(`label[for="${campo.id}"]`)?.textContent || '';
      const referencia = normalizar(`${campo.id || ''} ${campo.name || ''} ${campo.title || ''} ${campo.getAttribute('aria-label') || ''} ${label}`);
      const idPeriodo = /(?:inicio|fim|start|end)$/.test(normalizar(campo.id || campo.name || ''));
      const rotuloPeriodo = /data\s+(?:inicial|final)/.test(referencia);
      if (idPeriodo || rotuloPeriodo) campo.value = hoje;
    });
  }

  function rotuloDoPar(base, inicio) {
    const label = document.querySelector(`label[for="${inicio.id}"]`)?.textContent || inicio.closest('label')?.textContent || '';
    const fonte = normalizar(`${base} ${inicio.title || ''} ${inicio.getAttribute('aria-label') || ''} ${label}`);
    const chave = Object.keys(LABELS).find(item => fonte.includes(item));
    return LABELS[chave || 'data'];
  }

  function blocoDo(input) {
    return input.closest('.card, .filters, .toolbar, form, .pagina') || input.parentElement;
  }

  function rotuloControle(campo) {
    const fonte = normalizar(`${campo.id || ''} ${campo.name || ''} ${campo.placeholder || ''} ${campo.title || ''}`);
    const regras = [
      ['status', 'Status'], ['busca', 'Buscar'], ['buscar', 'Buscar'], ['pagador', 'Pagador'],
      ['fornecedor', 'Fornecedor'], ['categoria', 'Categoria'], ['forma', 'Forma de pagamento'],
      ['conta', 'Conta'], ['usuario', 'Quem lançou'], ['funcionario', 'Funcionário'],
      ['responsavel', 'Responsável'], ['loja', 'Loja'], ['tipo', 'Tipo']
    ];
    return regras.find(([termo]) => fonte.includes(termo))?.[1] || (campo.tagName === 'SELECT' ? 'Opção' : 'Buscar');
  }

  function rotularFiltros() {
    const blocos = ['.financeiro-filtros-row', '.financeiro-filtros-flex', '.financeiro-filtros-baixar', '.recebiveis-provisionados-filtros', '.relatorio-financeiro-filtros', '.filters', '.toolbar'];
    const seletor = blocos.flatMap(bloco => [`${bloco} input[id^="filtro"]`, `${bloco} select[id^="filtro"]`]).join(', ');
    document.querySelectorAll(seletor).forEach(campo => {
      if (campo.type === 'date' || campo.type === 'checkbox' || campo.type === 'hidden' || campo.dataset.filterLabeled === 'true') return;
      if (campo.closest('label, .campo-com-label, .financeiro-filtro-compacto, .filter-field-standard')) {
        campo.dataset.filterLabeled = 'true';
        return;
      }
      const wrapper = document.createElement('label');
      wrapper.className = `filter-field-standard ${campo.tagName === 'SELECT' ? 'filter-field-select' : 'filter-field-search'}`;
      const texto = document.createElement('span');
      texto.textContent = rotuloControle(campo);
      campo.parentElement.insertBefore(wrapper, campo);
      wrapper.append(texto, campo);
      campo.dataset.filterLabeled = 'true';
    });
  }

  function esconderCampo(input) {
    if (!input) return;
    input.dataset.dateFilterEnhanced = 'true';
    input.classList.add('date-filter-original-hidden');
    const grupo = input.closest('.financeiro-filtro-compacto, .campo-com-label, label');
    const alvo = grupo && grupo.querySelectorAll('input[type="date"]').length === 1 ? grupo : input;
    alvo.classList.add('date-filter-original-hidden');
  }

  function aplicar(wrapper) {
    const pares = JSON.parse(wrapper.dataset.pares || '[]');
    const criterio = wrapper.querySelector('.date-filter-criterion')?.value || '';
    const dataInicio = wrapper.querySelector('.date-filter-start')?.value || '';
    const dataFim = wrapper.querySelector('.date-filter-end')?.value || '';
    const especial = criterio.startsWith('especial:');
    pares.forEach(par => {
      const inicio = document.getElementById(par.inicio);
      const fim = document.getElementById(par.fim);
      if (!inicio || !fim) return;
      const ativo = par.base === criterio || (especial && par === pares[0]);
      const novoInicio = ativo ? dataInicio : '';
      const novoFim = ativo ? dataFim : '';
      const mudouInicio = inicio.value !== novoInicio;
      const mudouFim = fim.value !== novoFim;
      inicio.value = novoInicio;
      fim.value = novoFim;
      if (mudouInicio || mudouFim) inicio.dispatchEvent(new Event('change', { bubbles:true }));
    });
  }

  window.sincronizarFiltroDataPadronizado = function(paginaId, dataInicio, dataFim, criterio = '') {
    const pagina = document.getElementById(String(paginaId || ''));
    const wrapper = pagina?.querySelector('.date-filter-standard');
    if (!wrapper) return false;
    const inicio = wrapper.querySelector('.date-filter-start');
    const fim = wrapper.querySelector('.date-filter-end');
    const seletor = wrapper.querySelector('.date-filter-criterion');
    if (inicio) inicio.value = dataInicio || '';
    if (fim) fim.value = dataFim || '';
    if (seletor && criterio) {
      const valor = criterio.startsWith('especial:') ? criterio : `especial:${criterio}`;
      if ([...seletor.options].some(opcao => opcao.value === valor)) seletor.value = valor;
    }
    aplicar(wrapper);
    return true;
  };

  function aprimorarBloco(bloco, pares) {
    if (!bloco || bloco.querySelector('.date-filter-standard')) return;
    const primeiro = document.getElementById(pares[0].inicio);
    if (!primeiro) return;
    pares.forEach(par => {
      esconderCampo(document.getElementById(par.inicio));
      esconderCampo(document.getElementById(par.fim));
    });
    const wrapper = document.createElement('div');
    wrapper.className = 'date-filter-standard';
    wrapper.dataset.pares = JSON.stringify(pares);
    const paginaId = bloco.closest('.pagina')?.id || '';
    const especiais = OPCOES_ESPECIAIS[paginaId] || [];
    const opcoes = especiais.length
      ? especiais.map(([valor, label]) => ({ valor:`especial:${valor}`, label }))
      : pares.map(par => ({ valor:par.base, label:par.label }));
    wrapper.innerHTML = `
      <label class="date-filter-start-field"><span>Data inicial</span><input class="date-filter-start" type="date" aria-label="Data inicial"></label>
      <label class="date-filter-end-field"><span>Data final</span><input class="date-filter-end" type="date" aria-label="Data final"></label>
      <label class="date-filter-criterion-field"><span>Consultar por</span><select class="date-filter-criterion" aria-label="Consultar por">${opcoes.map(opcao => `<option value="${opcao.valor}">${opcao.label}</option>`).join('')}</select></label>`;
    const ancora = primeiro.closest('.financeiro-filtro-compacto, .campo-com-label, label') || primeiro;
    ancora.parentElement.insertBefore(wrapper, ancora);
    wrapper.querySelector('.date-filter-start').value = primeiro.value || '';
    wrapper.querySelector('.date-filter-end').value = document.getElementById(pares[0].fim)?.value || '';
    wrapper.querySelectorAll('input,select').forEach(campo => campo.addEventListener('change', () => aplicar(wrapper)));
  }

  function executar() {
    preencherPeriodosVaziosComHoje();
    rotularFiltros();

    // Baixar contas já possui o par de datas e o critério nativos. Impede que o
    // padronizador genérico crie um segundo conjunto e comprima o grid da tela.
    const paginaBaixarContas = document.getElementById('financeiro_baixar_contas');
    if (paginaBaixarContas) {
      paginaBaixarContas.querySelectorAll('.date-filter-standard').forEach(wrapper => wrapper.remove());
      paginaBaixarContas.querySelectorAll('input[type="date"]').forEach(input => {
        input.dataset.dateFilterNative = 'true';
        delete input.dataset.dateFilterEnhanced;
        input.classList.remove('date-filter-original-hidden');
        input.closest('.financeiro-filtro-compacto, .campo-com-label, label')?.classList.remove('date-filter-original-hidden');
      });
    }
    document.querySelectorAll('.date-filter-standard').forEach((wrapper, indice, todos) => {
      const bloco = blocoDo(wrapper);
      const primeiro = [...todos].find(item => item !== wrapper && blocoDo(item) === bloco);
      if (primeiro) wrapper.remove();
    });
    const inicios = [...document.querySelectorAll('input[type="date"][id^="filtro"][id$="Inicio"]')]
      .filter(input => !input.closest('#financeiro_baixar_contas'))
      .filter(input => input.dataset.dateFilterEnhanced !== 'true' && input.dataset.dateFilterNative !== 'true');
    const porBloco = new Map();
    inicios.forEach(inicio => {
      const base = inicio.id.slice(0, -6);
      const fim = document.getElementById(`${base}Fim`);
      if (!fim || fim.type !== 'date') return;
      const bloco = blocoDo(inicio);
      if (!porBloco.has(bloco)) porBloco.set(bloco, []);
      porBloco.get(bloco).push({ base, inicio:inicio.id, fim:fim.id, label:rotuloDoPar(base, inicio) });
    });
    porBloco.forEach((pares, bloco) => aprimorarBloco(bloco, pares));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', executar);
  else executar();
  new MutationObserver(() => requestAnimationFrame(executar)).observe(document.documentElement, { childList:true, subtree:true });
})();
