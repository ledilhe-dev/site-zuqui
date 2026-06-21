create extension if not exists pgcrypto;

create table if not exists public.email_tokens_auth (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('verificacao_email', 'reset_senha')),
  funcionario_id uuid references public.funcionarios(id) on delete cascade,
  email text not null,
  token_hash text not null unique,
  meta jsonb not null default '{}'::jsonb,
  expira_em timestamptz not null,
  usado_em timestamptz,
  criado_em timestamptz not null default timezone('utc', now())
);

create index if not exists idx_email_tokens_auth_email
  on public.email_tokens_auth(email);

create index if not exists idx_email_tokens_auth_tipo
  on public.email_tokens_auth(tipo);

create index if not exists idx_email_tokens_auth_expira_em
  on public.email_tokens_auth(expira_em);
