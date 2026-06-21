create extension if not exists pgcrypto;

create table if not exists public.contas_financeiras (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  saldo_atual numeric(12,2) not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.contas_financeiras
  add column if not exists nome text,
  add column if not exists saldo_atual numeric(12,2) not null default 0,
  add column if not exists ativo boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists contas_financeiras_nome_uk
  on public.contas_financeiras ((lower(trim(nome))));

create index if not exists contas_financeiras_ativo_idx
  on public.contas_financeiras (ativo);

alter table if exists public.recebiveis
  add column if not exists conta_financeira_id uuid references public.contas_financeiras(id) on update cascade on delete restrict;

create index if not exists recebiveis_conta_financeira_idx
  on public.recebiveis (conta_financeira_id);

create table if not exists public.contas_financeiras_movimentacoes (
  id uuid primary key default gen_random_uuid(),
  conta_financeira_id uuid not null references public.contas_financeiras(id) on update cascade on delete restrict,
  recebivel_id uuid references public.recebiveis(id) on update cascade on delete set null,
  tipo text not null default 'entrada',
  valor numeric(12,2) not null check (valor >= 0),
  descricao text,
  saldo_apos numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

alter table if exists public.contas_financeiras_movimentacoes
  add column if not exists conta_financeira_id uuid references public.contas_financeiras(id) on update cascade on delete restrict,
  add column if not exists recebivel_id uuid references public.recebiveis(id) on update cascade on delete set null,
  add column if not exists tipo text not null default 'entrada',
  add column if not exists valor numeric(12,2) not null default 0,
  add column if not exists descricao text,
  add column if not exists saldo_apos numeric(12,2) not null default 0,
  add column if not exists created_at timestamptz not null default now();

create index if not exists contas_financeiras_mov_conta_idx
  on public.contas_financeiras_movimentacoes (conta_financeira_id, created_at desc);

create index if not exists contas_financeiras_mov_recebivel_idx
  on public.contas_financeiras_movimentacoes (recebivel_id);

alter table if exists public.contas_financeiras enable row level security;
alter table if exists public.contas_financeiras_movimentacoes enable row level security;

drop policy if exists contas_financeiras_anon_all on public.contas_financeiras;
drop policy if exists contas_financeiras_authenticated_all on public.contas_financeiras;
drop policy if exists contas_financeiras_movimentacoes_anon_all on public.contas_financeiras_movimentacoes;
drop policy if exists contas_financeiras_movimentacoes_authenticated_all on public.contas_financeiras_movimentacoes;

create policy contas_financeiras_anon_all
  on public.contas_financeiras
  for all
  to anon
  using (true)
  with check (true);

create policy contas_financeiras_authenticated_all
  on public.contas_financeiras
  for all
  to authenticated
  using (true)
  with check (true);

create policy contas_financeiras_movimentacoes_anon_all
  on public.contas_financeiras_movimentacoes
  for all
  to anon
  using (true)
  with check (true);

create policy contas_financeiras_movimentacoes_authenticated_all
  on public.contas_financeiras_movimentacoes
  for all
  to authenticated
  using (true)
  with check (true);
