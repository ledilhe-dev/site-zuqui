create table if not exists public.raffinato_sync_solicitacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  loja_id uuid not null references public.lojas(id) on delete cascade,
  connector_instance_id uuid not null references public.raffinato_connector_instances(id) on delete cascade,
  inicio date not null,
  fim_exclusivo date not null,
  status text not null check(status in ('pendente','concluida','erro')),
  solicitado_em timestamptz not null default now(),
  concluido_em timestamptz,
  erro text,
  unique(empresa_id,loja_id),
  check(fim_exclusivo>inicio)
);

create index if not exists raffinato_sync_solicitacoes_pendentes_idx
  on public.raffinato_sync_solicitacoes(connector_instance_id,status,solicitado_em);

alter table public.raffinato_sync_solicitacoes enable row level security;
revoke all on public.raffinato_sync_solicitacoes from anon,authenticated;

comment on table public.raffinato_sync_solicitacoes is
  'Fila coalescida de atualizacao incremental solicitada explicitamente pelo botao Consultar.';
