-- Alinha o gerador de escalas ao contexto operacional seguro usado pelo restante do sistema.
-- A política anterior exigia um cabeçalho de empresa fora do contrato do cliente.

alter table public.escala_simulacoes enable row level security;

drop policy if exists escala_simulacoes_tenant_select on public.escala_simulacoes;
drop policy if exists escala_simulacoes_tenant_insert on public.escala_simulacoes;
drop policy if exists escala_simulacoes_tenant_update on public.escala_simulacoes;
drop policy if exists escala_simulacoes_tenant_delete on public.escala_simulacoes;
drop policy if exists tenant_select on public.escala_simulacoes;
drop policy if exists tenant_insert on public.escala_simulacoes;
drop policy if exists tenant_update on public.escala_simulacoes;
drop policy if exists tenant_delete on public.escala_simulacoes;

create policy tenant_select on public.escala_simulacoes
  for select to anon, authenticated
  using (public.request_store_authorized(empresa_id, loja_id));

create policy tenant_insert on public.escala_simulacoes
  for insert to anon, authenticated
  with check (public.request_store_authorized(empresa_id, loja_id));

create policy tenant_update on public.escala_simulacoes
  for update to anon, authenticated
  using (public.request_store_authorized(empresa_id, loja_id))
  with check (public.request_store_authorized(empresa_id, loja_id));

create policy tenant_delete on public.escala_simulacoes
  for delete to anon, authenticated
  using (public.request_store_authorized(empresa_id, loja_id));

grant select, insert, update, delete on public.escala_simulacoes to anon, authenticated;

notify pgrst, 'reload schema';
