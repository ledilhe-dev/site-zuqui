-- Recria ocorrências comprovadamente omitidas pela antiga regra de turno.
-- Não altera o cadastro dos funcionários e não duplica lançamentos existentes.
with eventos_turno as (
  select distinct e.tarefa_id, e.funcionario_responsavel_id as funcionario_id, e.data_programada
  from public.checklist_lancamento_eventos e
  where e.tipo_evento = 'agendamento_ignorado'
    and e.data_programada is not null
    and coalesce(e.meta ->> 'motivo', '') = 'fora_turno_funcionario'
),
programacoes as (
  select distinct on (e.tarefa_id, e.funcionario_id, e.data_programada)
    e.data_programada as data_faltante, l.*
  from eventos_turno e
  join public.checklist_lancamentos l
    on l.tarefa_id = e.tarefa_id
   and l.funcionario_id = e.funcionario_id
   and l.agendamento_id is not null
   and (l.lancado_em at time zone 'America/Sao_Paulo')::date = e.data_programada
  where not exists (
    select 1 from public.checklist_lancamentos existente
    where existente.tarefa_id = e.tarefa_id
      and existente.funcionario_id = e.funcionario_id
      and existente.data_programada = e.data_programada
      and coalesce(existente.horario_inicio, nullif(existente.horario_limite, '')::time)
          is not distinct from coalesce(l.horario_inicio, nullif(l.horario_limite, '')::time)
  )
  order by e.tarefa_id, e.funcionario_id, e.data_programada, l.data_programada
)
insert into public.checklist_lancamentos (
  tarefa_id, checklist_id, funcionario_id, nome, descricao,
  horario_limite, horario_inicio, horario_fim, dias_semana,
  data_programada, lancado_em, criado_por_id, criado_por_nome,
  origem_lancamento, observacao_lancamento, empresa_id, loja_id,
  status, agendamento_id, repeticao_intervalo_dias, repeticao_duracao_dias
)
select
  p.tarefa_id, p.checklist_id, p.funcionario_id, p.nome, p.descricao,
  p.horario_limite, p.horario_inicio, p.horario_fim, p.dias_semana,
  p.data_faltante, now(), p.criado_por_id, p.criado_por_nome,
  p.origem_lancamento, 'Ocorrência recalculada após a remoção da antiga regra de turno.',
  p.empresa_id, p.loja_id, 'pendente', p.agendamento_id,
  p.repeticao_intervalo_dias, p.repeticao_duracao_dias
from programacoes p;
