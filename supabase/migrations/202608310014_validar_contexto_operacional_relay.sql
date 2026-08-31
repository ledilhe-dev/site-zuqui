create or replace function public.validar_contexto_operacional_relay(p_principal_id uuid,p_token text,p_empresa_id uuid,p_loja_id uuid)
returns boolean language sql security definer stable set search_path=pg_catalog,public,private,extensions as $$
select exists(select 1 from private.sessoes_operacionais s where s.principal_id=p_principal_id
 and s.token_hash=encode(extensions.digest(coalesce(p_token,''),'sha256'),'hex') and s.revogado_em is null and s.expira_em>now()
 and ((s.empresa_id=p_empresa_id and s.loja_id=p_loja_id and exists(select 1 from public.funcionarios f where f.id=p_principal_id and f."é_administrador" is true and f.ativo is true))
 or (s.principal_tipo='funcionario' and s.empresa_id is null and s.loja_id is null and exists(select 1 from public.funcionario_lojas fl join public.lojas l on l.id=fl.loja_id join public.perfis p on p.id=fl.perfil_id where fl.funcionario_id=p_principal_id and fl.loja_id=p_loja_id and fl.ativo is true and l.empresa_id=p_empresa_id and p.loja_id=p_loja_id and p.ativo is true))
 or (s.principal_tipo='usuario_admin' and exists(select 1 from public.usuarios_admin a where a.id=p_principal_id and a.empresa_id=p_empresa_id and a.loja_id=p_loja_id and a.ativo is true))))
$$;
revoke all on function public.validar_contexto_operacional_relay(uuid,text,uuid,uuid) from public;
grant execute on function public.validar_contexto_operacional_relay(uuid,text,uuid,uuid) to service_role;
notify pgrst,'reload schema';
