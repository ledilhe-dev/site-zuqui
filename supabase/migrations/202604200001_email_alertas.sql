create extension if not exists pgcrypto;

create table if not exists public.email_alertas (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  failed_at timestamptz,
  status text not null default 'pending',
  attempts integer not null default 0,
  tipo text not null,
  chave_unica text not null,
  assunto text not null,
  mensagem text not null,
  destinatarios jsonb not null default '[]'::jsonb,
  meta jsonb not null default '{}'::jsonb,
  ultimo_erro text,
  constraint email_alertas_status_check check (status in ('pending', 'sent', 'error')),
  constraint email_alertas_chave_unica_key unique (chave_unica)
);

create index if not exists email_alertas_status_created_at_idx
  on public.email_alertas (status, created_at);

alter table public.email_alertas enable row level security;

drop policy if exists "email_alertas_select_public" on public.email_alertas;
create policy "email_alertas_select_public"
on public.email_alertas
for select
to anon, authenticated
using (true);

drop policy if exists "email_alertas_insert_public" on public.email_alertas;
create policy "email_alertas_insert_public"
on public.email_alertas
for insert
to anon, authenticated
with check (true);
