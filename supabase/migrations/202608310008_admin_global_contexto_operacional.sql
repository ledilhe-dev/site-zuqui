-- Administrador do Sistema é identidade global, não funcionário/perfil de loja.
alter table private.sessoes_operacionais add column if not exists empresa_id uuid;
alter table private.sessoes_operacionais add column if not exists loja_id uuid;
create index if not exists sessoes_operacionais_contexto_idx
  on private.sessoes_operacionais(principal_id, empresa_id, loja_id, expira_em)
  where revogado_em is null;

create or replace function public.emitir_contexto_operacional_admin_global(
  p_funcionario_id uuid, p_token_global text, p_loja_id uuid
) returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, private, extensions
as $$ declare v_loja public.lojas%rowtype; v_token text;
begin
  if not public.validar_sessao_admin_global(p_funcionario_id,p_token_global) then
    raise exception 'Sessão administrativa global inválida' using errcode='42501';
  end if;
  select * into v_loja from public.lojas where id=p_loja_id and ativo is not false;
  if v_loja.id is null then raise exception 'Loja inválida ou inativa' using errcode='22023'; end if;
  v_token:=gen_random_uuid()::text||replace(gen_random_uuid()::text,'-','');
  insert into private.sessoes_operacionais(token_hash,principal_tipo,principal_id,empresa_id,loja_id,expira_em)
  values(encode(extensions.digest(v_token,'sha256'),'hex'),'funcionario',p_funcionario_id,v_loja.empresa_id,v_loja.id,now()+interval '12 hours');
  return jsonb_build_object('operational_access_token',v_token,'empresa_id',v_loja.empresa_id,'loja_id',v_loja.id);
end $$;
revoke all on function public.emitir_contexto_operacional_admin_global(uuid,text,uuid) from public;
grant execute on function public.emitir_contexto_operacional_admin_global(uuid,text,uuid) to anon,authenticated;

create or replace function public.request_store_authorized(p_empresa_id uuid,p_loja_id uuid)
returns boolean language plpgsql security definer stable
set search_path=pg_catalog,public,private,extensions
as $$ declare h jsonb:=private.request_headers_json();v_id uuid;v_loja uuid;v_token text;v_global text;
begin
  begin v_id:=nullif(h->>'x-funcionario-id','')::uuid; exception when others then return false; end;
  begin v_loja:=nullif(h->>'x-loja-id','')::uuid; exception when others then return false; end;
  v_loja:=coalesce(v_loja,p_loja_id);
  if v_id is null or v_loja is null or v_loja is distinct from p_loja_id then return false; end if;
  if not exists(select 1 from public.lojas l where l.id=v_loja and l.empresa_id=p_empresa_id and l.ativo is not false) then return false; end if;
  v_token:=coalesce(h->>'x-operational-token','');v_global:=coalesce(h->>'x-global-admin-token','');
  if v_global<>'' and public.validar_sessao_admin_global(v_id,v_global) then
    return exists(select 1 from private.sessoes_operacionais s where s.principal_id=v_id
      and s.token_hash=encode(extensions.digest(v_token,'sha256'),'hex') and s.revogado_em is null and s.expira_em>now()
      and s.empresa_id=p_empresa_id and s.loja_id=p_loja_id);
  end if;
  if not exists(select 1 from private.sessoes_operacionais s where s.principal_id=v_id
    and s.token_hash=encode(extensions.digest(v_token,'sha256'),'hex') and s.revogado_em is null and s.expira_em>now()) then return false; end if;
  return exists(select 1 from private.sessoes_operacionais s where s.principal_id=v_id
    and s.token_hash=encode(extensions.digest(v_token,'sha256'),'hex')
    and ((s.principal_tipo='funcionario' and exists(select 1 from public.funcionario_lojas fl join public.perfis p on p.id=fl.perfil_id
      where fl.funcionario_id=v_id and fl.loja_id=v_loja and fl.ativo is true and p.loja_id=v_loja and p.ativo is true))
    or (s.principal_tipo='usuario_admin' and exists(select 1 from public.usuarios_admin a where a.id=v_id and a.loja_id=v_loja and a.ativo is true))));
end $$;

-- Auditoria não destrutiva de vínculos históricos globais para exibição no painel.
create or replace function public.obter_vinculos_historicos_admin_global(p_funcionario_id uuid,p_token text)
returns jsonb language sql security definer stable
set search_path=pg_catalog,public,private,extensions
as $$
  select case when public.validar_sessao_admin_global(p_funcionario_id,p_token) then
    coalesce((select jsonb_agg(jsonb_build_object('funcionario_id',fl.funcionario_id,'loja_id',fl.loja_id,'ativo',fl.ativo))
      from public.funcionario_lojas fl join public.funcionarios f on f.id=fl.funcionario_id where f."é_administrador" is true),'[]'::jsonb)
  else '[]'::jsonb end
$$;
revoke all on function public.obter_vinculos_historicos_admin_global(uuid,text) from public;
grant execute on function public.obter_vinculos_historicos_admin_global(uuid,text) to anon,authenticated;

create or replace function public.obter_usuarios_classificados_admin_global(p_funcionario_id uuid,p_token text)
returns jsonb language plpgsql security definer stable
set search_path=pg_catalog,public,private,extensions
as $$
begin
  if not public.validar_sessao_admin_global(p_funcionario_id,p_token) then
    raise exception 'Acesso global não autorizado' using errcode='42501';
  end if;
  return jsonb_build_object(
    'administradores_sistema',coalesce((select jsonb_agg(jsonb_build_object(
      'id',f.id,'nome',f.nome,'email',f.email,'ativo',f.ativo,'ultimo_acesso',
      (select max(s.criado_em) from private.sessoes_admin_global s where s.funcionario_id=f.id)
    ) order by f.nome) from public.funcionarios f where f."é_administrador" is true),'[]'::jsonb),
    'masters',coalesce((select jsonb_agg(jsonb_build_object(
      'id',f.id,'nome',f.nome,'email',f.email,'ativo',f.ativo,'empresa_id',l.empresa_id,
      'loja_id',fl.loja_id,'perfil_id',fl.perfil_id,'perfil_nome',p.nome,'perfil_codigo',p.codigo
    ) order by f.nome,l.nome) from public.funcionario_lojas fl
      join public.funcionarios f on f.id=fl.funcionario_id
      join public.lojas l on l.id=fl.loja_id
      join public.perfis p on p.id=fl.perfil_id and p.loja_id=fl.loja_id
      where f."é_administrador" is not true and upper(coalesce(p.codigo,'')) in ('ADM','MASTER')),'[]'::jsonb)
  );
end $$;
revoke all on function public.obter_usuarios_classificados_admin_global(uuid,text) from public;
grant execute on function public.obter_usuarios_classificados_admin_global(uuid,text) to anon,authenticated;

notify pgrst,'reload schema';
