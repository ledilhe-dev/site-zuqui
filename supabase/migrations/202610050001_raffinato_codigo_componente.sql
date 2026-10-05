alter table public.raffinato_pizza_mandatory_data_v1
  add column if not exists codigo_componente text;

comment on column public.raffinato_pizza_mandatory_data_v1.codigo_componente is
  'Codigo PDV/integracao do item filho, preservando prefixos como I para identificar pedidos integrados.';
