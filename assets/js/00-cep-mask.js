(function configurarMascaraCepLoja() {
  document.addEventListener('input', (ev) => {
    const id = ev.target?.id || '';
    if (!['configCepLoja', 'cepLojaCadastro', 'saasCepLoja'].includes(id)) return;
    if (typeof formatarCepLoja === 'function') {
      ev.target.value = formatarCepLoja(ev.target.value || '');
    }
  });
})();
