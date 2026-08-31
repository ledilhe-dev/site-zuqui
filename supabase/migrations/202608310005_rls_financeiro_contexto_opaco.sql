create table if not exists private.sessoes_operacionais (
  token_hash text primary key,
  principal_tipo text not null check (principal_tipo in ('funcionario','usuario_admin')),
  principal_id uuid not null,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null default (now() + interval '30 days'),
  revogado_em timestamptz
);
revoke all on private.sessoes_operacionais from public, anon, authenticated;

create or replace function private.emitir_sessao_operacional(p_tipo text, p_id uuid)
returns text language plpgsql security definer
set search_path = pg_catalog, private, extensions
as $$ declare v_token text;
begin
  v_token := gen_random_uuid()::text || replace(gen_random_uuid()::text, '-', '');
  insert into private.sessoes_operacionais(token_hash, principal_tipo, principal_id)
  values (encode(extensions.digest(v_token, 'sha256'), 'hex'), p_tipo, p_id);
  return v_token;
end $$;

create or replace function public.autenticar_funcionario_contexto(p_identificador text, p_senha text)
returns jsonb language plpgsql security definer
set search_path = public, private, extensions set statement_timeout = '10s'
as $$
declare v_funcionario public.funcionarios%rowtype; v_perfil public.perfis%rowtype;
  v_token_global text; v_token_operacional text;
begin
  select f.* into v_funcionario
  from public.funcionarios f join private.credenciais_sistema c
    on c.tipo='funcionario' and c.entidade_id=f.id and c.finalidade='login'
  where f.ativo is true and nullif(trim(p_senha),'') is not null
    and (lower(trim(coalesce(f.email,'')))=lower(trim(p_identificador))
      or (f.senha_troca_obrigatoria is true and lower(trim(coalesce(f.nome,'')))=lower(trim(p_identificador))))
    and c.segredo_hash=extensions.crypt(trim(p_senha),c.segredo_hash)
  order by case when lower(trim(coalesce(f.email,'')))=lower(trim(p_identificador)) then 0 else 1 end limit 1;
  if v_funcionario.id is null then return null; end if;
  select * into v_perfil from public.perfis where id=v_funcionario.perfil_id;
  v_token_operacional := private.emitir_sessao_operacional('funcionario', v_funcionario.id);
  if v_funcionario."é_administrador" is true then
    v_token_global := gen_random_uuid()::text || replace(gen_random_uuid()::text,'-','');
    insert into private.sessoes_admin_global(token_hash,funcionario_id)
    values(encode(extensions.digest(v_token_global,'sha256'),'hex'),v_funcionario.id);
  end if;
  return (to_jsonb(v_funcionario)-'pin') || jsonb_build_object(
    'perfis',to_jsonb(v_perfil),'global_admin_token',v_token_global,
    'operational_access_token',v_token_operacional);
end $$;

create or replace function public.autenticar_usuario_admin(p_identificador text, p_senha text)
returns jsonb language plpgsql security definer
set search_path = public, private, extensions
as $$ declare v_admin public.usuarios_admin%rowtype; v_token text;
begin
  select a.* into v_admin from public.usuarios_admin a
  join private.credenciais_sistema c on c.tipo='usuario_admin' and c.entidade_id=a.id and c.finalidade='login'
  where a.ativo is true and nullif(trim(p_senha),'') is not null
    and (lower(trim(coalesce(a.usuario,'')))=lower(trim(p_identificador)) or lower(trim(coalesce(a.nome,'')))=lower(trim(p_identificador)))
    and c.segredo_hash=extensions.crypt(trim(p_senha),c.segredo_hash)
  order by case when lower(trim(coalesce(a.usuario,'')))=lower(trim(p_identificador)) then 0 else 1 end limit 1;
  if v_admin.id is null then return null; end if;
  v_token := private.emitir_sessao_operacional('usuario_admin',v_admin.id);
  return (to_jsonb(v_admin)-'pin') || jsonb_build_object('operational_access_token',v_token);
