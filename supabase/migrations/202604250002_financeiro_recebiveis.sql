create extension if not exists pgcrypto;

create table if not exists public.recebiveis (
  id uuid primary key default gen_random_uuid(),
  pagador_id uuid not null references public.fornecedores(id) on update cascade on delete restrict,
  forma_pagamento_id uuid not null references public.formas_pagamento(id) on update cascade on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.recebiveis
  add column if not exists pagador_id uuid references public.fornecedores(id) on update cascade on delete restrict,
  add column if not exists forma_pagamento_id uuid references public.formas_pagamento(id) on update cascade on delete restrict,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists recebiveis_pagador_idx
  on public.recebiveis (pagador_id);

create index if not exists recebiveis_forma_pagamento_idx
  on public.recebiveis (forma_pagamento_id);

create index if not exists recebiveis_created_at_idx
  on public.recebiveis (created_at);

alter table if exists public.recebiveis enable row level security;

drop policy if exists recebiveis_anon_all on public.recebiveis;
drop policy if exists recebiveis_authenticated_all on public.recebiveis;

create policy recebiveis_anon_all
  on public.recebiveis
  for all
  to anon
  using (true)
  with check (true);

create policy recebiveis_authenticated_all
  on public.recebiveis
  for all
  to authenticated
  using (true)
  with check (true);
