create or replace function public.definir_vinculo_instalacao_raffinato_admin(
  p_funcionario_id uuid, p_token text, p_connector_instance_id uuid,
  p_loja_id uuid, p_vincular boolean
) returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare v_empresa_instalacao uuid; v_empresa_loja uuid; v_integracao_id uuid;
begin
  if not public.validar_sessao_admin_global(p_funcionario_id,p_token) then
    raise exception 'Acesso global nao autorizado' using errcode='42501';
  end if;
  select empresa_id into v_empresa_instalacao from public.raffinato_connector_instances
   where id=p_connector_instance_id;
  if not found then raise exception 'Instalacao nao encontrada'; end if;
  select empresa_id into v_empresa_loja from public.lojas where id=p_loja_id;
  if not found or v_empresa_loja is distinct from v_empresa_instalacao then
    raise exception 'A filial nao pertence a empresa desta instalacao';
  end if;
  select id into v_integracao_id from public.raffinato_integracoes
   where empresa_id=v_empresa_instalacao and loja_id=p_loja_id for update;
  if not found then raise exception 'Integracao Raffinato da filial nao encontrada'; end if;
  if p_vincular then
    update public.raffinato_integracoes set connector_instance_id=p_connector_instance_id,
      status='ativa',ultimo_erro=null,atualizado_em=now() where id=v_integracao_id;
  else
    update public.raffinato_integracoes set connector_instance_id=null,status='pausada',
      ultimo_erro='Replicacao pausada pelo painel administrativo.',atualizado_em=now()
      where id=v_integracao_id;
  end if;
  update public.raffinato_connector_instances c set filiais_vinculadas=(
    select count(*)::integer from public.raffinato_integracoes r where r.connector_instance_id=c.id
  ) where c.id=p_connector_instance_id;
  return jsonb_build_object('ok',true,'vinculada',p_vincular,
    'connector_instance_id',p_connector_instance_id,'loja_id',p_loja_id,
    'integracao_id',v_integracao_id,'dados_preservados',true);
end $$;
revoke all on function public.definir_vinculo_instalacao_raffinato_admin(uuid,text,uuid,uuid,boolean) from public;
grant execute on function public.definir_vinculo_instalacao_raffinato_admin(uuid,text,uuid,uuid,boolean) to anon,authenticated;
notify pgrst,'reload schema';
