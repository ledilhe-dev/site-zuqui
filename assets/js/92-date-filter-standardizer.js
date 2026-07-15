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
    ]
  };

  function normalizar(texto) {
    return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  function rotuloDoPar(base, inicio) {
    const fonte = normalizar(`${base} ${inicio.title || ''} ${inicio.getAttribute('aria-label') || ''}`);
    const chave = Object.keys(LABELS).find(item => fonte.includes(item));
    return LABELS[chave || 'data'];
  }

  function blocoDo(input) {
    return input.closest('.card, .filters, .toolbar, form, .pagina') || input.parentElement;
  }

  function esconderCampo(input) {
    if (!input) return;
    input.dataset.dateFilterEnhanced = 'true';
    input.classList.add('date-filter-original-hidden');
    const label = input.closest('label');
    const alvo = label && label.querySelectorAll('input[type="date"]').length === 1 ? label : input;
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
    const ancora = primeiro.closest('label') || primeiro;
    ancora.parentElement.insertBefore(wrapper, ancora);
    wrapper.querySelector('.date-filter-start').value = primeiro.value || '';
    wrapper.querySelector('.date-filter-end').value = document.getElementById(pares[0].fim)?.value || '';
    wrapper.querySelectorAll('input,select').forEach(campo => campo.addEventListener('change', () => aplicar(wrapper)));
  }

  function executar() {
    document.querySelectorAll('.date-filter-standard').forEach((wrapper, indice, todos) => {
      const bloco = blocoDo(wrapper);
      const primeiro = todos.find(item => item !== wrapper && blocoDo(item) === bloco);
      if (primeiro) wrapper.remove();
    });
    const inicios = [...document.querySelectorAll('input[type="date"][id^="filtro"][id$="Inicio"]')]
      .filter(input => input.dataset.dateFilterEnhanced !== 'true');
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
