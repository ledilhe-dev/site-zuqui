-- Cache seguro para disponibilizar sangrias fora do computador do conector.
alter table public.raffinato_integracoes
  add column if not exists conector_token_hash text,
  add column if not exists ultima_sincronizacao_em timestamptz;

create unique index if not exists raffinato_integracoes_token_idx
  on public.raffinato_integracoes (conector_token_hash)
  where conector_token_hash is not null;

create table if not exists public.raffinato_sangrias_cache (
  id bigint generated always as identity primary key,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  loja_id uuid not null references public.lojas(id) on delete cascade,
  data date not null,
  hora time not null,
  motivo text not null,
  valor numeric(14,2) not null default 0,
  sincronizado_em timestamptz not null default now()
);

create index if not exists raffinato_cache_loja_periodo_idx
  on public.raffinato_sangrias_cache (empresa_id, loja_id, data, hora);

alter table public.raffinato_sangrias_cache enable row level security;
revoke all on public.raffinato_sangrias_cache from anon, authenticated;
-- A tabela e acessada exclusivamente pela Edge Function com service_role.

comment on table public.raffinato_sangrias_cache is
  'Cache de leitura do Raffinato, abastecido pelo conector e consultado pela Edge Function.';
