create or replace function public.autenticar_funcionario(p_identificador text, p_senha text)
returns jsonb
language sql
security definer
set search_path = public, private, extensions
set statement_timeout = '10s'
as $$
  with candidatos as materialized (
    select f.*
    from public.funcionarios f
    where f.ativo is true
      and (
        lower(trim(coalesce(f.email, ''))) = lower(trim(p_identificador))
        or (f.senha_troca_obrigatoria is true and lower(trim(coalesce(f.nome, ''))) = lower(trim(p_identificador)))
      )
    order by case when lower(trim(coalesce(f.email, ''))) = lower(trim(p_identificador)) then 0 else 1 end
    limit 5
  )
  select (to_jsonb(f) - 'pin') || jsonb_build_object('perfis', to_jsonb(p))
  from candidatos f
  join private.credenciais_sistema c
    on c.tipo = 'funcionario' and c.entidade_id = f.id and c.finalidade = 'login'
  left join public.perfis p on p.id = f.perfil_id
  where nullif(trim(p_senha), '') is not null
    and c.segredo_hash = extensions.crypt(trim(p_senha), c.segredo_hash)
  limit 1;
$$;

revoke all on function public.autenticar_funcionario(text, text) from public;
grant execute on function public.autenticar_funcionario(text, text) to anon, authenticated;
