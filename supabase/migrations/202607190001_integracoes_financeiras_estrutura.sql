-- Base do modulo Integracoes Financeiras. Nenhuma conexao externa e criada nesta fase.
create extension if not exists pgcrypto;

create or replace function public.fn_if_touch() returns trigger language plpgsql set search_path=public as $$
begin new.atualizado_em=now(); return new; end $$;

create or replace function public.fn_if_tenant() returns trigger language plpgsql set search_path=public as $$
declare v_empresa uuid;
begin
  select empresa_id into v_empresa from public.lojas where id=new.loja_id;
  if v_empresa is null then raise exception 'Loja inexistente ou sem empresa.'; end if;
  if new.empresa_id is null then new.empresa_id=v_empresa;
  elsif new.empresa_id<>v_empresa then raise exception 'Empresa e loja incompativeis.'; end if;
  return new;
end $$;

create table if not exists public.integracoes_financeiras_instituicoes(
 id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id) on delete cascade,
 loja_id uuid not null references public.lojas(id) on delete cascade, nome text not null, codigo text,
 tipo text not null default 'banco' check(tipo in('banco','cooperativa','fintech','corretora','carteira','outro')),
 pais_codigo char(2) not null default 'BR', identificador_externo text, metadados jsonb not null default '{}', ativo boolean not null default true,
 criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now(), unique(loja_id,nome));

create table if not exists public.integracoes_financeiras_configuracoes(
 id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id) on delete cascade,
 loja_id uuid not null references public.lojas(id) on delete cascade, instituicao_id uuid references public.integracoes_financeiras_instituicoes(id) on delete set null,
 provedor text not null default 'manual', ambiente text not null default 'sandbox' check(ambiente in('sandbox','producao')),
 status text not null default 'rascunho' check(status in('rascunho','pendente','ativa','pausada','erro','revogada')),
 identificador_conexao_externo text, escopos text[] not null default '{}', configuracao_publica jsonb not null default '{}', referencia_segredo text,
 sincronizacao_automatica boolean not null default false, intervalo_sincronizacao_minutos integer check(intervalo_sincronizacao_minutos is null or intervalo_sincronizacao_minutos>=5),
 ultima_sincronizacao_em timestamptz, proxima_sincronizacao_em timestamptz, erro_atual text, criado_por uuid,
 criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now(), unique(loja_id,provedor,identificador_conexao_externo));

create table if not exists public.integracoes_financeiras_contas_bancarias(
 id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id) on delete cascade,
 loja_id uuid not null references public.lojas(id) on delete cascade, instituicao_id uuid not null references public.integracoes_financeiras_instituicoes(id),
 configuracao_integracao_id uuid references public.integracoes_financeiras_configuracoes(id) on delete set null, nome text not null,
 tipo text not null default 'corrente' check(tipo in('corrente','poupanca','pagamento','investimento','carteira','outro')), moeda char(3) not null default 'BRL',
 agencia text, numero_mascarado text, identificador_externo text, saldo_atual numeric(18,2), saldo_disponivel numeric(18,2), saldo_atualizado_em timestamptz,
 status text not null default 'pendente' check(status in('pendente','ativa','inativa','erro','desconectada')), dados_origem jsonb not null default '{}',
 criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now(), unique(loja_id,configuracao_integracao_id,identificador_externo));

create table if not exists public.integracoes_financeiras_cartoes_credito(
 id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id) on delete cascade,
 loja_id uuid not null references public.lojas(id) on delete cascade, instituicao_id uuid not null references public.integracoes_financeiras_instituicoes(id),
 configuracao_integracao_id uuid references public.integracoes_financeiras_configuracoes(id) on delete set null,
 conta_bancaria_id uuid references public.integracoes_financeiras_contas_bancarias(id) on delete set null, nome text not null, bandeira text,
 ultimos_quatro char(4), identificador_externo text, moeda char(3) not null default 'BRL', limite_total numeric(18,2), limite_disponivel numeric(18,2),
 dia_fechamento smallint check(dia_fechamento between 1 and 31), dia_vencimento smallint check(dia_vencimento between 1 and 31),
 status text not null default 'pendente' check(status in('pendente','ativo','inativo','erro','desconectado')), dados_origem jsonb not null default '{}',
 criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now(), unique(loja_id,configuracao_integracao_id,identificador_externo));

create table if not exists public.integracoes_financeiras_categorias(
 id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id) on delete cascade,
 loja_id uuid not null references public.lojas(id) on delete cascade, categoria_pai_id uuid references public.integracoes_financeiras_categorias(id) on delete set null,
 nome text not null, tipo text not null default 'ambos' check(tipo in('receita','despesa','ambos')), cor text, icone text, sistema boolean not null default false,
 ativo boolean not null default true, criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now(), unique(loja_id,categoria_pai_id,nome));

