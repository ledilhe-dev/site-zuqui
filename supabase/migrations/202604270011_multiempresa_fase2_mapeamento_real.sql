-- Multiempresa fase 2 (mapeamento para o schema real do projeto)
-- Objetivo:
-- 1) Estender empresa_id para tabelas realmente usadas no app atual.
-- 2) Backfill priorizando vínculo por loja quando existir loja_id.
-- 3) Aplicar RLS por empresa_id em modo de transição (sem quebrar ambiente sem claim JWT).

-- IMPORTANTE (transição):
-- As policies abaixo permitem acesso quando não houver claim empresa_id no JWT,
-- para evitar indisponibilidade imediata no frontend atual.
-- Depois que o auth propagar empresa_id no token, endureça removendo o fallback "is null".

-- 1) Garantir função para ler empresa_id do JWT
create or replace function public.current_empresa_id()
returns uuid
language sql
stable
as $$
  select nullif((current_setting('request.jwt.claims', true)::jsonb ->> 'empresa_id'), '')::uuid
$$;

-- 2) Garantir empresa padrão
insert into public.empresas (nome, slug, ativo)
select 'Empresa Padrão', 'empresa-padrao', true
where not exists (select 1 from public.empresas);

-- 3) Helper: adicionar empresa_id com backfill inteligente
create or replace function public._ensure_empresa_id_real_schema(_table_name text)
returns void
language plpgsql
as $$
declare
  _table_exists boolean;
  _empresa_col_exists boolean;
  _loja_col_exists boolean;
  _default_empresa_id uuid;
  _constraint_name text;
  _index_name text;
  _lojas_table_exists boolean;
begin
  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = _table_name
  ) into _table_exists;

  if not _table_exists then
    raise notice 'Tabela public.% não existe; pulando.', _table_name;
    return;
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = _table_name and column_name = 'empresa_id'
  ) into _empresa_col_exists;

  if not _empresa_col_exists then
    execute format('alter table public.%I add column empresa_id uuid', _table_name);
  end if;

  select id into _default_empresa_id
  from public.empresas
  order by criado_em asc
  limit 1;

  -- Se a tabela tiver loja_id e existir public.lojas com empresa_id, backfill pelo vínculo loja->empresa.
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = _table_name and column_name = 'loja_id'
  ) into _loja_col_exists;

  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'lojas'
  ) into _lojas_table_exists;

  if _loja_col_exists and _lojas_table_exists and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'lojas' and column_name = 'empresa_id'
  ) then
    execute format(
      'update public.%I t
          set empresa_id = l.empresa_id
         from public.lojas l
        where t.empresa_id is null
          and t.loja_id is not null
          and l.id = t.loja_id
          and l.empresa_id is not null',
      _table_name
    );
  end if;

  -- Fallback para empresa padrão
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
    where table_schema = 'public' and table_name = _table_name and constraint_name = _constraint_name
  ) then
    execute format(
      'alter table public.%I add constraint %I foreign key (empresa_id) references public.empresas(id) on delete restrict',
      _table_name,
      _constraint_name
    );
  end if;

  _index_name := 'ix_' || _table_name || '_empresa_id';
  execute format('create index if not exists %I on public.%I (empresa_id)', _index_name, _table_name);
end;
$$;

-- 4) Garantir empresa_id em tabelas reais do app
-- núcleo de usuários/operação
select public._ensure_empresa_id_real_schema('usuarios_admin');
select public._ensure_empresa_id_real_schema('funcionarios');
select public._ensure_empresa_id_real_schema('tarefas');
select public._ensure_empresa_id_real_schema('checklist_execucoes');
select public._ensure_empresa_id_real_schema('checklist_lancamentos');
select public._ensure_empresa_id_real_schema('checklist_lancamento_eventos');
select public._ensure_empresa_id_real_schema('checklist_execucao_usuarios');
select public._ensure_empresa_id_real_schema('checklist_respostas');

-- ponto
select public._ensure_empresa_id_real_schema('ponto_registros');
select public._ensure_empresa_id_real_schema('ponto_intervalos');
select public._ensure_empresa_id_real_schema('ponto_ajustes_solicitacoes');
select public._ensure_empresa_id_real_schema('ponto_batidas_auditoria');

-- alertas/acesso
select public._ensure_empresa_id_real_schema('email_alertas');
select public._ensure_empresa_id_real_schema('alertas_rapidos');
select public._ensure_empresa_id_real_schema('solicitacoes_acesso');
select public._ensure_empresa_id_real_schema('acessos_logs');

-- financeiro (já existe no projeto atual)
select public._ensure_empresa_id_real_schema('fornecedores');
select public._ensure_empresa_id_real_schema('contasapagar');
select public._ensure_empresa_id_real_schema('recebiveis');
select public._ensure_empresa_id_real_schema('formas_pagamento');
select public._ensure_empresa_id_real_schema('contas_financeiras');
select public._ensure_empresa_id_real_schema('contas_financeiras_movimentacoes');
select public._ensure_empresa_id_real_schema('contas_financeiras_ajustes_saldo');

-- metadados/config
select public._ensure_empresa_id_real_schema('configuracoes_loja');
select public._ensure_empresa_id_real_schema('email_notificacoes');
select public._ensure_empresa_id_real_schema('perfis');
select public._ensure_empresa_id_real_schema('checklists');
select public._ensure_empresa_id_real_schema('checklist_itens');
select public._ensure_empresa_id_real_schema('email_tokens_auth');

