create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.credenciais_sistema (
  tipo text not null check (tipo in ('funcionario', 'usuario_admin')),
  entidade_id uuid not null,
  finalidade text not null check (finalidade in ('login', 'pin')),
  segredo_hash text not null,
  atualizado_em timestamptz not null default now(),
  primary key (tipo, entidade_id, finalidade)
);

revoke all on private.credenciais_sistema from public, anon, authenticated;

-- O segredo legado passa a funcionar como PIN operacional e, temporariamente,
-- como senha de login. O login legado recebe troca obrigatória por e-mail.
alter table public.funcionarios add column if not exists senha_troca_obrigatoria boolean not null default false;
alter table public.usuarios_admin add column if not exists senha_troca_obrigatoria boolean not null default false;
alter table public.empresas add column if not exists cnpj text;
create unique index if not exists ux_empresas_cnpj
  on public.empresas ((regexp_replace(coalesce(cnpj, ''), '[^0-9]', '', 'g')))
  where regexp_replace(coalesce(cnpj, ''), '[^0-9]', '', 'g') <> '';
alter table public.solicitacoes_acesso add column if not exists cnpj text;
alter table public.solicitacoes_acesso add column if not exists observacao text;
alter table public.solicitacoes_acesso add column if not exists funcionario_localizado_id uuid references public.funcionarios(id) on delete set null;

create or replace function private.localizar_solicitacao_acesso()
returns trigger
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_cnpj text := regexp_replace(coalesce(new.cnpj, ''), '[^0-9]', '', 'g');
begin
  if length(v_cnpj) = 14 then
    select e.id into new.empresa_id
    from public.empresas e
    where regexp_replace(coalesce(e.cnpj, ''), '[^0-9]', '', 'g') = v_cnpj
      and e.ativo is true
    limit 1;
  end if;

  if new.empresa_id is not null then
    select f.id into new.funcionario_localizado_id
    from public.funcionarios f
    where f.empresa_id = new.empresa_id
      and lower(trim(regexp_replace(f.nome, '[[:space:]]+', ' ', 'g'))) = lower(trim(regexp_replace(new.nome, '[[:space:]]+', ' ', 'g')))
    order by f.ativo desc
    limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_localizar_solicitacao_acesso on public.solicitacoes_acesso;
create trigger trg_localizar_solicitacao_acesso
before insert or update of nome, cnpj on public.solicitacoes_acesso
for each row execute function private.localizar_solicitacao_acesso();

insert into private.credenciais_sistema (tipo, entidade_id, finalidade, segredo_hash)
select 'funcionario', f.id, finalidade, extensions.crypt(trim(f.pin::text), extensions.gen_salt('bf', 12))
from public.funcionarios f
cross join (values ('login'), ('pin')) as destinos(finalidade)
where nullif(trim(f.pin::text), '') is not null
on conflict (tipo, entidade_id, finalidade) do update
set segredo_hash = excluded.segredo_hash, atualizado_em = now();

insert into private.credenciais_sistema (tipo, entidade_id, finalidade, segredo_hash)
select 'usuario_admin', a.id, finalidade, extensions.crypt(trim(a.pin::text), extensions.gen_salt('bf', 12))
from public.usuarios_admin a
cross join (values ('login'), ('pin')) as destinos(finalidade)
where nullif(trim(a.pin::text), '') is not null
on conflict (tipo, entidade_id, finalidade) do update
set segredo_hash = excluded.segredo_hash, atualizado_em = now();

update public.funcionarios set senha_troca_obrigatoria = true where pin is not null;
update public.usuarios_admin set senha_troca_obrigatoria = true where pin is not null;

alter table public.funcionarios alter column pin drop not null;
alter table public.usuarios_admin alter column pin drop not null;
update public.funcionarios set pin = null where pin is not null;
update public.usuarios_admin set pin = null where pin is not null;
alter table public.solicitacoes_acesso alter column pin drop not null;
update public.solicitacoes_acesso set pin = null where pin is not null;

