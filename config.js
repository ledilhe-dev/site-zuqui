// config.js — Configurações do Check Diário
// NOTA DE SEGURANÇA:
//   • A anon key do Supabase é PÚBLICA por design (equivalente a uma chave de API pública).
//     Os dados são protegidos pelas políticas de Row Level Security (RLS) no Supabase.
//   • NUNCA coloque a service_role key aqui.
//   • O arquivo config.js pode ser carregado separadamente e ignorado pelo Git (.gitignore).
//   • Credenciais de login de funcionários são gerenciadas exclusivamente pelo Supabase.

window.APP_CONFIG = {
  supabaseUrl: 'https://tqfoxqbmslxoynrasltl.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxZm94cWJtc2x4b3lucmFzbHRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1OTU0NDgsImV4cCI6MjA5MjE3MTQ0OH0.2pFQGzMKyYe6P30txCFLCVcNO-Nwjk-zEWknZwNXz88',
  emailFunctionName: 'notificar-alertas-email',
  authEmailFunctionName: 'autenticacao-email',
  authRedirectUrl: 'https://checkdiario.com.br/',
  appVersion: '3.2.10',
  appVersionLabel: '3.2.10-agenda-responsaveis-vinculo',
};
