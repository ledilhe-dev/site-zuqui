alter table if exists public.funcionarios
  add column if not exists tempo_intervalo_minutos integer;

update public.funcionarios
set tempo_intervalo_minutos = coalesce(tempo_intervalo_minutos, 60)
where tempo_intervalo_minutos is null;

alter table if exists public.funcionarios
  alter column tempo_intervalo_minutos set default 60;

alter table if exists public.funcionarios
  drop constraint if exists funcionarios_tempo_intervalo_minutos_check;

alter table if exists public.funcionarios
  add constraint funcionarios_tempo_intervalo_minutos_check
  check (tempo_intervalo_minutos is null or tempo_intervalo_minutos between 0 and 720);
