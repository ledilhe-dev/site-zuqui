window.addEventListener('load', function() {
  try {
    var url = new URL(window.location.href);
    var changed = false;
    Array.from(url.searchParams.keys()).forEach(function(key) {
      var k = String(key || '').toLowerCase();
      if (k === 'atualizacao' || k.indexOf('campo_password') === 0 || k.indexOf('campo_seguro') === 0) {
        url.searchParams.delete(key);
        changed = true;
      }
    });
    if (changed && window.history && window.history.replaceState) {
      window.history.replaceState({}, document.title, url.pathname + (url.search || '') + (url.hash || ''));
    }
  } catch (e) {}
});
