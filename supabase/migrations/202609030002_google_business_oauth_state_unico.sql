create table if not exists public.google_business_oauth_states (
  nonce uuid primary key,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  loja_id uuid not null references public.lojas(id) on delete cascade,
  principal_id uuid not null,
  expira_em timestamptz not null,
  usado_em timestamptz,
  criado_em timestamptz not null default now()
);

alter table public.google_business_oauth_states enable row level security;
revoke all on public.google_business_oauth_states from anon, authenticated;
grant select, insert, update, delete on public.google_business_oauth_states to service_role;

create index if not exists idx_google_business_oauth_states_expira
  on public.google_business_oauth_states (expira_em);

comment on table public.google_business_oauth_states is
  'Nonces efêmeros e de uso único do OAuth Google Business; acesso exclusivo da Edge Function.';
