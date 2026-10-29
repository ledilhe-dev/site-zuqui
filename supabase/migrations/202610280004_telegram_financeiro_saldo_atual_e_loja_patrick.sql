-- Reforça o escopo financeiro da loja PATRICK. O webhook também recalcula o
-- saldo imediatamente antes do envio, evitando snapshots antigos na fila.
create or replace function public.telegram_enfileirar_resumo_financeiro()
returns integer language plpgsql security definer set search_path=public as $$
declare
  v_agora timestamp := clock_timestamp() at time zone 'America/Sao_Paulo';
  v_hoje date := v_agora::date;
  v_inicio_mes date := date_trunc('month',v_agora)::date;
  v_inicio_proximo_mes date := (date_trunc('month',v_agora)+interval '1 month')::date;
  v_slot text;
  v_total integer := 0;
  v_linhas integer := 0;
begin
  if v_agora::time >= time '16:00' then v_slot:='16';
  elsif v_agora::time >= time '08:00' then v_slot:='08';
  else return 0;
  end if;

  insert into public.telegram_alertas(chave_unica,tipo,empresa_id,loja_id,descricao,funcionario_nome,horario_previsto)
  select 'financeiro:saldos:v8:'||v_hoje||':'||v_slot||':'||l.id,'financeiro_saldo',l.empresa_id,l.id,
    '💰 SALDO EM CONTAS - '||v_slot||':00'||chr(10)||chr(10)||coalesce(s.linhas,'Nenhuma conta financeira ativa.')||
    chr(10)||chr(10)||'Total no cofre = R$ '||public.telegram_formatar_brl(coalesce(s.total,0)),
    'Financeiro',(v_hoje::text||' '||v_slot||':00')::timestamp at time zone 'America/Sao_Paulo'
  from public.lojas l
  left join lateral (
    select string_agg(cf.nome||' - R$ '||public.telegram_formatar_brl(cf.saldo_atual),E'\n----------------------\n' order by cf.nome) linhas,
      sum(cf.saldo_atual) total
    from public.contas_financeiras cf where cf.loja_id=l.id and cf.ativo
  ) s on true
  where l.ativo and lower(trim(l.nome))='patrick'
  on conflict(chave_unica) do update set descricao=excluded.descricao;
  get diagnostics v_linhas=row_count; v_total:=v_total+v_linhas;

  insert into public.telegram_alertas(chave_unica,tipo,empresa_id,loja_id,descricao,funcionario_nome,horario_previsto)
  select 'financeiro:abertas:v11:'||v_hoje||':'||v_slot||':'||l.id,'financeiro_vencimento',l.empresa_id,l.id,
    '💰 CONTAS EM ABERTO 🔴'||chr(10)||'Período: '||to_char(v_inicio_mes,'DD/MM/YYYY')||' a '||to_char(v_inicio_proximo_mes-1,'DD/MM/YYYY')||
    chr(10)||chr(10)||p.linhas||chr(10)||'------------------------------'||chr(10)||'🔴 FALTA PAGAR: R$ '||public.telegram_formatar_brl(p.valor),
    'Financeiro',(v_hoje::text||' '||v_slot||':00')::timestamp at time zone 'America/Sao_Paulo'
  from public.lojas l
  join lateral (
    select sum(x.quantidade) quantidade,sum(x.valor) valor,
      string_agg(x.fornecedor||chr(10)||'Vencimento: '||to_char(x.proximo_vencimento,'DD/MM/YYYY')||chr(10)||'Valor: R$ '||public.telegram_formatar_brl(x.valor),E'\n------------------------------\n' order by x.proximo_vencimento,x.fornecedor) linhas
    from (
      select coalesce(nullif(trim(f.nome),''),'Fornecedor não informado') fornecedor,min(c.data_vencimento) proximo_vencimento,
        count(*) quantidade,sum(greatest(coalesce(c.valor_compra,0)-coalesce(c.valor_pago,0),0)) valor
      from public.contasapagar c left join public.fornecedores f on f.id=c.fornecedor_id
      where c.loja_id=l.id and c.data_pagamento is null and c.excluido_em is null
        and c.data_vencimento>=v_inicio_mes and c.data_vencimento<v_inicio_proximo_mes
        and greatest(coalesce(c.valor_compra,0)-coalesce(c.valor_pago,0),0)>0
      group by c.fornecedor_id,coalesce(nullif(trim(f.nome),''),'Fornecedor não informado')
    ) x
  ) p on p.quantidade>0
  where l.ativo and lower(trim(l.nome))='patrick'
  on conflict(chave_unica) do update set descricao=excluded.descricao;
  get diagnostics v_linhas=row_count; v_total:=v_total+v_linhas;
  return v_total;
end $$;

revoke all on function public.telegram_enfileirar_resumo_financeiro() from public;
grant execute on function public.telegram_enfileirar_resumo_financeiro() to service_role;
notify pgrst,'reload schema';
