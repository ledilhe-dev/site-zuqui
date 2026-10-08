-- Registros legados sem historico equivalente nao podem continuar aparecendo
-- sem categoria. Eles ficam explicitamente marcados para revisao humana.
do $$
declare v_loja record; v_categoria uuid;
begin
  for v_loja in
    select id,empresa_id from public.lojas where ativo and lower(nome) like '%patrick%'
  loop
    select id into v_categoria from public.categorias_compra
    where loja_id=v_loja.id and upper(trim(nome))='A CLASSIFICAR'
    order by ativo desc limit 1;

    if v_categoria is null then
      insert into public.categorias_compra(nome,icone,cor,descricao,empresa_id,loja_id,ativo)
      values ('A CLASSIFICAR',null,'#f59e0b','Lancamentos antigos que precisam de revisao de categoria.',v_loja.empresa_id,v_loja.id,true)
      returning id into v_categoria;
    else
      update public.categorias_compra set ativo=true where id=v_categoria;
    end if;

    update public.contasapagar
    set categoria_id=v_categoria,updated_at=now()
    where loja_id=v_loja.id and categoria_id is null and excluido_em is null;
  end loop;
end $$;
