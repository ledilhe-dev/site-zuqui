alter table public.contasapagar
  add column if not exists titulo_origem_id uuid references public.contasapagar(id) on delete set null,
  add column if not exists baixa_parcial_grupo_id uuid,
  add column if not exists eh_baixa_parcial boolean not null default false;

create index if not exists contasapagar_titulo_origem_idx
  on public.contasapagar(titulo_origem_id);
create index if not exists contasapagar_baixa_parcial_grupo_idx
  on public.contasapagar(baixa_parcial_grupo_id);

create or replace function public.baixar_conta_parcial(
  p_conta_apagar_id uuid,
  p_valor_pago numeric,
  p_forma_pagamento_id uuid,
  p_forma_pagamento text,
  p_conta_financeira_id uuid,
  p_movimentar_saldo boolean default true,
  p_data_pagamento date default current_date
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_titulo public.contasapagar%rowtype;
  v_pagamento_id uuid := gen_random_uuid();
  v_grupo_id uuid;
  v_saldo numeric(14,2);
  v_saldo_conta numeric;
  v_agora timestamptz := now();
  v_momento text;
  v_obs_original text;
  v_obs_pagamento text;
begin
  select * into v_titulo
    from public.contasapagar
   where id = p_conta_apagar_id and excluido_em is null
   for update;

  if not found then raise exception 'Titulo nao encontrado ou sem permissao de acesso.'; end if;
  if v_titulo.pago_confirmado_em is not null then raise exception 'Este titulo ja esta pago.'; end if;
  if p_valor_pago is null or p_valor_pago <= 0 then raise exception 'Informe um valor pago maior que zero.'; end if;
  if p_valor_pago >= v_titulo.valor_compra then raise exception 'A baixa parcial deve ser menor que o saldo atual.'; end if;
  if p_forma_pagamento_id is null then raise exception 'Informe a forma de pagamento.'; end if;
  if p_conta_financeira_id is null then raise exception 'Informe a conta financeira.'; end if;

  v_saldo := round(v_titulo.valor_compra - p_valor_pago, 2);
  v_grupo_id := coalesce(v_titulo.baixa_parcial_grupo_id, gen_random_uuid());
  v_momento := to_char(timezone('America/Sao_Paulo', v_agora), 'DD/MM/YYYY HH24:MI');
  v_obs_original := trim(concat_ws(E'\n', nullif(v_titulo.observacao, ''),
    format('[PAGAMENTO PARCIAL] %s - pago R$ %s - saldo pendente R$ %s - baixa %s',
      v_momento, to_char(p_valor_pago, 'FM999G999G990D00'), to_char(v_saldo, 'FM999G999G990D00'), v_pagamento_id)));
  v_obs_pagamento := format('[BAIXA PARCIAL] Titulo original %s - vencimento original %s - pago R$ %s em %s - saldo residual R$ %s',
    v_titulo.id, to_char(v_titulo.data_vencimento, 'DD/MM/YYYY'),
    to_char(p_valor_pago, 'FM999G999G990D00'), v_momento, to_char(v_saldo, 'FM999G999G990D00'));
  if not p_movimentar_saldo then v_obs_pagamento := v_obs_pagamento || ' [BAIXA SEM MOVIMENTACAO DE SALDO]'; end if;

  update public.contasapagar
     set valor_compra = v_saldo,
         baixa_parcial_grupo_id = v_grupo_id,
         observacao = v_obs_original,
         updated_at = v_agora
   where id = v_titulo.id;

  insert into public.contasapagar(
    id, fornecedor_id, data_compra, data_vencimento, data_pagamento,
    valor_compra, valor_original, valor_pago, forma_pagamento, forma_pagamento_id,
    pago_confirmado_em, qtd_parcelas, intervalo_parcelas_dias, numero_parcela,
    grupo_parcelas_id, observacao, criado_por_id, criado_por_nome,
    conta_financeira_id, empresa_id, loja_id, categoria_id,
    titulo_origem_id, baixa_parcial_grupo_id, eh_baixa_parcial
  ) values (
    v_pagamento_id, v_titulo.fornecedor_id, v_titulo.data_compra, v_titulo.data_vencimento, p_data_pagamento,
    p_valor_pago, p_valor_pago, p_valor_pago, p_forma_pagamento, p_forma_pagamento_id,
    v_agora, v_titulo.qtd_parcelas, v_titulo.intervalo_parcelas_dias, v_titulo.numero_parcela,
    v_titulo.grupo_parcelas_id, v_obs_pagamento, v_titulo.criado_por_id, v_titulo.criado_por_nome,
    p_conta_financeira_id, v_titulo.empresa_id, v_titulo.loja_id, v_titulo.categoria_id,
    v_titulo.id, v_grupo_id, true
  );

  if p_movimentar_saldo then
    update public.contas_financeiras
       set saldo_atual = coalesce(saldo_atual, 0) - p_valor_pago,
           updated_at = v_agora
     where id = p_conta_financeira_id
       and empresa_id = v_titulo.empresa_id
       and loja_id = v_titulo.loja_id
     returning saldo_atual into v_saldo_conta;
    if not found then raise exception 'Conta financeira nao encontrada ou sem permissao de acesso.'; end if;

    insert into public.contas_financeiras_movimentacoes(
      conta_financeira_id, conta_apagar_id, tipo, valor, descricao,
      saldo_apos, empresa_id, loja_id
    ) values (
      p_conta_financeira_id, v_pagamento_id, 'saida', p_valor_pago,
      'Pagamento parcial de titulo para ' || coalesce(v_titulo.fornecedor_id::text, 'fornecedor'),
      v_saldo_conta, v_titulo.empresa_id, v_titulo.loja_id
    );
  end if;

  return jsonb_build_object(
    'titulo_original_id', v_titulo.id,
    'pagamento_id', v_pagamento_id,
    'grupo_id', v_grupo_id,
    'valor_original', v_titulo.valor_compra,
    'valor_pago', p_valor_pago,
    'saldo_residual', v_saldo,
    'data_vencimento', v_titulo.data_vencimento,
    'pago_em', v_agora
  );
end;
$$;

revoke all on function public.baixar_conta_parcial(uuid,numeric,uuid,text,uuid,boolean,date) from public;
grant execute on function public.baixar_conta_parcial(uuid,numeric,uuid,text,uuid,boolean,date) to authenticated;

