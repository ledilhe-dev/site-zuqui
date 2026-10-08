-- Alertas financeiros e controle multiloja de produtos proximos ao vencimento.

alter table public.telegram_destinos
  add column if not exists notificar_financeiro boolean not null default true,
  add column if not exists notificar_produtos_vencimento boolean not null default true;

alter table public.telegram_alertas drop constraint if exists telegram_alertas_tipo_check;
alter table public.telegram_alertas add constraint telegram_alertas_tipo_check check (tipo in (
  'tarefa_iniciada','tarefa_nao_iniciada','tarefa_finalizada','tarefa_nao_finalizada',
  'financeiro_vencimento','financeiro_saldo','produto_cadastrado','produto_vencimento'
));

create table if not exists public.produtos_vencimento (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  loja_id uuid not null references public.lojas(id) on delete cascade,
  nome_produto text not null check (length(trim(nome_produto)) between 2 and 180),
  codigo_barras text not null default '',
  data_vencimento date not null,
  funcionario_id uuid references public.funcionarios(id) on delete set null,
  funcionario_nome text not null,
  dias_antecedencia integer not null default 1 check (dias_antecedencia between 0 and 365),
  alertar_telegram boolean not null default true,
  avisar_no_vencimento boolean not null default true,
  horario_alerta time not null default '08:00',
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists produtos_vencimento_loja_data_idx
  on public.produtos_vencimento(loja_id, data_vencimento) where ativo;
create index if not exists produtos_vencimento_codigo_idx
  on public.produtos_vencimento(loja_id, codigo_barras) where ativo and codigo_barras <> '';

alter table public.produtos_vencimento enable row level security;
drop policy if exists tenant_select on public.produtos_vencimento;
drop policy if exists tenant_insert on public.produtos_vencimento;
drop policy if exists tenant_update on public.produtos_vencimento;
drop policy if exists tenant_delete on public.produtos_vencimento;
create policy tenant_select on public.produtos_vencimento for select to anon, authenticated
  using (public.request_store_authorized(empresa_id, loja_id));
create policy tenant_insert on public.produtos_vencimento for insert to anon, authenticated
  with check (public.request_store_authorized(empresa_id, loja_id));
create policy tenant_update on public.produtos_vencimento for update to anon, authenticated
  using (public.request_store_authorized(empresa_id, loja_id))
  with check (public.request_store_authorized(empresa_id, loja_id));
create policy tenant_delete on public.produtos_vencimento for delete to anon, authenticated
  using (public.request_store_authorized(empresa_id, loja_id));

create or replace function public.telegram_produto_cadastrado()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.alertar_telegram and new.ativo then
    insert into public.telegram_alertas(
      chave_unica,tipo,empresa_id,loja_id,descricao,funcionario_id,funcionario_nome,
      horario_previsto,horario_real
    ) values (
      'produto_cadastrado:'||new.id::text,'produto_cadastrado',new.empresa_id,new.loja_id,
      E'📦 PRODUTO CADASTRADO\nProduto: '||new.nome_produto||
      case when new.codigo_barras<>'' then E'\nCódigo de barras: '||new.codigo_barras else '' end||
      E'\nVencimento: '||to_char(new.data_vencimento,'DD/MM/YYYY')||
      E'\nCadastrado por: '||new.funcionario_nome||
      case when new.dias_antecedencia>0 then E'\nAlerta: '||new.dias_antecedencia||' dia(s) antes, às '||to_char(new.horario_alerta,'HH24:MI') else '' end,
      new.funcionario_id,new.funcionario_nome,now(),now()
    ) on conflict(chave_unica) do nothing;
  end if;
  return new;
end $$;

drop trigger if exists trg_telegram_produto_cadastrado on public.produtos_vencimento;
create trigger trg_telegram_produto_cadastrado after insert on public.produtos_vencimento
for each row execute function public.telegram_produto_cadastrado();

create or replace function public.telegram_enfileirar_alertas_programados()
returns integer language plpgsql security definer set search_path=public as $$
declare
  v_agora timestamp := clock_timestamp() at time zone 'America/Sao_Paulo';
  v_hoje date := (clock_timestamp() at time zone 'America/Sao_Paulo')::date;
  v_hora time := (clock_timestamp() at time zone 'America/Sao_Paulo')::time;
  v_total integer := 0; v_linhas integer := 0;
begin
  -- Contas de amanha, agrupadas por loja e fornecedor, a partir das 08:00.
  if v_hora >= time '08:00' then
    insert into public.telegram_alertas(chave_unica,tipo,empresa_id,loja_id,descricao,
      funcionario_nome,horario_previsto)
    select 'financeiro:amanha:'||v_hoje::text||':'||c.loja_id::text||':'||c.fornecedor_id::text,
      'financeiro_vencimento',c.empresa_id,c.loja_id,
      E'🟡 CONTAS QUE VENCEM AMANHÃ\nFornecedor: '||f.nome||
      E'\nValor total: R$ '||replace(to_char(sum(c.valor_compra),'FM999G999G990D00'),'.',',')||
      E'\nConta(s): '||string_agg(distinct coalesce(cf.nome,'Não informada'),', ')||
      E'\nCategoria(s): '||string_agg(distinct coalesce(cat.nome,'Sem categoria'),', ')||
      E'\nVencimento: '||to_char(v_hoje+1,'DD/MM/YYYY'),
      'Financeiro',((v_hoje+1)::text||' 08:00')::timestamp at time zone 'America/Sao_Paulo'
    from public.contasapagar c
    join public.fornecedores f on f.id=c.fornecedor_id
    left join public.contas_financeiras cf on cf.id=c.conta_financeira_id
    left join public.categorias_compra cat on cat.id=c.categoria_id
    where c.data_vencimento=v_hoje+1 and c.data_pagamento is null and c.excluido_em is null
    group by c.empresa_id,c.loja_id,c.fornecedor_id,f.nome
    on conflict(chave_unica) do nothing;
    get diagnostics v_linhas=row_count; v_total:=v_total+v_linhas;

    -- Saldo de todas as contas ativas, uma mensagem por loja, diariamente.
    insert into public.telegram_alertas(chave_unica,tipo,empresa_id,loja_id,descricao,
      funcionario_nome,horario_previsto)
    select 'financeiro:saldo:'||v_hoje::text||':'||cf.loja_id::text,
      'financeiro_saldo',cf.empresa_id,cf.loja_id,
      E'🏦 SALDO DAS CONTAS — '||to_char(v_hoje,'DD/MM/YYYY')||E'\n'||
      string_agg('• '||cf.nome||': R$ '||replace(to_char(cf.saldo_atual,'FM999G999G990D00'),'.',','),E'\n' order by cf.nome)||
      E'\n\nSaldo total: R$ '||replace(to_char(sum(cf.saldo_atual),'FM999G999G990D00'),'.',','),
      'Financeiro',(v_hoje::text||' 08:00')::timestamp at time zone 'America/Sao_Paulo'
    from public.contas_financeiras cf where cf.ativo is true
    group by cf.empresa_id,cf.loja_id
    on conflict(chave_unica) do nothing;
    get diagnostics v_linhas=row_count; v_total:=v_total+v_linhas;
  end if;

  -- Contas de hoje: lembretes independentes às 08:00 e às 16:00.
  if v_hora >= time '08:00' then
    insert into public.telegram_alertas(chave_unica,tipo,empresa_id,loja_id,descricao,
      funcionario_nome,horario_previsto)
    select 'financeiro:hoje08:'||v_hoje::text||':'||c.loja_id::text||':'||c.fornecedor_id::text,
      'financeiro_vencimento',c.empresa_id,c.loja_id,
      E'🔴 CONTAS QUE VENCEM HOJE — 08:00\nFornecedor: '||f.nome||
      E'\nValor total: R$ '||replace(to_char(sum(c.valor_compra),'FM999G999G990D00'),'.',',')||
      E'\nConta(s): '||string_agg(distinct coalesce(cf.nome,'Não informada'),', ')||
      E'\nCategoria(s): '||string_agg(distinct coalesce(cat.nome,'Sem categoria'),', '),
      'Financeiro',(v_hoje::text||' 08:00')::timestamp at time zone 'America/Sao_Paulo'
    from public.contasapagar c join public.fornecedores f on f.id=c.fornecedor_id
    left join public.contas_financeiras cf on cf.id=c.conta_financeira_id
    left join public.categorias_compra cat on cat.id=c.categoria_id
    where c.data_vencimento=v_hoje and c.data_pagamento is null and c.excluido_em is null
    group by c.empresa_id,c.loja_id,c.fornecedor_id,f.nome on conflict(chave_unica) do nothing;
    get diagnostics v_linhas=row_count; v_total:=v_total+v_linhas;
  end if;
  if v_hora >= time '16:00' then
    insert into public.telegram_alertas(chave_unica,tipo,empresa_id,loja_id,descricao,
      funcionario_nome,horario_previsto)
    select 'financeiro:hoje16:'||v_hoje::text||':'||c.loja_id::text||':'||c.fornecedor_id::text,
      'financeiro_vencimento',c.empresa_id,c.loja_id,
      E'⏰ CONTAS QUE VENCEM HOJE — 16:00\nFornecedor: '||f.nome||
      E'\nValor ainda em aberto: R$ '||replace(to_char(sum(c.valor_compra),'FM999G999G990D00'),'.',',')||
      E'\nConta(s): '||string_agg(distinct coalesce(cf.nome,'Não informada'),', ')||
      E'\nCategoria(s): '||string_agg(distinct coalesce(cat.nome,'Sem categoria'),', '),
      'Financeiro',(v_hoje::text||' 16:00')::timestamp at time zone 'America/Sao_Paulo'
    from public.contasapagar c join public.fornecedores f on f.id=c.fornecedor_id
    left join public.contas_financeiras cf on cf.id=c.conta_financeira_id
    left join public.categorias_compra cat on cat.id=c.categoria_id
    where c.data_vencimento=v_hoje and c.data_pagamento is null and c.excluido_em is null
    group by c.empresa_id,c.loja_id,c.fornecedor_id,f.nome on conflict(chave_unica) do nothing;
    get diagnostics v_linhas=row_count; v_total:=v_total+v_linhas;
  end if;

  -- Produtos: antecedencia individual e aviso opcional no vencimento.
  insert into public.telegram_alertas(chave_unica,tipo,empresa_id,loja_id,descricao,
    funcionario_id,funcionario_nome,horario_previsto)
  select 'produto:antecedencia:'||p.id::text,'produto_vencimento',p.empresa_id,p.loja_id,
    E'⚠️ PRODUTO PRÓXIMO AO VENCIMENTO\nProduto: '||p.nome_produto||
    case when p.codigo_barras<>'' then E'\nCódigo de barras: '||p.codigo_barras else '' end||
    E'\nVence em: '||to_char(p.data_vencimento,'DD/MM/YYYY')||
    E'\nFaltam: '||p.dias_antecedencia||' dia(s)',p.funcionario_id,p.funcionario_nome,
    (p.data_vencimento-p.dias_antecedencia+p.horario_alerta) at time zone 'America/Sao_Paulo'
  from public.produtos_vencimento p
  where p.ativo and p.alertar_telegram and p.dias_antecedencia>0
    and v_hoje>=p.data_vencimento-p.dias_antecedencia and v_hora>=p.horario_alerta
  on conflict(chave_unica) do nothing;
  get diagnostics v_linhas=row_count; v_total:=v_total+v_linhas;

  insert into public.telegram_alertas(chave_unica,tipo,empresa_id,loja_id,descricao,
    funcionario_id,funcionario_nome,horario_previsto)
  select 'produto:vencimento:'||p.id::text,'produto_vencimento',p.empresa_id,p.loja_id,
    E'🚨 PRODUTO VENCE HOJE\nProduto: '||p.nome_produto||
    case when p.codigo_barras<>'' then E'\nCódigo de barras: '||p.codigo_barras else '' end||
    E'\nVencimento: '||to_char(p.data_vencimento,'DD/MM/YYYY'),p.funcionario_id,p.funcionario_nome,
    (p.data_vencimento+p.horario_alerta) at time zone 'America/Sao_Paulo'
  from public.produtos_vencimento p
  where p.ativo and p.alertar_telegram and p.avisar_no_vencimento
    and v_hoje>=p.data_vencimento and v_hora>=p.horario_alerta
  on conflict(chave_unica) do nothing;
  get diagnostics v_linhas=row_count; v_total:=v_total+v_linhas;
  return v_total;
end $$;

revoke all on function public.telegram_enfileirar_alertas_programados() from public;
grant execute on function public.telegram_enfileirar_alertas_programados() to service_role;
notify pgrst,'reload schema';
