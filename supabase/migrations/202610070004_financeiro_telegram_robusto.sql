-- Financeiro no Telegram: ajustes imediatos, resumos 08h/16h e categoria obrigatoria.

alter table public.telegram_alertas drop constraint if exists telegram_alertas_tipo_check;
alter table public.telegram_alertas add constraint telegram_alertas_tipo_check check (tipo in (
  'tarefa_iniciada','tarefa_nao_iniciada','tarefa_finalizada','tarefa_nao_finalizada',
  'financeiro_vencimento','financeiro_saldo','financeiro_ajuste',
  'produto_cadastrado','produto_vencimento','agenda_cadastrada','agenda_dia'
));

-- Aproveita o historico do mesmo fornecedor para reparar compras antigas sem categoria.
with categoria_preferida as (
  select distinct on (c.loja_id,c.fornecedor_id)
    c.loja_id,c.fornecedor_id,c.categoria_id
  from public.contasapagar c
  where c.categoria_id is not null and c.excluido_em is null
  order by c.loja_id,c.fornecedor_id,c.created_at desc
)
update public.contasapagar c
set categoria_id=p.categoria_id, updated_at=now()
from categoria_preferida p
where c.loja_id=p.loja_id and c.fornecedor_id=p.fornecedor_id
  and c.categoria_id is null and c.excluido_em is null;

-- Em outubro/2026, dia 10 e sabado e dia 12 e feriado nacional. Para os
-- fornecedores configurados para vencer no dia 10, o proximo dia util e 13/10.
update public.contasapagar c
set data_vencimento=date '2026-10-13', updated_at=now()
from public.fornecedores f, public.lojas l
where f.id=c.fornecedor_id and l.id=c.loja_id
  and lower(l.nome) like '%patrick%'
  and f.dia_vencimento=10
  and c.data_pagamento is null and c.excluido_em is null
  and c.data_vencimento between date '2026-10-01' and date '2026-10-12';

-- Novos lancamentos e edicoes nunca podem ficar sem categoria, inclusive por API/IA.
create or replace function public.contasapagar_exigir_categoria()
returns trigger language plpgsql as $$
begin
  if new.categoria_id is null then
    raise exception 'Categoria de compra obrigatoria.' using errcode='23514';
  end if;
  return new;
end $$;
drop trigger if exists trg_contasapagar_exigir_categoria on public.contasapagar;
create trigger trg_contasapagar_exigir_categoria
before insert or update on public.contasapagar
for each row execute function public.contasapagar_exigir_categoria();

create or replace function public.telegram_ajuste_saldo_financeiro()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_conta_nome text; v_empresa uuid; v_loja uuid;
begin
  select nome,empresa_id,loja_id into v_conta_nome,v_empresa,v_loja
  from public.contas_financeiras where id=new.conta_financeira_id;
  insert into public.telegram_alertas(
    chave_unica,tipo,empresa_id,loja_id,descricao,funcionario_id,funcionario_nome,
    horario_previsto,horario_real
  ) values (
    'financeiro:ajuste:'||new.id::text,'financeiro_ajuste',
    coalesce(new.empresa_id,v_empresa),coalesce(new.loja_id,v_loja),
    E'💰 AJUSTE DE SALDO / COFRE\nConta: '||coalesce(v_conta_nome,'Nao informada')||
    E'\nOperacao: '||case when new.tipo='saida' then 'Saida' else 'Entrada' end||
    E'\nValor do ajuste: R$ '||replace(to_char(new.valor,'FM999G999G990D00'),'.',',')||
    E'\nSaldo anterior: R$ '||replace(to_char(new.saldo_anterior,'FM999G999G990D00'),'.',',')||
    E'\nNovo saldo: R$ '||replace(to_char(new.saldo_atual,'FM999G999G990D00'),'.',',')||
    E'\nResponsavel: '||coalesce(new.funcionario_nome,'Sistema')||
    case when nullif(trim(new.observacao),'') is not null then E'\nObservacao: '||trim(new.observacao) else '' end,
    new.funcionario_id,coalesce(new.funcionario_nome,'Sistema'),now(),now()
  ) on conflict(chave_unica) do nothing;

  perform net.http_post(
    url := 'https://tqfoxqbmslxoynrasltl.supabase.co/functions/v1/telegram-webhook',
    headers := jsonb_build_object('Content-Type','application/json'),
    body := jsonb_build_object('origem','cron')
  );
  return new;
