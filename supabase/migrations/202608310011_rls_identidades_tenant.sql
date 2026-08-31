create or replace function public.request_funcionario_row_authorized(p_funcionario_id uuid,p_empresa_id uuid,p_loja_id uuid)
returns boolean language sql security definer stable
set search_path=pg_catalog,public,private,extensions
as $$
  select (p_loja_id is not null and public.request_store_authorized(p_empresa_id,p_loja_id))
    or exists(select 1 from public.funcionario_lojas fl join public.lojas l on l.id=fl.loja_id
      where fl.funcionario_id=p_funcionario_id and fl.ativo is true and public.request_store_authorized(l.empresa_id,l.id))
$$;
create or replace function public.request_empresa_authorized(p_empresa_id uuid)
returns boolean language sql security definer stable
set search_path=pg_catalog,public,private,extensions
as $$ select exists(select 1 from public.lojas l where l.empresa_id=p_empresa_id and public.request_store_authorized(p_empresa_id,l.id)) $$;

do $$ declare pol record;
begin
  if to_regclass('public.funcionarios') is not null then
    alter table public.funcionarios enable row level security;
    for pol in select policyname from pg_policies where schemaname='public' and tablename='funcionarios' loop execute format('drop policy %I on public.funcionarios',pol.policyname); end loop;
    create policy tenant_select on public.funcionarios for select to anon,authenticated using ("é_administrador" is not true and public.request_funcionario_row_authorized(id,empresa_id,loja_id));
    create policy tenant_insert on public.funcionarios for insert to anon,authenticated with check ("é_administrador" is not true and public.request_funcionario_row_authorized(id,empresa_id,loja_id));
    create policy tenant_update on public.funcionarios for update to anon,authenticated using ("é_administrador" is not true and public.request_funcionario_row_authorized(id,empresa_id,loja_id)) with check ("é_administrador" is not true and public.request_funcionario_row_authorized(id,empresa_id,loja_id));
    create policy tenant_delete on public.funcionarios for delete to anon,authenticated using ("é_administrador" is not true and public.request_funcionario_row_authorized(id,empresa_id,loja_id));
  end if;
  if to_regclass('public.funcionario_lojas') is not null then
    alter table public.funcionario_lojas enable row level security;
    for pol in select policyname from pg_policies where schemaname='public' and tablename='funcionario_lojas' loop execute format('drop policy %I on public.funcionario_lojas',pol.policyname); end loop;
    create policy tenant_select on public.funcionario_lojas for select to anon,authenticated using (public.request_loja_authorized(loja_id));
    create policy tenant_insert on public.funcionario_lojas for insert to anon,authenticated with check (public.request_loja_authorized(loja_id));
    create policy tenant_update on public.funcionario_lojas for update to anon,authenticated using (public.request_loja_authorized(loja_id)) with check (public.request_loja_authorized(loja_id));
    create policy tenant_delete on public.funcionario_lojas for delete to anon,authenticated using (public.request_loja_authorized(loja_id));
  end if;
end $$;

do $$ declare t text;pol record;pred text;
begin
  foreach t in array array['lojas','perfis','usuarios_admin'] loop
    if not exists(select 1 from information_schema.tables where table_schema='public' and table_name=t and table_type='BASE TABLE') then continue; end if;
    pred:=case when exists(select 1 from information_schema.columns where table_schema='public' and table_name=t and column_name='loja_id') then 'public.request_loja_authorized(loja_id)' else 'public.request_empresa_authorized(empresa_id)' end;
    execute format('alter table public.%I enable row level security',t);
    for pol in select policyname from pg_policies where schemaname='public' and tablename=t loop execute format('drop policy %I on public.%I',pol.policyname,t); end loop;
    execute format('create policy tenant_select on public.%I for select to anon,authenticated using (%s)',t,pred);
    execute format('create policy tenant_insert on public.%I for insert to anon,authenticated with check (%s)',t,pred);
    execute format('create policy tenant_update on public.%I for update to anon,authenticated using (%s) with check (%s)',t,pred,pred);
    execute format('create policy tenant_delete on public.%I for delete to anon,authenticated using (%s)',t,pred);
  end loop;
end $$;

revoke all on function public.request_funcionario_row_authorized(uuid,uuid,uuid) from public;
revoke all on function public.request_empresa_authorized(uuid) from public;
grant execute on function public.request_funcionario_row_authorized(uuid,uuid,uuid) to anon,authenticated,service_role;
grant execute on function public.request_empresa_authorized(uuid) to anon,authenticated,service_role;
notify pgrst,'reload schema';
