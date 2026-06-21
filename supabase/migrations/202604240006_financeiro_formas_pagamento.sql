create extension if not exists pgcrypto;

create table if not exists public.formas_pagamento (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.formas_pagamento
  add column if not exists nome text,
  add column if not exists ativo boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists formas_pagamento_nome_uk
  on public.formas_pagamento ((lower(trim(nome))));

create index if not exists formas_pagamento_ativo_idx
  on public.formas_pagamento (ativo);

insert into public.formas_pagamento (nome, ativo)
select 'Pix', true
where not exists (
  select 1 from public.formas_pagamento where lower(trim(nome)) = lower('Pix')
);

insert into public.formas_pagamento (nome, ativo)
select 'Dinheiro', true
where not exists (
  select 1 from public.formas_pagamento where lower(trim(nome)) = lower('Dinheiro')
);

insert into public.formas_pagamento (nome, ativo)
select 'Cartão', true
where not exists (
  select 1 from public.formas_pagamento where lower(trim(nome)) = lower('Cartão')
);

insert into public.formas_pagamento (nome, ativo)
select distinct trim(c.forma_pagamento), true
from public.contasapagar c
where coalesce(trim(c.forma_pagamento), '') <> ''
  and not exists (
    select 1
    from public.formas_pagamento f
    where lower(trim(f.nome)) = lower(trim(c.forma_pagamento))
  );

alter table if exists public.contasapagar
  add column if not exists forma_pagamento_id uuid references public.formas_pagamento(id) on update cascade on delete restrict;

update public.contasapagar c
set forma_pagamento_id = f.id
from public.formas_pagamento f
where c.forma_pagamento_id is null
  and coalesce(trim(c.forma_pagamento), '') <> ''
  and lower(trim(f.nome)) = lower(trim(c.forma_pagamento));

create index if not exists contasapagar_forma_pagamento_id_idx
  on public.contasapagar (forma_pagamento_id);

alter table if exists public.formas_pagamento enable row level security;

drop policy if exists formas_pagamento_anon_all on public.formas_pagamento;
drop policy if exists formas_pagamento_authenticated_all on public.formas_pagamento;

create policy formas_pagamento_anon_all
  on public.formas_pagamento
  for all
  to anon
  using (true)
  with check (true);

create policy formas_pagamento_authenticated_all
  on public.formas_pagamento
  for all
  to authenticated
  using (true)
  with check (true);
