-- Integracao Raffinato por loja. Segredos permanecem no conector local protegido pelo Windows.
create table if not exists public.raffinato_integracoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  loja_id uuid not null references public.lojas(id) on delete cascade,
  instancia_sql text not null,
  banco_dados text not null,
  usuario_mascarado text not null,
  referencia_segredo text not null,
  status text not null default 'ativa' check (status in ('ativa','erro','inativa')),
  ultimo_teste_em timestamptz,
  ultimo_erro text,
  criado_por uuid,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (loja_id)
);

drop trigger if exists raffinato_integracoes_tenant on public.raffinato_integracoes;
create trigger raffinato_integracoes_tenant before insert or update on public.raffinato_integracoes
for each row execute function public.fn_if_tenant();
drop trigger if exists raffinato_integracoes_touch on public.raffinato_integracoes;
create trigger raffinato_integracoes_touch before update on public.raffinato_integracoes
for each row execute function public.fn_if_touch();

alter table public.raffinato_integracoes enable row level security;
drop policy if exists raffinato_integracoes_select on public.raffinato_integracoes;
drop policy if exists raffinato_integracoes_insert on public.raffinato_integracoes;
drop policy if exists raffinato_integracoes_update on public.raffinato_integracoes;
drop policy if exists raffinato_integracoes_delete on public.raffinato_integracoes;
create policy raffinato_integracoes_select on public.raffinato_integracoes for select to anon,authenticated
  using (empresa_id = public.current_empresa_id());
create policy raffinato_integracoes_insert on public.raffinato_integracoes for insert to anon,authenticated
  with check (empresa_id = public.current_empresa_id());
create policy raffinato_integracoes_update on public.raffinato_integracoes for update to anon,authenticated
  using (empresa_id = public.current_empresa_id()) with check (empresa_id = public.current_empresa_id());
create policy raffinato_integracoes_delete on public.raffinato_integracoes for delete to anon,authenticated
  using (empresa_id = public.current_empresa_id());

create index if not exists raffinato_integracoes_empresa_loja_idx on public.raffinato_integracoes (empresa_id, loja_id);
comment on table public.raffinato_integracoes is 'Metadados da conexao Raffinato por loja. Senhas ficam protegidas no conector local.';