create or replace function private.capturar_credencial_publica()
returns trigger
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_tipo text := tg_argv[0];
  v_segredo text := nullif(trim(new.pin::text), '');
  v_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
begin
  if v_segredo is not null then
    if v_role not in ('service_role') and session_user not in ('postgres', 'supabase_admin') then
      raise exception 'A senha deve ser alterada pelo fluxo seguro do sistema.' using errcode = '42501';
    end if;
    if length(v_segredo) < 4 then
      raise exception 'A senha deve ter pelo menos 4 caracteres.' using errcode = '22023';
    end if;

    insert into private.credenciais_sistema (tipo, entidade_id, finalidade, segredo_hash)
    values (v_tipo, new.id, 'pin', extensions.crypt(v_segredo, extensions.gen_salt('bf', 12)))
    on conflict (tipo, entidade_id, finalidade) do update
    set segredo_hash = excluded.segredo_hash, atualizado_em = now();
  end if;

  -- A coluna pública permanece nula; nenhum hash ou senha chega ao navegador.
  new.pin := null;
  return new;
end;
$$;

drop trigger if exists trg_credencial_segura_funcionario on public.funcionarios;
create trigger trg_credencial_segura_funcionario
before insert or update of pin on public.funcionarios
for each row execute function private.capturar_credencial_publica('funcionario');

drop trigger if exists trg_credencial_segura_usuario_admin on public.usuarios_admin;
create trigger trg_credencial_segura_usuario_admin
before insert or update of pin on public.usuarios_admin
for each row execute function private.capturar_credencial_publica('usuario_admin');

create or replace function public.autenticar_funcionario(p_identificador text, p_senha text)
returns jsonb
language sql
security definer
set search_path = public, private, extensions
as $$
  select (to_jsonb(f) - 'pin') || jsonb_build_object('perfis', to_jsonb(p))
  from public.funcionarios f
  join private.credenciais_sistema c
    on c.tipo = 'funcionario' and c.entidade_id = f.id and c.finalidade = 'login'
  left join public.perfis p on p.id = f.perfil_id
  where f.ativo is true
    and nullif(trim(p_identificador), '') is not null
    and nullif(trim(p_senha), '') is not null
    and (
      lower(trim(coalesce(f.email, ''))) = lower(trim(p_identificador))
      or (f.senha_troca_obrigatoria is true and lower(trim(coalesce(f.nome, ''))) = lower(trim(p_identificador)))
    )
    and c.segredo_hash = extensions.crypt(trim(p_senha), c.segredo_hash)
  order by
    case when lower(trim(coalesce(f.email, ''))) = lower(trim(p_identificador)) then 0
         when lower(trim(coalesce(f.nome, ''))) = lower(trim(p_identificador)) then 1
         else 2 end,
    f.nome
  limit 1;
$$;

create or replace function public.autenticar_usuario_admin(p_identificador text, p_senha text)
returns jsonb
language sql
security definer
set search_path = public, private, extensions
as $$
  select to_jsonb(a) - 'pin'
  from public.usuarios_admin a
  join private.credenciais_sistema c
    on c.tipo = 'usuario_admin' and c.entidade_id = a.id and c.finalidade = 'login'
  where a.ativo is true
    and nullif(trim(p_identificador), '') is not null
    and nullif(trim(p_senha), '') is not null
    and (
      lower(trim(coalesce(a.usuario, ''))) = lower(trim(p_identificador))
      or lower(trim(coalesce(a.nome, ''))) = lower(trim(p_identificador))
    )
    and c.segredo_hash = extensions.crypt(trim(p_senha), c.segredo_hash)
  order by case when lower(trim(coalesce(a.usuario, ''))) = lower(trim(p_identificador)) then 0 else 1 end
  limit 1;
$$;

