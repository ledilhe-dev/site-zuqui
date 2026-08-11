alter table public.raffinato_delivery_aberto_cache
  alter column id_venda drop not null;

comment on column public.raffinato_delivery_aberto_cache.id_venda is
  'Vinculo opcional para diagnostico; a apuracao operacional nao depende de Venda.';
