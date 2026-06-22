create or replace function public.verificar_senha_funcionario(p_funcionario_id uuid, p_senha text)
returns boolean
language sql
security definer
set search_path = public, private, extensions
as $$
  select exists (
    select 1
    from private.credenciais_sistema c
    join public.funcionarios f on f.id = c.entidade_id
    where c.tipo = 'funcionario'
      and c.finalidade = 'login'
      and c.entidade_id = p_funcionario_id
      and f.ativo is true
      and nullif(trim(p_senha), '') is not null
      and c.segredo_hash = extensions.crypt(trim(p_senha), c.segredo_hash)
  );
$$;

revoke all on function public.verificar_senha_funcionario(uuid, text) from public, anon, authenticated;
grant execute on function public.verificar_senha_funcionario(uuid, text) to service_role;