create or replace function public.verificar_credencial_funcionario(p_funcionario_id uuid, p_senha text)
returns boolean
language sql
security definer
set search_path = public, private, extensions
as $$
  select exists (
    select 1
    from private.credenciais_sistema c
    join public.funcionarios f on f.id = c.entidade_id
    where c.tipo = 'funcionario'
      and c.finalidade = 'pin'
      and c.entidade_id = p_funcionario_id
      and f.ativo is true
      and nullif(trim(p_senha), '') is not null
      and c.segredo_hash = extensions.crypt(trim(p_senha), c.segredo_hash)
  );
$$;

create or replace function public.verificar_credencial_usuario_admin(p_usuario_id uuid, p_senha text)
returns boolean
language sql
security definer
set search_path = public, private, extensions
as $$
  select exists (
    select 1
    from private.credenciais_sistema c
    join public.usuarios_admin a on a.id = c.entidade_id
    where c.tipo = 'usuario_admin'
      and c.finalidade = 'login'
      and c.entidade_id = p_usuario_id
      and a.ativo is true
      and nullif(trim(p_senha), '') is not null
      and c.segredo_hash = extensions.crypt(trim(p_senha), c.segredo_hash)
  );
$$;

create or replace function public.verificar_pin_usuario_admin(p_usuario_id uuid, p_pin text)
returns boolean
language sql
security definer
set search_path = public, private, extensions
as $$
  select exists (
    select 1
    from private.credenciais_sistema c
    join public.usuarios_admin a on a.id = c.entidade_id
    where c.tipo = 'usuario_admin'
      and c.finalidade = 'pin'
      and c.entidade_id = p_usuario_id
      and a.ativo is true
      and nullif(trim(p_pin), '') is not null
      and c.segredo_hash = extensions.crypt(trim(p_pin), c.segredo_hash)
  );
$$;

create or replace function public.buscar_funcionarios_por_credencial(p_senha text)
returns jsonb
language sql
security definer
set search_path = public, private, extensions
as $$
  select coalesce(jsonb_agg(to_jsonb(f) - 'pin' order by f.nome), '[]'::jsonb)
  from public.funcionarios f
  join private.credenciais_sistema c
    on c.tipo = 'funcionario' and c.entidade_id = f.id and c.finalidade = 'pin'
  where f.ativo is true
    and nullif(trim(p_senha), '') is not null
    and c.segredo_hash = extensions.crypt(trim(p_senha), c.segredo_hash);
$$;

create or replace function public.credencial_funcionario_em_uso(p_senha text, p_ignorar_id uuid default null)
returns boolean
language sql
security definer
set search_path = public, private, extensions
as $$
  select exists (
    select 1 from private.credenciais_sistema c
    where c.tipo = 'funcionario'
      and c.finalidade = 'pin'
      and (p_ignorar_id is null or c.entidade_id <> p_ignorar_id)
      and nullif(trim(p_senha), '') is not null
      and c.segredo_hash = extensions.crypt(trim(p_senha), c.segredo_hash)
  );
$$;

create or replace function public.definir_credencial_funcionario(p_funcionario_id uuid, p_nova_senha text)
returns void
language plpgsql
security definer
set search_path = public, private, extensions
as $$
begin
  if length(trim(coalesce(p_nova_senha, ''))) < 8 then
    raise exception 'A nova senha deve ter pelo menos 8 caracteres.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.funcionarios where id = p_funcionario_id) then
    raise exception 'Funcionário não encontrado.' using errcode = 'P0002';
  end if;
  insert into private.credenciais_sistema (tipo, entidade_id, finalidade, segredo_hash)
  values ('funcionario', p_funcionario_id, 'login', extensions.crypt(trim(p_nova_senha), extensions.gen_salt('bf', 12)))
  on conflict (tipo, entidade_id, finalidade) do update
  set segredo_hash = excluded.segredo_hash, atualizado_em = now();
  update public.funcionarios set pin = null, senha_troca_obrigatoria = false where id = p_funcionario_id;
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
  values ('funcionario', p_funcionario_id, 'pin', extensions.crypt(trim(p_novo_pin), extensions.gen_salt('bf', 12)))
  on conflict (tipo, entidade_id, finalidade) do update
  set segredo_hash = excluded.segredo_hash, atualizado_em = now();
  update public.funcionarios set pin = null where id = p_funcionario_id;