end $$;
drop trigger if exists trg_telegram_ajuste_saldo_financeiro on public.contas_financeiras_ajustes_saldo;
create trigger trg_telegram_ajuste_saldo_financeiro
after insert on public.contas_financeiras_ajustes_saldo
for each row execute function public.telegram_ajuste_saldo_financeiro();

create or replace function public.telegram_enfileirar_resumo_financeiro()
returns integer language plpgsql security definer set search_path=public as $$
declare
  v_agora timestamp := clock_timestamp() at time zone 'America/Sao_Paulo';
  v_hoje date := v_agora::date;
  v_hora time := v_agora::time;
  v_slot text;
  v_total integer := 0;
begin
  if v_hora >= time '16:00' then v_slot := '16';
  elsif v_hora >= time '08:00' then v_slot := '08';
  else return 0;
  end if;

  insert into public.telegram_alertas(chave_unica,tipo,empresa_id,loja_id,descricao,funcionario_nome,horario_previsto)
  select 'financeiro:resumo:'||v_hoje||':'||v_slot||':'||l.id,
    'financeiro_saldo',l.empresa_id,l.id,
    case when v_slot='16' then '📊 RESUMO FINANCEIRO — 16:00' else '📊 RESUMO FINANCEIRO — 08:00' end||
    E'\nLoja: '||l.nome||E'\nData: '||to_char(v_hoje,'DD/MM/YYYY')||
    E'\n\nSALDOS\n'||coalesce(s.linhas,'Nenhuma conta financeira ativa.')||
    E'\nSaldo total: R$ '||replace(to_char(coalesce(s.total,0),'FM999G999G990D00'),'.',',')||
    E'\n\nCONTAS EM ABERTO'||
    E'\nVencem hoje: '||coalesce(p.qtd_hoje,0)||' — R$ '||replace(to_char(coalesce(p.valor_hoje,0),'FM999G999G990D00'),'.',',')||
    E'\nVencidas: '||coalesce(p.qtd_atrasada,0)||' — R$ '||replace(to_char(coalesce(p.valor_atrasado,0),'FM999G999G990D00'),'.',','),
    'Financeiro',(v_hoje::text||' '||v_slot||':00')::timestamp at time zone 'America/Sao_Paulo'
  from public.lojas l
  left join lateral (
    select string_agg('• '||cf.nome||': R$ '||replace(to_char(cf.saldo_atual,'FM999G999G990D00'),'.',','),E'\n' order by cf.nome) linhas,
      sum(cf.saldo_atual) total
    from public.contas_financeiras cf where cf.loja_id=l.id and cf.ativo
  ) s on true
  left join lateral (
    select count(*) filter(where c.data_vencimento=v_hoje) qtd_hoje,
      coalesce(sum(c.valor_compra) filter(where c.data_vencimento=v_hoje),0) valor_hoje,
      count(*) filter(where c.data_vencimento<v_hoje) qtd_atrasada,
      coalesce(sum(c.valor_compra) filter(where c.data_vencimento<v_hoje),0) valor_atrasado
    from public.contasapagar c
    where c.loja_id=l.id and c.data_pagamento is null and c.excluido_em is null
  ) p on true
  where l.ativo and lower(l.nome) like '%patrick%'
  on conflict(chave_unica) do nothing;
  get diagnostics v_total=row_count;
  return v_total;
end $$;
revoke all on function public.telegram_enfileirar_resumo_financeiro() from public;
grant execute on function public.telegram_enfileirar_resumo_financeiro() to service_role;

notify pgrst,'reload schema';
