do $$
begin
  if exists (
    select 1 from public.contasapagar c join public.lojas l on l.id=c.loja_id
    where lower(l.nome) like '%patrick%' and c.excluido_em is null and c.categoria_id is null
  ) then
    raise exception 'Ainda existem compras ativas sem categoria na loja Patrick.';
  end if;

  if exists (
    select 1 from public.contasapagar c
    join public.fornecedores f on f.id=c.fornecedor_id
    join public.lojas l on l.id=c.loja_id
    where lower(l.nome) like '%patrick%' and f.dia_vencimento=10
      and c.data_pagamento is null and c.excluido_em is null
      and c.data_vencimento between date '2026-10-01' and date '2026-10-12'
  ) then
    raise exception 'Ainda existem vencimentos do dia 10 fora do proximo dia util.';
  end if;
end $$;
