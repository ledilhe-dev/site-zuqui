do $$
begin
  if to_regclass('public.agenda') is not null then
    update public.agenda a
       set empresa_id = l.empresa_id
      from public.lojas l
     where a.loja_id = l.id
       and a.empresa_id is null
       and l.empresa_id is not null;

    if exists (select 1 from public.agenda where loja_id is null) then
      raise exception 'Nao foi possivel obrigar agenda.loja_id: existem registros de agenda sem loja_id.';
    end if;

    alter table public.agenda
      alter column loja_id set not null;
  end if;
end $$;

create or replace function public.fn_agenda_tenant_from_loja()
returns trigger
language plpgsql
as $$
begin
  if new.loja_id is null then
    raise exception 'agenda.loja_id nao pode ser nulo.';
  end if;

  if new.empresa_id is null then
    select l.empresa_id
      into new.empresa_id
    from public.lojas l
    where l.id = new.loja_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_agenda_tenant_from_loja on public.agenda;
create trigger trg_agenda_tenant_from_loja
before insert or update on public.agenda
for each row
execute function public.fn_agenda_tenant_from_loja();

notify pgrst, 'reload schema';
