-- Sessões e evidências da conciliação manual, sempre isoladas por loja.
create table if not exists public.conciliacao_importacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  loja_id uuid not null references public.lojas(id) on delete cascade,
  fornecedor_id uuid not null references public.fornecedores(id),
  arquivo_nome text not null,
  arquivo_tipo text not null check (arquivo_tipo in ('pdf','imagem','ofx','qfx')),
  arquivo_hash text not null,
  leitor text not null check (leitor in ('ofx','pdf_texto','ocr_local','openai','hibrido')),
  status text not null default 'processando' check (status in ('processando','revisao','concluida','cancelada','erro')),
  total_documento numeric(18,2),
  total_lancamentos numeric(18,2),
  confianca numeric(5,4) check (confianca between 0 and 1),
  alertas jsonb not null default '[]',
  metadados jsonb not null default '{}',
  criado_por_id uuid,
  criado_por_nome text,
  criado_em timestamptz not null default now(),
  concluido_em timestamptz,
  unique (loja_id, arquivo_hash)
);

create table if not exists public.conciliacao_importacao_itens (
  id uuid primary key default gen_random_uuid(),
  importacao_id uuid not null references public.conciliacao_importacoes(id) on delete cascade,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  loja_id uuid not null references public.lojas(id) on delete cascade,
  ordem integer not null,
  data_movimento date,
  descricao text not null,
  valor numeric(18,2) not null check (valor >= 0),
  tipo text not null default 'debito',
  identificador_bancario text,
  texto_evidencia text,
  pagina integer,
  confianca numeric(5,4) check (confianca between 0 and 1),
  status text not null default 'pendente' check (status in ('pendente','localizado','divergente','conciliado','cadastrado','ignorado')),
  conta_pagar_id uuid references public.contasapagar(id) on delete set null,
  score_correspondencia numeric(8,4),
  criterios_correspondencia jsonb not null default '{}',
  criado_em timestamptz not null default now(),
  unique (importacao_id, ordem)
);

create table if not exists public.conciliacao_auditoria (
  id uuid primary key default gen_random_uuid(),
  importacao_id uuid references public.conciliacao_importacoes(id) on delete set null,
  item_id uuid references public.conciliacao_importacao_itens(id) on delete set null,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  loja_id uuid not null references public.lojas(id) on delete cascade,
  acao text not null,
  conta_pagar_id uuid references public.contasapagar(id) on delete set null,
  antes jsonb,
  depois jsonb,
  ator_id uuid,
  ator_nome text,
  criado_em timestamptz not null default now()
);

create index if not exists idx_conc_importacoes_loja_data on public.conciliacao_importacoes(empresa_id,loja_id,criado_em desc);
create index if not exists idx_conc_itens_importacao_status on public.conciliacao_importacao_itens(importacao_id,status);
create index if not exists idx_conc_itens_fitid on public.conciliacao_importacao_itens(loja_id,identificador_bancario) where identificador_bancario is not null;
create index if not exists idx_conc_auditoria_loja_data on public.conciliacao_auditoria(empresa_id,loja_id,criado_em desc);

do $$
declare tabela text;
begin
  foreach tabela in array array['conciliacao_importacoes','conciliacao_importacao_itens','conciliacao_auditoria'] loop
    execute format('alter table public.%I enable row level security', tabela);
    execute format('drop policy if exists conc_select on public.%I', tabela);
    execute format('drop policy if exists conc_insert on public.%I', tabela);
    execute format('drop policy if exists conc_update on public.%I', tabela);
    execute format('create policy conc_select on public.%I for select to anon,authenticated using (empresa_id=public.current_empresa_id())', tabela);
    execute format('create policy conc_insert on public.%I for insert to anon,authenticated with check (empresa_id=public.current_empresa_id() and exists(select 1 from public.lojas l where l.id=loja_id and l.empresa_id=public.current_empresa_id()))', tabela);
    execute format('create policy conc_update on public.%I for update to anon,authenticated using (empresa_id=public.current_empresa_id()) with check (empresa_id=public.current_empresa_id() and exists(select 1 from public.lojas l where l.id=loja_id and l.empresa_id=public.current_empresa_id()))', tabela);
  end loop;
end $$;
