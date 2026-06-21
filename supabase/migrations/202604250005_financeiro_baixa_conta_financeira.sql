alter table if exists public.contasapagar
  add column if not exists conta_financeira_id uuid references public.contas_financeiras(id) on update cascade on delete restrict;

create index if not exists contasapagar_conta_financeira_idx
  on public.contasapagar (conta_financeira_id);

alter table if exists public.contas_financeiras_movimentacoes
  add column if not exists conta_apagar_id uuid references public.contasapagar(id) on update cascade on delete set null;

create index if not exists contas_financeiras_mov_conta_apagar_idx
  on public.contas_financeiras_movimentacoes (conta_apagar_id);