end $$;

create or replace function private.request_headers_json()
returns jsonb language sql stable set search_path='' as $$
  select coalesce(nullif(current_setting('request.headers',true),'')::jsonb,'{}'::jsonb)
$$;

create or replace function public.request_store_authorized(p_empresa_id uuid, p_loja_id uuid)
returns boolean language plpgsql security definer stable
set search_path = pg_catalog, public, private, extensions
as $$ declare h jsonb:=private.request_headers_json(); v_id uuid; v_loja uuid; v_token text; v_global text;
begin
  begin v_id := nullif(h->>'x-funcionario-id','')::uuid; exception when others then return false; end;
  begin v_loja := nullif(h->>'x-loja-id','')::uuid; exception when others then return false; end;
  if v_id is null or v_loja is null or v_loja is distinct from p_loja_id then return false; end if;
  if not exists(select 1 from public.lojas l where l.id=v_loja and l.empresa_id=p_empresa_id and l.ativo is not false) then return false; end if;
  v_token:=coalesce(h->>'x-operational-token',''); v_global:=coalesce(h->>'x-global-admin-token','');
  if v_global<>'' and public.validar_sessao_admin_global(v_id,v_global) then return true; end if;
  if not exists(select 1 from private.sessoes_operacionais s where s.principal_id=v_id
    and s.token_hash=encode(extensions.digest(v_token,'sha256'),'hex') and s.revogado_em is null and s.expira_em>now()) then return false; end if;
  return exists(
    select 1 from private.sessoes_operacionais s
    where s.principal_id=v_id and s.token_hash=encode(extensions.digest(v_token,'sha256'),'hex')
      and ((s.principal_tipo='funcionario' and exists(select 1 from public.funcionario_lojas fl join public.perfis p on p.id=fl.perfil_id
             where fl.funcionario_id=v_id and fl.loja_id=v_loja and fl.ativo is true and p.loja_id=v_loja and p.ativo is true))
        or (s.principal_tipo='usuario_admin' and exists(select 1 from public.usuarios_admin a where a.id=v_id and a.loja_id=v_loja and a.ativo is true)))
  );
end $$;
revoke all on function public.request_store_authorized(uuid,uuid) from public;
grant execute on function public.request_store_authorized(uuid,uuid) to anon,authenticated;

-- Dados financeiros passam a negar por padrão e exigem token opaco + loja exata.
do $$ declare t text; pol record;
begin
  foreach t in array array['fornecedores','formas_pagamento','contasapagar','contas_financeiras','contas_financeiras_movimentacoes','contas_financeiras_ajustes_saldo','recebiveis','recebiveis_futuros','categorias_compra','grupos_fornecedor'] loop
    if to_regclass('public.'||t) is null
      or not exists(select 1 from information_schema.columns where table_schema='public' and table_name=t and column_name='empresa_id')
      or not exists(select 1 from information_schema.columns where table_schema='public' and table_name=t and column_name='loja_id')
    then continue; end if;
    execute format('alter table public.%I enable row level security',t);
    for pol in select policyname from pg_policies where schemaname='public' and tablename=t loop
      execute format('drop policy %I on public.%I',pol.policyname,t);
    end loop;
    execute format('create policy tenant_select on public.%I for select to anon,authenticated using (public.request_store_authorized(empresa_id,loja_id))',t);
    execute format('create policy tenant_insert on public.%I for insert to anon,authenticated with check (public.request_store_authorized(empresa_id,loja_id))',t);
    execute format('create policy tenant_update on public.%I for update to anon,authenticated using (public.request_store_authorized(empresa_id,loja_id)) with check (public.request_store_authorized(empresa_id,loja_id))',t);
    execute format('create policy tenant_delete on public.%I for delete to anon,authenticated using (public.request_store_authorized(empresa_id,loja_id))',t);
  end loop;
end $$;

notify pgrst,'reload schema';
