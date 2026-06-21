begin;

create or replace function public.lojas_gerar_codigo_seq(p_empresa_id uuid, p_loja_id uuid default null)
returns text
language plpgsql
as $$
declare
  v_proximo integer;
begin
  perform pg_advisory_xact_lock(hashtext('lojas_codigo:' || coalesce(p_empresa_id::text, 'sem_empresa')));

  select coalesce(max(codigo::integer), 0) + 1
    into v_proximo
  from public.lojas
  where (empresa_id is not distinct from p_empresa_id)
    and (p_loja_id is null or id <> p_loja_id)
    and coalesce(trim(codigo), '') <> ''
    and codigo ~ '^[0-9]+$';

  return lpad(v_proximo::text, 3, '0');
end;
$$;

create or replace function public.lojas_set_codigo_auto_trg()
returns trigger
language plpgsql
as $$
begin
  if coalesce(trim(new.codigo), '') = '' then
    new.codigo := public.lojas_gerar_codigo_seq(new.empresa_id, new.id);
  else
    new.codigo := trim(new.codigo);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_lojas_set_codigo_auto on public.lojas;
create trigger trg_lojas_set_codigo_auto
before insert or update of empresa_id, codigo
on public.lojas
for each row
execute function public.lojas_set_codigo_auto_trg();

update public.lojas l
set codigo = public.lojas_gerar_codigo_seq(l.empresa_id, l.id)
where coalesce(trim(l.codigo), '') = '';

do $$
declare
  r record;
begin
  for r in
    select id, empresa_id,
           row_number() over (
             partition by empresa_id, trim(codigo)
             order by id
           ) as rn
    from public.lojas
    where coalesce(trim(codigo), '') <> ''
  loop
    if r.rn > 1 then
      update public.lojas
      set codigo = public.lojas_gerar_codigo_seq(r.empresa_id, r.id)
      where id = r.id;
    end if;
  end loop;
end;
$$;

create unique index if not exists lojas_empresa_codigo_uidx
  on public.lojas (empresa_id, codigo);

commit;
