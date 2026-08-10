(function bloquearGerenciadorSenhasNavegador() {
  function ehCampoLoginReal(input) {
    return input && (input.id === 'username' || input.id === 'password' || input.closest('#loginForm'));
  }

  function ehCampoSenhaOuPin(input) {
    if (ehCampoLoginReal(input)) return false;
    var alvo = [
      input.type,
      input.name,
      input.id,
      input.placeholder,
      input.getAttribute('aria-label'),
      input.getAttribute('data-campo')
    ].join(' ').toLowerCase();
    return alvo.includes('senha') || alvo.includes('password') || alvo.includes('pin');
  }

  function reforcarAtributos(input) {
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('autocorrect', 'off');
    input.setAttribute('autocapitalize', 'off');
    input.setAttribute('spellcheck', 'false');
    input.setAttribute('data-lpignore', 'true');
    input.setAttribute('data-1p-ignore', 'true');
    input.setAttribute('data-bwignore', 'true');
    input.setAttribute('data-form-type', 'other');
    input.setAttribute('data-no-password-manager', 'true');

    // A senha SQL do Raffinato possui controle próprio de Mostrar/Ocultar.
    // Não converta o tipo nem aplique a máscara CSS global neste campo.
    if (input.id === 'raffinatoDbPassword') {
      input.classList.remove('pin-secure-input');
      return;
    }

    // Campos de PIN/senha dentro do sistema não podem ser reconhecidos pelo navegador como senha real.
    // Mantemos o valor normal para o JS, mas mascaramos visualmente com CSS.
    if (input.type === 'password') {
      try { input.type = 'text'; } catch (_) {}
    }
    input.classList.add('pin-secure-input');

    if (!input.name || /password|senha|pin/i.test(input.name)) {
      input.name = 'campo_' + (input.id || 'seguro') + '_' + Math.random().toString(36).slice(2, 8);
    }
  }

  function inserirCamposIsca(form) {
    if (!form || form.querySelector('[data-password-decoy="true"]')) return;
    var fakeUser = document.createElement('input');
    fakeUser.type = 'text';
    fakeUser.setAttribute('data-password-decoy', 'true');
    fakeUser.setAttribute('autocomplete', 'username');
    fakeUser.tabIndex = -1;
    fakeUser.style.cssText = 'position:absolute;left:-9999px;opacity:0;width:1px;height:1px;pointer-events:none;';

    var fakePass = document.createElement('input');
    fakePass.type = 'password';
    fakePass.setAttribute('data-password-decoy', 'true');
    fakePass.setAttribute('autocomplete', 'current-password');
    fakePass.tabIndex = -1;
    fakePass.style.cssText = 'position:absolute;left:-9999px;opacity:0;width:1px;height:1px;pointer-events:none;';

    form.insertBefore(fakePass, form.firstChild);
    form.insertBefore(fakeUser, form.firstChild);
  }

  function aplicarBloqueioSenha() {
    try {
      document.querySelectorAll('form').forEach(function(form) {
        if (form.id === 'loginForm') {
          form.setAttribute('autocomplete', 'on');
          form.removeAttribute('data-lpignore');
          form.removeAttribute('data-1p-ignore');
          form.removeAttribute('data-bwignore');
          form.setAttribute('data-form-type', 'login');
          return;
        }
        form.setAttribute('autocomplete', 'off');
        form.setAttribute('data-lpignore', 'true');
        form.setAttribute('data-1p-ignore', 'true');
        form.setAttribute('data-form-type', 'other');
        inserirCamposIsca(form);
      });

      document.querySelectorAll('input').forEach(function(input) {
        if (ehCampoSenhaOuPin(input)) reforcarAtributos(input);
      });
    } catch (e) {
      console.warn('Não foi possível aplicar bloqueio do gerenciador de senhas:', e);
    }
  }

  aplicarBloqueioSenha();
  document.addEventListener('DOMContentLoaded', aplicarBloqueioSenha);
  document.addEventListener('focusin', aplicarBloqueioSenha, true);
  document.addEventListener('input', aplicarBloqueioSenha, true);
  window.addEventListener('load', aplicarBloqueioSenha);
  window.bloquearGerenciadorSenhasNavegador = aplicarBloqueioSenha;
})();
