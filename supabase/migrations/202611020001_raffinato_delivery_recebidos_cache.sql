create table if not exists public.raffinato_delivery_recebidos_cache (
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  loja_id uuid not null references public.lojas(id) on delete cascade,
  id_filial integer not null,
  id_integracao bigint not null,
  id_integracao_delivery text not null,
  data_recebimento date not null,
  hora_recebimento time not null,
  origem text not null,
  importado integer,
  id_tele_entrega bigint,
  id_venda bigint,
  valor_venda numeric,
  situacao text not null check (situacao in ('FATURADO','PENDENTE_CONCILIACAO')),
  sincronizado_em timestamptz not null default now(),
  primary key (empresa_id,loja_id,id_integracao),
  check (id_venda is not null or valor_venda is null)
);

create index if not exists raffinato_delivery_recebidos_periodo_idx
  on public.raffinato_delivery_recebidos_cache(loja_id,data_recebimento,hora_recebimento);

create index if not exists raffinato_delivery_recebidos_situacao_idx
  on public.raffinato_delivery_recebidos_cache(loja_id,situacao,data_recebimento);

alter table public.raffinato_delivery_recebidos_cache enable row level security;
revoke all on public.raffinato_delivery_recebidos_cache from anon,authenticated;

comment on table public.raffinato_delivery_recebidos_cache is
  'Pedidos recebidos da integracao Delivery para conciliacao operacional; pedidos sem venda nunca recebem valor inferido.';
