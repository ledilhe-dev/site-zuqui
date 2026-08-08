-- Google Business Profile: conexões, locais, avaliações e métricas.
create extension if not exists pgcrypto;

create table if not exists public.google_business_conexoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  loja_id uuid references public.lojas(id) on delete cascade,
  google_account_id text,
  google_email text,
  refresh_token_cifrado text not null,
  status text not null default 'ativa' check (status in ('ativa','erro','revogada')),
  ultima_sincronizacao_em timestamptz,
  ultimo_erro text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists google_business_conexoes_empresa_conta_uidx on public.google_business_conexoes(empresa_id, google_account_id);

create table if not exists public.google_business_locais (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  loja_id uuid references public.lojas(id) on delete set null,
  conexao_id uuid not null references public.google_business_conexoes(id) on delete cascade,
  google_account_id text not null,
  google_location_id text not null,
  nome text not null,
  endereco text,
  nota_media numeric(3,2),
  total_avaliacoes integer not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(conexao_id, google_location_id)
);

create table if not exists public.google_avaliacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  loja_id uuid references public.lojas(id) on delete set null,
  local_id uuid not null references public.google_business_locais(id) on delete cascade,
  review_id text not null,
  avaliador_nome text,
  avaliador_foto_url text,
  nota smallint not null check (nota between 1 and 5),
  comentario text,
  criado_em timestamptz not null,
  atualizado_em timestamptz,
  resposta_texto text,
  resposta_atualizada_em timestamptz,
  dados_origem jsonb not null default '{}'::jsonb,
  sincronizado_em timestamptz not null default now(),
  unique(local_id, review_id)
);
create index if not exists google_avaliacoes_empresa_data_idx on public.google_avaliacoes(empresa_id, criado_em desc);
create index if not exists google_avaliacoes_loja_nota_idx on public.google_avaliacoes(loja_id, nota, criado_em desc);

create table if not exists public.google_avaliacoes_metricas_diarias (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  loja_id uuid references public.lojas(id) on delete cascade,
  local_id uuid not null references public.google_business_locais(id) on delete cascade,
  data date not null,
  quantidade integer not null default 0,
  nota_media numeric(3,2),
  respondidas integer not null default 0,
  unique(local_id, data)
);

create table if not exists public.google_sincronizacoes_logs (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  loja_id uuid references public.lojas(id) on delete set null,
  conexao_id uuid references public.google_business_conexoes(id) on delete set null,
  status text not null check (status in ('iniciada','sucesso','erro')),
  avaliacoes_processadas integer not null default 0,
  mensagem text,
  created_at timestamptz not null default now()
);

alter table public.google_business_conexoes enable row level security;
alter table public.google_business_locais enable row level security;
alter table public.google_avaliacoes enable row level security;
alter table public.google_avaliacoes_metricas_diarias enable row level security;
alter table public.google_sincronizacoes_logs enable row level security;

-- A Edge Function usa service_role para gravar. O frontend recebe somente leitura,
-- filtrada pelo tenant configurado no JWT do Supabase.
do $$
declare tabela text;
begin
  foreach tabela in array array['google_business_conexoes','google_business_locais','google_avaliacoes','google_avaliacoes_metricas_diarias','google_sincronizacoes_logs']
  loop
    execute format('drop policy if exists tenant_read on public.%I', tabela);
    execute format(
      'create policy tenant_read on public.%I for select to authenticated using (empresa_id::text = coalesce(auth.jwt()->>''empresa_id'', auth.jwt()->''user_metadata''->>''empresa_id''))',
      tabela
    );
  end loop;
end $$;

revoke all on public.google_business_conexoes from anon, authenticated;
grant select (id, empresa_id, loja_id, google_account_id, google_email, status, ultima_sincronizacao_em, ultimo_erro, created_at, updated_at) on public.google_business_conexoes to authenticated;
grant select on public.google_business_locais, public.google_avaliacoes, public.google_avaliacoes_metricas_diarias, public.google_sincronizacoes_logs to authenticated;
