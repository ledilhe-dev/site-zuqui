create table if not exists private.bloqueios_batida_ponto (
  funcionario_id uuid primary key references public.funcionarios(id) on delete cascade,
  ultima_batida_em timestamptz not null,
  token uuid not null,
  atualizado_em timestamptz not null default now()
);

revoke all on private.bloqueios_batida_ponto from public, anon, authenticated;

create or replace function public.reservar_batida_ponto(p_funcionario_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_token uuid := gen_random_uuid();
  v_resultado uuid;
  v_agora timestamptz := clock_timestamp();
begin
  insert into private.bloqueios_batida_ponto (funcionario_id, ultima_batida_em, token, atualizado_em)
  values (p_funcionario_id, v_agora, v_token, v_agora)
  on conflict (funcionario_id) do update
    set ultima_batida_em = excluded.ultima_batida_em,
        token = excluded.token,
        atualizado_em = excluded.atualizado_em
    where private.bloqueios_batida_ponto.ultima_batida_em <= v_agora - interval '10 minutes'
  returning token into v_resultado;
  return v_resultado;
end;
$$;

create or replace function public.liberar_reserva_batida_ponto(p_funcionario_id uuid, p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public, private
as $$
begin
  delete from private.bloqueios_batida_ponto
  where funcionario_id = p_funcionario_id and token = p_token;
  return found;
end;
$$;

revoke all on function public.reservar_batida_ponto(uuid) from public;
revoke all on function public.liberar_reserva_batida_ponto(uuid, uuid) from public;
grant execute on function public.reservar_batida_ponto(uuid) to anon, authenticated;
grant execute on function public.liberar_reserva_batida_ponto(uuid, uuid) to anon, authenticated;
