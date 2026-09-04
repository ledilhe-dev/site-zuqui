create or replace function public.resolver_contexto_google_business(
  p_principal_id uuid,
  p_token text,
  p_empresa_id uuid,
  p_loja_id uuid
)
returns jsonb
language plpgsql
security definer
stable
set search_path = pg_catalog, public, private, extensions
as $$
declare
  v_sessao private.sessoes_operacionais%rowtype;
  v_loja public.lojas%rowtype;
  v_funcionario public.funcionarios%rowtype;
  v_perfil public.perfis%rowtype;
begin
  select *
    into v_sessao
    from private.sessoes_operacionais s
   where s.principal_id = p_principal_id
     and s.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
     and s.revogado_em is null
     and s.expira_em > now()
   limit 1;

  if not found then
    return jsonb_build_object('autorizado', false, 'codigo', 'SESSION_INVALID');
  end if;

  select *
    into v_loja
    from public.lojas l
   where l.id = p_loja_id
     and l.empresa_id = p_empresa_id
     and l.ativo is true;

  if not found then
    return jsonb_build_object('autorizado', false, 'codigo', 'TENANT_INVALID');
  end if;

  if v_sessao.principal_tipo = 'usuario_admin'
     and exists (
       select 1
         from public.usuarios_admin a
        where a.id = p_principal_id
          and a.empresa_id = p_empresa_id
          and a.loja_id = p_loja_id
          and a.ativo is true
     )
  then
    return jsonb_build_object(
      'autorizado', true,
      'administrador', true,
      'principal_tipo', 'usuario_admin',
      'empresa_id', p_empresa_id,
      'loja_id', p_loja_id,
      'loja_nome', v_loja.nome
    );
  end if;

  select *
    into v_funcionario
    from public.funcionarios f
   where f.id = p_principal_id
     and f.ativo is true;

  if found
     and v_funcionario.e_administrador is true
     and (
       (v_sessao.empresa_id = p_empresa_id and v_sessao.loja_id = p_loja_id)
       or (v_sessao.principal_tipo = 'funcionario' and v_sessao.empresa_id is null and v_sessao.loja_id is null)
     )
  then
    return jsonb_build_object(
      'autorizado', true,
      'administrador', true,
      'principal_tipo', 'administrador_sistema',
      'empresa_id', p_empresa_id,
      'loja_id', p_loja_id,
      'loja_nome', v_loja.nome
    );
  end if;

  select p.*
    into v_perfil
    from public.funcionario_lojas fl
    join public.perfis p on p.id = fl.perfil_id
   where fl.funcionario_id = p_principal_id
     and fl.loja_id = p_loja_id
     and fl.ativo is true
     and p.loja_id = p_loja_id
     and p.ativo is true
   limit 1;

  if not found then
    return jsonb_build_object('autorizado', false, 'codigo', 'STORE_PROFILE_NOT_LINKED');
  end if;

  if upper(coalesce(v_perfil.codigo, '')) in ('ADM', 'MASTER')
     or coalesce((v_perfil.permissoes ->> 'estatisticas_atendimento')::boolean, false)
  then
    return jsonb_build_object(
      'autorizado', true,
      'administrador', upper(coalesce(v_perfil.codigo, '')) in ('ADM', 'MASTER'),
      'principal_tipo', 'funcionario',
      'empresa_id', p_empresa_id,
      'loja_id', p_loja_id,
      'loja_nome', v_loja.nome
    );
  end if;

  return jsonb_build_object('autorizado', false, 'codigo', 'PERMISSION_DENIED');
end;
$$;

revoke all on function public.resolver_contexto_google_business(uuid, text, uuid, uuid) from public;
grant execute on function public.resolver_contexto_google_business(uuid, text, uuid, uuid) to service_role;

comment on function public.resolver_contexto_google_business(uuid, text, uuid, uuid) is
  'Fonte única de autorização da integração Google Business; usa e_administrador canônico e perfil local.';

notify pgrst, 'reload schema';
