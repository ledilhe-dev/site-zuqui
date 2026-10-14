// Copie para config.hostinger.js e preencha somente a chave PUBLICA da VPS.
// Nunca coloque service_role, sb_secret ou senha de banco neste arquivo.
window.APP_CONFIG = {
  backendName: 'hostinger',
  supabaseUrl: 'https://api.checkdiario.com.br',
  supabaseAnonKey: '',
  emailFunctionName: 'notificar-alertas-email',
  authEmailFunctionName: 'autenticacao-email',
  authRedirectUrl: 'https://checkdiario.com.br/',
  appVersion: '3.4.0',
  appVersionLabel: '3.4.0-checkia-vencimentos-telegram',
};
