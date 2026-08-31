do $$ declare pol record;
begin
  if to_regclass('public.empresas') is not null then
    alter table public.empresas enable row level security;
    for pol in select policyname from pg_policies where schemaname='public' and tablename='empresas' loop execute format('drop policy %I on public.empresas',pol.policyname); end loop;
    create policy tenant_select on public.empresas for select to anon,authenticated using (public.request_empresa_authorized(id));
    create policy tenant_insert on public.empresas for insert to anon,authenticated with check (public.request_empresa_authorized(id));
    create policy tenant_update on public.empresas for update to anon,authenticated using (public.request_empresa_authorized(id)) with check (public.request_empresa_authorized(id));
    create policy tenant_delete on public.empresas for delete to anon,authenticated using (public.request_empresa_authorized(id));
  end if;
end $$;
notify pgrst,'reload schema';
