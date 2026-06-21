create extension if not exists pgcrypto;

create table if not exists public.contas_financeiras_ajustes_saldo (
  id uuid primary key default gen_random_uuid(),
  conta_financeira_id uuid not null references public.contas_financeiras(id) on update cascade on delete restrict,
  tipo text not null default 'entrada' check (tipo in ('entrada', 'saida')),
  valor numeric(12,2) not null check (valor > 0),
  saldo_anterior numeric(12,2) not null,
  saldo_atual numeric(12,2) not null,
  observacao text,
  funcionario_id uuid references public.funcionarios(id) on update cascade on delete set null,
  funcionario_nome text not null,
  created_at timestamptz not null default now()
);

alter table if exists public.contas_financeiras_ajustes_saldo
  add column if not exists conta_financeira_id uuid references public.contas_financeiras(id) on update cascade on delete restrict,
  add column if not exists tipo text not null default 'entrada',
  add column if not exists valor numeric(12,2) not null default 0,
  add column if not exists saldo_anterior numeric(12,2) not null default 0,
  add column if not exists saldo_atual numeric(12,2) not null default 0,
  add column if not exists observacao text,
  add column if not exists funcionario_id uuid references public.funcionarios(id) on update cascade on delete set null,
  add column if not exists funcionario_nome text,
  add column if not exists created_at timestamptz not null default now();

create index if not exists contas_financeiras_ajustes_saldo_conta_idx
  on public.contas_financeiras_ajustes_saldo (conta_financeira_id, created_at desc);

create index if not exists contas_financeiras_ajustes_saldo_funcionario_idx
  on public.contas_financeiras_ajustes_saldo (funcionario_id, created_at desc);

alter table if exists public.contas_financeiras_ajustes_saldo enable row level security;

drop policy if exists contas_financeiras_ajustes_saldo_anon_all on public.contas_financeiras_ajustes_saldo;
drop policy if exists contas_financeiras_ajustes_saldo_authenticated_all on public.contas_financeiras_ajustes_saldo;

create policy contas_financeiras_ajustes_saldo_anon_all
  on public.contas_financeiras_ajustes_saldo
  for all
  to anon
  using (true)
  with check (true);

create policy contas_financeiras_ajustes_saldo_authenticated_all
  on public.contas_financeiras_ajustes_saldo
  for all
  to authenticated
  using (true)
  with check (true);