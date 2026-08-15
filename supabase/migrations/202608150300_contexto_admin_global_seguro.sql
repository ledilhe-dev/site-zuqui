-- Sessao opaca para separar autoridade global do contexto operacional.
create table if not exists private.sessoes_admin_global (
  token_hash text primary key,
  funcionario_id uuid not null references public.funcionarios(id) on delete cascade,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null default (now() + interval '30 days'),
  revogado_em timestamptz
);
create index if not exists sessoes_admin_global_funcionario_idx
  on private.sessoes_admin_global (funcionario_id, expira_em desc);

create or replace function public.autenticar_funcionario_contexto(p_identificador text, p_senha text)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
set statement_timeout = '10s'
as $$
declare
  v_funcionario public.funcionarios%rowtype;
  v_perfil public.perfis%rowtype;
  v_token text;
begin
  select f.* into v_funcionario
  from public.funcionarios f
  join private.credenciais_sistema c
    on c.tipo = 'funcionario' and c.entidade_id = f.id and c.finalidade = 'login'
  where f.ativo is true
    and nullif(trim(p_senha), '') is not null
    and (
      lower(trim(coalesce(f.email, ''))) = lower(trim(p_identificador))
      or (f.senha_troca_obrigatoria is true and lower(trim(coalesce(f.nome, ''))) = lower(trim(p_identificador)))
    )
    and c.segredo_hash = extensions.crypt(trim(p_senha), c.segredo_hash)
  order by case when lower(trim(coalesce(f.email, ''))) = lower(trim(p_identificador)) then 0 else 1 end
  limit 1;
  if v_funcionario.id is null then return null; end if;
  select * into v_perfil from public.perfis where id = v_funcionario.perfil_id;
  if v_funcionario."é_administrador" is true then
    v_token := gen_random_uuid()::text || replace(gen_random_uuid()::text, '-', '');
    insert into private.sessoes_admin_global(token_hash, funcionario_id)
    values (encode(extensions.digest(v_token, 'sha256'), 'hex'), v_funcionario.id);
  end if;
  return (to_jsonb(v_funcionario) - 'pin')
    || jsonb_build_object('perfis', to_jsonb(v_perfil), 'global_admin_token', v_token);
end;
$$;

create or replace function public.validar_sessao_admin_global(p_funcionario_id uuid, p_token text)
returns boolean
language sql
security definer
stable
set search_path = public, private, extensions
as $$
  select exists (
    select 1
    from private.sessoes_admin_global s
    join public.funcionarios f on f.id = s.funcionario_id
    where s.funcionario_id = p_funcionario_id
      and s.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
      and s.revogado_em is null and s.expira_em > now()
      and f.ativo is true and f."é_administrador" is true
  );
$$;

revoke all on function public.autenticar_funcionario_contexto(text, text) from public;
revoke all on function public.validar_sessao_admin_global(uuid, text) from public;
grant execute on function public.autenticar_funcionario_contexto(text, text) to anon, authenticated;
grant execute on function public.validar_sessao_admin_global(uuid, text) to anon, authenticated;

create or replace function public.obter_painel_admin_global(p_funcionario_id uuid, p_token text)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, private, extensions
as $$
declare v_result jsonb;
begin
  if not public.validar_sessao_admin_global(p_funcionario_id, p_token) then
    raise exception 'Acesso global nao autorizado' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'empresas', coalesce((select jsonb_agg(to_jsonb(e) order by e.nome) from public.empresas e), '[]'::jsonb),
    'lojas', coalesce((select jsonb_agg(to_jsonb(l) order by l.nome) from public.lojas l), '[]'::jsonb),
    'usuarios', coalesce((select jsonb_agg((to_jsonb(f) - 'pin') order by f.nome) from public.funcionarios f), '[]'::jsonb),
    'conectores', coalesce((select jsonb_agg(to_jsonb(r) order by r.atualizado_em desc) from public.raffinato_integracoes r), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function public.obter_painel_admin_global(uuid, text) from public;
grant execute on function public.obter_painel_admin_global(uuid, text) to anon, authenticated;
