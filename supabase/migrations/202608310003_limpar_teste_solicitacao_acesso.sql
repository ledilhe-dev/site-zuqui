-- Remove exclusivamente o registro técnico criado no teste de publicação da RPC pública.
delete from public.solicitacoes_acesso
where email = 'teste-publicacao-acesso-20260831@checkdiario.invalid';
