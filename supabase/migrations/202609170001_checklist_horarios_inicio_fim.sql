-- Separa o início previsto do prazo de conclusão das programações.
-- horario_limite é preservado como legado e continua espelhando o início.

alter table public.checklist_lancamentos
  add column if not exists horario_inicio time without time zone,
  add column if not exists horario_fim time without time zone;

update public.checklist_lancamentos
set horario_inicio = left(horario_limite, 5)::time
where horario_inicio is null
  and nullif(horario_limite, '') is not null;

-- A regra anterior alertava uma hora depois do início real. Para preservar uma
-- janela equivalente nos registros legados, o fim previsto recebe início + 1h.
update public.checklist_lancamentos
set horario_fim = (horario_inicio + interval '1 hour')::time
where horario_fim is null
  and horario_inicio is not null;

comment on column public.checklist_lancamentos.horario_inicio is
  'Horário em que a ocorrência deve ser iniciada.';
comment on column public.checklist_lancamentos.horario_fim is
  'Prazo máximo para finalizar a ocorrência; pode cair no dia seguinte quando menor que o início.';
comment on column public.checklist_lancamentos.horario_limite is
  'Campo legado, mantido por compatibilidade e espelhado a partir de horario_inicio.';

alter table public.telegram_alertas
  add column if not exists funcionario_inicio_id uuid references public.funcionarios(id) on delete set null,
  add column if not exists funcionario_inicio_nome text,
  add column if not exists funcionario_fim_id uuid references public.funcionarios(id) on delete set null,
  add column if not exists funcionario_fim_nome text,
  add column if not exists inicio_previsto timestamptz,
  add column if not exists inicio_real timestamptz,
  add column if not exists fim_previsto timestamptz,
  add column if not exists finalizacao_real timestamptz;

create or replace function public.telegram_horario_programado(
  p_data date,
  p_horario time without time zone,
  p_horario_inicio time without time zone default null
) returns timestamptz
language sql
immutable
as $$
  select (
    (p_data + case
      when p_horario_inicio is not null and p_horario <= p_horario_inicio then 1
      else 0
    end)::text || ' ' || p_horario::text
  )::timestamp at time zone 'America/Sao_Paulo';
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
  v_inicio_id uuid;
  v_fim_id uuid;
  v_inicio_nome text;
  v_fim_nome text;
  v_inicio_real timestamptz;
  v_finalizacao_real timestamptz;
  v_inicio_hora time;
  v_fim_hora time;
  v_inicio_previsto timestamptz;
  v_fim_previsto timestamptz;
begin
  if tg_op = 'INSERT' and new.status in ('aberto', 'pausado', 'finalizado') then
    v_tipo := 'tarefa_iniciada';
  elsif tg_op = 'UPDATE' and old.status is distinct from new.status and new.status = 'finalizado' then
    v_tipo := 'tarefa_finalizada';
  else
    return new;
  end if;

  select * into v_lancamento from public.checklist_lancamentos where id = new.lancamento_id;
  v_inicio_hora := coalesce(v_lancamento.horario_inicio, nullif(v_lancamento.horario_limite, '')::time);
  v_fim_hora := coalesce(v_lancamento.horario_fim, v_inicio_hora + interval '1 hour');
  if v_lancamento.id is null or v_lancamento.data_programada is null
    or v_inicio_hora is null or v_fim_hora is null
    or coalesce(new.empresa_id, v_lancamento.empresa_id) is null
    or coalesce(new.loja_id, v_lancamento.loja_id) is null then
    return new;
  end if;

  v_inicio_id := coalesce(new.usuario_inicio_id, new.funcionario_id);
  v_fim_id := new.usuario_fim_id;
  v_inicio_real := coalesce(new.inicio_confirmado_em, new.iniciado_em, new.created_at);
  v_finalizacao_real := coalesce(new.finalizacao_confirmada_em, new.finalizado_em);
  select nome into v_inicio_nome from public.funcionarios where id = v_inicio_id;
  select nome into v_fim_nome from public.funcionarios where id = v_fim_id;
  v_inicio_previsto := public.telegram_horario_programado(v_lancamento.data_programada, v_inicio_hora);
  v_fim_previsto := public.telegram_horario_programado(v_lancamento.data_programada, v_fim_hora, v_inicio_hora);

  insert into public.telegram_alertas (
    chave_unica, tipo, empresa_id, loja_id, lancamento_id, execucao_id,
    descricao, funcionario_id, funcionario_nome, horario_previsto, horario_real,
    funcionario_inicio_id, funcionario_inicio_nome, funcionario_fim_id, funcionario_fim_nome,
    inicio_previsto, inicio_real, fim_previsto, finalizacao_real
  ) values (
    v_tipo || ':' || new.id::text, v_tipo,
    coalesce(new.empresa_id, v_lancamento.empresa_id), coalesce(new.loja_id, v_lancamento.loja_id),
    v_lancamento.id, new.id,
    coalesce(nullif(v_lancamento.descricao, ''), nullif(v_lancamento.nome, ''), 'Tarefa sem descrição'),
    case when v_tipo = 'tarefa_finalizada' then v_fim_id else v_inicio_id end,
    case when v_tipo = 'tarefa_finalizada' then coalesce(v_fim_nome, 'Funcionário não identificado') else coalesce(v_inicio_nome, 'Funcionário não identificado') end,
    case when v_tipo = 'tarefa_finalizada' then v_fim_previsto else v_inicio_previsto end,
    case when v_tipo = 'tarefa_finalizada' then v_finalizacao_real else v_inicio_real end,
    v_inicio_id, coalesce(v_inicio_nome, 'Funcionário não identificado'),
    v_fim_id, v_fim_nome,
    v_inicio_previsto, v_inicio_real, v_fim_previsto, v_finalizacao_real
  ) on conflict (chave_unica) do nothing;

  return new;
