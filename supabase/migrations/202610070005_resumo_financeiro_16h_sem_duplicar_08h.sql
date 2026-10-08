-- O fluxo existente ja envia saldo e contas as 08h. Este resumo complementa
-- somente as 16h, evitando duas mensagens de saldo pela manha.
create or replace function public.telegram_enfileirar_resumo_financeiro()
returns integer language plpgsql security definer set search_path=public as $$
declare
  v_agora timestamp := clock_timestamp() at time zone 'America/Sao_Paulo';
  v_hoje date := v_agora::date;
  v_hora time := v_agora::time;
  v_total integer := 0;
begin
  if v_hora < time '16:00' then return 0; end if;

  insert into public.telegram_alertas(chave_unica,tipo,empresa_id,loja_id,descricao,funcionario_nome,horario_previsto)
  select 'financeiro:resumo:'||v_hoje||':16:'||l.id,
    'financeiro_saldo',l.empresa_id,l.id,
    E'📊 RESUMO FINANCEIRO — 16:00\nLoja: '||l.nome||E'\nData: '||to_char(v_hoje,'DD/MM/YYYY')||
    E'\n\nSALDOS\n'||coalesce(s.linhas,'Nenhuma conta financeira ativa.')||
    E'\nSaldo total: R$ '||replace(to_char(coalesce(s.total,0),'FM999G999G990D00'),'.',',')||
    E'\n\nCONTAS EM ABERTO'||
    E'\nVencem hoje: '||coalesce(p.qtd_hoje,0)||' — R$ '||replace(to_char(coalesce(p.valor_hoje,0),'FM999G999G990D00'),'.',',')||
    E'\nVencidas: '||coalesce(p.qtd_atrasada,0)||' — R$ '||replace(to_char(coalesce(p.valor_atrasado,0),'FM999G999G990D00'),'.',','),
    'Financeiro',(v_hoje::text||' 16:00')::timestamp at time zone 'America/Sao_Paulo'
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
