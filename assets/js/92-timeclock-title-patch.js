(function(){
  function moverInfoParaTitulo(){
    var btn = document.getElementById('btnInfoRegrasPonto');
    var titulo = document.querySelector('#bater_ponto .ponto-topo-grid > .card:first-child .card-title');
    if (!btn || !titulo || btn.parentElement === titulo) return;
    titulo.appendChild(btn);
  }
  document.addEventListener('DOMContentLoaded', function(){
    setTimeout(moverInfoParaTitulo, 350);
    setTimeout(moverInfoParaTitulo, 1200);
  });
  setTimeout(moverInfoParaTitulo, 350);
  setTimeout(moverInfoParaTitulo, 1200);
})();
