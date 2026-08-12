create table if not exists public.raffinato_agrupamentos_cache (
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  loja_id uuid not null references public.lojas(id) on delete cascade,
  id_filial integer not null,
  id_agrupamento bigint not null,
  nome text not null,
  sincronizado_em timestamptz not null default now(),
  primary key (empresa_id,loja_id,id_filial,id_agrupamento)
);

create table if not exists public.raffinato_produtos_catalogo_cache (
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  loja_id uuid not null references public.lojas(id) on delete cascade,
  id_filial integer not null,
  id_produto bigint not null,
  nome text not null,
  id_agrupamento bigint,
  agrupamento text,
  sincronizado_em timestamptz not null default now(),
  primary key (empresa_id,loja_id,id_filial,id_produto)
);

create table if not exists public.raffinato_formas_pagamento_catalogo_cache (
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  loja_id uuid not null references public.lojas(id) on delete cascade,
  id_filial integer not null,
  id_forma_pagamento bigint not null,
  nome text not null,
  sincronizado_em timestamptz not null default now(),
  primary key (empresa_id,loja_id,id_filial,id_forma_pagamento)
);

create index if not exists raffinato_produtos_catalogo_nome_idx on public.raffinato_produtos_catalogo_cache(loja_id,nome);
create index if not exists raffinato_agrupamentos_nome_idx on public.raffinato_agrupamentos_cache(loja_id,nome);
create index if not exists raffinato_formas_catalogo_nome_idx on public.raffinato_formas_pagamento_catalogo_cache(loja_id,nome);

alter table public.raffinato_agrupamentos_cache enable row level security;
alter table public.raffinato_produtos_catalogo_cache enable row level security;
alter table public.raffinato_formas_pagamento_catalogo_cache enable row level security;
revoke all on public.raffinato_agrupamentos_cache from anon,authenticated;
revoke all on public.raffinato_produtos_catalogo_cache from anon,authenticated;
revoke all on public.raffinato_formas_pagamento_catalogo_cache from anon,authenticated;
