create table if not exists public.raffinato_historico_diario_cache (
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  loja_id uuid not null references public.lojas(id) on delete cascade,
  id_filial integer not null,
  data date not null,
  modulo_venda text not null,
  faturamento numeric(20,4) not null default 0,
  vendas integer not null default 0,
  sincronizado_em timestamptz not null default now(),
  primary key (empresa_id,loja_id,id_filial,data,modulo_venda)
);

create index if not exists raffinato_historico_diario_periodo_idx
  on public.raffinato_historico_diario_cache(loja_id,id_filial,data);

alter table public.raffinato_historico_diario_cache enable row level security;
revoke all on public.raffinato_historico_diario_cache from anon, authenticated;
