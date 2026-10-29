alter table public.recebiveis_futuros
  add column if not exists titulo_origem_id uuid references public.recebiveis_futuros(id) on delete set null,
  add column if not exists baixa_parcial_grupo_id uuid,
  add column if not exists eh_baixa_parcial boolean not null default false;

alter table public.recebiveis
  add column if not exists baixa_parcial_grupo_id uuid,
  add column if not exists eh_baixa_parcial boolean not null default false;

create index if not exists recebiveis_futuros_titulo_origem_idx on public.recebiveis_futuros(titulo_origem_id);
create index if not exists recebiveis_futuros_baixa_parcial_grupo_idx on public.recebiveis_futuros(baixa_parcial_grupo_id);
create index if not exists recebiveis_baixa_parcial_grupo_idx on public.recebiveis(baixa_parcial_grupo_id);

create or replace function public.baixar_recebivel_parcial(
  p_recebivel_futuro_id uuid,
  p_valor_recebido numeric,
  p_conta_financeira_id uuid,
  p_movimentar_saldo boolean default true,
  p_data_recebimento date default current_date,
  p_confirmado_por_nome text default null,
  p_observacao text default null
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_titulo public.recebiveis_futuros%rowtype;
  v_parte_id uuid := gen_random_uuid();
  v_recebivel_id uuid := gen_random_uuid();
  v_grupo_id uuid;
  v_saldo numeric(14,2);
  v_agora timestamptz := now();
  v_confirmado_em timestamptz;
  v_momento text;
  v_obs_original text;
  v_obs_parte text;
begin
  v_confirmado_em := ((coalesce(p_data_recebimento,current_date)::text || ' 12:00:00 America/Sao_Paulo')::timestamptz);
  select * into v_titulo from public.recebiveis_futuros
   where id=p_recebivel_futuro_id and ativo=true and excluido_em is null
   for update;
  if not found then raise exception 'Titulo a receber nao encontrado ou sem permissao de acesso.'; end if;
  if v_titulo.confirmado_em is not null then raise exception 'Este titulo ja foi recebido.'; end if;
  if p_valor_recebido is null or p_valor_recebido<=0 then raise exception 'Informe um valor recebido maior que zero.'; end if;
  if p_valor_recebido>=v_titulo.valor then raise exception 'A baixa parcial deve ser menor que o saldo atual.'; end if;
  if p_conta_financeira_id is null then raise exception 'Informe a conta financeira.'; end if;

  perform 1 from public.contas_financeiras where id=p_conta_financeira_id
    and empresa_id=v_titulo.empresa_id and loja_id=v_titulo.loja_id;
  if not found then raise exception 'Conta financeira nao encontrada ou sem permissao de acesso.'; end if;

  v_saldo:=round(v_titulo.valor-p_valor_recebido,2);
  v_grupo_id:=coalesce(v_titulo.baixa_parcial_grupo_id,gen_random_uuid());
  v_momento:=to_char(timezone('America/Sao_Paulo',v_agora),'DD/MM/YYYY HH24:MI');
  v_obs_original:=trim(concat_ws(E'\n',nullif(v_titulo.observacao,''),
    format('[RECEBIMENTO PARCIAL] %s - recebido R$ %s - saldo pendente R$ %s - baixa %s',
      v_momento,to_char(p_valor_recebido,'FM999G999G990D00'),to_char(v_saldo,'FM999G999G990D00'),v_parte_id)));
  v_obs_parte:=trim(concat_ws(E'\n',nullif(p_observacao,''),
    format('[BAIXA PARCIAL] Titulo original %s - previsao original %s - recebido R$ %s em %s - saldo residual R$ %s%s',
      v_titulo.id,to_char(v_titulo.data_prevista,'DD/MM/YYYY'),to_char(p_valor_recebido,'FM999G999G990D00'),v_momento,
      to_char(v_saldo,'FM999G999G990D00'),case when p_movimentar_saldo then '' else ' [BAIXA SEM MOVIMENTACAO DE SALDO]' end)));

  update public.recebiveis_futuros set valor=v_saldo,baixa_parcial_grupo_id=v_grupo_id,observacao=v_obs_original
   where id=v_titulo.id;

  insert into public.recebiveis_futuros(
    id,empresa_id,loja_id,pagador_id,forma_pagamento_id,conta_financeira_id,valor,data_prevista,
    observacao,recorrente,recorrencia_dias,confirmado_em,confirmado_por_nome,valor_confirmado,
    conta_financeira_confirmada_id,criado_por_nome,criado_por_id,ativo,intervalo_dias,qtd_recorrencias,
    numero_recorrencia,sequencial_dias_corridos,titulo_origem_id,baixa_parcial_grupo_id,eh_baixa_parcial
  ) values (
    v_parte_id,v_titulo.empresa_id,v_titulo.loja_id,v_titulo.pagador_id,v_titulo.forma_pagamento_id,
    v_titulo.conta_financeira_id,p_valor_recebido,v_titulo.data_prevista,v_obs_parte,false,null,v_confirmado_em,
    coalesce(nullif(trim(p_confirmado_por_nome),''),'Usuario'),p_valor_recebido,p_conta_financeira_id,
    v_titulo.criado_por_nome,v_titulo.criado_por_id,true,v_titulo.intervalo_dias,1,1,
    v_titulo.sequencial_dias_corridos,v_titulo.id,v_grupo_id,true
  );

  insert into public.recebiveis(
    id,pagador_id,forma_pagamento_id,valor,conta_financeira_id,empresa_id,loja_id,criado_por_id,
    criado_por_nome,qtd_parcelas,intervalo_dias,observacao,valor_original,recebivel_futuro_id,
    data_prevista_original,movimentar_saldo,baixa_parcial_grupo_id,eh_baixa_parcial
  ) values (
    v_recebivel_id,v_titulo.pagador_id,v_titulo.forma_pagamento_id,p_valor_recebido,p_conta_financeira_id,
    v_titulo.empresa_id,v_titulo.loja_id,v_titulo.criado_por_id,coalesce(nullif(trim(p_confirmado_por_nome),''),v_titulo.criado_por_nome),
    1,v_titulo.intervalo_dias,v_obs_parte,p_valor_recebido,v_parte_id,v_titulo.data_prevista,
    p_movimentar_saldo,v_grupo_id,true
  );

  update public.recebiveis_futuros set recebivel_id=v_recebivel_id where id=v_parte_id;

  return jsonb_build_object('titulo_original_id',v_titulo.id,'parte_recebida_id',v_parte_id,
    'recebivel_id',v_recebivel_id,'grupo_id',v_grupo_id,'valor_original',v_titulo.valor,
    'valor_recebido',p_valor_recebido,'saldo_residual',v_saldo,'data_prevista',v_titulo.data_prevista,'recebido_em',v_agora);
end;
$$;

revoke all on function public.baixar_recebivel_parcial(uuid,numeric,uuid,boolean,date,text,text) from public;
grant execute on function public.baixar_recebivel_parcial(uuid,numeric,uuid,boolean,date,text,text) to authenticated;
