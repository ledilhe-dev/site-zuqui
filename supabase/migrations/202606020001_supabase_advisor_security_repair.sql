-- Reparo para avisos do Supabase Security Advisor.
--
-- Observacao importante:
-- O app atual usa a anon key no frontend e ainda depende de policies permissivas
-- em varios fluxos. Este SQL remove os avisos criticos sem endurecer o acesso a
-- ponto de quebrar login/cadastros. Para isolamento forte, migrar para Supabase
-- Auth/backend e remover as policies permissivas.

create or replace function public.current_empresa_id()
returns uuid
language sql
stable
set search_path = ''
as $$
  select nullif((current_setting('request.jwt.claims', true)::jsonb ->> 'empresa_id'), '')::uuid
$$;

-- 1) Tabelas com "Policy Exists RLS Disabled" / "RLS Disabled in Public".

alter table if exists public.empresas enable row level security;

drop policy if exists empresas_select_public on public.empresas;
create policy empresas_select_public
  on public.empresas
  for select
  to anon, authenticated
  using (true);

drop policy if exists empresas_insert_public on public.empresas;
create policy empresas_insert_public
  on public.empresas
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists empresas_update_public on public.empresas;
create policy empresas_update_public
  on public.empresas
  for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists empresas_delete_public on public.empresas;
create policy empresas_delete_public
  on public.empresas
  for delete
  to anon, authenticated
  using (true);

alter table if exists public.lojas enable row level security;

drop policy if exists lojas_select_empresa_transition on public.lojas;
create policy lojas_select_empresa_transition
  on public.lojas
  for select
  to anon, authenticated
  using (
    public.current_empresa_id() is null
    or empresa_id = public.current_empresa_id()
  );

drop policy if exists lojas_insert_empresa_transition on public.lojas;
create policy lojas_insert_empresa_transition
  on public.lojas
  for insert
  to anon, authenticated
  with check (
    public.current_empresa_id() is null
    or empresa_id = public.current_empresa_id()
  );

drop policy if exists lojas_update_empresa_transition on public.lojas;
create policy lojas_update_empresa_transition
  on public.lojas
  for update
  to anon, authenticated
  using (
    public.current_empresa_id() is null
    or empresa_id = public.current_empresa_id()
  )
  with check (
    public.current_empresa_id() is null
    or empresa_id = public.current_empresa_id()
  );

drop policy if exists lojas_delete_empresa_transition on public.lojas;
create policy lojas_delete_empresa_transition
  on public.lojas
  for delete
  to anon, authenticated
  using (
    public.current_empresa_id() is null
    or empresa_id = public.current_empresa_id()
  );

alter table if exists public.funcionario_lojas enable row level security;

drop policy if exists funcionario_lojas_select_public on public.funcionario_lojas;
create policy funcionario_lojas_select_public
  on public.funcionario_lojas
  for select
  to anon, authenticated
  using (true);

drop policy if exists funcionario_lojas_insert_public on public.funcionario_lojas;
create policy funcionario_lojas_insert_public
  on public.funcionario_lojas
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists funcionario_lojas_update_public on public.funcionario_lojas;
create policy funcionario_lojas_update_public
  on public.funcionario_lojas
  for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists funcionario_lojas_delete_public on public.funcionario_lojas;
create policy funcionario_lojas_delete_public
  on public.funcionario_lojas
  for delete
  to anon, authenticated
  using (true);

-- 2) Views com "Security Definer View".
-- security_invoker faz a view respeitar as permissoes/RLS do usuario chamador.

do $$
begin
  if exists (
    select 1 from information_schema.views
    where table_schema = 'public' and table_name = 'usuarios'
  ) then
    alter view public.usuarios set (security_invoker = true);
  end if;

  if exists (
    select 1 from information_schema.views
    where table_schema = 'public' and table_name = 'pontos'
  ) then
    alter view public.pontos set (security_invoker = true);
  end if;

  if exists (
    select 1 from information_schema.views
    where table_schema = 'public' and table_name = 'alertas'
  ) then
    alter view public.alertas set (security_invoker = true);
  end if;

  if exists (
    select 1 from information_schema.views
    where table_schema = 'public' and table_name = 'ajustes_ponto'
  ) then
    alter view public.ajustes_ponto set (security_invoker = true);
  end if;
end;
$$;

-- 3) Conferencia rapida depois de rodar:
-- select schemaname, tablename, rowsecurity
-- from pg_tables
-- where schemaname = 'public'
--   and tablename in ('empresas', 'lojas', 'funcionario_lojas')
-- order by tablename;
--
-- select schemaname, viewname, definition
-- from pg_views
-- where schemaname = 'public'
--   and viewname in ('usuarios', 'pontos', 'alertas');
