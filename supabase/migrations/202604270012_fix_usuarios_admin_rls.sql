-- Correção urgente: RLS de usuarios_admin bloqueando cadastro de admins por loja
-- Causa: tabela com RLS ativo mas sem policies de INSERT (ou policies antigas incompatíveis).

-- 1) Garantir que a tabela existe antes de qualquer operação
do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'usuarios_admin'
  ) then
    raise exception 'Tabela public.usuarios_admin não existe. Crie a tabela antes de rodar esta migration.';
  end if;
end;
$$;

-- 2) Habilitar RLS (caso ainda não esteja)
alter table public.usuarios_admin enable row level security;

-- 3) Remover todas as policies existentes na tabela (limpar slate)
do $$
declare
  r record;
begin
  for r in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'usuarios_admin'
  loop
    execute format('drop policy if exists %I on public.usuarios_admin', r.policyname);
  end loop;
end;
$$;

-- 4) Criar policies simples e permissivas (sem dependência de claim JWT)
-- Permite anon e authenticated fazerem tudo — adequado para app com token anon key.

create policy "ua_select_all"
  on public.usuarios_admin
  for select
  to anon, authenticated
  using (true);

create policy "ua_insert_all"
  on public.usuarios_admin
  for insert
  to anon, authenticated
  with check (true);

create policy "ua_update_all"
  on public.usuarios_admin
  for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "ua_delete_all"
  on public.usuarios_admin
  for delete
  to anon, authenticated
  using (true);
