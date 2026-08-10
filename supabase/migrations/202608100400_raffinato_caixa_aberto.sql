alter table public.raffinato_faturamento_cache
  add column if not exists valor_retirada numeric not null default 0,
  add column if not exists caixa_aberto boolean not null default false,
  add column if not exists valor_confirmado_disponivel boolean not null default true;
