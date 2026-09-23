-- Recompõe a ocorrência de 23/09/2026 ignorada porque o horário já havia passado.
-- Idempotente: preserva o tenant/agendamento e não cria duplicidade.
with modelo as (
  select l.*
  from public.checklist_lancamentos l
  join public.funcionarios f on f.id = l.funcionario_id
  where lower(trim(f.nome)) = 'marcia'
    and lower(l.nome) like '%ifood%'
    and l.data_programada > date '2026-09-23'
    and coalesce(l.status, 'pendente') = 'pendente'
  order by l.data_programada, l.lancado_em
  limit 1
)
insert into public.checklist_lancamentos (
  tarefa_id, checklist_id, funcionario_id, nome, descricao,
  horario_limite, horario_inicio, horario_fim, dias_semana,
  data_programada, lancado_em, criado_por_id, criado_por_nome,
  origem_lancamento, observacao_lancamento, empresa_id, loja_id,
  status, agendamento_id, repeticao_intervalo_dias, repeticao_duracao_dias
)
select
  m.tarefa_id, m.checklist_id, m.funcionario_id, m.nome, m.descricao,
  m.horario_limite, m.horario_inicio, m.horario_fim, m.dias_semana,
  date '2026-09-23', now(), m.criado_por_id, m.criado_por_nome,
  m.origem_lancamento,
  'Ocorrência de hoje reposta após remoção da regra que ignorava horário vencido.',
  m.empresa_id, m.loja_id, 'pendente', m.agendamento_id,
  m.repeticao_intervalo_dias, m.repeticao_duracao_dias
from modelo m
where not exists (
  select 1 from public.checklist_lancamentos existente
  where existente.tarefa_id = m.tarefa_id
    and existente.funcionario_id = m.funcionario_id
    and existente.data_programada = date '2026-09-23'
    and coalesce(existente.horario_inicio, nullif(existente.horario_limite, '')::time)
        is not distinct from coalesce(m.horario_inicio, nullif(m.horario_limite, '')::time)
    and coalesce(existente.status, 'pendente') not in ('cancelado', 'cancelada', 'excluido', 'excluida')
);
