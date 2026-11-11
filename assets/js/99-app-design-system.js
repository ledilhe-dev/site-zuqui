(function bootstrapAppDesignSystem() {
  'use strict';

  const AppUI = window.AppUI = window.AppUI || {};
  const searchTerms = /busca|buscar|pesquisa|pesquisar|consulta|consultar/i;

  AppUI.normalizeText = function normalizeText(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
  };

  AppUI.positionPopover = function positionPopover(popover, trigger) {
    if (!popover || !trigger || getComputedStyle(popover).display === 'none') return;
    if (popover.matches('#dashGfDropdownForn, #dashGfDropdownCat')) {
      popover.classList.add('app-popover');
      popover.style.setProperty('position', 'absolute', 'important');
      popover.style.setProperty('inset', 'calc(100% + 4px) 0 auto auto', 'important');
      popover.style.setProperty('width', 'min(320px, calc(100vw - 24px))', 'important');
      return;
    }
    const margin = innerWidth <= 700 ? 8 : 12;
    const anchor = trigger.getBoundingClientRect();
    const content = trigger.closest('.pagina, .card, .content, .main');
    const contentRect = content?.getBoundingClientRect();
    const boundaryLeft = Math.max(margin, contentRect?.left ?? margin);
    const boundaryRight = Math.min(innerWidth - margin, contentRect?.right ?? (innerWidth - margin));
    const availableWidth = Math.max(180, boundaryRight - boundaryLeft);
    const width = Math.min(Math.max(anchor.width, 240), availableWidth, 320);
    const spaceBelow = innerHeight - anchor.bottom - margin;
    const spaceAbove = anchor.top - margin;
    const openAbove = spaceBelow < 220 && spaceAbove > spaceBelow;
    popover.classList.add('app-popover');
    popover.style.setProperty('position', 'fixed', 'important');
    popover.style.setProperty('width', width + 'px', 'important');
    popover.style.setProperty('left', Math.max(boundaryLeft, Math.min(anchor.left, boundaryRight - width)) + 'px', 'important');
    popover.style.setProperty('right', 'auto', 'important');
    popover.style.top = openAbove ? 'auto' : Math.max(margin, anchor.bottom + 4) + 'px';
    popover.style.bottom = openAbove ? Math.max(margin, innerHeight - anchor.top + 4) + 'px' : 'auto';
    popover.style.maxHeight = Math.max(160, (openAbove ? spaceAbove : spaceBelow) - 4) + 'px';
    popover.style.zIndex = '99999';
  };

  function classifyControls(root) {
    root.querySelectorAll('input, select, textarea, button').forEach(control => {
      if (control.closest('.sidebar, .topbar, #loginScreen')) return;
      if (!control.matches('[type="checkbox"], [type="radio"], [type="hidden"], [type="file"], [type="color"]')) {
        control.classList.add('app-control');
      }
      if (control.matches('button, [type="button"], [type="submit"]')) control.classList.add('app-button');
      if (control.matches('select')) control.classList.add('app-select');
      if (control.matches('[type="date"], [type="month"], [type="week"]')) control.classList.add('app-date');
      if (control.matches('[type="time"]')) control.classList.add('app-time');
      const identity = [control.id, control.name, control.placeholder, control.getAttribute('aria-label')].join(' ');
      if (control.matches('[type="search"]') || searchTerms.test(identity)) {
        control.classList.add('app-search');
        control.closest('.filter-field-standard')?.classList.add('app-field-search');
      }
    });
    root.querySelectorAll('.financeiro-filtros-row, .relatorio-financeiro-filtros, .atendimento-filtros, .tarefas-filtro-grid, .ponto-ajustes-filtros, .dash-gf-toolbar, [class*="-filtros-unificados"]').forEach(bar => bar.classList.add('app-filter-bar'));
    root.querySelectorAll('.table-wrap, .table-responsive, [class*="-table-wrap"], [class*="-tabela-wrap"]').forEach(region => region.classList.add('app-table-region'));
    root.querySelectorAll('.overlay .modal, .modal-overlay .modal, [role="dialog"]').forEach(modal => modal.classList.add('app-modal'));
  }

  function enhancePayableCategoryFilter() {
    const dropdown = document.getElementById('dropdownCategoriasContaAPagar');
    const trigger = document.getElementById('btnFiltroContaAPagarCategorias');
    if (!dropdown || !trigger) return;
    dropdown.classList.add('app-popover');

    const applySearch = query => {
      const normalized = AppUI.normalizeText(query);
      dropdown.querySelectorAll('label').forEach(option => {
        option.hidden = Boolean(normalized) && !AppUI.normalizeText(option.textContent).includes(normalized);
      });
    };

    const ensureSearch = () => {
      let input = dropdown.querySelector('.app-popover-search');
      if (!input && dropdown.children.length) {
        input = document.createElement('input');
        input.type = 'search';
        input.className = 'app-popover-search app-control app-search';
        input.placeholder = 'Pesquisar categorias';
        input.setAttribute('aria-label', 'Pesquisar categorias');
        input.autocomplete = 'off';
        input.addEventListener('input', () => applySearch(input.value));
        dropdown.insertBefore(input, dropdown.children[1] || dropdown.firstChild);
      }
      return input;
    };

    const observer = new MutationObserver(() => {
      observer.disconnect();
      const input = ensureSearch();
      if (input) applySearch(input.value);
      if (getComputedStyle(dropdown).display !== 'none') AppUI.positionPopover(dropdown, trigger);
      observer.observe(dropdown, { childList: true });
    });
    observer.observe(dropdown, { childList: true });

    trigger.addEventListener('click', () => requestAnimationFrame(() => {
      if (getComputedStyle(dropdown).display !== 'none') {
        ensureSearch();
        AppUI.positionPopover(dropdown, trigger);
      }
    }));
    addEventListener('resize', () => AppUI.positionPopover(dropdown, trigger), { passive: true });
    addEventListener('scroll', () => AppUI.positionPopover(dropdown, trigger), { passive: true, capture: true });
  }

  function enhanceDashboardFilters() {
    const pairs = [
      ['dashGfDropdownForn', 'btnDashGfFornecedores'],
      ['dashGfDropdownCat', 'btnDashGfCategorias'],
    ];
    pairs.forEach(([popoverId, triggerId]) => {
      const popover = document.getElementById(popoverId);
      const trigger = document.getElementById(triggerId);
      if (!popover || !trigger) return;
      popover.classList.add('app-popover');
      trigger.addEventListener('click', () => requestAnimationFrame(() => AppUI.positionPopover(popover, trigger)));
    });
  }

  function initialize() {
    classifyControls(document);
    enhancePayableCategoryFilter();
    enhanceDashboardFilters();
    const observer = new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE) classifyControls(node.matches?.('.pagina') ? node : node);
    })));
    observer.observe(document.body, { childList: true, subtree: true });
    document.documentElement.dataset.appDesignSystem = '1';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();

