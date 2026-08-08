do $$
declare
  v_escala_kind char;
  v_agenda_exists boolean;
begin
  select c.relkind
    into v_escala_kind
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'escala_plantoes';

  select exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'agenda'
  ) into v_agenda_exists;

  if v_escala_kind = 'r' and not v_agenda_exists then
    alter table public.escala_plantoes rename to agenda;
  elsif v_escala_kind = 'r' and v_agenda_exists then
    raise notice 'As tabelas public.agenda e public.escala_plantoes existem. Nenhuma renomeacao automatica foi feita para evitar sobrescrever dados.';
  end if;

  if to_regclass('public.agenda') is not null then
    alter table public.agenda
      alter column funcionario_id drop not null;
  end if;
end $$;

do $$
declare
  v_escala_kind char;
begin
  select c.relkind
    into v_escala_kind
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'escala_plantoes';

  if to_regclass('public.agenda') is not null and coalesce(v_escala_kind, '') <> 'r' then
    drop view if exists public.escala_plantoes;
    create view public.escala_plantoes
      with (security_invoker = true)
      as select * from public.agenda;

    grant select, insert, update, delete on public.escala_plantoes to anon, authenticated;
  end if;
end $$;

notify pgrst, 'reload schema';
