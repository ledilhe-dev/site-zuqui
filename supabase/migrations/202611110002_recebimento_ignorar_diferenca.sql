alter table public.recebiveis_futuros
  add column if not exists valor_original_confirmacao numeric(14,2),
  add column if not exists valor_ignorado numeric(14,2) not null default 0;

alter table public.recebiveis
  add column if not exists valor_ignorado numeric(14,2) not null default 0;

create or replace function public.baixar_recebivel_ignorando_diferenca(
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
  v_recebivel_id uuid := gen_random_uuid();
  v_valor_recebido numeric(14,2);
  v_valor_ignorado numeric(14,2);
  v_confirmado_em timestamptz;
  v_momento text;
  v_observacao text;
begin
  v_valor_recebido := round(p_valor_recebido, 2);
  v_confirmado_em := ((coalesce(p_data_recebimento, current_date)::text || ' 12:00:00 America/Sao_Paulo')::timestamptz);

  select * into v_titulo
    from public.recebiveis_futuros
   where id = p_recebivel_futuro_id
     and ativo = true
     and excluido_em is null
   for update;

  if not found then raise exception 'Titulo a receber nao encontrado ou sem permissao de acesso.'; end if;
  if v_titulo.confirmado_em is not null then raise exception 'Este titulo ja foi recebido.'; end if;
  if v_valor_recebido is null or v_valor_recebido <= 0 then raise exception 'Informe um valor recebido maior que zero.'; end if;
  if v_valor_recebido >= v_titulo.valor then raise exception 'O valor recebido deve ser menor que o valor original para ignorar a diferenca.'; end if;
  if p_conta_financeira_id is null then raise exception 'Informe a conta financeira.'; end if;

  perform 1
    from public.contas_financeiras
   where id = p_conta_financeira_id
     and empresa_id = v_titulo.empresa_id
     and loja_id = v_titulo.loja_id;
  if not found then raise exception 'Conta financeira nao encontrada ou sem permissao de acesso.'; end if;

  v_valor_ignorado := round(v_titulo.valor - v_valor_recebido, 2);
  v_momento := to_char(timezone('America/Sao_Paulo', now()), 'DD/MM/YYYY HH24:MI');
  v_observacao := trim(concat_ws(E'\n', nullif(v_titulo.observacao, ''), nullif(p_observacao, ''),
    format('[DIFERENCA IGNORADA] %s - valor original R$ %s - recebido R$ %s - ignorado R$ %s%s',
      v_momento,
      to_char(v_titulo.valor, 'FM999G999G990D00'),
      to_char(v_valor_recebido, 'FM999G999G990D00'),
      to_char(v_valor_ignorado, 'FM999G999G990D00'),
      case when p_movimentar_saldo then '' else ' [BAIXA SEM MOVIMENTACAO DE SALDO]' end)));

  update public.recebiveis_futuros
     set confirmado_em = v_confirmado_em,
         confirmado_por_nome = coalesce(nullif(trim(p_confirmado_por_nome), ''), 'Usuario'),
         valor_confirmado = v_valor_recebido,
         conta_financeira_confirmada_id = p_conta_financeira_id,
         valor_original_confirmacao = v_titulo.valor,
         valor_ignorado = v_valor_ignorado,
         observacao = v_observacao
   where id = v_titulo.id;

  insert into public.recebiveis(
    id, pagador_id, forma_pagamento_id, valor, conta_financeira_id, empresa_id, loja_id,
    criado_por_id, criado_por_nome, qtd_parcelas, intervalo_dias, observacao, valor_original,
    valor_ignorado, recebivel_futuro_id, data_prevista_original, movimentar_saldo
  ) values (
    v_recebivel_id, v_titulo.pagador_id, v_titulo.forma_pagamento_id, v_valor_recebido,
    p_conta_financeira_id, v_titulo.empresa_id, v_titulo.loja_id, v_titulo.criado_por_id,
    coalesce(nullif(trim(p_confirmado_por_nome), ''), v_titulo.criado_por_nome), 1,
    v_titulo.intervalo_dias, v_observacao, v_titulo.valor, v_valor_ignorado, v_titulo.id,
    v_titulo.data_prevista, p_movimentar_saldo
  );

  update public.recebiveis_futuros
     set recebivel_id = v_recebivel_id
   where id = v_titulo.id;

  return jsonb_build_object(
    'titulo_id', v_titulo.id,
    'recebivel_id', v_recebivel_id,
    'valor_original', v_titulo.valor,
    'valor_recebido', v_valor_recebido,
    'valor_ignorado', v_valor_ignorado,
    'data_prevista', v_titulo.data_prevista,
    'recebido_em', v_confirmado_em
  );
end;
$$;

revoke all on function public.baixar_recebivel_ignorando_diferenca(uuid,numeric,uuid,boolean,date,text,text) from public;
grant execute on function public.baixar_recebivel_ignorando_diferenca(uuid,numeric,uuid,boolean,date,text,text) to authenticated;

notify pgrst, 'reload schema';
