-- Telegram operacional do CheckDiário.
-- Mantém destinos, fila e deduplicação separados por empresa e loja.

create extension if not exists pgcrypto;
create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists public.telegram_destinos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  loja_id uuid references public.lojas(id) on delete cascade,
  chat_id bigint not null,
  nome text,
  ativo boolean not null default true,
  notificar_tarefa_iniciada boolean not null default true,
  notificar_tarefa_nao_iniciada boolean not null default true,
  notificar_tarefa_finalizada boolean not null default true,
  notificar_tarefa_nao_finalizada boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create unique index if not exists telegram_destinos_chat_escopo_unq
  on public.telegram_destinos (empresa_id, coalesce(loja_id, '00000000-0000-0000-0000-000000000000'::uuid), chat_id);

create index if not exists telegram_destinos_escopo_idx
  on public.telegram_destinos (empresa_id, loja_id) where ativo;

create table if not exists public.telegram_alertas (
  id uuid primary key default gen_random_uuid(),
  chave_unica text not null unique,
  tipo text not null check (tipo in (
    'tarefa_iniciada',
    'tarefa_nao_iniciada',
    'tarefa_finalizada',
    'tarefa_nao_finalizada'
  )),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  loja_id uuid not null references public.lojas(id) on delete cascade,
  lancamento_id uuid references public.checklist_lancamentos(id) on delete set null,
  execucao_id uuid references public.checklist_execucoes(id) on delete set null,
  descricao text not null,
  funcionario_id uuid references public.funcionarios(id) on delete set null,
  funcionario_nome text not null,
  horario_previsto timestamptz not null,
  horario_real timestamptz,
  status text not null default 'pendente' check (status in ('pendente', 'processando', 'enviado', 'erro')),
  tentativas integer not null default 0,
  ultimo_erro text,
  criado_em timestamptz not null default now(),
  processando_em timestamptz,
  enviado_em timestamptz
);

create index if not exists telegram_alertas_fila_idx
  on public.telegram_alertas (status, criado_em);
create index if not exists telegram_alertas_escopo_idx
  on public.telegram_alertas (empresa_id, loja_id, criado_em desc);

alter table public.telegram_destinos enable row level security;
alter table public.telegram_alertas enable row level security;

revoke all on public.telegram_destinos from anon, authenticated;
revoke all on public.telegram_alertas from anon, authenticated;

create or replace function public.telegram_horario_previsto(
  p_data date,
  p_horario text
) returns timestamptz
language sql
immutable
as $$
  select ((p_data::text || ' ' || left(p_horario, 5))::timestamp at time zone 'America/Sao_Paulo');
$$;

create or replace function public.telegram_enfileirar_evento_execucao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lancamento public.checklist_lancamentos%rowtype;
  v_tipo text;
  v_funcionario_id uuid;
  v_funcionario_nome text;
  v_horario_real timestamptz;
  v_horario_previsto timestamptz;
begin
  if tg_op = 'INSERT' and new.status in ('aberto', 'pausado', 'finalizado') then
    v_tipo := 'tarefa_iniciada';
  elsif tg_op = 'UPDATE'
    and old.status is distinct from new.status
    and new.status = 'finalizado' then
    v_tipo := 'tarefa_finalizada';
  else
    return new;
  end if;

  select * into v_lancamento
  from public.checklist_lancamentos
  where id = new.lancamento_id;

  if v_lancamento.id is null
    or coalesce(new.empresa_id, v_lancamento.empresa_id) is null
    or coalesce(new.loja_id, v_lancamento.loja_id) is null
    or v_lancamento.data_programada is null
    or nullif(v_lancamento.horario_limite, '') is null then
    return new;
  end if;

  if v_tipo = 'tarefa_iniciada' then
    v_funcionario_id := coalesce(new.usuario_inicio_id, new.funcionario_id);
    v_horario_real := coalesce(new.inicio_confirmado_em, new.iniciado_em, new.created_at);
  else
    v_funcionario_id := coalesce(new.usuario_fim_id, new.funcionario_id);
    v_horario_real := coalesce(new.finalizacao_confirmada_em, new.finalizado_em, now());
  end if;

  select nome into v_funcionario_nome
  from public.funcionarios
  where id = v_funcionario_id;

  v_horario_previsto := public.telegram_horario_previsto(
    v_lancamento.data_programada,
    v_lancamento.horario_limite
  );

  insert into public.telegram_alertas (
    chave_unica, tipo, empresa_id, loja_id, lancamento_id, execucao_id,
    descricao, funcionario_id, funcionario_nome, horario_previsto, horario_real
  ) values (
    v_tipo || ':' || new.id::text,
    v_tipo,
    coalesce(new.empresa_id, v_lancamento.empresa_id),
    coalesce(new.loja_id, v_lancamento.loja_id),
    v_lancamento.id,
    new.id,
    coalesce(nullif(v_lancamento.descricao, ''), nullif(v_lancamento.nome, ''), 'Tarefa sem descrição'),
    v_funcionario_id,
    coalesce(nullif(v_funcionario_nome, ''), 'Funcionário não identificado'),
    v_horario_previsto,
    v_horario_real
  ) on conflict (chave_unica) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_telegram_execucao_evento on public.checklist_execucoes;
