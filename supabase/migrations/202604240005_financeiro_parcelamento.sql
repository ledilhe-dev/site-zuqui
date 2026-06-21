alter table if exists public.contasapagar
  add column if not exists qtd_parcelas integer not null default 1,
  add column if not exists intervalo_parcelas_dias integer,
  add column if not exists numero_parcela integer not null default 1,
  add column if not exists grupo_parcelas_id uuid;

update public.contasapagar
set qtd_parcelas = coalesce(qtd_parcelas, 1)
where qtd_parcelas is null;

update public.contasapagar
set numero_parcela = coalesce(numero_parcela, 1)
where numero_parcela is null;

create index if not exists contasapagar_grupo_parcelas_idx
  on public.contasapagar (grupo_parcelas_id, numero_parcela);

create index if not exists contasapagar_qtd_parcelas_idx
  on public.contasapagar (qtd_parcelas, numero_parcela);
