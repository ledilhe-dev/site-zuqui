/* Padroniza consultas por data: um calendário e um critério por bloco de filtro. */
(function () {
  'use strict';

  const LABELS = {
    cadastro: 'Data de cadastro', vencimento: 'Data de vencimento', atualizacao: 'Data de atualização',
    pagamento: 'Data de pagamento', recebimento: 'Data de recebimento', prevista: 'Data prevista',
    ajuste: 'Data do ajuste', lancamento: 'Data do lançamento', execucao: 'Data de execução',
    data: 'Data'
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
    const label = input.closest('label');
    const alvo = label && label.querySelectorAll('input[type="date"]').length === 1 ? label : input;
    alvo.classList.add('date-filter-original-hidden');
  }

  function aplicar(wrapper) {
    const pares = JSON.parse(wrapper.dataset.pares || '[]');
    const criterio = wrapper.querySelector('.date-filter-criterion')?.value || '';
    const data = wrapper.querySelector('.date-filter-single')?.value || '';
    pares.forEach(par => {
      const inicio = document.getElementById(par.inicio);
      const fim = document.getElementById(par.fim);
      if (!inicio || !fim) return;
      const valor = par.base === criterio ? data : '';
      const mudouInicio = inicio.value !== valor;
      const mudouFim = fim.value !== valor;
      inicio.value = valor;
      fim.value = valor;
      if (mudouInicio || mudouFim) inicio.dispatchEvent(new Event('change', { bubbles:true }));
    });
  }

  function aprimorarBloco(bloco, pares) {
    if (!bloco || bloco.querySelector(':scope > .date-filter-standard')) return;
    const primeiro = document.getElementById(pares[0].inicio);
    if (!primeiro) return;
    pares.forEach(par => {
      esconderCampo(document.getElementById(par.inicio));
      esconderCampo(document.getElementById(par.fim));
    });
    const wrapper = document.createElement('div');
    wrapper.className = 'date-filter-standard';
    wrapper.dataset.pares = JSON.stringify(pares);
    wrapper.innerHTML = `
      <label class="date-filter-single-field"><span>Data</span><input class="date-filter-single" type="date" aria-label="Data da consulta"></label>
      <label class="date-filter-criterion-field"><span>Consultar por</span><select class="date-filter-criterion" aria-label="Consultar por">${pares.map(par => `<option value="${par.base}">${par.label}</option>`).join('')}</select></label>`;
    const ancora = primeiro.closest('label') || primeiro;
    ancora.parentElement.insertBefore(wrapper, ancora);
    wrapper.querySelectorAll('input,select').forEach(campo => campo.addEventListener('change', () => aplicar(wrapper)));
  }

  function executar() {
    const inicios = [...document.querySelectorAll('input[type="date"][id^="filtro"][id$="Inicio"]')]
      .filter(input => !input.classList.contains('date-filter-original-hidden'));
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
