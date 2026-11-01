-- Simulações isoladas do calendário oficial e do banco Raffinato.
create table if not exists public.escala_simulacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  loja_id uuid not null references public.lojas(id) on delete cascade,
  nome text not null check (length(trim(nome)) between 1 and 120),
  configuracao jsonb not null default '{}'::jsonb,
  resultado jsonb,
  versao_motor integer not null default 1,
  criado_por uuid references public.funcionarios(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists escala_simulacoes_tenant_idx on public.escala_simulacoes(empresa_id,loja_id,atualizado_em desc);
alter table public.escala_simulacoes enable row level security;

drop policy if exists escala_simulacoes_tenant_select on public.escala_simulacoes;
create policy escala_simulacoes_tenant_select on public.escala_simulacoes for select using (
  empresa_id = nullif(current_setting('request.headers',true)::jsonb->>'x-empresa-id','')::uuid
  and loja_id = nullif(current_setting('request.headers',true)::jsonb->>'x-loja-id','')::uuid
);
drop policy if exists escala_simulacoes_tenant_insert on public.escala_simulacoes;
create policy escala_simulacoes_tenant_insert on public.escala_simulacoes for insert with check (
  empresa_id = nullif(current_setting('request.headers',true)::jsonb->>'x-empresa-id','')::uuid
  and loja_id = nullif(current_setting('request.headers',true)::jsonb->>'x-loja-id','')::uuid
);
drop policy if exists escala_simulacoes_tenant_update on public.escala_simulacoes;
create policy escala_simulacoes_tenant_update on public.escala_simulacoes for update using (
  empresa_id = nullif(current_setting('request.headers',true)::jsonb->>'x-empresa-id','')::uuid
  and loja_id = nullif(current_setting('request.headers',true)::jsonb->>'x-loja-id','')::uuid
) with check (
  empresa_id = nullif(current_setting('request.headers',true)::jsonb->>'x-empresa-id','')::uuid
  and loja_id = nullif(current_setting('request.headers',true)::jsonb->>'x-loja-id','')::uuid
);
drop policy if exists escala_simulacoes_tenant_delete on public.escala_simulacoes;
create policy escala_simulacoes_tenant_delete on public.escala_simulacoes for delete using (
  empresa_id = nullif(current_setting('request.headers',true)::jsonb->>'x-empresa-id','')::uuid
  and loja_id = nullif(current_setting('request.headers',true)::jsonb->>'x-loja-id','')::uuid
);
comment on table public.escala_simulacoes is 'Cenários do gerador inteligente; nunca representa ou altera a agenda oficial.';
