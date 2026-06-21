-- Base multiempresa (tenant) - fase 1
-- Objetivo: criar tabela empresas, adicionar empresa_id nas tabelas principais,
-- criar índices/FKs e aplicar políticas de isolamento por empresa.

-- 1) Tabela de empresas
create table if not exists public.empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create unique index if not exists ux_empresas_slug on public.empresas (slug);
create index if not exists ix_empresas_ativo on public.empresas (ativo);

-- 2) Seed mínimo (caso ainda não exista nenhuma empresa)
insert into public.empresas (nome, slug, ativo)
select 'Empresa Padrão', 'empresa-padrao', true
where not exists (select 1 from public.empresas);

-- 3) Função utilitária para adicionar coluna empresa_id com segurança
create or replace function public._add_empresa_id_if_exists(_table_name text)
returns void
language plpgsql
as $$
declare
  _table_exists boolean;
  _column_exists boolean;
  _default_empresa_id uuid;
  _constraint_name text;
  _index_name text;
begin
  select exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = _table_name
  ) into _table_exists;

  if not _table_exists then
    raise notice 'Tabela public.% não existe; pulando.', _table_name;
    return;
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = _table_name
      and column_name = 'empresa_id'
  ) into _column_exists;

  if not _column_exists then
    execute format('alter table public.%I add column empresa_id uuid', _table_name);
  end if;

  -- backfill com empresa padrão para evitar nulls
  select id into _default_empresa_id
  from public.empresas
  order by criado_em asc
  limit 1;

  execute format(
    'update public.%I set empresa_id = coalesce(empresa_id, %L::uuid) where empresa_id is null',
    _table_name,
    _default_empresa_id
  );

  execute format('alter table public.%I alter column empresa_id set not null', _table_name);

  _constraint_name := 'fk_' || _table_name || '_empresa_id';
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = _table_name
      and constraint_name = _constraint_name
  ) then
    execute format(
      'alter table public.%I add constraint %I foreign key (empresa_id) references public.empresas(id) on delete restrict',
      _table_name,
      _constraint_name
    );
  end if;

  _index_name := 'ix_' || _table_name || '_empresa_id';
  execute format(
    'create index if not exists %I on public.%I (empresa_id)',
    _index_name,
    _table_name
  );
end;
$$;

-- 4) Aplicar empresa_id nas tabelas do plano
select public._add_empresa_id_if_exists('usuarios');
select public._add_empresa_id_if_exists('funcionarios');
select public._add_empresa_id_if_exists('tarefas');
select public._add_empresa_id_if_exists('checklist_execucoes');
select public._add_empresa_id_if_exists('pontos');
select public._add_empresa_id_if_exists('ajustes_ponto');
select public._add_empresa_id_if_exists('alertas');
select public._add_empresa_id_if_exists('acessos_logs');

-- 5) RLS multiempresa (isolamento por empresa)
-- Observação importante:
-- Estas policies esperam um claim JWT "empresa_id" no token.
-- Se o claim não existir, as consultas retornam vazio para SELECT.

create or replace function public.current_empresa_id()
returns uuid
language sql
stable
as $$
  select nullif((current_setting('request.jwt.claims', true)::jsonb ->> 'empresa_id'), '')::uuid
$$;

create or replace function public._apply_empresa_rls_if_exists(_table_name text)
returns void
language plpgsql
as $$
declare
  _table_exists boolean;
  _policy_select text;
  _policy_insert text;
  _policy_update text;
  _policy_delete text;
begin
  select exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = _table_name
  ) into _table_exists;

  if not _table_exists then
    return;
  end if;

  execute format('alter table public.%I enable row level security', _table_name);

  _policy_select := _table_name || '_select_empresa';
  _policy_insert := _table_name || '_insert_empresa';
  _policy_update := _table_name || '_update_empresa';
  _policy_delete := _table_name || '_delete_empresa';

  execute format('drop policy if exists %I on public.%I', _policy_select, _table_name);
  execute format('drop policy if exists %I on public.%I', _policy_insert, _table_name);
  execute format('drop policy if exists %I on public.%I', _policy_update, _table_name);
  execute format('drop policy if exists %I on public.%I', _policy_delete, _table_name);

  execute format(
    'create policy %I on public.%I for select to anon, authenticated using (empresa_id = public.current_empresa_id())',
    _policy_select,
    _table_name
  );

  execute format(
    'create policy %I on public.%I for insert to anon, authenticated with check (empresa_id = public.current_empresa_id())',
    _policy_insert,
    _table_name
  );

  execute format(
    'create policy %I on public.%I for update to anon, authenticated using (empresa_id = public.current_empresa_id()) with check (empresa_id = public.current_empresa_id())',
    _policy_update,
    _table_name
  );

  execute format(
    'create policy %I on public.%I for delete to anon, authenticated using (empresa_id = public.current_empresa_id())',
    _policy_delete,
    _table_name
  );
end;
$$;

select public._apply_empresa_rls_if_exists('usuarios');
select public._apply_empresa_rls_if_exists('funcionarios');
select public._apply_empresa_rls_if_exists('tarefas');
select public._apply_empresa_rls_if_exists('checklist_execucoes');
select public._apply_empresa_rls_if_exists('pontos');
select public._apply_empresa_rls_if_exists('ajustes_ponto');
select public._apply_empresa_rls_if_exists('alertas');
select public._apply_empresa_rls_if_exists('acessos_logs');

-- 6) Limpeza das funções utilitárias (opcional)
drop function if exists public._add_empresa_id_if_exists(text);
drop function if exists public._apply_empresa_rls_if_exists(text);

-- 7) Validação rápida
-- select id, nome, slug, ativo from public.empresas order by nome;
-- select empresa_id, count(*) from public.funcionarios group by empresa_id;
