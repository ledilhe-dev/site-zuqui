create table if not exists public.raffinato_pizza_mandatory_metadata_v1 (
  empresa_id uuid not null, loja_id uuid not null, connector_instance_id uuid,
  connection_profile_id uuid not null, id_filial integer not null check(id_filial>0), dataset_version text not null default 'pizza-v1',
  id_agrupamento integer not null, arvore text, nome text not null, sincronizado_em timestamptz not null default now(),
  primary key(empresa_id,loja_id,id_filial,dataset_version,id_agrupamento)
);
create table if not exists public.raffinato_pizza_mandatory_data_v1 (
  empresa_id uuid not null, loja_id uuid not null, connector_instance_id uuid,
  connection_profile_id uuid not null, id_filial integer not null check(id_filial>0), dataset_version text not null default 'pizza-v1',
  data date not null, hora time not null, id_venda bigint not null, id_item bigint not null, id_pai bigint not null,
  id_produto_pai bigint, produto_pai text, id_agrupamento_pai bigint, agrupamento_pai text, quantidade_produto_principal numeric,
  origem text, valor_item numeric, id_grupo_obrigatorio bigint not null, grupo_obrigatorio text,
  quantidade_maxima numeric, quantidade_minima numeric, id_componente bigint, componente text,
  quantidade_componente numeric, valor_componente numeric, sincronizado_em timestamptz not null default now(),
  primary key(empresa_id,loja_id,id_filial,dataset_version,id_venda,id_pai,id_grupo_obrigatorio,id_item)
);
create index if not exists raffinato_pizza_mandatory_data_v1_periodo_idx on public.raffinato_pizza_mandatory_data_v1(empresa_id,loja_id,id_filial,dataset_version,data,hora);
alter table public.raffinato_pizza_mandatory_metadata_v1 enable row level security;
alter table public.raffinato_pizza_mandatory_data_v1 enable row level security;
revoke all on public.raffinato_pizza_mandatory_metadata_v1 from anon,authenticated;
revoke all on public.raffinato_pizza_mandatory_data_v1 from anon,authenticated;
