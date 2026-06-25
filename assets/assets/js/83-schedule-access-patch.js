(function(){
  'use strict';
  function normalizar(v){
    return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
  }
  function ehAdmEscala(){
    try {
      if (typeof usuarioEhAdministrador === 'function' && usuarioEhAdministrador()) return true;
      if (typeof usuarioTemPermissao === 'function' && usuarioTemPermissao('cadastro_plantao')) return true;
      var u = window.usuarioSistemaLogado || (typeof usuarioSistemaLogado !== 'undefined' ? usuarioSistemaLogado : null);
      var codigo = normalizar(u && u.perfil && u.perfil.codigo || u && u.perfil_codigo || u && u.tipo || '');
      return codigo === 'ADM' || codigo === 'ADMIN' || codigo === 'ADMINISTRADOR' || codigo === 'MASTER';
    } catch (_e) {
      return false;
    }
  }
  window.usuarioPodeGerenciarEscala = ehAdmEscala;

  function podeExcluirAgenda(){
    try {
      if (typeof usuarioEhAdministrador === 'function' && usuarioEhAdministrador()) return true;
      if (typeof usuarioTemPermissao === 'function') return usuarioTemPermissao('excluir_agenda_cadastrada');
      return false;
    } catch (_e) { return false; }
  }
  window.usuarioPodeExcluirAgenda = podeExcluirAgenda;

  function msgModal(texto, tipo){
    try {
      if (typeof msg === 'function') msg('msgModalEscalaPlantao', texto, tipo || 'err');
      else {
        var el = document.getElementById('msgModalEscalaPlantao');
        if (el) el.textContent = texto || '';
      }
    } catch (_e) {}
  }

  function aplicarModoEscala(){
    var pode = ehAdmEscala();
    var podeExcluir = podeExcluirAgenda();
    document.body.classList.toggle('escala-somente-visualizacao', !pode);

    document.querySelectorAll('#escala_plantoes .escala-side-title button, #escala_plantoes button[onclick="abrirModalCadastroPlantaoEscala()"], #escala_plantoes button[onclick^="abrirModalCadastroPlantaoEscala("]').forEach(function(btn){
      btn.style.display = pode ? '' : 'none';
      btn.disabled = !pode;
    });

    var modal = document.getElementById('modalEscalaPlantao');
    if (!modal) return;
    modal.classList.toggle('escala-modal-readonly', !pode);

    ['escalaPlantaoFuncionario','escalaPlantaoInicio','escalaPlantaoFim','escalaPlantaoTipo','escalaPlantaoTitulo','escalaPlantaoValor','escalaPlantaoObservacao'].forEach(function(id){
      var el = document.getElementById(id);
      if (el) el.disabled = !pode;
    });

    var btnSalvar = document.getElementById('btnSalvarPlantaoEscala');
    var btnExcluir = document.getElementById('btnExcluirPlantaoEscala');
    if (btnSalvar) btnSalvar.style.display = pode ? '' : 'none';
    if (btnExcluir) btnExcluir.style.display = podeExcluir ? btnExcluir.style.display : 'none';

    var titulo = document.getElementById('escalaModalTitulo');
    if (titulo && !pode) titulo.textContent = 'Visualizar escala';
  }
  window.aplicarModoEscalaPorPerfil = aplicarModoEscala;

  function envolver(nome, wrapper){
    var tentativas = 0;
    var timer = setInterval(function(){
      tentativas++;
      if (typeof window[nome] === 'function' && !window[nome].__perfilEscalaPatch) {
        var original = window[nome];
        var nova = wrapper(original);
        nova.__perfilEscalaPatch = true;
        window[nome] = nova;
        clearInterval(timer);
      }
      if (tentativas > 80) clearInterval(timer);
    }, 100);
  }

  envolver('abrirModalCadastroPlantaoEscala', function(original){
    return async function(dataIso){
      await original.apply(this, arguments);
      aplicarModoEscala();
      if (!ehAdmEscala()) msgModal('Visualização apenas. Seu perfil não permite lançar ou editar a Agenda.', 'ok');
    };
  });

  envolver('abrirModalEditarPlantaoEscala', function(original){
    return async function(id){
      await original.apply(this, arguments);
      aplicarModoEscala();
      if (!ehAdmEscala()) msgModal('Visualização apenas. Seu perfil não permite editar a Agenda.', 'ok');
    };
  });

  envolver('salvarPlantaoEscala', function(original){
    return async function(){
      if (!ehAdmEscala()) {
        aplicarModoEscala();
        msgModal('Sem permissão para salvar itens da Agenda.', 'err');
        return;
      }
      return await original.apply(this, arguments);
    };
  });

  envolver('excluirPlantaoEscala', function(original){
    return async function(){
      if (!podeExcluirAgenda()) {
        aplicarModoEscala();
        msgModal('Seu perfil não permite excluir itens da Agenda.', 'err');
        return;
      }
      return await original.apply(this, arguments);
    };
  });

  document.addEventListener('click', function(ev){
    var btnNovo = ev.target.closest && ev.target.closest('#escala_plantoes .escala-side-title button, #escala_plantoes button[onclick="abrirModalCadastroPlantaoEscala()"]');
    if (btnNovo && !ehAdmEscala()) {
      ev.preventDefault();
      ev.stopPropagation();
      return false;
    }
    var acaoSalvar = ev.target.closest && ev.target.closest('#btnSalvarPlantaoEscala, [data-escala-salvar]');
    var acaoExcluir = ev.target.closest && ev.target.closest('#btnExcluirPlantaoEscala, [data-escala-excluir]');
    if ((acaoSalvar && !ehAdmEscala()) || (acaoExcluir && !podeExcluirAgenda())) {
      ev.preventDefault();
      ev.stopPropagation();
      aplicarModoEscala();
      msgModal(acaoExcluir ? 'Seu perfil não permite excluir itens da Agenda.' : 'Seu perfil não permite alterar a Agenda.', 'err');
      return false;
    }
  }, true);

  document.addEventListener('DOMContentLoaded', function(){
    setTimeout(aplicarModoEscala, 500);
    setTimeout(aplicarModoEscala, 1500);
  });
  setInterval(function(){
    if (document.getElementById('escala_plantoes')) aplicarModoEscala();
  }, 3000);
})();
