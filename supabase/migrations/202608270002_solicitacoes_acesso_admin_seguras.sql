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
  v_empresa_id uuid;
  v_data jsonb;
begin
  if not public.validar_sessao_admin_global(p_funcionario_id, p_token) then
    raise exception 'Acesso nao autorizado' using errcode = '42501';
  end if;

  select f.empresa_id into v_empresa_id
    from public.funcionarios f
   where f.id = p_funcionario_id and f.ativo is true;

  if v_empresa_id is null then
    raise exception 'Administrador sem empresa vinculada' using errcode = '42501';
  end if;

  case lower(coalesce(p_acao, ''))
    when 'listar' then
      select coalesce(jsonb_agg(to_jsonb(s) order by s.created_at desc), '[]'::jsonb)
        into v_data
        from public.solicitacoes_acesso s
       where s.empresa_id = v_empresa_id;
      return jsonb_build_object('ok', true, 'data', v_data);
    when 'obter' then
      select to_jsonb(s) into v_data
        from public.solicitacoes_acesso s
       where s.id = p_id and s.empresa_id = v_empresa_id;
      return jsonb_build_object('ok', v_data is not null, 'data', v_data);
    when 'aprovar' then
      update public.solicitacoes_acesso
         set status = 'aprovada', aprovado_em = now()
       where id = p_id and empresa_id = v_empresa_id;
    when 'rejeitar' then
      update public.solicitacoes_acesso
         set status = 'rejeitada', rejeitado_em = now()
       where id = p_id and empresa_id = v_empresa_id;
    when 'excluir' then
      delete from public.solicitacoes_acesso
       where id = p_id and empresa_id = v_empresa_id;
    when 'excluir_duplicadas' then
      delete from public.solicitacoes_acesso
       where empresa_id = v_empresa_id
         and lower(btrim(email)) = lower(btrim(coalesce(p_email, '')))
         and id <> p_id
         and status <> 'aprovada';
    when 'excluir_email' then
      delete from public.solicitacoes_acesso
       where empresa_id = v_empresa_id
         and lower(btrim(email)) = lower(btrim(coalesce(p_email, '')));
    else
      raise exception 'Acao invalida' using errcode = '22023';
  end case;

  return jsonb_build_object('ok', found);
end;
$$;

revoke all on function public.gerenciar_solicitacoes_acesso(uuid, text, text, uuid, text) from public;
grant execute on function public.gerenciar_solicitacoes_acesso(uuid, text, text, uuid, text) to anon, authenticated;