create trigger trg_telegram_execucao_evento
after insert or update of status on public.checklist_execucoes
for each row execute function public.telegram_enfileirar_evento_execucao();

create or replace function public.telegram_enfileirar_atrasos()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inseridos integer := 0;
  v_linhas integer;
begin
  insert into public.telegram_alertas (
    chave_unica, tipo, empresa_id, loja_id, lancamento_id, execucao_id,
    descricao, funcionario_id, funcionario_nome, horario_previsto, horario_real
  )
  select
    'tarefa_nao_iniciada:' || l.id::text,
    'tarefa_nao_iniciada',
    l.empresa_id,
    l.loja_id,
    l.id,
    null,
    coalesce(nullif(l.descricao, ''), nullif(l.nome, ''), 'Tarefa sem descrição'),
    l.funcionario_id,
    coalesce(nullif(f.nome, ''), 'Funcionário responsável não identificado'),
    public.telegram_horario_previsto(l.data_programada, l.horario_limite),
    null
  from public.checklist_lancamentos l
  left join public.funcionarios f on f.id = l.funcionario_id
  where l.status = 'pendente'
    and l.empresa_id is not null
    and l.loja_id is not null
    and l.data_programada is not null
    and nullif(l.horario_limite, '') is not null
    and public.telegram_horario_previsto(l.data_programada, l.horario_limite) < now()
    and not exists (
      select 1 from public.checklist_execucoes e where e.lancamento_id = l.id
    )
  on conflict (chave_unica) do nothing;
  get diagnostics v_linhas = row_count;
  v_inseridos := v_inseridos + v_linhas;

  insert into public.telegram_alertas (
    chave_unica, tipo, empresa_id, loja_id, lancamento_id, execucao_id,
    descricao, funcionario_id, funcionario_nome, horario_previsto, horario_real
  )
  select
    'tarefa_nao_finalizada:' || e.id::text,
    'tarefa_nao_finalizada',
    coalesce(e.empresa_id, l.empresa_id),
    coalesce(e.loja_id, l.loja_id),
    l.id,
    e.id,
    coalesce(nullif(l.descricao, ''), nullif(l.nome, ''), 'Tarefa sem descrição'),
    coalesce(e.usuario_inicio_id, e.funcionario_id),
    coalesce(nullif(f.nome, ''), 'Funcionário não identificado'),
    public.telegram_horario_previsto(l.data_programada, l.horario_limite),
    coalesce(e.inicio_confirmado_em, e.iniciado_em)
  from public.checklist_execucoes e
  join public.checklist_lancamentos l on l.id = e.lancamento_id
  left join public.funcionarios f on f.id = coalesce(e.usuario_inicio_id, e.funcionario_id)
  where e.status in ('aberto', 'pausado')
    and coalesce(e.empresa_id, l.empresa_id) is not null
    and coalesce(e.loja_id, l.loja_id) is not null
    and l.data_programada is not null
    and nullif(l.horario_limite, '') is not null
    and public.telegram_horario_previsto(l.data_programada, l.horario_limite) < now()
  on conflict (chave_unica) do nothing;
  get diagnostics v_linhas = row_count;

  return v_inseridos + v_linhas;
end;
$$;

create or replace function public.telegram_reservar_alertas(p_limite integer default 20)
returns setof public.telegram_alertas
language plpgsql
security definer
set search_path = public
as $$
begin
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
  set status = 'processando',
      processando_em = now(),
      tentativas = a.tentativas + 1,
      ultimo_erro = null
  from candidatos c
  where a.id = c.id
  returning a.*;
end;
$$;

revoke all on function public.telegram_enfileirar_atrasos() from public;
revoke all on function public.telegram_reservar_alertas(integer) from public;
grant execute on function public.telegram_enfileirar_atrasos() to service_role;
grant execute on function public.telegram_reservar_alertas(integer) to service_role;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'checkdiario-telegram-alertas') then
    perform cron.unschedule('checkdiario-telegram-alertas');
  end if;

  perform cron.schedule(
    'checkdiario-telegram-alertas',
    '* * * * *',
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

comment on table public.telegram_destinos is
  'Chats do Telegram habilitados por empresa e, opcionalmente, por loja.';
comment on table public.telegram_alertas is
  'Fila deduplicada dos quatro alertas operacionais do CheckDiário.';
