-- Renova uma sessão persistente mediante posse do token anterior e vínculo ainda ativo.
-- Não permite trocar empresa/loja nem criar acesso a partir apenas do UUID do usuário.
create or replace function public.renovar_contexto_operacional(
  p_principal_id uuid, p_token text, p_empresa_id uuid, p_loja_id uuid, p_global_token text default null
) returns boolean language plpgsql security definer
set search_path=pg_catalog,public,private,extensions
as $$
declare v_hash text;
begin
  if p_principal_id is null or p_loja_id is null or p_empresa_id is null or coalesce(p_token,'')='' then return false; end if;
  if not exists(select 1 from public.lojas l where l.id=p_loja_id and l.empresa_id=p_empresa_id and l.ativo is not false) then return false; end if;
  v_hash:=encode(extensions.digest(p_token,'sha256'),'hex');

  if not exists(select 1 from private.sessoes_operacionais s
    where s.principal_id=p_principal_id and s.token_hash=v_hash
      and s.empresa_id=p_empresa_id and s.loja_id=p_loja_id
      and s.revogado_em is null and s.expira_em>now()-interval '30 days') then return false; end if;

  if not (
    exists(select 1 from public.funcionario_lojas fl join public.perfis p on p.id=fl.perfil_id
      where fl.funcionario_id=p_principal_id and fl.loja_id=p_loja_id and fl.ativo is true
        and p.loja_id=p_loja_id and p.ativo is true)
    or exists(select 1 from public.usuarios_admin a where a.id=p_principal_id and a.loja_id=p_loja_id and a.ativo is true)
    or (coalesce(p_global_token,'')<>'' and public.validar_sessao_admin_global(p_principal_id,p_global_token))
  ) then return false; end if;

  update private.sessoes_operacionais set expira_em=now()+interval '12 hours'
   where principal_id=p_principal_id and token_hash=v_hash
     and empresa_id=p_empresa_id and loja_id=p_loja_id and revogado_em is null;
  return found;
end $$;

revoke all on function public.renovar_contexto_operacional(uuid,text,uuid,uuid,text) from public;
grant execute on function public.renovar_contexto_operacional(uuid,text,uuid,uuid,text) to anon,authenticated;
notify pgrst,'reload schema';
