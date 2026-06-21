// ---- INIT ----
registrarServiceWorkerPwa();
atualizarRelogioTopbar();
atualizarQuintoDiaUtilTopbar();
window.setInterval(atualizarRelogioTopbar, 1000);
window.setInterval(atualizarQuintoDiaUtilTopbar, 60 * 60 * 1000);
// Consumo otimizado: sem polling pesado; carregamento por tela, ação do usuário e Realtime filtrado por loja/empresa.
iniciarAtualizacaoAutomatica();
window.setTimeout(() => {
  forcarCampoObservacaoTarefaEmBranco();
  redefinirCampoBuscaTarefas();
}, 250);
