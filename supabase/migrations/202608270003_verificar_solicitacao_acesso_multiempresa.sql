do $$
declare
  v_gustare_id uuid;
  v_outra_id uuid;
  v_outra_cnpj text;
  v_outra_cnpj_temporario boolean := false;
  v_resultado jsonb;
  v_empresa_gravada uuid;
  v_inexistente_antes bigint;
  v_inexistente_depois bigint;
begin
  update public.empresas
     set cnpj = '20496179000127'
   where slug = 'forneria-gustare'
     and nullif(regexp_replace(coalesce(cnpj, ''), '[^0-9]', '', 'g'), '') is null;

  select e.id into v_gustare_id
    from public.empresas e
   where regexp_replace(coalesce(e.cnpj, ''), '[^0-9]', '', 'g') = '20496179000127'
     and e.ativo is true;
  if v_gustare_id is null then
    raise exception 'Teste: empresa Gustare nao localizada pelo CNPJ normalizado';
  end if;

  select e.id, nullif(regexp_replace(coalesce(e.cnpj, ''), '[^0-9]', '', 'g'), '')
    into v_outra_id, v_outra_cnpj
    from public.empresas e
   where e.id <> v_gustare_id
     and e.ativo is true
   order by e.id
   limit 1;
  if v_outra_id is null then
    raise exception 'Teste: nao existe uma segunda empresa ativa';
  end if;
  if v_outra_cnpj is null then
    v_outra_cnpj := '11222333000181';
    v_outra_cnpj_temporario := true;
    update public.empresas set cnpj = v_outra_cnpj where id = v_outra_id;
  end if;

  delete from public.solicitacoes_acesso
   where email in ('teste-rpc-gustare@checkdiario.invalid', 'teste-rpc-outra@checkdiario.invalid');

  v_resultado := public.solicitar_acesso_por_cnpj(
    'Teste RPC Gustare', '20.496.179/0001-27',
    'teste-rpc-gustare@checkdiario.invalid', 'Teste transacional Gustare'
  );
  if coalesce((v_resultado ->> 'ok')::boolean, false) is not true then
    raise exception 'Teste Gustare falhou: %', v_resultado;
  end if;
  select empresa_id into v_empresa_gravada from public.solicitacoes_acesso
   where email = 'teste-rpc-gustare@checkdiario.invalid';
  if v_empresa_gravada is distinct from v_gustare_id then
    raise exception 'Teste Gustare vinculou empresa incorreta';
  end if;

  v_resultado := public.solicitar_acesso_por_cnpj(
    'Teste RPC Outra Empresa', v_outra_cnpj,
    'teste-rpc-outra@checkdiario.invalid', 'Teste transacional outra empresa'
  );
  if coalesce((v_resultado ->> 'ok')::boolean, false) is not true then
    raise exception 'Teste outra empresa falhou: %', v_resultado;
  end if;
  select empresa_id into v_empresa_gravada from public.solicitacoes_acesso
   where email = 'teste-rpc-outra@checkdiario.invalid';
  if v_empresa_gravada is distinct from v_outra_id or v_empresa_gravada = v_gustare_id then
    raise exception 'Teste outra empresa vinculou tenant incorreto';
  end if;

  select count(*) into v_inexistente_antes from public.solicitacoes_acesso
   where email = 'teste-rpc-inexistente@checkdiario.invalid';
  v_resultado := public.solicitar_acesso_por_cnpj(
    'Teste RPC Inexistente', '00.000.000/0000-00',
    'teste-rpc-inexistente@checkdiario.invalid', 'Nao deve inserir'
  );
  select count(*) into v_inexistente_depois from public.solicitacoes_acesso
   where email = 'teste-rpc-inexistente@checkdiario.invalid';
  if v_resultado ->> 'codigo' <> 'empresa_nao_encontrada'
     or v_inexistente_depois <> v_inexistente_antes then
    raise exception 'Teste CNPJ inexistente criou registro ou retornou codigo incorreto';
  end if;

  delete from public.solicitacoes_acesso
   where email in ('teste-rpc-gustare@checkdiario.invalid', 'teste-rpc-outra@checkdiario.invalid');
  if v_outra_cnpj_temporario then
    update public.empresas set cnpj = null where id = v_outra_id and cnpj = v_outra_cnpj;
  end if;
end;
$$;