end;
$$;

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
    descricao, funcionario_id, funcionario_nome, horario_previsto, horario_real,
    inicio_previsto, fim_previsto
  )
  select
    'tarefa_nao_iniciada:' || l.id, 'tarefa_nao_iniciada', l.empresa_id, l.loja_id, l.id, null,
    coalesce(nullif(l.descricao, ''), nullif(l.nome, ''), 'Tarefa sem descrição'),
    l.funcionario_id, coalesce(nullif(f.nome, ''), 'Funcionário responsável não identificado'),
    public.telegram_horario_programado(l.data_programada, coalesce(l.horario_inicio, nullif(l.horario_limite, '')::time)), null,
    public.telegram_horario_programado(l.data_programada, coalesce(l.horario_inicio, nullif(l.horario_limite, '')::time)),
    public.telegram_horario_programado(l.data_programada, coalesce(l.horario_fim, coalesce(l.horario_inicio, nullif(l.horario_limite, '')::time) + interval '1 hour'), coalesce(l.horario_inicio, nullif(l.horario_limite, '')::time))
  from public.checklist_lancamentos l
  left join public.funcionarios f on f.id = l.funcionario_id
  where l.status = 'pendente' and l.empresa_id is not null and l.loja_id is not null
    and l.data_programada is not null
    and coalesce(l.horario_inicio, nullif(l.horario_limite, '')::time) is not null
    and public.telegram_horario_programado(l.data_programada, coalesce(l.horario_inicio, nullif(l.horario_limite, '')::time)) < now()
    and not exists (select 1 from public.checklist_execucoes e where e.lancamento_id = l.id)
  on conflict (chave_unica) do nothing;
  get diagnostics v_linhas = row_count;
  v_inseridos := v_inseridos + v_linhas;

  insert into public.telegram_alertas (
    chave_unica, tipo, empresa_id, loja_id, lancamento_id, execucao_id,
    descricao, funcionario_id, funcionario_nome, horario_previsto, horario_real,
    funcionario_inicio_id, funcionario_inicio_nome, inicio_previsto, inicio_real, fim_previsto
  )
  select
    'tarefa_nao_finalizada:' || e.id, 'tarefa_nao_finalizada',
    coalesce(e.empresa_id, l.empresa_id), coalesce(e.loja_id, l.loja_id), l.id, e.id,
    coalesce(nullif(l.descricao, ''), nullif(l.nome, ''), 'Tarefa sem descrição'),
    coalesce(e.usuario_inicio_id, e.funcionario_id), coalesce(nullif(f.nome, ''), 'Funcionário não identificado'),
    public.telegram_horario_programado(l.data_programada, coalesce(l.horario_fim, coalesce(l.horario_inicio, nullif(l.horario_limite, '')::time) + interval '1 hour'), coalesce(l.horario_inicio, nullif(l.horario_limite, '')::time)),
    coalesce(e.inicio_confirmado_em, e.iniciado_em),
    coalesce(e.usuario_inicio_id, e.funcionario_id), coalesce(nullif(f.nome, ''), 'Funcionário não identificado'),
    public.telegram_horario_programado(l.data_programada, coalesce(l.horario_inicio, nullif(l.horario_limite, '')::time)),
    coalesce(e.inicio_confirmado_em, e.iniciado_em),
    public.telegram_horario_programado(l.data_programada, coalesce(l.horario_fim, coalesce(l.horario_inicio, nullif(l.horario_limite, '')::time) + interval '1 hour'), coalesce(l.horario_inicio, nullif(l.horario_limite, '')::time))
  from public.checklist_execucoes e
  join public.checklist_lancamentos l on l.id = e.lancamento_id
  left join public.funcionarios f on f.id = coalesce(e.usuario_inicio_id, e.funcionario_id)
  where e.status in ('aberto', 'pausado')
    and coalesce(e.empresa_id, l.empresa_id) is not null and coalesce(e.loja_id, l.loja_id) is not null
    and l.data_programada is not null
    and coalesce(l.horario_fim, coalesce(l.horario_inicio, nullif(l.horario_limite, '')::time) + interval '1 hour') is not null
    and public.telegram_horario_programado(l.data_programada, coalesce(l.horario_fim, coalesce(l.horario_inicio, nullif(l.horario_limite, '')::time) + interval '1 hour'), coalesce(l.horario_inicio, nullif(l.horario_limite, '')::time)) < now()
  on conflict (chave_unica) do nothing;
  get diagnostics v_linhas = row_count;
  return v_inseridos + v_linhas;
end;
$$;
