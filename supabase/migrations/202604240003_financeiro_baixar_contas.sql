alter table if exists public.contasapagar
  add column if not exists valor_pago numeric(12,2),
  add column if not exists forma_pagamento text,
  add column if not exists pago_confirmado_em timestamptz;

update public.contasapagar
set valor_pago = coalesce(valor_pago, valor_compra, 0)
where valor_pago is null;

update public.contasapagar
set pago_confirmado_em = coalesce(pago_confirmado_em, now())
where data_pagamento is not null and pago_confirmado_em is null;

create index if not exists contasapagar_pago_confirmado_idx
  on public.contasapagar (pago_confirmado_em);
