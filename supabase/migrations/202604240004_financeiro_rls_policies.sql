alter table if exists public.fornecedores enable row level security;
alter table if exists public.contasapagar enable row level security;

drop policy if exists fornecedores_anon_all on public.fornecedores;
drop policy if exists fornecedores_authenticated_all on public.fornecedores;
drop policy if exists contasapagar_anon_all on public.contasapagar;
drop policy if exists contasapagar_authenticated_all on public.contasapagar;

create policy fornecedores_anon_all
  on public.fornecedores
  for all
  to anon
  using (true)
  with check (true);

create policy fornecedores_authenticated_all
  on public.fornecedores
  for all
  to authenticated
  using (true)
  with check (true);

create policy contasapagar_anon_all
  on public.contasapagar
  for all
  to anon
  using (true)
  with check (true);

create policy contasapagar_authenticated_all
  on public.contasapagar
  for all
  to authenticated
  using (true)
  with check (true);