-- também alinhar lojas ao tenant
select public._ensure_empresa_id_real_schema('lojas');

-- 5) Views de compatibilidade com o plano conceitual (somente se não houver tabela homônima)
create or replace function public._create_plan_compat_view_if_needed(_view_name text, _source_table text)
returns void
language plpgsql
as $$
declare
  _view_exists boolean;
  _table_exists boolean;
  _source_exists boolean;
begin
  select exists (
    select 1 from information_schema.views
    where table_schema = 'public' and table_name = _view_name
  ) into _view_exists;

  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = _view_name
  ) into _table_exists;

  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = _source_table
  ) into _source_exists;

  if _table_exists or _view_exists or not _source_exists then
    return;
  end if;

  execute format('create view public.%I as select * from public.%I', _view_name, _source_table);
end;
$$;

-- mapeamento conceitual -> real
select public._create_plan_compat_view_if_needed('usuarios', 'usuarios_admin');
select public._create_plan_compat_view_if_needed('pontos', 'ponto_registros');
select public._create_plan_compat_view_if_needed('ajustes_ponto', 'ponto_ajustes_solicitacoes');
select public._create_plan_compat_view_if_needed('alertas', 'email_alertas');

-- 6) Helper: aplicar policies por empresa_id em modo de transição
create or replace function public._apply_empresa_rls_transition(_table_name text)
returns void
language plpgsql
as $$
declare
  _table_exists boolean;
  _empresa_col_exists boolean;
  _policy_select text;
  _policy_insert text;
  _policy_update text;
  _policy_delete text;
begin
  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = _table_name
  ) into _table_exists;

  if not _table_exists then
    return;
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = _table_name and column_name = 'empresa_id'
  ) into _empresa_col_exists;

  if not _empresa_col_exists then
    return;
  end if;

  execute format('alter table public.%I enable row level security', _table_name);

  _policy_select := _table_name || '_select_empresa_transition';
  _policy_insert := _table_name || '_insert_empresa_transition';
  _policy_update := _table_name || '_update_empresa_transition';
  _policy_delete := _table_name || '_delete_empresa_transition';

  execute format('drop policy if exists %I on public.%I', _policy_select, _table_name);
  execute format('drop policy if exists %I on public.%I', _policy_insert, _table_name);
  execute format('drop policy if exists %I on public.%I', _policy_update, _table_name);
  execute format('drop policy if exists %I on public.%I', _policy_delete, _table_name);

  -- Transição: se não houver claim empresa_id, não bloqueia leitura/escrita imediatamente.
  execute format(
    'create policy %I on public.%I for select to anon, authenticated using (public.current_empresa_id() is null or empresa_id = public.current_empresa_id())',
    _policy_select,
    _table_name
  );

  execute format(
    'create policy %I on public.%I for insert to anon, authenticated with check (public.current_empresa_id() is null or empresa_id = public.current_empresa_id())',
    _policy_insert,
    _table_name
  );

  execute format(
    'create policy %I on public.%I for update to anon, authenticated using (public.current_empresa_id() is null or empresa_id = public.current_empresa_id()) with check (public.current_empresa_id() is null or empresa_id = public.current_empresa_id())',
    _policy_update,
    _table_name
  );

  execute format(
    'create policy %I on public.%I for delete to anon, authenticated using (public.current_empresa_id() is null or empresa_id = public.current_empresa_id())',
    _policy_delete,
    _table_name
  );
end;
$$;

-- aplicar em tabelas mais sensíveis do fluxo atual
select public._apply_empresa_rls_transition('usuarios_admin');
select public._apply_empresa_rls_transition('funcionarios');
select public._apply_empresa_rls_transition('tarefas');
select public._apply_empresa_rls_transition('checklist_execucoes');
select public._apply_empresa_rls_transition('checklist_lancamentos');
select public._apply_empresa_rls_transition('ponto_registros');
select public._apply_empresa_rls_transition('ponto_ajustes_solicitacoes');
select public._apply_empresa_rls_transition('email_alertas');
select public._apply_empresa_rls_transition('alertas_rapidos');
select public._apply_empresa_rls_transition('solicitacoes_acesso');
select public._apply_empresa_rls_transition('contasapagar');
select public._apply_empresa_rls_transition('recebiveis');
select public._apply_empresa_rls_transition('contas_financeiras');
select public._apply_empresa_rls_transition('fornecedores');
select public._apply_empresa_rls_transition('lojas');

-- 7) Limpeza helpers internos
drop function if exists public._ensure_empresa_id_real_schema(text);
drop function if exists public._create_plan_compat_view_if_needed(text, text);
drop function if exists public._apply_empresa_rls_transition(text);

-- 8) Checks manuais sugeridos pós-apply
-- select id, nome, slug from public.empresas order by criado_em;
-- select empresa_id, count(*) from public.usuarios_admin group by empresa_id;
-- select empresa_id, count(*) from public.funcionarios group by empresa_id;
-- select empresa_id, count(*) from public.tarefas group by empresa_id;
-- select empresa_id, count(*) from public.ponto_registros group by empresa_id;
