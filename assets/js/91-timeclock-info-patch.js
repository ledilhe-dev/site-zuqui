(function(){
  function byId(id){ return document.getElementById(id); }
  function abrirInfoPonto(){
    var modal = byId('pontoInfoRegrasModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'pontoInfoRegrasModal';
      modal.className = 'ponto-info-modal-overlay';
      modal.hidden = true;
      modal.innerHTML = '<div class="ponto-info-modal-card" role="dialog" aria-modal="true" aria-labelledby="pontoInfoRegrasTitulo">'+
        '<h3 id="pontoInfoRegrasTitulo">Regras do ponto</h3>'+
        '<p>O ponto usa uma sequência única para evitar bloqueios quando houver ajuste manual ou mais de um intervalo.</p>'+
        '<ul>'+
          '<li><strong>1ª batida:</strong> abre a jornada.</li>'+
          '<li><strong>2ª batida:</strong> inicia o intervalo.</li>'+
          '<li><strong>3ª batida:</strong> retorna do intervalo e mantém a jornada aberta.</li>'+
          '<li><strong>4ª batida:</strong> pode iniciar um segundo intervalo, se ainda não for saída final.</li>'+
          '<li><strong>5ª batida:</strong> retorna do segundo intervalo.</li>'+
          '<li><strong>6ª batida:</strong> fecha a jornada do dia.</li>'+
          '<li>Se o funcionário não retornar em até 2 horas após uma saída para intervalo, essa batida passa a ser interpretada nos cálculos como saída final. O registro original não é alterado.</li>'+
          '<li>O ponto só fecha definitivamente com a saída final registrada ou no encerramento do dia às 23:59 no horário de Brasília.</li>'+
          '<li>Ajustes manuais entram na mesma sequência das batidas normais e não devem bloquear batidas futuras.</li>'+
        '</ul>'+
        '<div class="ponto-info-modal-actions"><button class="btn btn-green" type="button" id="btnFecharInfoPonto">Entendi</button></div>'+
      '</div>';
      document.body.appendChild(modal);
      modal.addEventListener('click', function(ev){ if (ev.target === modal) modal.hidden = true; });
      modal.querySelector('#btnFecharInfoPonto').addEventListener('click', function(){ modal.hidden = true; });
    }
    modal.hidden = false;
  }
  function inserirBotaoInfo(){
    var row = document.querySelector('#bater_ponto .ponto-registro-row');
    if (!row || byId('btnInfoRegrasPonto')) return;
    var btn = document.createElement('button');
    btn.id = 'btnInfoRegrasPonto';
    btn.type = 'button';
    btn.className = 'btn btn-ghost ponto-info-regra-btn';
    btn.title = 'Regras do ponto';
    btn.setAttribute('aria-label', 'Regras do ponto');
    btn.textContent = 'I';
    btn.addEventListener('click', abrirInfoPonto);
    row.appendChild(btn);
  }
  window.abrirInfoRegrasPonto = abrirInfoPonto;
  document.addEventListener('DOMContentLoaded', inserirBotaoInfo);
  setTimeout(inserirBotaoInfo, 300);
  setTimeout(inserirBotaoInfo, 1200);
})();
