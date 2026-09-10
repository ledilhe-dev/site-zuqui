alter table public.raffinato_pizza_mandatory_data_v1
  add column if not exists valor_unitario_componente numeric,
  add column if not exists modulo_venda text,
  add column if not exists canal_venda text,
  add column if not exists situacao_venda text,
  add column if not exists origem_codigo integer,
  add column if not exists vinculos_modulo integer;

create index if not exists raffinato_item_obrigatorio_dimensoes_idx
  on public.raffinato_pizza_mandatory_data_v1
  (empresa_id, loja_id, id_filial, data, modulo_venda, situacao_venda, canal_venda);

comment on column public.raffinato_pizza_mandatory_data_v1.valor_componente is
  'ValorTotal historico da linha filha em dbo.VendaItem; nunca recalculado pelo preco atual.';
comment on column public.raffinato_pizza_mandatory_data_v1.valor_unitario_componente is
  'ValorUnitario historico da linha filha em dbo.VendaItem.';
comment on column public.raffinato_pizza_mandatory_data_v1.situacao_venda is
  'Classificacao informativa pelos campos Aberto dos vinculos de modulo; nunca filtra a existencia da venda na sincronizacao.';
