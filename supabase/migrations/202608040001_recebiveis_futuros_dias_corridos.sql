alter table public.recebiveis_futuros
  add column if not exists sequencial_dias_corridos boolean not null default false;

comment on column public.recebiveis_futuros.sequencial_dias_corridos is
  'Quando true, a recorrencia usa dias corridos e inclui finais de semana e feriados; quando false, avanca para o proximo dia util.';
