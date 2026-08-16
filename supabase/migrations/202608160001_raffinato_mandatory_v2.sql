create table if not exists public.raffinato_mandatory_v2_cache (
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  loja_id uuid not null references public.lojas(id) on delete cascade,
  id_filial integer not null check (id_filial > 0),
  data date not null,
  hora time not null,
  id_venda bigint not null,
  id_item bigint not null,
  id_pai bigint not null,
  id_produto_pai bigint,
  produto_pai text,
  id_agrupamento_pai bigint,
  agrupamento_pai text,
  origem text not null,
  valor_item numeric not null default 0,
  id_grupo_obrigatorio bigint not null,
  grupo_obrigatorio text not null,
  quantidade_maxima numeric,
  quantidade_minima numeric,
  id_componente bigint not null,
  componente text,
  quantidade_componente numeric not null default 0,
  valor_componente numeric not null default 0,
  sincronizado_em timestamptz not null default now(),
  primary key (empresa_id, loja_id, id_filial, id_venda, id_pai, id_grupo_obrigatorio, id_item)
);

create index if not exists raffinato_mandatory_v2_periodo_idx
  on public.raffinato_mandatory_v2_cache(empresa_id, loja_id, id_filial, data, hora);
create index if not exists raffinato_mandatory_v2_produto_idx
  on public.raffinato_mandatory_v2_cache(empresa_id, loja_id, id_filial, id_agrupamento_pai, id_produto_pai);

alter table public.raffinato_mandatory_v2_cache enable row level security;
revoke all on public.raffinato_mandatory_v2_cache from anon, authenticated;
