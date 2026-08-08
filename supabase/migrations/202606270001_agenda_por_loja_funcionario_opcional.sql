do $$
begin
  if to_regclass('public.agenda') is not null then
    alter table public.agenda
      alter column funcionario_id drop not null;
  elsif to_regclass('public.escala_plantoes') is not null then
    alter table public.escala_plantoes
      alter column funcionario_id drop not null;
  end if;
end $$;
