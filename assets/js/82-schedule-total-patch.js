(function(){
  function byId(id){ return document.getElementById(id); }
  function moeda(v){
    var n = Number(v || 0);
    try { return n.toLocaleString('pt-BR', { style:'currency', currency:'BRL' }); }
    catch(_e){ return 'R$ ' + n.toFixed(2).replace('.', ','); }
  }
  function dataCurta(dataIso){
    var p = String(dataIso || '').slice(0,10).split('-');
    return p.length === 3 ? p[2] + '/' + p[1] : '';
  }
  function eventos(){
    try {
      if (Array.isArray(window.escalaPlantoesEventos)) return window.escalaPlantoesEventos;
      if (typeof escalaPlantoesEventos !== 'undefined' && Array.isArray(escalaPlantoesEventos)) return escalaPlantoesEventos;
    } catch(_e) {}
    return [];
  }
  function garantirCampo(){
    var card = byId('escalaTotalPagoCard');
    if (card) return card;
    var calendario = byId('escalaCalendarioGrid');
    if (!calendario || !calendario.parentElement) return null;
    card = document.createElement('div');
    card.id = 'escalaTotalPagoCard';
    card.className = 'escala-total-pago';
    card.setAttribute('data-permissao-valor-escala', '');
    card.innerHTML = '<div class="escala-total-pago-label">R$ PAGO</div><div class="escala-total-pago-valor" id="escalaTotalPagoValor">R$ 0,00</div>';
    calendario.parentElement.insertBefore(card, calendario);
    return card;
  }
  function atualizar(dataIso){
    var card = garantirCampo();
    var valorEl = byId('escalaTotalPagoValor');
    var labelEl = card && card.querySelector('.escala-total-pago-label');
    if (!card || !valorEl) return;
    var podeVer = typeof window.usuarioPodeVerValorCombinadoEscala === 'function' ? window.usuarioPodeVerValorCombinadoEscala() : true;
    card.style.display = podeVer ? '' : 'none';
    if (!podeVer) return;
    var dataFiltro = String(dataIso || '').slice(0,10);
    var total = eventos().reduce(function(acc, item){
      if (!item || item.deleted_at) return acc;
      if (String(item.tipo || 'plantao').toLowerCase() !== 'plantao') return acc;
      if (dataFiltro && String(item.data_plantao || '').slice(0,10) !== dataFiltro) return acc;
      var bruto = item.valor_combinado;
      if (bruto === null || bruto === undefined || bruto === '') return acc;
      var valor = Number(String(bruto).replace(',', '.'));
      return Number.isFinite(valor) ? acc + valor : acc;
    }, 0);
    if (labelEl) labelEl.textContent = dataFiltro ? ('R$ PAGO ' + dataCurta(dataFiltro)) : 'R$ PAGO';
    valorEl.textContent = moeda(total);
    if (typeof window.aplicarPermissaoValorCombinadoEscala === 'function') window.aplicarPermissaoValorCombinadoEscala();
  }
  function envolver(nome){
    var original = window[nome];
    if (typeof original !== 'function' || original.__totalPagoPlantaoPatch) return;
    window[nome] = function(){
      var retorno = original.apply(this, arguments);
      Promise.resolve(retorno).finally(function(){ setTimeout(atualizar, 0); });
      return retorno;
    };
    window[nome].__totalPagoPlantaoPatch = true;
  }
  function instalar(){
    garantirCampo();
    envolver('renderizarEscalaPlantoes');
    envolver('carregarEscalaPlantoes');
    envolver('salvarPlantaoEscala');
    envolver('excluirPlantaoEscala');
    atualizar();
  }
  window.atualizarTotalPagoPlantaoEscala = atualizar;
  document.addEventListener('DOMContentLoaded', function(){ setTimeout(instalar, 300); setTimeout(instalar, 1200); });
  setTimeout(instalar, 300);
  setTimeout(instalar, 1500);
})();
