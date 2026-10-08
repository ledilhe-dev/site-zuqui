-- Recupera avisos de edicoes feitas antes da criacao dos campos de auditoria.
with grupos as (
  select distinct agendamento_id
  from public.checklist_lancamentos
  where agendamento_id is not null
), comparacao as (
  select g.agendamento_id, antigo.nome as nome_antigo, futuro.nome as nome_novo,
    antigo.funcionario_id as funcionario_antigo, futuro.funcionario_id as funcionario_novo,
    antigo.horario_inicio as inicio_antigo, futuro.horario_inicio as inicio_novo,
    antigo.horario_fim as fim_antigo, futuro.horario_fim as fim_novo,
    antigo.dias_semana as dias_antigos, futuro.dias_semana as dias_novos,
    futuro.data_programada as vigencia
  from grupos g
  cross join lateral (
    select l.* from public.checklist_lancamentos l
    where l.agendamento_id = g.agendamento_id
    order by l.data_programada, l.lancado_em limit 1
  ) antigo
  cross join lateral (
    select l.* from public.checklist_lancamentos l
    where l.agendamento_id = g.agendamento_id
      and lower(coalesce(l.status,'pendente')) = 'pendente'
      and l.data_programada >= (now() at time zone 'America/Sao_Paulo')::date
    order by l.data_programada limit 1
  ) futuro
  where antigo.nome is distinct from futuro.nome
     or antigo.funcionario_id is distinct from futuro.funcionario_id
     or antigo.horario_inicio is distinct from futuro.horario_inicio
     or antigo.horario_fim is distinct from futuro.horario_fim
     or antigo.dias_semana is distinct from futuro.dias_semana
)
update public.checklist_lancamentos l
set programacao_alterada_em = now(),
    programacao_alteracao_valida_desde = c.vigencia,
    programacao_alteracao_resumo = concat_ws(' | ',
      case when c.nome_antigo is distinct from c.nome_novo then concat('Tarefa: ',coalesce(c.nome_antigo,'anterior'),' -> ',coalesce(c.nome_novo,'nova')) end,
      case when c.funcionario_antigo is distinct from c.funcionario_novo then concat('Responsavel alterado para ',coalesce(fn.nome,'novo funcionario')) end,
      case when c.inicio_antigo is distinct from c.inicio_novo or c.fim_antigo is distinct from c.fim_novo
        then concat('Horario alterado para ',coalesce(to_char(c.inicio_novo,'HH24:MI'),'--:--'),'-',coalesce(to_char(c.fim_novo,'HH24:MI'),'--:--')) end,
      case when c.dias_antigos is distinct from c.dias_novos then concat('Dias alterados para ',coalesce(c.dias_novos,'-')) end)
from comparacao c
left join public.funcionarios fn on fn.id = c.funcionario_novo
where l.agendamento_id = c.agendamento_id
  and l.programacao_alterada_em is null;
