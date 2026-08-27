alter table public.raffinato_pizza_mandatory_data_v1
  add column if not exists cancelado boolean,
  add column if not exists retornou_estoque boolean,
  add column if not exists retorno_estoque_original text;

comment on column public.raffinato_pizza_mandatory_data_v1.retornou_estoque is
  'Derivado de OperacaoEstoque.AnulaOposto para o VendaItem cancelado; null em registros legados.';
