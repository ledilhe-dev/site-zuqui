create or replace function public.excluir_instalacao_raffinato_admin(p_funcionario_id uuid,p_token text,p_connector_instance_id uuid)
returns jsonb language plpgsql security definer set search_path=public,private,extensions as $$
declare v_empresa_id uuid;
begin
  if not public.validar_sessao_admin_global(p_funcionario_id,p_token) then raise exception 'Acesso global não autorizado' using errcode='42501'; end if;
  select empresa_id into v_empresa_id from public.raffinato_connector_instances where id=p_connector_instance_id for update;
  if not found then raise exception 'Instalação não encontrada'; end if;
  if exists(select 1 from public.raffinato_integracoes where connector_instance_id=p_connector_instance_id) then raise exception 'Esta instalação ainda possui filiais vinculadas. Remova os vínculos antes de excluir.'; end if;
  delete from public.raffinato_connector_instances where id=p_connector_instance_id;
  return jsonb_build_object('ok',true,'connector_instance_id',p_connector_instance_id,'empresa_id',v_empresa_id);
end $$;
revoke all on function public.excluir_instalacao_raffinato_admin(uuid,text,uuid) from public;
grant execute on function public.excluir_instalacao_raffinato_admin(uuid,text,uuid) to anon,authenticated;