create table if not exists public.integracoes_financeiras_fornecedores(
 id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id) on delete cascade,
 loja_id uuid not null references public.lojas(id) on delete cascade, fornecedor_legado_id uuid references public.fornecedores(id) on delete set null,
 nome text not null, nome_normalizado text not null, documento text,
 tipo text not null default 'fornecedor' check(tipo in('fornecedor','cliente','beneficiario','estabelecimento','outro')),
 identificadores_externos jsonb not null default '{}', metadados jsonb not null default '{}', ativo boolean not null default true,
 criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now(), unique(loja_id,nome_normalizado));

create table if not exists public.integracoes_financeiras_movimentacoes(
 id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id) on delete cascade,
 loja_id uuid not null references public.lojas(id) on delete cascade,
 conta_bancaria_id uuid references public.integracoes_financeiras_contas_bancarias(id) on delete cascade,
 cartao_credito_id uuid references public.integracoes_financeiras_cartoes_credito(id) on delete cascade,
 categoria_id uuid references public.integracoes_financeiras_categorias(id) on delete set null,
 fornecedor_id uuid references public.integracoes_financeiras_fornecedores(id) on delete set null,
 configuracao_integracao_id uuid references public.integracoes_financeiras_configuracoes(id) on delete set null,
 movimentacao_pai_id uuid references public.integracoes_financeiras_movimentacoes(id) on delete set null,
 identificador_externo text, tipo text not null check(tipo in('credito','debito','transferencia','estorno','tarifa','juros','ajuste')),
 origem text not null default 'manual' check(origem in('manual','open_finance','agregador','importacao','sistema')),
 status text not null default 'pendente' check(status in('pendente','processada','cancelada','ignorada')),
 descricao text not null, descricao_original text, valor numeric(18,2) not null check(valor>=0), moeda char(3) not null default 'BRL',
 data_movimentacao date not null, data_competencia date, data_liquidacao date,
 parcela_numero integer check(parcela_numero is null or parcela_numero>0), parcelas_total integer check(parcelas_total is null or parcelas_total>0),
 classificada_automaticamente boolean not null default false, confianca_classificacao numeric(5,4) check(confianca_classificacao between 0 and 1),
 possivel_duplicidade boolean not null default false, possivel_assinatura boolean not null default false, hash_deduplicacao text,
 dados_origem jsonb not null default '{}', criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now(),
 check(num_nonnulls(conta_bancaria_id,cartao_credito_id)=1));

create table if not exists public.integracoes_financeiras_conciliacoes(
 id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id) on delete cascade,
 loja_id uuid not null references public.lojas(id) on delete cascade,
 movimentacao_id uuid not null references public.integracoes_financeiras_movimentacoes(id) on delete cascade,
 entidade_origem text not null, entidade_id uuid,
 status text not null default 'pendente' check(status in('pendente','conciliada','divergente','ignorada','desfeita')),
 valor_esperado numeric(18,2), valor_movimentacao numeric(18,2), diferenca numeric(18,2), conciliado_por uuid,
 conciliado_em timestamptz, observacao text, metadados jsonb not null default '{}',
 criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now(), unique(movimentacao_id,entidade_origem,entidade_id));

create table if not exists public.integracoes_financeiras_regras_classificacao(
 id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id) on delete cascade,
 loja_id uuid not null references public.lojas(id) on delete cascade, nome text not null, prioridade integer not null default 100,
 ativa boolean not null default true, condicoes jsonb not null default '{}',
 categoria_id uuid references public.integracoes_financeiras_categorias(id) on delete set null,
 fornecedor_id uuid references public.integracoes_financeiras_fornecedores(id) on delete set null,
 acao jsonb not null default '{}', origem text not null default 'usuario' check(origem in('usuario','sistema','finance_ai')), criado_por uuid,
 criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now(), unique(loja_id,nome));

create table if not exists public.integracoes_financeiras_historico_sincronizacoes(
 id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id) on delete cascade,
 loja_id uuid not null references public.lojas(id) on delete cascade,
 configuracao_integracao_id uuid not null references public.integracoes_financeiras_configuracoes(id) on delete cascade,
 tipo text not null default 'incremental' check(tipo in('inicial','incremental','manual','webhook','reprocessamento')),
 status text not null default 'iniciada' check(status in('iniciada','concluida','parcial','falhou','cancelada')),
 iniciado_em timestamptz not null default now(), finalizado_em timestamptz, cursor_origem text,
 registros_recebidos integer not null default 0, registros_criados integer not null default 0,
 registros_atualizados integer not null default 0, registros_ignorados integer not null default 0,
 mensagem_erro text, detalhes jsonb not null default '{}', criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now());

