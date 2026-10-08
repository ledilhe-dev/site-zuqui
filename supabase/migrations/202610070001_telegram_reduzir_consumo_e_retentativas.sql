-- Reduz invocacoes ociosas e recupera automaticamente alertas do Telegram.
-- O webhook deve ser implantado com --no-verify-jwt, pois Telegram e pg_cron
-- nao possuem um JWT de usuario do Supabase.

create or replace function public.telegram_reservar_alertas(p_limite integer default 20)
returns setof public.telegram_alertas
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Recupera entregas interrompidas e falhas transitorias, com limite para
  -- impedir repeticao infinita em chat removido ou configuracao invalida.
  update public.telegram_alertas
  set status = 'pendente', processando_em = null
  where tentativas < 5
    and (
      (status = 'processando' and processando_em < now() - interval '10 minutes')
      or (status = 'erro' and criado_em > now() - interval '7 days')
    );

  return query
  with candidatos as (
    select a.id
    from public.telegram_alertas a
    where a.status = 'pendente'
    order by a.criado_em
    for update skip locked
    limit greatest(1, least(coalesce(p_limite, 20), 100))
  )
  update public.telegram_alertas a
  set status = 'processando', processando_em = now(),
      tentativas = a.tentativas + 1, ultimo_erro = null
  from candidatos c
  where a.id = c.id
  returning a.*;
end;
$$;

revoke all on function public.telegram_reservar_alertas(integer) from public;
grant execute on function public.telegram_reservar_alertas(integer) to service_role;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'checkdiario-telegram-alertas') then
    perform cron.unschedule('checkdiario-telegram-alertas');
  end if;

  -- Antes: a cada minuto (43.200 invocacoes/mes). Agora: a cada 5 minutos
  -- (8.640/mes), preservando a deteccao de tarefas atrasadas.
  perform cron.schedule(
    'checkdiario-telegram-alertas',
    '*/5 * * * *',
    $cron$
      select net.http_post(
        url := 'https://tqfoxqbmslxoynrasltl.supabase.co/functions/v1/telegram-webhook',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := '{"origem":"cron"}'::jsonb,
        timeout_milliseconds := 50000
      );
    $cron$
  );
end;
$$;
