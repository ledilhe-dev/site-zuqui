-- Completa programações que foram truncadas pelo limite de linhas de uma única
-- requisição ao PostgREST. Usa a duração, os dias e o intervalo gravados no
-- próprio agendamento e preserva ocorrências existentes/concluídas.
with resumo as (
  select
    agendamento_id,
    min(data_programada) as data_inicial,
    max(repeticao_duracao_dias) as duracao_dias
  from public.checklist_lancamentos
  where agendamento_id is not null
    and coalesce(repeticao_duracao_dias, 0) > 0
  group by agendamento_id
),
modelo as (
  select distinct on (l.agendamento_id)
    l.*,
    r.data_inicial,
    r.duracao_dias
  from public.checklist_lancamentos l
  join resumo r on r.agendamento_id = l.agendamento_id
  order by l.agendamento_id, l.data_programada, l.lancado_em
),
candidatas as (
  select
    m.*,
    d::date as data_faltante,
    case extract(isodow from d)::integer
      when 1 then 'seg' when 2 then 'ter' when 3 then 'qua'
      when 4 then 'qui' when 5 then 'sex' when 6 then 'sab'
      when 7 then 'dom'
    end as dia_token
  from modelo m
  cross join lateral generate_series(
    m.data_inicial::timestamp,
    (m.data_inicial + (m.duracao_dias - 1))::timestamp,
    interval '1 day'
  ) d
),
permitidas as (
  select c.*
  from candidatas c
  where lower(coalesce(c.dias_semana, 'todos')) = 'todos'
     or c.dia_token = any(string_to_array(lower(c.dias_semana), ','))
),
ancoradas as (
  select p.*, min(p.data_faltante) over (partition by p.agendamento_id) as data_ancora
  from permitidas p
),
faltantes as (
  select a.*
  from ancoradas a
  where mod((a.data_faltante - a.data_ancora), greatest(coalesce(a.repeticao_intervalo_dias, 1), 1)) = 0
    and not exists (
      select 1
      from public.checklist_lancamentos existente
      where existente.agendamento_id = a.agendamento_id
        and existente.data_programada = a.data_faltante
    )
)
insert into public.checklist_lancamentos (
  tarefa_id, checklist_id, funcionario_id, nome, descricao,
  horario_limite, horario_inicio, horario_fim, dias_semana,
  data_programada, lancado_em, criado_por_id, criado_por_nome,
  origem_lancamento, observacao_lancamento, empresa_id, loja_id,
  status, agendamento_id, repeticao_intervalo_dias, repeticao_duracao_dias
)
select
  f.tarefa_id, f.checklist_id, f.funcionario_id, f.nome, f.descricao,
  f.horario_limite, f.horario_inicio, f.horario_fim, f.dias_semana,
  f.data_faltante, now(), f.criado_por_id, f.criado_por_nome,
  f.origem_lancamento,
  'Ocorrência completada após correção do limite de inclusão em massa.',
  f.empresa_id, f.loja_id, 'pendente', f.agendamento_id,
  f.repeticao_intervalo_dias, f.repeticao_duracao_dias
from faltantes f;
