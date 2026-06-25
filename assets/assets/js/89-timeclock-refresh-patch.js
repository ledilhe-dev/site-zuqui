(function patchPontoAtualizarPrimeiroClique() {
  function obterFuncionarioFiltroPontoSeguro() {
    try {
      return (typeof obterFuncionarioRestritoLogadoIdParaPonto === 'function'
        ? (obterFuncionarioRestritoLogadoIdParaPonto() || '')
        : '');
    } catch (e) {
      return '';
    }
  }

  async function atualizarPontoTelaAgora() {
    try {
      const funcionarioId = obterFuncionarioFiltroPontoSeguro();
      if (typeof carregarResumoPontoHoje === 'function') {
        await carregarResumoPontoHoje(funcionarioId);
      }
    } catch (e) {
      console.warn('Não foi possível atualizar o status do ponto:', e);
    }

    try {
      if (typeof carregarHorasDashboard === 'function') {
        await carregarHorasDashboard();
      }
    } catch (e) {
      console.warn('Não foi possível atualizar horas do ponto:', e);
    }
  }

  function agendarAtualizacaoPonto() {
    setTimeout(atualizarPontoTelaAgora, 150);
    setTimeout(atualizarPontoTelaAgora, 650);
    setTimeout(atualizarPontoTelaAgora, 1400);
  }

  // Ao abrir a tela Bater ponto, força a atualização após a página ficar ativa.
  if (typeof window.abrirPagina === 'function' && !window.abrirPagina.__patchPontoPrimeiroClique) {
    const abrirPaginaOriginal = window.abrirPagina;
    window.abrirPagina = function(id, botao) {
      const retorno = abrirPaginaOriginal.apply(this, arguments);
      if (id === 'bater_ponto') {
        agendarAtualizacaoPonto();
      }
      return retorno;
    };
    window.abrirPagina.__patchPontoPrimeiroClique = true;
  }

  // Depois de registrar ponto, atualiza novamente para não precisar clicar duas vezes.
  if (typeof window.registrarPontoFuncionario === 'function' && !window.registrarPontoFuncionario.__patchPontoPrimeiroClique) {
    const registrarOriginal = window.registrarPontoFuncionario;
    window.registrarPontoFuncionario = async function() {
      const retorno = await registrarOriginal.apply(this, arguments);
      agendarAtualizacaoPonto();
      return retorno;
    };
    window.registrarPontoFuncionario.__patchPontoPrimeiroClique = true;
  }

  window.atualizarPontoTelaAgora = atualizarPontoTelaAgora;
})();
