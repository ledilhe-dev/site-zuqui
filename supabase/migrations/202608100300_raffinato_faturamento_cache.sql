create table if not exists public.raffinato_faturamento_cache (
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  loja_id uuid not null references public.lojas(id) on delete cascade,
  data date not null,
  id_forma_pagamento bigint not null,
  forma_pagamento text not null,
  valor_movimento numeric not null default 0,
  valor_abertura numeric not null default 0,
  valor_suprimento numeric not null default 0,
  valor_sangria numeric not null default 0,
  valor_apurado numeric not null default 0,
  valor_confirmado numeric not null default 0,
  sincronizado_em timestamptz not null default now(),
  primary key (empresa_id, loja_id, data, id_forma_pagamento)
);
create index if not exists raffinato_faturamento_cache_periodo_idx
  on public.raffinato_faturamento_cache (loja_id, data);
alter table public.raffinato_faturamento_cache enable row level security;
