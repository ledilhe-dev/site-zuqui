create extension if not exists pgcrypto;

alter table if exists public.checklist_lancamentos
  add column if not exists data_programada date,
  add column if not exists criado_por_id uuid references public.funcionarios(id) on delete set null,
  add column if not exists criado_por_nome text,
  add column if not exists origem_lancamento text not null default 'manual',
  add column if not exists observacao_lancamento text;

update public.checklist_lancamentos
set data_programada = coalesce(
  data_programada,
  timezone('America/Sao_Paulo', lancado_em)::date,
  current_date
)
where data_programada is null;

create index if not exists checklist_lancamentos_data_programada_idx
  on public.checklist_lancamentos (data_programada);

create index if not exists checklist_lancamentos_funcionario_data_idx
  on public.checklist_lancamentos (funcionario_id, data_programada);

create table if not exists public.checklist_lancamento_eventos (
  id uuid primary key default gen_random_uuid(),
  lancamento_id uuid references public.checklist_lancamentos(id) on delete set null,
  execucao_id uuid references public.checklist_execucoes(id) on delete set null,
  tarefa_id uuid references public.tarefas(id) on delete set null,
  checklist_id uuid references public.checklists(id) on delete set null,
  funcionario_responsavel_id uuid references public.funcionarios(id) on delete set null,
  funcionario_ator_id uuid references public.funcionarios(id) on delete set null,
  funcionario_ator_nome text,
  tipo_evento text not null check (tipo_evento in ('lancado', 'agendamento_ignorado', 'iniciado', 'finalizado', 'cancelado')),
  origem_evento text not null default 'sistema',
  data_programada date,
  horario_programado time,
  registrado_em timestamptz not null default now(),
  observacao text,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists checklist_lancamento_eventos_registrado_idx
  on public.checklist_lancamento_eventos (registrado_em desc);

create index if not exists checklist_lancamento_eventos_programada_idx
  on public.checklist_lancamento_eventos (data_programada, tipo_evento);

create index if not exists checklist_lancamento_eventos_responsavel_idx
  on public.checklist_lancamento_eventos (funcionario_responsavel_id, registrado_em desc);

insert into public.checklist_lancamento_eventos (
  lancamento_id,
  tarefa_id,
  checklist_id,
  funcionario_responsavel_id,
  funcionario_ator_id,
  funcionario_ator_nome,
  tipo_evento,
  origem_evento,
  data_programada,
  horario_programado,
  registrado_em,
  observacao,
  meta
)
select
  l.id,
  l.tarefa_id,
  l.checklist_id,
  l.funcionario_id,
  l.criado_por_id,
  l.criado_por_nome,
  'lancado',
  coalesce(nullif(l.origem_lancamento, ''), 'manual'),
  l.data_programada,
  case
    when l.horario_limite is null then null
    else left(l.horario_limite::text, 5)::time
  end,
  coalesce(l.lancado_em, now()),
  coalesce(l.observacao_lancamento, 'Lançamento migrado para a auditoria.'),
  jsonb_build_object('migrado', true)
from public.checklist_lancamentos l
where not exists (
  select 1
  from public.checklist_lancamento_eventos e
  where e.lancamento_id = l.id
    and e.tipo_evento = 'lancado'
);

insert into public.checklist_lancamento_eventos (
  lancamento_id,
  execucao_id,
  tarefa_id,
  checklist_id,
  funcionario_responsavel_id,
  funcionario_ator_id,
  funcionario_ator_nome,
  tipo_evento,
  origem_evento,
  data_programada,
  horario_programado,
  registrado_em,
  observacao,
  meta
)
select
  e.lancamento_id,
  e.id,
  e.tarefa_id,
  e.checklist_id,
  e.funcionario_id,
  e.usuario_inicio_id,
  f.nome,
  'iniciado',
  'migracao',
  coalesce(l.data_programada, e.data_execucao),
  case
    when coalesce(t.horario_limite::text, l.horario_limite::text, '') = '' then null
    else left(coalesce(t.horario_limite::text, l.horario_limite::text), 5)::time
  end,
  coalesce(e.inicio_confirmado_em, e.iniciado_em, now()),
  'Início migrado para a auditoria.',
  jsonb_build_object('migrado', true)
from public.checklist_execucoes e
left join public.checklist_lancamentos l on l.id = e.lancamento_id
left join public.tarefas t on t.id = e.tarefa_id
left join public.funcionarios f on f.id = e.usuario_inicio_id
where coalesce(e.inicio_confirmado_em, e.iniciado_em) is not null
  and not exists (
    select 1
    from public.checklist_lancamento_eventos ev
    where ev.execucao_id = e.id
      and ev.tipo_evento = 'iniciado'
  );

insert into public.checklist_lancamento_eventos (
  lancamento_id,
  execucao_id,
  tarefa_id,
  checklist_id,
  funcionario_responsavel_id,
  funcionario_ator_id,
  funcionario_ator_nome,
  tipo_evento,
  origem_evento,
  data_programada,
  horario_programado,
  registrado_em,
  observacao,
  meta
)
select
  e.lancamento_id,
  e.id,
  e.tarefa_id,
  e.checklist_id,
  e.funcionario_id,
  e.usuario_fim_id,
  f.nome,
  'finalizado',
  'migracao',
  coalesce(l.data_programada, e.data_execucao),
  case
    when coalesce(t.horario_limite::text, l.horario_limite::text, '') = '' then null
    else left(coalesce(t.horario_limite::text, l.horario_limite::text), 5)::time
  end,
  coalesce(e.finalizacao_confirmada_em, e.finalizado_em, now()),
  'Finalização migrada para a auditoria.',
  jsonb_build_object('migrado', true)
from public.checklist_execucoes e
left join public.checklist_lancamentos l on l.id = e.lancamento_id
left join public.tarefas t on t.id = e.tarefa_id
left join public.funcionarios f on f.id = e.usuario_fim_id
where coalesce(e.finalizacao_confirmada_em, e.finalizado_em) is not null
  and not exists (
    select 1
    from public.checklist_lancamento_eventos ev
    where ev.execucao_id = e.id
      and ev.tipo_evento = 'finalizado'
  );