end;
$$;

create or replace function public.definir_credencial_usuario_admin(p_usuario_id uuid, p_nova_senha text)
returns void
language plpgsql
security definer
set search_path = public, private, extensions
as $$
begin
  if length(trim(coalesce(p_nova_senha, ''))) < 8 then
    raise exception 'A nova senha deve ter pelo menos 8 caracteres.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.usuarios_admin where id = p_usuario_id) then
    raise exception 'Administrador não encontrado.' using errcode = 'P0002';
  end if;
  insert into private.credenciais_sistema (tipo, entidade_id, finalidade, segredo_hash)
  values ('usuario_admin', p_usuario_id, 'login', extensions.crypt(trim(p_nova_senha), extensions.gen_salt('bf', 12)))
  on conflict (tipo, entidade_id, finalidade) do update
  set segredo_hash = excluded.segredo_hash, atualizado_em = now();
  update public.usuarios_admin set pin = null, senha_troca_obrigatoria = false where id = p_usuario_id;
end;
$$;

create or replace function public.definir_pin_usuario_admin(p_usuario_id uuid, p_novo_pin text)
returns void
language plpgsql
security definer
set search_path = public, private, extensions
as $$
begin
  if length(trim(coalesce(p_novo_pin, ''))) < 4 then
    raise exception 'O PIN deve ter pelo menos 4 caracteres.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.usuarios_admin where id = p_usuario_id) then
    raise exception 'Administrador não encontrado.' using errcode = 'P0002';
  end if;
  insert into private.credenciais_sistema (tipo, entidade_id, finalidade, segredo_hash)
  values ('usuario_admin', p_usuario_id, 'pin', extensions.crypt(trim(p_novo_pin), extensions.gen_salt('bf', 12)))
  on conflict (tipo, entidade_id, finalidade) do update
  set segredo_hash = excluded.segredo_hash, atualizado_em = now();
  update public.usuarios_admin set pin = null where id = p_usuario_id;
end;
$$;

revoke all on function public.definir_credencial_funcionario(uuid, text) from public, anon, authenticated;
revoke all on function public.definir_pin_funcionario(uuid, text) from public, anon, authenticated;
revoke all on function public.definir_credencial_usuario_admin(uuid, text) from public, anon, authenticated;
revoke all on function public.definir_pin_usuario_admin(uuid, text) from public, anon, authenticated;
grant execute on function public.definir_credencial_funcionario(uuid, text) to service_role;
grant execute on function public.definir_pin_funcionario(uuid, text) to service_role;
grant execute on function public.definir_credencial_usuario_admin(uuid, text) to service_role;
grant execute on function public.definir_pin_usuario_admin(uuid, text) to service_role;

revoke all on function public.autenticar_funcionario(text, text) from public;
revoke all on function public.autenticar_usuario_admin(text, text) from public;
revoke all on function public.verificar_credencial_funcionario(uuid, text) from public;
revoke all on function public.verificar_credencial_usuario_admin(uuid, text) from public;
revoke all on function public.verificar_pin_usuario_admin(uuid, text) from public;
revoke all on function public.buscar_funcionarios_por_credencial(text) from public;
revoke all on function public.credencial_funcionario_em_uso(text, uuid) from public;

grant execute on function public.autenticar_funcionario(text, text) to anon, authenticated;
grant execute on function public.autenticar_usuario_admin(text, text) to anon, authenticated;
grant execute on function public.verificar_credencial_funcionario(uuid, text) to anon, authenticated;
grant execute on function public.verificar_credencial_usuario_admin(uuid, text) to anon, authenticated;
grant execute on function public.verificar_pin_usuario_admin(uuid, text) to anon, authenticated;
grant execute on function public.buscar_funcionarios_por_credencial(text) to anon, authenticated;
grant execute on function public.credencial_funcionario_em_uso(text, uuid) to anon, authenticated;
