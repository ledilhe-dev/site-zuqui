create extension if not exists pgcrypto;

create table if not exists public.fornecedores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cnpj text,
  telefone text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.fornecedores
  add column if not exists nome text,
  add column if not exists cnpj text,
  add column if not exists telefone text,
  add column if not exists email text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists fornecedores_cnpj_uk
  on public.fornecedores ((regexp_replace(coalesce(cnpj, ''), '[^0-9]', '', 'g')))
  where coalesce(cnpj, '') <> '';

create index if not exists fornecedores_nome_idx
  on public.fornecedores (nome);

create table if not exists public.contasapagar (
  id uuid primary key default gen_random_uuid(),
  fornecedor_id uuid not null references public.fornecedores(id) on update cascade on delete restrict,
  data_compra date not null,
  data_vencimento date not null,
  data_pagamento date,
  valor_compra numeric(12,2) not null check (valor_compra >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.contasapagar
  add column if not exists fornecedor_id uuid references public.fornecedores(id) on update cascade on delete restrict,
  add column if not exists data_compra date,
  add column if not exists data_vencimento date,
  add column if not exists data_pagamento date,
  add column if not exists valor_compra numeric(12,2),
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.contasapagar
set valor_compra = 0
where valor_compra is null;

alter table if exists public.contasapagar
  alter column valor_compra set default 0,
  alter column valor_compra set not null;

create index if not exists contasapagar_fornecedor_idx
  on public.contasapagar (fornecedor_id);

create index if not exists contasapagar_vencimento_idx
  on public.contasapagar (data_vencimento);

create index if not exists contasapagar_pagamento_idx
  on public.contasapagar (data_pagamento);
