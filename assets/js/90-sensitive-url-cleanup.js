function limparParametrosSensiveisDaUrl() {
  try {
    var url = new URL(window.location.href);
    var changed = false;
    var versaoTecnica = String(url.searchParams.get('v') || '').toLowerCase();
    var veioDeAtualizacaoForcada = versaoTecnica.indexOf('forcar-atualizacao-cache') >= 0;
    Array.from(url.searchParams.keys()).forEach(function(key) {
      var k = String(key || '').toLowerCase();
      var parametroTecnicoAtualizacao = veioDeAtualizacaoForcada && (k === 'v' || k === 't');
      if (parametroTecnicoAtualizacao || k === 'atualizacao' || /^(username|password|passwd|pwd|senha|usuario)$/.test(k) || k.indexOf('campo_password') === 0 || k.indexOf('campo_seguro') === 0) {
        url.searchParams.delete(key);
        changed = true;
      }
    });
    if (changed && window.history && window.history.replaceState) {
      window.history.replaceState({}, document.title, url.pathname + (url.search || '') + (url.hash || ''));
    }
  } catch (e) {}
}
limparParametrosSensiveisDaUrl();
window.addEventListener('pageshow', limparParametrosSensiveisDaUrl);
