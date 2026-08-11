create table if not exists public.raffinato_delivery_aberto_cache (
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  loja_id uuid not null references public.lojas(id) on delete cascade,
  id_filial integer not null,
  id_tele_entrega bigint not null,
  id_venda bigint not null,
  pedido bigint not null,
  data date not null,
  hora time not null,
  id_status integer not null,
  status text not null,
  valor numeric not null default 0,
  cancelado boolean not null default false,
  finalizado boolean not null default false,
  id_documento_fiscal bigint,
  sincronizado_em timestamptz not null default now(),
  primary key (empresa_id, loja_id, id_tele_entrega)
);

create index if not exists raffinato_delivery_aberto_periodo_idx
  on public.raffinato_delivery_aberto_cache (loja_id, data, hora);

alter table public.raffinato_delivery_aberto_cache enable row level security;
revoke all on public.raffinato_delivery_aberto_cache from anon, authenticated;

comment on table public.raffinato_delivery_aberto_cache is
  'Snapshot operacional de TeleEntrega ainda aberta e sem documento fiscal.';
