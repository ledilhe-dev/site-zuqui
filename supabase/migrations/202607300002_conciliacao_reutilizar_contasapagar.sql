-- Complementa a conciliação reutilizando os valores nativos de contasapagar.
alter table public.conciliacao_importacoes
  add column if not exists arquivo_mime text,
  add column if not exists arquivo_tamanho bigint,
  add column if not exists arquivo_storage_path text,
  add column if not exists conteudo_extraido jsonb not null default '{}';

comment on column public.conciliacao_importacoes.arquivo_storage_path is
  'Caminho opcional no Storage. O arquivo não é salvo como bytea no banco.';
comment on table public.conciliacao_auditoria is
  'Histórico imutável e exclusivo da conciliação; preserva antes/depois sem duplicar os dados atuais de contasapagar.';

create or replace function public.conciliar_conta_pagar_com_arquivo(
  p_loja_id uuid,
  p_conta_pagar_id uuid,
  p_importacao_id uuid,
  p_item_id uuid,
  p_valor_arquivo numeric,
  p_ator_id uuid default null,
  p_ator_nome text default null
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_conta public.contasapagar%rowtype;
  v_empresa_id uuid;
  v_antes jsonb;
  v_depois jsonb;
begin
  if p_valor_arquivo is null or p_valor_arquivo < 0 then
    raise exception 'Valor do arquivo inválido.';
  end if;

  select * into v_conta
  from public.contasapagar
  where id=p_conta_pagar_id and loja_id=p_loja_id and excluido_em is null
  for update;
  if not found then raise exception 'Conta não encontrada na loja atual.'; end if;

  select empresa_id into v_empresa_id from public.lojas where id=p_loja_id;
  if v_empresa_id is null or v_conta.empresa_id<>v_empresa_id then
    raise exception 'Empresa e loja incompatíveis.';
  end if;

  if p_importacao_id is not null and not exists(
    select 1 from public.conciliacao_importacoes
    where id=p_importacao_id and loja_id=p_loja_id and empresa_id=v_empresa_id
  ) then raise exception 'Importação não pertence à loja atual.'; end if;

  if p_item_id is not null and not exists(
    select 1 from public.conciliacao_importacao_itens
    where id=p_item_id and importacao_id=p_importacao_id and loja_id=p_loja_id
  ) then raise exception 'Item não pertence à importação atual.'; end if;

  v_antes := jsonb_build_object(
    'valor_original',v_conta.valor_original,
    'valor_compra',v_conta.valor_compra,
    'valor_pago',v_conta.valor_pago,
    'data_pagamento',v_conta.data_pagamento,
    'observacao',v_conta.observacao,
    'categoria_id',v_conta.categoria_id,
    'fornecedor_id',v_conta.fornecedor_id
  );

  update public.contasapagar
  set valor_compra=round(p_valor_arquivo,2),
      valor_pago=case when data_pagamento is not null then round(p_valor_arquivo,2) else valor_pago end
  where id=p_conta_pagar_id
  returning * into v_conta;

  v_depois := jsonb_build_object(
    'valor_original',v_conta.valor_original,
    'valor_compra',v_conta.valor_compra,
    'valor_pago',v_conta.valor_pago,
    'data_pagamento',v_conta.data_pagamento,
    'observacao',v_conta.observacao,
    'categoria_id',v_conta.categoria_id,
    'fornecedor_id',v_conta.fornecedor_id
  );

  if p_item_id is not null then
    update public.conciliacao_importacao_itens
    set status='conciliado', conta_pagar_id=p_conta_pagar_id
    where id=p_item_id;
  end if;

  insert into public.conciliacao_auditoria(
    importacao_id,item_id,empresa_id,loja_id,acao,conta_pagar_id,antes,depois,ator_id,ator_nome
  ) values (
    p_importacao_id,p_item_id,v_empresa_id,p_loja_id,'valor_conciliado',
    p_conta_pagar_id,v_antes,v_depois,p_ator_id,p_ator_nome
  );

  return jsonb_build_object(
    'conta_pagar_id',p_conta_pagar_id,
    'valor_original',v_conta.valor_original,
    'valor_compra',v_conta.valor_compra,
    'valor_pago',v_conta.valor_pago,
    'pago',v_conta.data_pagamento is not null
  );
end $$;

grant execute on function public.conciliar_conta_pagar_com_arquivo(uuid,uuid,uuid,uuid,numeric,uuid,text)
  to anon, authenticated;
