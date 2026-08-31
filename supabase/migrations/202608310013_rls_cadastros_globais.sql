create or replace function public.request_admin_global_authorized()
returns boolean language plpgsql security definer stable
set search_path=pg_catalog,public,private,extensions
as $$ declare h jsonb:=private.request_headers_json();v_id uuid;v_token text;
begin
  begin v_id:=nullif(h->>'x-funcionario-id','')::uuid; exception when others then return false; end;
  v_token:=coalesce(h->>'x-global-admin-token','');
  return v_id is not null and v_token<>'' and public.validar_sessao_admin_global(v_id,v_token);
end $$;
revoke all on function public.request_admin_global_authorized() from public;
grant execute on function public.request_admin_global_authorized() to anon,authenticated,service_role;

drop policy if exists tenant_select on public.empresas;drop policy if exists tenant_insert on public.empresas;drop policy if exists tenant_update on public.empresas;drop policy if exists tenant_delete on public.empresas;
create policy tenant_select on public.empresas for select to anon,authenticated using (public.request_admin_global_authorized() or public.request_empresa_authorized(id));
create policy tenant_insert on public.empresas for insert to anon,authenticated with check (public.request_admin_global_authorized());
create policy tenant_update on public.empresas for update to anon,authenticated using (public.request_admin_global_authorized()) with check (public.request_admin_global_authorized());
create policy tenant_delete on public.empresas for delete to anon,authenticated using (public.request_admin_global_authorized());

drop policy if exists tenant_select on public.lojas;drop policy if exists tenant_insert on public.lojas;drop policy if exists tenant_update on public.lojas;drop policy if exists tenant_delete on public.lojas;
create policy tenant_select on public.lojas for select to anon,authenticated using (public.request_admin_global_authorized() or public.request_empresa_authorized(empresa_id));
create policy tenant_insert on public.lojas for insert to anon,authenticated with check (public.request_admin_global_authorized());
create policy tenant_update on public.lojas for update to anon,authenticated using (public.request_admin_global_authorized()) with check (public.request_admin_global_authorized());
create policy tenant_delete on public.lojas for delete to anon,authenticated using (public.request_admin_global_authorized());
notify pgrst,'reload schema';
