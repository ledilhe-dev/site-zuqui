-- Registra explicitamente a configuracao final exibida apos cada recálculo.
-- Nao depende mais de comparar com uma ocorrencia antiga, que pode ter sido
-- atualizada junto com todas as pendencias.
create or replace function public.registrar_confirmacao_programacao_checklist(
  p_agendamento_id uuid,
  p_nome text,
  p_funcionario_id uuid,
  p_horario_inicio time,
  p_horario_fim time,
  p_dias_semana text
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_nome_funcionario text;
  v_vigencia date;
  v_resumo text;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if p_agendamento_id is null then raise exception 'Programacao obrigatoria.'; end if;
  select nome into v_nome_funcionario from public.funcionarios where id = p_funcionario_id;
  select min(data_programada) into v_vigencia
  from public.checklist_lancamentos
  where agendamento_id = p_agendamento_id
    and lower(coalesce(status,'pendente')) = 'pendente'
    and data_programada >= v_hoje;

  if v_vigencia is null then
    raise exception 'Programacao sem ocorrencia futura pendente.';
  end if;

  v_resumo := concat_ws(' | ',
    concat('Nome definido: ', coalesce(nullif(trim(p_nome),''),'Tarefa')),
    concat('Responsavel definido: ', coalesce(nullif(v_nome_funcionario,''),'Nao identificado')),
    concat('Horario definido: ', coalesce(to_char(p_horario_inicio,'HH24:MI'),'--:--'), '-', coalesce(to_char(p_horario_fim,'HH24:MI'),'--:--')),
    concat('Dias definidos: ', coalesce(nullif(p_dias_semana,''),'-'))
  );

  update public.checklist_lancamentos
  set programacao_alterada_em = now(),
      programacao_alteracao_valida_desde = v_vigencia,
      programacao_alteracao_resumo = v_resumo
  where agendamento_id = p_agendamento_id;

  if not found then raise exception 'Programacao nao encontrada ou sem acesso.'; end if;
  return jsonb_build_object('vigencia',v_vigencia,'resumo',v_resumo);
end;
$$;

grant execute on function public.registrar_confirmacao_programacao_checklist(uuid,text,uuid,time,time,text) to anon, authenticated;

-- Confirma a configuracao atual de todas as programacoes com ocorrencia futura.
-- Isto permite conferir inclusive as edicoes feitas antes da auditoria completa.
with futuras as (
  select distinct on (l.agendamento_id)
    l.agendamento_id, l.nome, l.funcionario_id, l.horario_inicio, l.horario_limite,
    l.horario_fim, l.dias_semana, l.data_programada, f.nome as funcionario_nome
  from public.checklist_lancamentos l
  left join public.funcionarios f on f.id = l.funcionario_id
  where l.agendamento_id is not null
    and lower(coalesce(l.status,'pendente')) = 'pendente'
    and l.data_programada >= (now() at time zone 'America/Sao_Paulo')::date
  order by l.agendamento_id, l.data_programada, l.lancado_em desc
)
update public.checklist_lancamentos l
set programacao_alterada_em = now(),
    programacao_alteracao_valida_desde = f.data_programada,
    programacao_alteracao_resumo = concat_ws(' | ',
      concat('Nome definido: ',coalesce(nullif(trim(f.nome),''),'Tarefa')),
      concat('Responsavel definido: ',coalesce(nullif(f.funcionario_nome,''),'Nao identificado')),
      concat('Horario definido: ',coalesce(to_char(f.horario_inicio::time,'HH24:MI'),to_char(f.horario_limite::time,'HH24:MI'),'--:--'),'-',coalesce(to_char(f.horario_fim::time,'HH24:MI'),'--:--')),
      concat('Dias definidos: ',coalesce(nullif(f.dias_semana,''),'-')))
from futuras f
where l.agendamento_id = f.agendamento_id;
