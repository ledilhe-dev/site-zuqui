-- Reparo definitivo do financeiro para multi-filiais.
-- Objetivo:
-- 1. Garantir auditoria em recebíveis.
-- 2. Fazer empresa_id acompanhar a loja_id real nas tabelas financeiras.
-- 3. Corrigir recebíveis lançados com loja/empresa diferente da conta financeira usada.

alter table if exists public.recebiveis
  add column if not exists criado_por_id uuid references public.funcionarios(id) on delete set null,
  add column if not exists criado_por_nome text;

update public.recebiveis r
set criado_por_nome = coalesce(nullif(trim(r.criado_por_nome), ''), 'Cadastro anterior')
where coalesce(nullif(trim(r.criado_por_nome), ''), '') = '';

create index if not exists recebiveis_criado_por_id_idx
  on public.recebiveis (criado_por_id);

do $$
declare
  tabela text;
begin
  foreach tabela in array array[
    'fornecedores',
    'formas_pagamento',
    'contasapagar',
    'contas_financeiras',
    'contas_financeiras_movimentacoes',
    'contas_financeiras_ajustes_saldo',
    'recebiveis',
    'funcionarios',
    'tarefas',
    'checklists',
    'checklist_execucoes',
    'checklist_lancamentos',
    'ponto_registros',
    'ponto_intervalos',
    'ponto_ajustes_solicitacoes'
  ] loop
    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = tabela
    ) and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = tabela and column_name = 'loja_id'
    ) and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = tabela and column_name = 'empresa_id'
    ) then
      execute format(
        'update public.%I t
            set empresa_id = l.empresa_id
           from public.lojas l
          where t.loja_id = l.id
            and l.empresa_id is not null
            and (t.empresa_id is distinct from l.empresa_id)',
        tabela
      );
    end if;
  end loop;
end $$;

-- Recebível deve pertencer à mesma loja/empresa da conta financeira onde o dinheiro entrou.
update public.recebiveis r
set loja_id = cf.loja_id,
    empresa_id = cf.empresa_id
from public.contas_financeiras cf
where r.conta_financeira_id = cf.id
  and cf.loja_id is not null
  and cf.empresa_id is not null
  and (
    r.loja_id is distinct from cf.loja_id
    or r.empresa_id is distinct from cf.empresa_id
  );

-- Movimentações também devem acompanhar a conta financeira.
update public.contas_financeiras_movimentacoes m
set loja_id = cf.loja_id,
    empresa_id = cf.empresa_id
from public.contas_financeiras cf
where m.conta_financeira_id = cf.id
  and cf.loja_id is not null
  and cf.empresa_id is not null
  and (
    m.loja_id is distinct from cf.loja_id
    or m.empresa_id is distinct from cf.empresa_id
  );

-- Índices úteis para filtros financeiros por filial/empresa.
create index if not exists idx_recebiveis_empresa_loja_created
  on public.recebiveis (empresa_id, loja_id, created_at desc);

create index if not exists idx_contas_financeiras_mov_empresa_loja_created
  on public.contas_financeiras_movimentacoes (empresa_id, loja_id, created_at desc);

