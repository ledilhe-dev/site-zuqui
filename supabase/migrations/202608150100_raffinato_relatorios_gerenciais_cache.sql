create table if not exists public.raffinato_abc_cache (
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  loja_id uuid not null references public.lojas(id) on delete cascade,
  data date not null,
  id_filial integer not null,
  codigo bigint not null,
  produto text not null,
  id_agrupamento bigint,
  agrupamento text,
  quantidade numeric(20,6) not null default 0,
  faturamento numeric(20,4) not null default 0,
  custo_conhecido numeric(20,4) not null default 0,
  faturamento_com_custo numeric(20,4) not null default 0,
  itens_com_custo integer not null default 0,
  itens_sem_custo integer not null default 0,
  sincronizado_em timestamptz not null default now(),
  primary key (empresa_id,loja_id,data,id_filial,codigo)
);
create index if not exists raffinato_abc_periodo_idx on public.raffinato_abc_cache(loja_id,id_filial,data);

create table if not exists public.raffinato_itens_obrigatorios_cache (
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  loja_id uuid not null references public.lojas(id) on delete cascade,
  data date not null,
  hora time not null,
  id_filial integer not null,
  id_venda bigint not null,
  id_pai bigint not null,
  id_produto_pai bigint not null,
  produto_pai text not null,
  id_agrupamento_pai bigint,
  agrupamento_pai text,
  origem text not null,
  valor_item numeric(20,4) not null default 0,
  id_item_obrigatorio bigint,
  item_obrigatorio text,
  id_componente bigint not null,
  componente text not null,
  quantidade_componente numeric(20,6) not null default 0,
  sincronizado_em timestamptz not null default now(),
  primary key (empresa_id,loja_id,id_pai,id_componente)
);
create index if not exists raffinato_io_periodo_idx on public.raffinato_itens_obrigatorios_cache(loja_id,id_filial,data,hora);

create table if not exists public.raffinato_anual_cache (
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  loja_id uuid not null references public.lojas(id) on delete cascade,
  id_filial integer not null,
  ano integer not null,
  mes integer not null,
  modulo_venda text not null,
  faturamento numeric(20,4) not null default 0,
  vendas integer not null default 0,
  quantidade numeric(20,6) not null default 0,
  primeira_data date,
  ultima_data date,
  sincronizado_em timestamptz not null default now(),
  primary key (empresa_id,loja_id,id_filial,ano,mes,modulo_venda)
);
create index if not exists raffinato_anual_periodo_idx on public.raffinato_anual_cache(loja_id,id_filial,ano,mes);

alter table public.raffinato_abc_cache enable row level security;
alter table public.raffinato_itens_obrigatorios_cache enable row level security;
alter table public.raffinato_anual_cache enable row level security;
revoke all on public.raffinato_abc_cache from anon, authenticated;
revoke all on public.raffinato_itens_obrigatorios_cache from anon, authenticated;
revoke all on public.raffinato_anual_cache from anon, authenticated;
