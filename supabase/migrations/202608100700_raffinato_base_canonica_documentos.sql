create table if not exists public.raffinato_documentos_faturados_cache (
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  loja_id uuid not null references public.lojas(id) on delete cascade,
  id_filial integer not null,
  id_documento_fiscal bigint not null,
  data date not null,
  hora time not null,
  tipo text,
  eh_contingencia boolean not null default false,
  id_forma_pagamento bigint not null,
  forma_pagamento text not null,
  valor_pagamento numeric not null default 0,
  sincronizado_em timestamptz not null default now(),
  primary key (empresa_id, loja_id, id_documento_fiscal, id_forma_pagamento)
);

create table if not exists public.raffinato_itens_faturados_cache (
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  loja_id uuid not null references public.lojas(id) on delete cascade,
  id_filial integer not null,
  id_documento_fiscal bigint not null,
  data date not null,
  hora time not null,
  codigo bigint not null,
  produto text not null,
  id_agrupamento bigint,
  agrupamento text,
  quantidade numeric not null default 0,
  total_faturado numeric not null default 0,
  sincronizado_em timestamptz not null default now(),
  primary key (empresa_id, loja_id, id_documento_fiscal, codigo)
);

create index if not exists raffinato_documentos_faturados_periodo_idx
  on public.raffinato_documentos_faturados_cache (loja_id, data, hora);
create index if not exists raffinato_documentos_faturados_forma_idx
  on public.raffinato_documentos_faturados_cache (loja_id, id_forma_pagamento, data);
create index if not exists raffinato_itens_faturados_periodo_idx
  on public.raffinato_itens_faturados_cache (loja_id, data, hora);
create index if not exists raffinato_itens_faturados_produto_idx
  on public.raffinato_itens_faturados_cache (loja_id, codigo, data);
create index if not exists raffinato_itens_faturados_grupo_idx
  on public.raffinato_itens_faturados_cache (loja_id, id_agrupamento, data);

alter table public.raffinato_documentos_faturados_cache enable row level security;
alter table public.raffinato_itens_faturados_cache enable row level security;
revoke all on public.raffinato_documentos_faturados_cache from anon, authenticated;
revoke all on public.raffinato_itens_faturados_cache from anon, authenticated;

comment on table public.raffinato_documentos_faturados_cache is
  'Base canonica por documento e forma de pagamento, incluindo hora e contingencia.';
comment on table public.raffinato_itens_faturados_cache is
  'Itens reais de ItemDocumentoFiscal vinculados a base canonica de documentos.';
