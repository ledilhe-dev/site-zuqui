alter table if exists public.recebiveis
  add column if not exists movimentar_saldo boolean not null default true;

create or replace function public.recebiveis_saldo_conta_financeira_trg_fn()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_saldo numeric; v_empresa_id uuid; v_loja_id uuid; v_pagador text; v_forma text; v_descricao text;
begin
  if tg_op = 'INSERT' then
    if not coalesce(new.movimentar_saldo, true) or new.conta_financeira_id is null or coalesce(new.valor, 0) <= 0 then return new; end if;
    select nome into v_pagador from public.fornecedores where id = new.pagador_id;
    select nome into v_forma from public.formas_pagamento where id = new.forma_pagamento_id;
    v_descricao := 'Recebivel de ' || coalesce(nullif(trim(v_pagador), ''), 'pagador') || ' via ' || coalesce(nullif(trim(v_forma), ''), 'forma de pagamento');
    update public.contas_financeiras set saldo_atual=coalesce(saldo_atual,0)+new.valor where id=new.conta_financeira_id returning saldo_atual,empresa_id,loja_id into v_saldo,v_empresa_id,v_loja_id;
    if not found then raise exception 'Conta financeira nao encontrada: %',new.conta_financeira_id; end if;
    insert into public.contas_financeiras_movimentacoes(conta_financeira_id,recebivel_id,tipo,valor,descricao,saldo_apos,empresa_id,loja_id) values(new.conta_financeira_id,new.id,'entrada',new.valor,v_descricao,v_saldo,coalesce(new.empresa_id,v_empresa_id),coalesce(new.loja_id,v_loja_id));
    return new;
  end if;
  if tg_op = 'DELETE' then
    if not coalesce(old.movimentar_saldo, true) or old.conta_financeira_id is null or coalesce(old.valor,0)<=0 then return old; end if;
    update public.contas_financeiras set saldo_atual=coalesce(saldo_atual,0)-old.valor where id=old.conta_financeira_id returning saldo_atual,empresa_id,loja_id into v_saldo,v_empresa_id,v_loja_id;
    if not found then raise exception 'Conta financeira nao encontrada: %',old.conta_financeira_id; end if;
    insert into public.contas_financeiras_movimentacoes(conta_financeira_id,recebivel_id,tipo,valor,descricao,saldo_apos,empresa_id,loja_id) values(old.conta_financeira_id,old.id,'estorno',old.valor,'Estorno por exclusao de recebivel',v_saldo,coalesce(old.empresa_id,v_empresa_id),coalesce(old.loja_id,v_loja_id));
    return old;
  end if;
  if tg_op = 'UPDATE' then
    if not coalesce(old.movimentar_saldo,true) and not coalesce(new.movimentar_saldo,true) then return new; end if;
    if old.conta_financeira_id is distinct from new.conta_financeira_id or coalesce(old.valor,0) is distinct from coalesce(new.valor,0) or old.movimentar_saldo is distinct from new.movimentar_saldo then
      if coalesce(old.movimentar_saldo,true) and old.conta_financeira_id is not null and coalesce(old.valor,0)>0 then
        update public.contas_financeiras set saldo_atual=coalesce(saldo_atual,0)-old.valor where id=old.conta_financeira_id returning saldo_atual,empresa_id,loja_id into v_saldo,v_empresa_id,v_loja_id;
        insert into public.contas_financeiras_movimentacoes(conta_financeira_id,recebivel_id,tipo,valor,descricao,saldo_apos,empresa_id,loja_id) values(old.conta_financeira_id,old.id,'estorno',old.valor,'Estorno por edicao de recebivel',v_saldo,coalesce(old.empresa_id,v_empresa_id),coalesce(old.loja_id,v_loja_id));
      end if;
      if coalesce(new.movimentar_saldo,true) and new.conta_financeira_id is not null and coalesce(new.valor,0)>0 then
        select nome into v_pagador from public.fornecedores where id=new.pagador_id; select nome into v_forma from public.formas_pagamento where id=new.forma_pagamento_id;
        v_descricao := 'Recebivel de '||coalesce(nullif(trim(v_pagador),''),'pagador')||' via '||coalesce(nullif(trim(v_forma),''),'forma de pagamento');
        update public.contas_financeiras set saldo_atual=coalesce(saldo_atual,0)+new.valor where id=new.conta_financeira_id returning saldo_atual,empresa_id,loja_id into v_saldo,v_empresa_id,v_loja_id;
        insert into public.contas_financeiras_movimentacoes(conta_financeira_id,recebivel_id,tipo,valor,descricao,saldo_apos,empresa_id,loja_id) values(new.conta_financeira_id,new.id,'entrada',new.valor,v_descricao,v_saldo,coalesce(new.empresa_id,v_empresa_id),coalesce(new.loja_id,v_loja_id));
      end if;
    end if;
    return new;
  end if;
  return coalesce(new,old);
end;
$$;
