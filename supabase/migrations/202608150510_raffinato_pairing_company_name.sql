create or replace function public.consumir_codigo_pareamento_raffinato(
  p_codigo text, p_connector_instance_id uuid, p_credencial_hash text,
  p_nome text, p_versao text
) returns jsonb
language plpgsql security definer
set search_path = public, private, extensions
as $$
declare
  v_codigo private.raffinato_connector_pairing_codes%rowtype;
  v_empresa_nome text;
begin
  select * into v_codigo from private.raffinato_connector_pairing_codes
   where codigo_hash=encode(digest(upper(trim(p_codigo)),'sha256'),'hex')
     and usado_em is null and expira_em > now()
   for update skip locked;
  if v_codigo.id is null then raise exception 'Código inválido, expirado ou já utilizado.' using errcode='22023'; end if;
  if exists(select 1 from public.raffinato_connector_instances where id=p_connector_instance_id) then
    raise exception 'Esta instalação já está vinculada.' using errcode='23505';
  end if;
  select nome into v_empresa_nome from public.empresas where id=v_codigo.empresa_id;
  insert into public.raffinato_connector_instances(id,empresa_id,nome,versao,status,ultimo_contato_em,credencial_hash)
  values(p_connector_instance_id,v_codigo.empresa_id,left(coalesce(nullif(trim(p_nome),''),'Conector Raffinato'),120),left(p_versao,30),'online',now(),p_credencial_hash);
  update private.raffinato_connector_pairing_codes set usado_em=now() where id=v_codigo.id;
  return jsonb_build_object('empresa_id',v_codigo.empresa_id,'empresa_nome',v_empresa_nome,'connector_instance_id',p_connector_instance_id);
end $$;
revoke all on function public.consumir_codigo_pareamento_raffinato(text,uuid,text,text,text) from public;
grant execute on function public.consumir_codigo_pareamento_raffinato(text,uuid,text,text,text) to service_role;
