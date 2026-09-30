(function aplicarIconesDaBarraLateral() {
  const icon = (content) => `<svg class="nav-icon-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${content}</svg>`;
  const icons = {
    bater_ponto: icon('<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/><path d="M9 2h6"/>'),
    escala_plantoes: icon('<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01"/>'),
    checklist: icon('<rect x="5" y="3" width="14" height="18" rx="3"/><path d="M9 3.5h6M8.5 11l2 2 4.5-5M9 17h6"/>'),
    tarefas_rapidas: icon('<path d="M12 3a6 6 0 0 0-3.7 10.7c.7.6 1.2 1.3 1.3 2.3h4.8c.1-1 .6-1.7 1.3-2.3A6 6 0 0 0 12 3Z"/><path d="M10 20h4M9.5 17.5h5M12 6v3"/>'),
    meu_painel: icon('<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="4" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="11" width="7" height="10" rx="2"/>'),
    dashboard: icon('<path d="M4 19a8 8 0 1 1 16 0"/><path d="m12 13 4-4M6.5 15h.01M17.5 15h.01M12 7h.01"/>'),
    estatisticas_atendimento: icon('<path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/><path d="m4 6 5-3 5 4 6-4"/>'),
    relatorios: icon('<path d="M6 2h9l4 4v16H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z"/><path d="M14 2v5h5M8 17v-3M12 17v-6M16 17V9"/>'),
    raffinato: icon('<path d="M5 20V7l7-4 7 4v13M3 20h18M8 10h8M8 14h8"/><path d="M9 20v-3h6v3"/>'),
    financeiro: icon('<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5c-.7-.7-1.8-1.1-3.2-1.1-1.8 0-3 .9-3 2.2 0 3.4 6.2 1.5 6.2 4.8 0 1.4-1.3 2.3-3.2 2.3-1.5 0-2.8-.5-3.7-1.4M12 5.5v13"/>'),
    integracoes_financeiras: icon('<path d="M4 7h16v11H4zM4 10h16M8 15h3"/><path d="M7 7V5h10v2"/>'),
    administracao_funcionarios: icon('<circle cx="9" cy="8" r="3"/><path d="M3.5 19c.5-4 2.3-6 5.5-6s5 2 5.5 6"/><circle cx="17.5" cy="9" r="2"/><path d="M15.5 14c2.8-.4 4.6 1.3 5 4"/>'),
    configuracoes: icon('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/>'),
    saas: icon('<path d="M4 20V6l8-3 8 3v14M8 9h2M14 9h2M8 13h2M14 13h2M9 20v-3h6v3"/>')
  };

  const targets = [
    ['[data-nav-item-id="bater_ponto"] > .nav-btn', 'bater_ponto'],
    ['[data-nav-item-id="escala_plantoes"] > .nav-btn', 'escala_plantoes'],
    ['[data-nav-item-id="checklist"] #btnMenuChecklist', 'checklist'],
    ['[data-nav-item-id="tarefas_rapidas"] > .nav-btn', 'tarefas_rapidas'],
    ['[data-nav-item-id="meu_painel"] > .nav-btn', 'meu_painel'],
    ['[data-nav-item-id="dashboard"] > .nav-btn', 'dashboard'],
    ['[data-nav-item-id="estatisticas_atendimento"] > .nav-btn', 'estatisticas_atendimento'],
    ['#btnMenuRelatorios', 'relatorios'],
    ['[data-nav-item-id="raffinato"].nav-btn', 'raffinato'],
    ['#btnMenuFinanceiro', 'financeiro'],
    ['#btnMenuIntegracoesFinanceiras', 'integracoes_financeiras'],
    ['#btnMenuFuncionarios', 'administracao_funcionarios'],
    ['#btnMenuConfiguracoes', 'configuracoes'],
    ['#btnMenuSaas', 'saas']
  ];

  function decorateButton(button, name) {
    if (!button || !icons[name]) return;
    let holder = button.querySelector(':scope > .icon, :scope > span > .icon');
    if (holder && button.dataset.sidebarIcon === name && holder.classList.contains('nav-icon-polished')) return;
    if (!holder) {
      holder = document.createElement('span');
      holder.className = 'icon';
      const directCopy = button.querySelector(':scope > .nav-copy');
      const contentRow = button.querySelector(':scope > span:has(.nav-copy)');
      if (contentRow) contentRow.insertBefore(holder, contentRow.firstChild);
      else if (directCopy) button.insertBefore(holder, directCopy);
      else button.insertBefore(holder, button.firstChild);
    }
    holder.innerHTML = icons[name];
    holder.classList.add('nav-icon-polished');
    button.dataset.sidebarIcon = name;
  }

  function applyAll() {
    targets.forEach(([selector, name]) => decorateButton(document.querySelector(selector), name));
  }

  applyAll();
  const nav = document.getElementById('navContainer');
  if (nav) new MutationObserver(applyAll).observe(nav, { childList: true, subtree: true });
})();
