alter table if exists public.recebiveis
  add column if not exists valor numeric(12,2) not null default 0;

update public.recebiveis
set valor = 0
where valor is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'recebiveis_valor_nao_negativo_ck'
      and conrelid = 'public.recebiveis'::regclass
  ) then
    alter table public.recebiveis
      add constraint recebiveis_valor_nao_negativo_ck check (valor >= 0);
  end if;
end $$;

create index if not exists recebiveis_valor_idx
  on public.recebiveis (valor);
