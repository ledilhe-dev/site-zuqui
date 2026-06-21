-- Contexto de tenant para reforcar isolamento por empresa no banco.
-- Esta migration cria/atualiza a funcao current_empresa_id() e
-- adiciona a RPC set_app_empresa_id() consumida pelo frontend.

create or replace function public.current_empresa_id()
returns uuid
language sql
stable
set search_path = ''
as $$
  select coalesce(
    nullif((current_setting('request.jwt.claims', true)::jsonb ->> 'empresa_id'), '')::uuid,
    nullif(current_setting('app.empresa_id', true), '')::uuid
  )
$$;

create or replace function public.set_app_empresa_id(p_empresa_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.empresa_id', coalesce(p_empresa_id::text, ''), false);
end;
$$;

grant execute on function public.set_app_empresa_id(uuid) to anon, authenticated;
