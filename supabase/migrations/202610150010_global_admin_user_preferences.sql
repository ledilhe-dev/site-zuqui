-- Permite que o administrador global leia e grave apenas as próprias
-- preferências de interface mesmo quando não há uma loja ativa no contexto.
create or replace function public.request_funcionario_authorized(p_funcionario_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  h jsonb := private.request_headers_json();
  v_id uuid;
  v_global text := coalesce(h->>'x-global-admin-token', '');
begin
  begin
    v_id := nullif(h->>'x-funcionario-id', '')::uuid;
  exception when others then
    return false;
  end;

  if v_id is null then return false; end if;

  if v_id = p_funcionario_id
     and v_global <> ''
     and public.validar_sessao_admin_global(v_id, v_global) then
    return true;
  end if;

  return exists (
    select 1
    from public.funcionario_lojas fl
    join public.lojas l on l.id = fl.loja_id
    where fl.funcionario_id = p_funcionario_id
      and fl.ativo is true
      and public.request_store_authorized(l.empresa_id, l.id)
  );
end;
$$;

revoke all on function public.request_funcionario_authorized(uuid) from public;
grant execute on function public.request_funcionario_authorized(uuid) to anon, authenticated, service_role;
