-- A autorização de tenant não é, por si só, autorização para administrar perfis.
create or replace function public.request_perfil_permission(p_loja_id uuid, p_permission text)
returns boolean language plpgsql security definer stable
set search_path=pg_catalog,public,private,extensions
as $$
declare
  h jsonb:=private.request_headers_json();
  v_id uuid;
  v_token text:=coalesce(h->>'x-operational-token','');
  v_global text:=coalesce(h->>'x-global-admin-token','');
begin
  begin v_id:=nullif(h->>'x-funcionario-id','')::uuid; exception when others then return false; end;
  if v_id is null or not public.request_loja_authorized(p_loja_id) then return false; end if;

  if v_global<>'' and public.validar_sessao_admin_global(v_id,v_global) then return true; end if;

  if exists(select 1 from private.sessoes_operacionais s
    join public.usuarios_admin a on a.id=s.principal_id and a.loja_id=p_loja_id and a.ativo is true
    where s.principal_id=v_id and s.principal_tipo='usuario_admin'
      and s.token_hash=encode(extensions.digest(v_token,'sha256'),'hex')
      and s.revogado_em is null and s.expira_em>now()) then return true; end if;

  return exists(select 1 from public.funcionario_lojas fl
    join public.perfis p on p.id=fl.perfil_id and p.loja_id=fl.loja_id and p.ativo is true
    where fl.funcionario_id=v_id and fl.loja_id=p_loja_id and fl.ativo is true
      and coalesce((p.permissoes->>p_permission)::boolean,false));
exception when others then return false;
end $$;

revoke all on function public.request_perfil_permission(uuid,text) from public;
grant execute on function public.request_perfil_permission(uuid,text) to anon,authenticated,service_role;

drop policy if exists tenant_insert on public.perfis;
drop policy if exists tenant_update on public.perfis;
drop policy if exists tenant_delete on public.perfis;
create policy tenant_insert on public.perfis for insert to anon,authenticated
  with check (public.request_perfil_permission(loja_id,'perfis_criar'));
create policy tenant_update on public.perfis for update to anon,authenticated
  using (public.request_perfil_permission(loja_id,'perfis_editar'))
  with check (public.request_perfil_permission(loja_id,'perfis_editar'));
create policy tenant_delete on public.perfis for delete to anon,authenticated
  using (public.request_perfil_permission(loja_id,'perfis_excluir'));

notify pgrst,'reload schema';
