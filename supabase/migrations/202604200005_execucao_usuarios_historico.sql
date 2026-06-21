create extension if not exists pgcrypto;

alter table if exists public.checklist_execucoes
  add column if not exists usuario_inicio_id uuid references public.funcionarios(id) on delete set null,
  add column if not exists usuario_fim_id uuid references public.funcionarios(id) on delete set null,
  add column if not exists inicio_confirmado_em timestamptz,
  add column if not exists finalizacao_confirmada_em timestamptz;

create table if not exists public.checklist_execucao_usuarios (
  id uuid primary key default gen_random_uuid(),
  execucao_id uuid not null references public.checklist_execucoes(id) on delete cascade,
  tipo_acao text not null check (tipo_acao in ('inicio', 'finalizacao')),
  funcionario_id uuid not null references public.funcionarios(id) on delete restrict,
  funcionario_responsavel_id uuid references public.funcionarios(id) on delete set null,
  tarefa_id uuid references public.tarefas(id) on delete set null,
  checklist_id uuid references public.checklists(id) on delete set null,
  registrado_em timestamptz not null default timezone('utc', now())
);

create index if not exists checklist_execucao_usuarios_execucao_idx
  on public.checklist_execucao_usuarios (execucao_id, registrado_em desc);

create index if not exists checklist_execucao_usuarios_funcionario_idx
  on public.checklist_execucao_usuarios (funcionario_id, registrado_em desc);

create index if not exists checklist_execucao_usuarios_tipo_idx
  on public.checklist_execucao_usuarios (tipo_acao, registrado_em desc);

update public.checklist_execucoes
set usuario_inicio_id = coalesce(usuario_inicio_id, funcionario_id),
    inicio_confirmado_em = coalesce(inicio_confirmado_em, iniciado_em)
where usuario_inicio_id is null;

update public.checklist_execucoes
set usuario_fim_id = coalesce(usuario_fim_id, funcionario_id),
    finalizacao_confirmada_em = coalesce(finalizacao_confirmada_em, finalizado_em)
where finalizado_em is not null
  and usuario_fim_id is null;

insert into public.checklist_execucao_usuarios (
  execucao_id,
  tipo_acao,
  funcionario_id,
  funcionario_responsavel_id,
  tarefa_id,
  checklist_id,
  registrado_em
)
select
  e.id,
  'inicio',
  coalesce(e.usuario_inicio_id, e.funcionario_id),
  e.funcionario_id,
  e.tarefa_id,
  e.checklist_id,
  coalesce(e.inicio_confirmado_em, e.iniciado_em, timezone('utc', now()))
from public.checklist_execucoes e
where coalesce(e.usuario_inicio_id, e.funcionario_id) is not null
  and not exists (
    select 1
    from public.checklist_execucao_usuarios h
    where h.execucao_id = e.id
      and h.tipo_acao = 'inicio'
  );

insert into public.checklist_execucao_usuarios (
  execucao_id,
  tipo_acao,
  funcionario_id,
  funcionario_responsavel_id,
  tarefa_id,
  checklist_id,
  registrado_em
)
select
  e.id,
  'finalizacao',
  coalesce(e.usuario_fim_id, e.funcionario_id),
  e.funcionario_id,
  e.tarefa_id,
  e.checklist_id,
  coalesce(e.finalizacao_confirmada_em, e.finalizado_em, timezone('utc', now()))
from public.checklist_execucoes e
where e.finalizado_em is not null
  and coalesce(e.usuario_fim_id, e.funcionario_id) is not null
  and not exists (
    select 1
    from public.checklist_execucao_usuarios h
    where h.execucao_id = e.id
      and h.tipo_acao = 'finalizacao'
  );
