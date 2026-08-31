-- Fecha tabelas auxiliares que antes podiam escapar do isolamento da tabela-pai.
create or replace function public.request_loja_authorized(p_loja_id uuid)
returns boolean language sql security definer stable
set search_path = pg_catalog, public, private, extensions
as $$
  select exists (
    select 1 from public.lojas l
    where l.id = p_loja_id
      and public.request_store_authorized(l.empresa_id, l.id)
  )
$$;

create or replace function public.request_execucao_authorized(p_execucao_id uuid)
returns boolean language sql security definer stable
set search_path = pg_catalog, public, private, extensions
as $$
  select exists (
    select 1 from public.checklist_execucoes e
    where e.id = p_execucao_id
      and public.request_store_authorized(e.empresa_id, e.loja_id)
  )
$$;

create or replace function public.request_lancamento_authorized(p_lancamento_id uuid)
returns boolean language sql security definer stable
set search_path = pg_catalog, public, private, extensions
as $$
  select exists (
    select 1 from public.checklist_lancamentos l
    where l.id = p_lancamento_id
      and public.request_store_authorized(l.empresa_id, l.loja_id)
  )
$$;

create or replace function public.request_funcionario_authorized(p_funcionario_id uuid)
returns boolean language sql security definer stable
set search_path = pg_catalog, public, private, extensions
as $$
  select exists (
    select 1
    from public.funcionario_lojas fl
    join public.lojas l on l.id = fl.loja_id
    where fl.funcionario_id = p_funcionario_id
      and fl.ativo is true
      and public.request_store_authorized(l.empresa_id, l.id)
  )
$$;

do $$
declare
  t text;
  predicate text;
  pol record;
begin
  foreach t in array array[
    'checklist_lancamento_eventos', 'checklist_execucao_usuarios', 'checklist_respostas',
    'ponto_batidas_auditoria', 'email_notificacoes', 'configuracoes_loja',
    'preferencias_usuario', 'feriados_loja'
  ] loop
    if not exists (
      select 1 from information_schema.tables
      where table_schema='public' and table_name=t and table_type='BASE TABLE'
    ) then continue; end if;

    if exists (select 1 from information_schema.columns where table_schema='public' and table_name=t and column_name='empresa_id')
       and exists (select 1 from information_schema.columns where table_schema='public' and table_name=t and column_name='loja_id') then
      predicate := 'public.request_store_authorized(empresa_id, loja_id)';
    elsif exists (select 1 from information_schema.columns where table_schema='public' and table_name=t and column_name='loja_id') then
      predicate := 'public.request_loja_authorized(loja_id)';
    elsif exists (select 1 from information_schema.columns where table_schema='public' and table_name=t and column_name='execucao_id') then
      predicate := 'public.request_execucao_authorized(execucao_id)';
    elsif exists (select 1 from information_schema.columns where table_schema='public' and table_name=t and column_name='lancamento_id') then
      predicate := 'public.request_lancamento_authorized(lancamento_id)';
    elsif exists (select 1 from information_schema.columns where table_schema='public' and table_name=t and column_name='funcionario_id') then
      predicate := 'public.request_funcionario_authorized(funcionario_id)';
    else
      -- Sem uma chave de tenant comprovável, a tabela não é exposta ao cliente anon.
      predicate := 'false';
    end if;

    execute format('alter table public.%I enable row level security', t);
    for pol in select policyname from pg_policies where schemaname='public' and tablename=t loop
      execute format('drop policy %I on public.%I', pol.policyname, t);
    end loop;
    execute format('create policy tenant_select on public.%I for select to anon,authenticated using (%s)', t, predicate);
    execute format('create policy tenant_insert on public.%I for insert to anon,authenticated with check (%s)', t, predicate);
    execute format('create policy tenant_update on public.%I for update to anon,authenticated using (%s) with check (%s)', t, predicate, predicate);
    execute format('create policy tenant_delete on public.%I for delete to anon,authenticated using (%s)', t, predicate);
  end loop;
end $$;

-- A fila de e-mail é interna: navegador não lê nem grava mensagens da fila.
do $$ declare pol record;
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='email_alertas' and table_type='BASE TABLE') then
    alter table public.email_alertas enable row level security;
    for pol in select policyname from pg_policies where schemaname='public' and tablename='email_alertas' loop
      execute format('drop policy %I on public.email_alertas', pol.policyname);
    end loop;
  end if;
end $$;

revoke all on function public.request_loja_authorized(uuid) from public;
revoke all on function public.request_execucao_authorized(uuid) from public;
revoke all on function public.request_lancamento_authorized(uuid) from public;
revoke all on function public.request_funcionario_authorized(uuid) from public;
grant execute on function public.request_loja_authorized(uuid) to anon, authenticated, service_role;
grant execute on function public.request_execucao_authorized(uuid) to anon, authenticated, service_role;
grant execute on function public.request_lancamento_authorized(uuid) to anon, authenticated, service_role;
grant execute on function public.request_funcionario_authorized(uuid) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
