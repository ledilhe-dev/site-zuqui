create or replace function public.baixar_contas_lote(
  p_itens jsonb,
  p_forma_pagamento_id uuid,
  p_forma_pagamento text,
  p_movimentar_saldo boolean default true,
  p_data_pagamento date default current_date
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_item jsonb;
  v_parte jsonb;
  v_titulo public.contasapagar%rowtype;
  v_conta_id uuid;
  v_conta_principal_id uuid;
  v_valor numeric(14,2);
  v_valor_parte numeric(14,2);
  v_total_partes numeric(14,2);
  v_saldo_apos numeric(14,2);
  v_processados integer := 0;
  v_agora timestamptz := now();
begin
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'Informe ao menos um titulo para baixar.';
  end if;
  if p_forma_pagamento_id is null then raise exception 'Informe a forma de pagamento.'; end if;

  for v_item in select value from jsonb_array_elements(p_itens) loop
    select * into v_titulo
      from public.contasapagar
     where id = (v_item->>'id')::uuid
       and excluido_em is null
     for update;
    if not found then raise exception 'Titulo nao encontrado ou sem permissao de acesso.'; end if;
    if v_titulo.pago_confirmado_em is not null then raise exception 'O titulo % ja esta pago.', v_titulo.id; end if;

    v_valor := round((v_item->>'valor_pago')::numeric, 2);
    v_conta_principal_id := (v_item->>'conta_principal_id')::uuid;
    if v_valor <= 0 then raise exception 'O valor pago deve ser maior que zero.'; end if;
    if v_conta_principal_id is null then raise exception 'Informe a conta financeira principal.'; end if;

    v_total_partes := 0;
    for v_parte in select value from jsonb_array_elements(coalesce(v_item->'partes', '[]'::jsonb)) loop
      v_total_partes := v_total_partes + round((v_parte->>'valor')::numeric, 2);
    end loop;
    if abs(v_total_partes - v_valor) > 0.004 then
      raise exception 'A divisao entre contas nao confere com o valor do titulo %.', v_titulo.id;
    end if;

    update public.contasapagar
       set data_pagamento = coalesce(p_data_pagamento, current_date),
           valor_pago = v_valor,
           forma_pagamento_id = p_forma_pagamento_id,
           forma_pagamento = p_forma_pagamento,
           conta_financeira_id = v_conta_principal_id,
           observacao = nullif(v_item->>'observacao', ''),
           pago_confirmado_em = v_agora,
           updated_at = v_agora
     where id = v_titulo.id;

    if p_movimentar_saldo then
      for v_parte in select value from jsonb_array_elements(v_item->'partes') loop
        v_conta_id := (v_parte->>'conta_id')::uuid;
        v_valor_parte := round((v_parte->>'valor')::numeric, 2);
        if v_valor_parte <= 0 then continue; end if;
        update public.contas_financeiras
           set saldo_atual = coalesce(saldo_atual, 0) - v_valor_parte,
               updated_at = v_agora
         where id = v_conta_id
           and empresa_id = v_titulo.empresa_id
           and loja_id = v_titulo.loja_id
         returning saldo_atual into v_saldo_apos;
        if not found then raise exception 'Conta financeira nao encontrada ou sem permissao de acesso.'; end if;

        insert into public.contas_financeiras_movimentacoes(
          conta_financeira_id, conta_apagar_id, tipo, valor, descricao,
          saldo_apos, empresa_id, loja_id
        ) values (
          v_conta_id, v_titulo.id, 'saida', v_valor_parte,
          coalesce(nullif(v_parte->>'descricao', ''), 'Pagamento de titulo'),
          v_saldo_apos, v_titulo.empresa_id, v_titulo.loja_id
        );
      end loop;
    end if;
    v_processados := v_processados + 1;
  end loop;

  return jsonb_build_object('ok', true, 'processados', v_processados, 'pago_em', v_agora);
end;
$$;

revoke all on function public.baixar_contas_lote(jsonb,uuid,text,boolean,date) from public;
grant execute on function public.baixar_contas_lote(jsonb,uuid,text,boolean,date) to anon, authenticated;

create index if not exists contasapagar_loja_status_vencimento_idx
  on public.contasapagar(loja_id, pago_confirmado_em, data_vencimento, id)
  where excluido_em is null;

notify pgrst, 'reload schema';
