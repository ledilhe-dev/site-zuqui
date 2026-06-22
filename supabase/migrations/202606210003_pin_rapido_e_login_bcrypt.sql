create or replace function public.buscar_funcionarios_por_credencial(p_senha text)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
set statement_timeout = '15s'
as $$
declare
  r record;
begin
  if nullif(trim(p_senha), '') is null then return '[]'::jsonb; end if;
  for r in
    select f.*, c.segredo_hash
    from private.credenciais_sistema c
    join public.funcionarios f on f.id = c.entidade_id and f.ativo is true
    where c.tipo = 'funcionario' and c.finalidade = 'pin'
    order by c.atualizado_em desc
  loop
    if r.segredo_hash = extensions.crypt(trim(p_senha), r.segredo_hash) then
      if r.segredo_hash like '$2%$12$%' then
        update private.credenciais_sistema
        set segredo_hash = extensions.crypt(trim(p_senha), extensions.gen_salt('bf', 8)), atualizado_em = now()
        where tipo = 'funcionario' and entidade_id = r.id and finalidade = 'pin';
      end if;
      return jsonb_build_array(to_jsonb(r) - 'pin' - 'segredo_hash');
    end if;
  end loop;
  return '[]'::jsonb;
end;
$$;

create or replace function public.definir_credencial_funcionario(p_funcionario_id uuid, p_nova_senha text)
returns void language plpgsql security definer set search_path = public, private, extensions as $$
begin
  if length(trim(coalesce(p_nova_senha, ''))) < 8 then raise exception 'A nova senha deve ter pelo menos 8 caracteres.' using errcode = '22023'; end if;
  if not exists (select 1 from public.funcionarios where id = p_funcionario_id) then raise exception 'Funcionário não encontrado.' using errcode = 'P0002'; end if;
  insert into private.credenciais_sistema (tipo, entidade_id, finalidade, segredo_hash)
  values ('funcionario', p_funcionario_id, 'login', extensions.crypt(trim(p_nova_senha), extensions.gen_salt('bf', 10)))
  on conflict (tipo, entidade_id, finalidade) do update set segredo_hash = excluded.segredo_hash, atualizado_em = now();
  update public.funcionarios set pin = null, senha_troca_obrigatoria = false where id = p_funcionario_id;
end; $$;

create or replace function public.definir_credencial_usuario_admin(p_usuario_id uuid, p_nova_senha text)
returns void language plpgsql security definer set search_path = public, private, extensions as $$
begin
  if length(trim(coalesce(p_nova_senha, ''))) < 8 then raise exception 'A nova senha deve ter pelo menos 8 caracteres.' using errcode = '22023'; end if;
  if not exists (select 1 from public.usuarios_admin where id = p_usuario_id) then raise exception 'Administrador não encontrado.' using errcode = 'P0002'; end if;
  insert into private.credenciais_sistema (tipo, entidade_id, finalidade, segredo_hash)
  values ('usuario_admin', p_usuario_id, 'login', extensions.crypt(trim(p_nova_senha), extensions.gen_salt('bf', 10)))
  on conflict (tipo, entidade_id, finalidade) do update set segredo_hash = excluded.segredo_hash, atualizado_em = now();
  update public.usuarios_admin set pin = null, senha_troca_obrigatoria = false where id = p_usuario_id;
end; $$;

revoke all on function public.buscar_funcionarios_por_credencial(text) from public;
revoke all on function public.definir_credencial_funcionario(uuid, text) from public, anon, authenticated;
revoke all on function public.definir_credencial_usuario_admin(uuid, text) from public, anon, authenticated;
grant execute on function public.buscar_funcionarios_por_credencial(text) to anon, authenticated;
grant execute on function public.definir_credencial_funcionario(uuid, text) to service_role;
grant execute on function public.definir_credencial_usuario_admin(uuid, text) to service_role;
