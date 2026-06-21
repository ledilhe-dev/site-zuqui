alter table if exists public.recebiveis
  add column if not exists criado_por_id uuid references public.funcionarios(id) on delete set null,
  add column if not exists criado_por_nome text;

update public.recebiveis
set criado_por_nome = coalesce(nullif(trim(criado_por_nome), ''), 'Cadastro anterior')
where coalesce(nullif(trim(criado_por_nome), ''), '') = '';

create index if not exists recebiveis_criado_por_id_idx
  on public.recebiveis (criado_por_id);

