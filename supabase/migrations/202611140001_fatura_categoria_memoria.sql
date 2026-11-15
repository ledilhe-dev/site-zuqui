begin;

-- Mantem compatibilidade com a tabela que ja existe nas instalacoes atuais.
-- Os nomes dos indices abaixo sao os canonicos da producao; assim a migracao
-- nao cria um segundo indice unico sobre as mesmas colunas.
create table if not exists public.fatura_categoria_memoria (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  loja_id uuid not null references public.lojas(id) on delete cascade,
  chave_estabelecimento text not null,
  categoria_id uuid,
  descricao_exemplo text,
  vezes_confirmado integer not null default 1,
  criado_por_id uuid,
  criado_por_nome text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create unique index if not exists fatura_categoria_memoria_unica
  on public.fatura_categoria_memoria (empresa_id, loja_id, chave_estabelecimento);
create index if not exists idx_fatura_cat_memoria_chave
  on public.fatura_categoria_memoria (chave_estabelecimento);
create index if not exists idx_fatura_cat_memoria_tenant
  on public.fatura_categoria_memoria (empresa_id, loja_id);

alter table public.fatura_categoria_memoria enable row level security;

drop policy if exists tenant_select on public.fatura_categoria_memoria;
drop policy if exists tenant_insert on public.fatura_categoria_memoria;
drop policy if exists tenant_update on public.fatura_categoria_memoria;
drop policy if exists tenant_delete on public.fatura_categoria_memoria;

create policy tenant_select on public.fatura_categoria_memoria
  for select to anon, authenticated
  using (public.request_store_authorized(empresa_id, loja_id));
create policy tenant_insert on public.fatura_categoria_memoria
  for insert to anon, authenticated
  with check (public.request_store_authorized(empresa_id, loja_id));
create policy tenant_update on public.fatura_categoria_memoria
  for update to anon, authenticated
  using (public.request_store_authorized(empresa_id, loja_id))
  with check (public.request_store_authorized(empresa_id, loja_id));
create policy tenant_delete on public.fatura_categoria_memoria
  for delete to anon, authenticated
  using (public.request_store_authorized(empresa_id, loja_id));

grant select, insert, update, delete on public.fatura_categoria_memoria to anon, authenticated;

notify pgrst, 'reload schema';

commit;
