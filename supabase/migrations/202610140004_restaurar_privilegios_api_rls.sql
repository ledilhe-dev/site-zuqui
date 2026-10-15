-- Restaura os privilegios-base perdidos no dump/restore somente para tabelas
-- que ja possuem RLS ativa e ao menos uma policy destinada a API publica.
-- Os GRANTs nao liberam linhas: as policies continuam obrigatorias.
do $$
declare
  r record;
begin
  for r in
    select distinct c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_policies p
      on p.schemaname = n.nspname
     and p.tablename = c.relname
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and c.relrowsecurity
      and (
        'anon' = any(p.roles)
        or 'authenticated' = any(p.roles)
        or 'public' = any(p.roles)
      )
  loop
    execute format(
      'grant select, insert, update, delete on table public.%I to anon, authenticated',
      r.relname
    );
  end loop;
end $$;

-- Sequencias pertencentes a essas tabelas sao necessarias para colunas
-- serial/identity. A RLS da tabela continua protegendo cada INSERT.
do $$
declare
  r record;
begin
  for r in
    select distinct seq.relname as sequence_name
    from pg_class tbl
    join pg_namespace n on n.oid = tbl.relnamespace
    join pg_policies p
      on p.schemaname = n.nspname
     and p.tablename = tbl.relname
    join pg_depend dep
      on dep.refobjid = tbl.oid
     and dep.deptype in ('a', 'i')
    join pg_class seq
      on seq.oid = dep.objid
     and seq.relkind = 'S'
    where n.nspname = 'public'
      and tbl.relrowsecurity
      and (
        'anon' = any(p.roles)
        or 'authenticated' = any(p.roles)
        or 'public' = any(p.roles)
      )
  loop
    execute format(
      'grant usage, select on sequence public.%I to anon, authenticated',
      r.sequence_name
    );
  end loop;
end $$;

notify pgrst, 'reload schema';
