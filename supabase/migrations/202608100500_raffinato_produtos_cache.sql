create table if not exists public.raffinato_produtos_cache (
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  loja_id uuid not null references public.lojas(id) on delete cascade,
  data date not null,
  codigo bigint not null,
  produto text not null,
  id_agrupamento bigint,
  agrupamento text,
  quantidade numeric not null default 0,
  total_faturado numeric not null default 0,
  sincronizado_em timestamptz not null default now(),
  primary key (empresa_id, loja_id, data, codigo)
);

create index if not exists raffinato_produtos_cache_periodo_idx
  on public.raffinato_produtos_cache (loja_id, data);

create index if not exists raffinato_produtos_cache_agrupamento_idx
  on public.raffinato_produtos_cache (loja_id, id_agrupamento);

alter table public.raffinato_produtos_cache enable row level security;
revoke all on public.raffinato_produtos_cache from anon, authenticated;

comment on table public.raffinato_produtos_cache is
  'Cache diario dos produtos faturados Raffinato, consultado no mobile pelo relay autenticado.';