create index if not exists idx_if_instituicoes_tenant on public.integracoes_financeiras_instituicoes(empresa_id,loja_id,ativo);
create index if not exists idx_if_configuracoes_status on public.integracoes_financeiras_configuracoes(empresa_id,loja_id,status);
create index if not exists idx_if_contas_status on public.integracoes_financeiras_contas_bancarias(empresa_id,loja_id,status);
create index if not exists idx_if_cartoes_status on public.integracoes_financeiras_cartoes_credito(empresa_id,loja_id,status);
create index if not exists idx_if_categorias_tipo on public.integracoes_financeiras_categorias(empresa_id,loja_id,tipo,ativo);
create index if not exists idx_if_fornecedores_nome on public.integracoes_financeiras_fornecedores(empresa_id,loja_id,nome_normalizado);
create index if not exists idx_if_movimentacoes_tenant_data on public.integracoes_financeiras_movimentacoes(empresa_id,loja_id,data_movimentacao desc);
create index if not exists idx_if_movimentacoes_conta_data on public.integracoes_financeiras_movimentacoes(conta_bancaria_id,data_movimentacao desc);
create index if not exists idx_if_movimentacoes_cartao_data on public.integracoes_financeiras_movimentacoes(cartao_credito_id,data_movimentacao desc);
create index if not exists idx_if_movimentacoes_categoria on public.integracoes_financeiras_movimentacoes(categoria_id) where categoria_id is not null;
create index if not exists idx_if_movimentacoes_hash on public.integracoes_financeiras_movimentacoes(loja_id,hash_deduplicacao) where hash_deduplicacao is not null;
create index if not exists idx_if_conciliacoes_status on public.integracoes_financeiras_conciliacoes(empresa_id,loja_id,status);
create index if not exists idx_if_regras_prioridade on public.integracoes_financeiras_regras_classificacao(empresa_id,loja_id,ativa,prioridade);
create index if not exists idx_if_sincronizacoes_data on public.integracoes_financeiras_historico_sincronizacoes(configuracao_integracao_id,iniciado_em desc);

do $$
declare v_tabela text;
begin
 foreach v_tabela in array array[
  'integracoes_financeiras_instituicoes','integracoes_financeiras_configuracoes','integracoes_financeiras_contas_bancarias',
  'integracoes_financeiras_cartoes_credito','integracoes_financeiras_categorias','integracoes_financeiras_fornecedores',
  'integracoes_financeiras_movimentacoes','integracoes_financeiras_conciliacoes','integracoes_financeiras_regras_classificacao',
  'integracoes_financeiras_historico_sincronizacoes'
 ] loop
  execute format('drop trigger if exists trg_if_tenant on public.%I',v_tabela);
  execute format('create trigger trg_if_tenant before insert or update of empresa_id,loja_id on public.%I for each row execute function public.fn_if_tenant()',v_tabela);
  execute format('drop trigger if exists trg_if_touch on public.%I',v_tabela);
  execute format('create trigger trg_if_touch before update on public.%I for each row execute function public.fn_if_touch()',v_tabela);
  execute format('alter table public.%I enable row level security',v_tabela);
  execute format('drop policy if exists if_select_empresa on public.%I',v_tabela);
  execute format('drop policy if exists if_insert_empresa on public.%I',v_tabela);
  execute format('drop policy if exists if_update_empresa on public.%I',v_tabela);
  execute format('drop policy if exists if_delete_empresa on public.%I',v_tabela);
  execute format('create policy if_select_empresa on public.%I for select to anon,authenticated using(empresa_id=public.current_empresa_id())',v_tabela);
  execute format('create policy if_insert_empresa on public.%I for insert to anon,authenticated with check(empresa_id=public.current_empresa_id())',v_tabela);
  execute format('create policy if_update_empresa on public.%I for update to anon,authenticated using(empresa_id=public.current_empresa_id()) with check(empresa_id=public.current_empresa_id())',v_tabela);
  execute format('create policy if_delete_empresa on public.%I for delete to anon,authenticated using(empresa_id=public.current_empresa_id())',v_tabela);
 end loop;
end $$;

comment on table public.integracoes_financeiras_configuracoes is 'Configuracoes agnosticas de provedor. Segredos ficam fora do banco; use referencia_segredo.';
comment on table public.integracoes_financeiras_movimentacoes is 'Movimentacoes normalizadas para entrada manual, Open Finance ou agregadores futuros.';
comment on table public.integracoes_financeiras_regras_classificacao is 'Regras declarativas preparadas para avaliacao futura pelo Finance AI.';
