-- Memoria por loja das correcoes feitas na revisao de importacoes OCR/OFX.
create table if not exists public.fatura_importacao_memoria (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  loja_id uuid not null references public.lojas(id) on delete cascade,
  chave_origem text not null,
  descricao_origem_exemplo text not null,
  observacao_padrao text,
  fornecedor_id uuid references public.fornecedores(id) on delete set null,
  categoria_id uuid references public.categorias_compra(id) on delete set null,
  ocorrencias integer not null default 1 check (ocorrencias > 0),
  ultima_utilizacao_em timestamptz not null default now(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (empresa_id, loja_id, chave_origem)
);

create index if not exists idx_fatura_importacao_memoria_busca
  on public.fatura_importacao_memoria (empresa_id, loja_id, ultima_utilizacao_em desc);

alter table public.fatura_importacao_memoria enable row level security;
drop policy if exists fatura_importacao_memoria_select_empresa on public.fatura_importacao_memoria;
drop policy if exists fatura_importacao_memoria_insert_empresa on public.fatura_importacao_memoria;
drop policy if exists fatura_importacao_memoria_update_empresa on public.fatura_importacao_memoria;
drop policy if exists fatura_importacao_memoria_delete_empresa on public.fatura_importacao_memoria;
create policy fatura_importacao_memoria_select_empresa on public.fatura_importacao_memoria for select to anon, authenticated using (empresa_id=public.current_empresa_id());
create policy fatura_importacao_memoria_insert_empresa on public.fatura_importacao_memoria for insert to anon, authenticated with check (empresa_id=public.current_empresa_id());
create policy fatura_importacao_memoria_update_empresa on public.fatura_importacao_memoria for update to anon, authenticated using (empresa_id=public.current_empresa_id()) with check (empresa_id=public.current_empresa_id());
create policy fatura_importacao_memoria_delete_empresa on public.fatura_importacao_memoria for delete to anon, authenticated using (empresa_id=public.current_empresa_id());

comment on table public.fatura_importacao_memoria is 'Aprende correcoes editaveis de observacao, fornecedor e categoria por descricao importada e por loja.';
