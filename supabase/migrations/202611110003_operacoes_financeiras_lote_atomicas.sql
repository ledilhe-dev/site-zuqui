create index if not exists contasapagar_loja_cadastro_idx
  on public.contasapagar (loja_id, created_at, id)
  where excluido_em is null;

-- Títulos legados podem não ter categoria. A regra continua obrigatória para
-- novos lançamentos e edições, mas não pode impedir sua baixa ou exclusão.
create or replace function public.contasapagar_exigir_categoria()
returns trigger
language plpgsql
as $$
begin
  if new.categoria_id is not null then return new; end if;
  if tg_op = 'UPDATE' and old.categoria_id is null and (
    (old.excluido_em is null and new.excluido_em is not null)
    or (old.pago_confirmado_em is null and new.pago_confirmado_em is not null)
  ) then
    return new;
  end if;
  raise exception 'Categoria de compra obrigatoria.' using errcode = '23514';
end;
$$;

create or replace function public.excluir_contas_pagar_lote(
  p_ids uuid[],
  p_excluido_em timestamptz,
  p_excluido_por_id uuid,
  p_excluido_por_nome text
) returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_esperado integer;
  v_disponivel integer;
  v_afetado integer;
begin
  v_esperado := coalesce(array_length(array(select distinct unnest(p_ids)), 1), 0);
  if v_esperado = 0 then raise exception 'Selecione ao menos uma conta para excluir.'; end if;
  if v_esperado > 500 then raise exception 'Selecione no maximo 500 contas por operacao.'; end if;

  select count(*) into v_disponivel
    from public.contasapagar
   where id = any(p_ids) and excluido_em is null;
  if v_disponivel <> v_esperado then
    raise exception 'Uma ou mais contas ja foram alteradas. Atualize a lista e tente novamente.';
  end if;

  update public.contasapagar
     set excluido_em = coalesce(p_excluido_em, now()),
         excluido_por_id = p_excluido_por_id,
         excluido_por_nome = coalesce(nullif(trim(p_excluido_por_nome), ''), 'Usuario')
   where id = any(p_ids) and excluido_em is null;
  get diagnostics v_afetado = row_count;
  if v_afetado <> v_esperado then raise exception 'A exclusao nao foi concluida integralmente.'; end if;
  return v_afetado;
end;
$$;

create or replace function public.excluir_recebiveis_futuros_lote(p_ids uuid[])
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_esperado integer;
  v_disponivel integer;
  v_afetado integer;
begin
  v_esperado := coalesce(array_length(array(select distinct unnest(p_ids)), 1), 0);
  if v_esperado = 0 then raise exception 'Selecione ao menos um recebimento para excluir.'; end if;
  if v_esperado > 500 then raise exception 'Selecione no maximo 500 recebimentos por operacao.'; end if;

  select count(*) into v_disponivel
    from public.recebiveis_futuros
   where id = any(p_ids) and excluido_em is null;
  if v_disponivel <> v_esperado then
    raise exception 'Um ou mais recebimentos ja foram alterados. Atualize a lista e tente novamente.';
  end if;

  delete from public.recebiveis_futuros where id = any(p_ids) and excluido_em is null;
  get diagnostics v_afetado = row_count;
  if v_afetado <> v_esperado then raise exception 'A exclusao nao foi concluida integralmente.'; end if;
  return v_afetado;
end;
$$;

create or replace function public.baixar_recebiveis_lote(
  p_ids uuid[],
  p_conta_financeira_id uuid,
  p_movimentar_saldo boolean default true,
  p_confirmado_por_id uuid default null,
  p_confirmado_por_nome text default null
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_esperado integer;
  v_disponivel integer;
  v_inseridos integer;
  v_total numeric(14,2);
  v_confirmado_em timestamptz := now();
begin
  v_esperado := coalesce(array_length(array(select distinct unnest(p_ids)), 1), 0);
  if v_esperado = 0 then raise exception 'Selecione ao menos um recebimento.'; end if;
  if v_esperado > 500 then raise exception 'Selecione no maximo 500 recebimentos por operacao.'; end if;
  if p_conta_financeira_id is null then raise exception 'Selecione a conta financeira.'; end if;

  perform 1 from public.contas_financeiras where id = p_conta_financeira_id and ativo is true;
  if not found then raise exception 'Conta financeira nao encontrada ou sem permissao.'; end if;

  select count(*), coalesce(sum(r.valor), 0)
    into v_disponivel, v_total
    from public.recebiveis_futuros r
    join public.contas_financeiras c
      on c.id = p_conta_financeira_id
     and c.empresa_id = r.empresa_id
     and c.loja_id = r.loja_id
   where r.id = any(p_ids)
     and r.ativo is true
     and r.excluido_em is null
     and r.confirmado_em is null
     and r.valor > 0;
  if v_disponivel <> v_esperado then
    raise exception 'Um ou mais recebimentos ja foram alterados ou nao pertencem a conta selecionada.';
  end if;

  insert into public.recebiveis(
    pagador_id, forma_pagamento_id, conta_financeira_id, valor, empresa_id, loja_id,
    criado_por_id, criado_por_nome, recebivel_futuro_id, data_prevista_original,
    valor_original, movimentar_saldo
  )
  select r.pagador_id, r.forma_pagamento_id, p_conta_financeira_id, r.valor,
         r.empresa_id, r.loja_id, p_confirmado_por_id,
         coalesce(nullif(trim(p_confirmado_por_nome), ''), 'Usuario'), r.id,
         r.data_prevista, r.valor, p_movimentar_saldo
    from public.recebiveis_futuros r
   where r.id = any(p_ids)
     and r.ativo is true
     and r.excluido_em is null
     and r.confirmado_em is null;
  get diagnostics v_inseridos = row_count;
  if v_inseridos <> v_esperado then raise exception 'A baixa nao foi concluida integralmente.'; end if;

  update public.recebiveis_futuros r
     set confirmado_em = v_confirmado_em,
         confirmado_por_nome = coalesce(nullif(trim(p_confirmado_por_nome), ''), 'Usuario'),
         valor_confirmado = r.valor,
         conta_financeira_confirmada_id = p_conta_financeira_id,
         recebivel_id = recebido.id
    from public.recebiveis recebido
   where r.id = any(p_ids)
     and recebido.recebivel_futuro_id = r.id
     and r.confirmado_em is null;

  return jsonb_build_object('quantidade', v_inseridos, 'total', v_total, 'confirmado_em', v_confirmado_em);
end;
$$;

revoke all on function public.excluir_contas_pagar_lote(uuid[],timestamptz,uuid,text) from public;
revoke all on function public.excluir_recebiveis_futuros_lote(uuid[]) from public;
revoke all on function public.baixar_recebiveis_lote(uuid[],uuid,boolean,uuid,text) from public;
grant execute on function public.excluir_contas_pagar_lote(uuid[],timestamptz,uuid,text) to anon, authenticated;
grant execute on function public.excluir_recebiveis_futuros_lote(uuid[]) to anon, authenticated;
grant execute on function public.baixar_recebiveis_lote(uuid[],uuid,boolean,uuid,text) to anon, authenticated;

notify pgrst, 'reload schema';
