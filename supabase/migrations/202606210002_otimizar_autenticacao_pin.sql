create index if not exists ix_funcionarios_login_email on public.funcionarios ((lower(trim(email)))) where ativo is true;
create index if not exists ix_funcionarios_login_nome on public.funcionarios ((lower(trim(nome)))) where ativo is true;

create or replace function public.autenticar_funcionario(p_identificador text, p_senha text)
returns jsonb
language sql
security definer
set search_path = public, private, extensions
as $$
  with candidatos as materialized (
    select f.*
    from public.funcionarios f
    where f.ativo is true
      and (
        lower(trim(coalesce(f.email, ''))) = lower(trim(p_identificador))
        or (f.senha_troca_obrigatoria is true and lower(trim(coalesce(f.nome, ''))) = lower(trim(p_identificador)))
      )
    order by case when lower(trim(coalesce(f.email, ''))) = lower(trim(p_identificador)) then 0 else 1 end
    limit 5
  )
  select (to_jsonb(f) - 'pin') || jsonb_build_object('perfis', to_jsonb(p))
  from candidatos f
  join private.credenciais_sistema c
    on c.tipo = 'funcionario' and c.entidade_id = f.id and c.finalidade = 'login'
  left join public.perfis p on p.id = f.perfil_id
  where nullif(trim(p_senha), '') is not null
    and c.segredo_hash = extensions.crypt(trim(p_senha), c.segredo_hash)
  limit 1;
$$;

create or replace function public.verificar_credencial_funcionario(p_funcionario_id uuid, p_senha text)
returns boolean
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_hash text;
begin
  select c.segredo_hash into v_hash
  from private.credenciais_sistema c
  join public.funcionarios f on f.id = c.entidade_id and f.ativo is true
  where c.tipo = 'funcionario' and c.finalidade = 'pin' and c.entidade_id = p_funcionario_id;
  if v_hash is null or nullif(trim(p_senha), '') is null then return false; end if;
  if v_hash <> extensions.crypt(trim(p_senha), v_hash) then return false; end if;
  if v_hash like '$2%$12$%' then
    update private.credenciais_sistema
    set segredo_hash = extensions.crypt(trim(p_senha), extensions.gen_salt('bf', 8)), atualizado_em = now()
    where tipo = 'funcionario' and entidade_id = p_funcionario_id and finalidade = 'pin';
  end if;
  return true;
end;
$$;

create or replace function public.buscar_funcionarios_por_credencial(p_senha text)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
set statement_timeout = '15s'
as $$
declare
  r record;
  v_resultado jsonb := '[]'::jsonb;
begin
  if nullif(trim(p_senha), '') is null then return v_resultado; end if;
  for r in
    select f.*, c.segredo_hash
    from private.credenciais_sistema c
    join public.funcionarios f on f.id = c.entidade_id and f.ativo is true
    where c.tipo = 'funcionario' and c.finalidade = 'pin'
    order by c.atualizado_em desc
  loop
    if r.segredo_hash = extensions.crypt(trim(p_senha), r.segredo_hash) then
      v_resultado := v_resultado || jsonb_build_array(to_jsonb(r) - 'pin' - 'segredo_hash');
      if r.segredo_hash like '$2%$12$%' then
        update private.credenciais_sistema
        set segredo_hash = extensions.crypt(trim(p_senha), extensions.gen_salt('bf', 8)), atualizado_em = now()
        where tipo = 'funcionario' and entidade_id = r.id and finalidade = 'pin';
      end if;
    end if;
  end loop;
  return v_resultado;
end;
$$;

create or replace function public.definir_pin_funcionario(p_funcionario_id uuid, p_novo_pin text)
returns void
language plpgsql
security definer
set search_path = public, private, extensions
as $$
begin
  if length(trim(coalesce(p_novo_pin, ''))) < 4 then
    raise exception 'O PIN deve ter pelo menos 4 caracteres.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.funcionarios where id = p_funcionario_id) then
    raise exception 'Funcionário não encontrado.' using errcode = 'P0002';
  end if;
  insert into private.credenciais_sistema (tipo, entidade_id, finalidade, segredo_hash)
  values ('funcionario', p_funcionario_id, 'pin', extensions.crypt(trim(p_novo_pin), extensions.gen_salt('bf', 8)))
  on conflict (tipo, entidade_id, finalidade) do update
  set segredo_hash = excluded.segredo_hash, atualizado_em = now();
end;
$$;

revoke all on function public.autenticar_funcionario(text, text) from public;
revoke all on function public.verificar_credencial_funcionario(uuid, text) from public;
revoke all on function public.buscar_funcionarios_por_credencial(text) from public;
revoke all on function public.definir_pin_funcionario(uuid, text) from public, anon, authenticated;
grant execute on function public.autenticar_funcionario(text, text) to anon, authenticated;
grant execute on function public.verificar_credencial_funcionario(uuid, text) to anon, authenticated;
grant execute on function public.buscar_funcionarios_por_credencial(text) to anon, authenticated;
grant execute on function public.definir_pin_funcionario(uuid, text) to service_role;
