// config.js â€” ConfiguraÃ§Ãµes do Check DiÃ¡rio
// NOTA DE SEGURANÃ‡A:
//   â€¢ A anon key do Supabase Ã© PÃšBLICA por design (equivalente a uma chave de API pÃºblica).
//     Os dados sÃ£o protegidos pelas polÃ­ticas de Row Level Security (RLS) no Supabase.
//   â€¢ NUNCA coloque a service_role key aqui.
//   â€¢ O arquivo config.js pode ser carregado separadamente e ignorado pelo Git (.gitignore).
//   â€¢ Credenciais de login de funcionÃ¡rios sÃ£o gerenciadas exclusivamente pelo Supabase.

window.APP_CONFIG = {
  supabaseUrl: 'https://api.checkdiario.com.br',
  supabaseAnonKey: 'sb_publishable_5YbK969xkPlJe8MS15FXDZ_rNF1XJOd',
  emailFunctionName: 'notificar-alertas-email',
  authEmailFunctionName: 'autenticacao-email',
  authRedirectUrl: 'https://checkdiario.com.br/',
  appVersion: '3.4.0',
  appVersionLabel: '3.4.0-checkia-vencimentos-telegram',
};
