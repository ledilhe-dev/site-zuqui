alter table if exists public.contasapagar
  add column if not exists criado_por_id uuid references public.funcionarios(id) on delete set null,
  add column if not exists criado_por_nome text,
  add column if not exists excluido_em timestamptz,
  add column if not exists excluido_por_id uuid references public.funcionarios(id) on delete set null,
  add column if not exists excluido_por_nome text;

update public.contasapagar
set criado_por_nome = coalesce(nullif(trim(criado_por_nome), ''), 'Cadastro anterior')
where coalesce(nullif(trim(criado_por_nome), ''), '') = '';

create index if not exists contasapagar_excluido_em_idx
  on public.contasapagar (excluido_em);

create index if not exists contasapagar_criado_por_id_idx
  on public.contasapagar (criado_por_id);

create index if not exists contasapagar_excluido_por_id_idx
  on public.contasapagar (excluido_por_id);