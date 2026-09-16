-- Metadados da programação do checklist. As regras operacionais existentes
-- (PIN para iniciar e conferência obrigatória por outra pessoa) não são alteradas.
alter table if exists public.tarefas
  add column if not exists criado_por_id uuid references public.funcionarios(id) on delete set null,
  add column if not exists criado_por_nome text;

alter table if exists public.checklist_lancamentos
  add column if not exists agendamento_id uuid,
  add column if not exists repeticao_intervalo_dias integer,
  add column if not exists repeticao_duracao_dias integer;

create index if not exists checklist_lancamentos_agendamento_idx
  on public.checklist_lancamentos (agendamento_id);

comment on column public.checklist_lancamentos.agendamento_id is
  'Identifica todas as ocorrências geradas pelo mesmo lançamento/programação.';
comment on column public.checklist_lancamentos.repeticao_intervalo_dias is
  'Intervalo em dias corridos informado no lançamento.';
comment on column public.checklist_lancamentos.repeticao_duracao_dias is
  'Horizonte total, em dias, informado no lançamento.';

-- Limpeza solicitada em 15/09/2026: remove somente lançamentos, execuções e
-- suas repetições/histórico. Preserva integralmente tarefas e checklists-base.
delete from public.checklist_lancamento_eventos;
delete from public.checklist_execucoes;
delete from public.checklist_lancamentos;

update public.tarefas
set lancada_checklist = false
where lancada_checklist is true;
