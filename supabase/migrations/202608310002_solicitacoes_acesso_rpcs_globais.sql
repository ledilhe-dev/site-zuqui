create or replace function public.solicitar_acesso_pendente(
  p_nome text,
  p_email text,
  p_telefone text,
  p_empresa_informada text,
  p_loja_informada text,
  p_cnpj text default null,
  p_observacao text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_nome text := btrim(coalesce(p_nome, ''));
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_telefone text := nullif(btrim(coalesce(p_telefone, '')), '');
  v_empresa text := btrim(coalesce(p_empresa_informada, ''));
  v_loja text := btrim(coalesce(p_loja_informada, ''));
  v_cnpj text := nullif(regexp_replace(coalesce(p_cnpj, ''), '[^0-9]', '', 'g'), '');
  v_observacao text := nullif(btrim(coalesce(p_observacao, '')), '');
  v_id uuid;
begin
  if length(v_nome) < 4
    or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or v_empresa = ''
    or v_loja = ''
    or (v_cnpj is not null and length(v_cnpj) <> 14)
    or length(coalesce(v_telefone, '')) > 30
    or length(coalesce(v_observacao, '')) > 500 then
    return jsonb_build_object('ok', false, 'codigo', 'dados_invalidos');
  end if;

  insert into public.solicitacoes_acesso (
    nome, email, telefone, empresa_informada, loja_informada,
    cnpj, observacao, mensagem, empresa_id, loja_id, status, created_at
  ) values (
    v_nome, v_email, v_telefone, v_empresa, v_loja,
    v_cnpj, v_observacao, v_observacao, null, null, 'pendente', now()
  ) returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'status', 'pendente');
end;
$$;

revoke all on function public.solicitar_acesso_pendente(text, text, text, text, text, text, text) from public;
grant execute on function public.solicitar_acesso_pendente(text, text, text, text, text, text, text) to anon, authenticated;

create or replace function public.gerenciar_solicitacoes_acesso(
  p_funcionario_id uuid,
  p_token text,
  p_acao text,
  p_id uuid default null,
  p_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_data jsonb;
begin
  if not public.validar_sessao_admin_global(p_funcionario_id, p_token) then
    raise exception 'Acesso nao autorizado' using errcode = '42501';
  end if;

  case lower(coalesce(p_acao, ''))
    when 'listar' then
      select coalesce(jsonb_agg(to_jsonb(s) order by s.created_at desc), '[]'::jsonb)
        into v_data from public.solicitacoes_acesso s;
      return jsonb_build_object('ok', true, 'data', v_data);
    when 'obter' then
      select to_jsonb(s) into v_data from public.solicitacoes_acesso s where s.id = p_id;
      return jsonb_build_object('ok', v_data is not null, 'data', v_data);
    when 'aprovar' then
      update public.solicitacoes_acesso set status = 'aprovada', aprovado_em = now() where id = p_id;
    when 'rejeitar' then
      update public.solicitacoes_acesso set status = 'rejeitada', rejeitado_em = now() where id = p_id;
    when 'excluir' then
      delete from public.solicitacoes_acesso where id = p_id;
    when 'excluir_duplicadas' then
      return jsonb_build_object('ok', true);
    when 'excluir_email' then
      delete from public.solicitacoes_acesso where lower(btrim(email)) = lower(btrim(coalesce(p_email, '')));
    else
      raise exception 'Acao invalida' using errcode = '22023';
  end case;

  return jsonb_build_object('ok', found);
end;
$$;

create or replace function public.vincular_solicitacao_acesso(
  p_funcionario_id uuid,
  p_token text,
  p_solicitacao_id uuid,
  p_empresa_id uuid,
  p_loja_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if not public.validar_sessao_admin_global(p_funcionario_id, p_token) then
    raise exception 'Acesso nao autorizado' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.lojas l
    where l.id = p_loja_id and l.empresa_id = p_empresa_id
  ) then
    return jsonb_build_object('ok', false, 'codigo', 'loja_empresa_invalida');
  end if;

  update public.solicitacoes_acesso
     set empresa_id = p_empresa_id,
         loja_id = p_loja_id,
         status = 'aprovada',
         aprovado_em = now()
   where id = p_solicitacao_id and status = 'pendente';
  return jsonb_build_object('ok', found);
end;
$$;

revoke all on function public.vincular_solicitacao_acesso(uuid, text, uuid, uuid, uuid) from public;
grant execute on function public.vincular_solicitacao_acesso(uuid, text, uuid, uuid, uuid) to anon, authenticated;

notify pgrst, 'reload schema';
