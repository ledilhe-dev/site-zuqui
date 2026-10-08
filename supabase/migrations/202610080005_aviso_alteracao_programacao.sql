alter table public.checklist_lancamentos
  add column if not exists programacao_alterada_em timestamptz,
  add column if not exists programacao_alteracao_valida_desde date,
  add column if not exists programacao_alteracao_resumo text;

create or replace function public.alterar_funcionario_programacao_checklist(
  p_agendamento_id uuid,
  p_funcionario_id uuid
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_anterior uuid;
  v_anterior_nome text;
  v_novo_nome text;
  v_vigencia date;
  v_atualizados integer := 0;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  select funcionario_id into v_anterior
  from public.checklist_lancamentos
  where agendamento_id = p_agendamento_id
    and lower(coalesce(status, 'pendente')) = 'pendente'
  order by (data_programada >= v_hoje) desc, data_programada
  limit 1 for update;

  if not found then raise exception 'Programacao sem ocorrencias pendentes.'; end if;
  select nome into v_anterior_nome from public.funcionarios where id = v_anterior;
  select nome into v_novo_nome from public.funcionarios where id = p_funcionario_id;
  if v_novo_nome is null then raise exception 'Funcionario nao encontrado.'; end if;

  update public.checklist_lancamentos
  set funcionario_id = p_funcionario_id
  where agendamento_id = p_agendamento_id
    and lower(coalesce(status, 'pendente')) = 'pendente';
  get diagnostics v_atualizados = row_count;

  select min(data_programada) into v_vigencia
  from public.checklist_lancamentos
  where agendamento_id = p_agendamento_id
    and lower(coalesce(status, 'pendente')) = 'pendente'
    and data_programada >= v_hoje;

  update public.checklist_lancamentos
  set programacao_alterada_em = now(),
      programacao_alteracao_valida_desde = v_vigencia,
      programacao_alteracao_resumo = concat('Responsavel: ', coalesce(v_anterior_nome, 'anterior'), ' -> ', v_novo_nome)
  where agendamento_id = p_agendamento_id;

  return jsonb_build_object('atualizados', v_atualizados, 'vigencia', v_vigencia,
    'resumo', concat('Responsavel: ', coalesce(v_anterior_nome, 'anterior'), ' -> ', v_novo_nome));
end;
$$;

grant execute on function public.alterar_funcionario_programacao_checklist(uuid, uuid) to anon, authenticated;

create or replace function public.recalcular_programacao_checklist(
  p_agendamento_id uuid, p_nome text, p_descricao text, p_funcionario_id uuid,
  p_horario_inicio time, p_horario_fim time, p_dias_semana text,
  p_intervalo integer, p_duracao integer, p_datas date[]
) returns jsonb
language plpgsql security invoker set search_path = public
as $$
declare
  v_modelo public.checklist_lancamentos%rowtype;
  v_anterior public.checklist_lancamentos%rowtype;
  v_data date; v_excluidos integer := 0; v_atualizados integer := 0; v_incluidos integer := 0;
  v_vigencia date; v_resumo text; v_anterior_nome text; v_novo_nome text;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if p_agendamento_id is null or coalesce(array_length(p_datas, 1), 0) = 0 then raise exception 'Programacao e datas sao obrigatorias.'; end if;
  if nullif(trim(p_nome), '') is null or p_funcionario_id is null then raise exception 'Nome e funcionario sao obrigatorios.'; end if;

  select * into v_modelo from public.checklist_lancamentos where agendamento_id = p_agendamento_id order by data_programada, lancado_em limit 1 for update;
  if v_modelo.id is null then raise exception 'Programacao nao encontrada ou sem acesso.'; end if;
  select * into v_anterior from public.checklist_lancamentos where agendamento_id = p_agendamento_id
    and lower(coalesce(status, 'pendente')) = 'pendente'
    order by (data_programada >= v_hoje) desc, data_programada limit 1;
  if v_anterior.id is null then v_anterior := v_modelo; end if;
  select nome into v_anterior_nome from public.funcionarios where id = v_anterior.funcionario_id;
  select nome into v_novo_nome from public.funcionarios where id = p_funcionario_id;

  delete from public.checklist_lancamentos where agendamento_id = p_agendamento_id
    and lower(coalesce(status, 'pendente')) = 'pendente' and not (data_programada = any(p_datas));
  get diagnostics v_excluidos = row_count;

  update public.checklist_lancamentos set nome = trim(p_nome), descricao = nullif(trim(p_descricao), ''),
    funcionario_id = p_funcionario_id, horario_limite = p_horario_inicio, horario_inicio = p_horario_inicio,
    horario_fim = p_horario_fim, dias_semana = p_dias_semana,
    repeticao_intervalo_dias = greatest(1, coalesce(p_intervalo, 1)), repeticao_duracao_dias = greatest(1, coalesce(p_duracao, 1))
  where agendamento_id = p_agendamento_id and lower(coalesce(status, 'pendente')) = 'pendente' and data_programada = any(p_datas);
  get diagnostics v_atualizados = row_count;

  foreach v_data in array p_datas loop
    if not exists (select 1 from public.checklist_lancamentos l where l.agendamento_id = p_agendamento_id and l.data_programada = v_data
      and lower(coalesce(l.status, 'pendente')) not in ('cancelado','cancelada','excluido','excluida')) then
      insert into public.checklist_lancamentos (tarefa_id, checklist_id, funcionario_id, nome, descricao, horario_limite,
        horario_inicio, horario_fim, dias_semana, data_programada, lancado_em, criado_por_id, criado_por_nome,
        origem_lancamento, observacao_lancamento, empresa_id, loja_id, status, agendamento_id,
        repeticao_intervalo_dias, repeticao_duracao_dias)
      values (v_modelo.tarefa_id, v_modelo.checklist_id, p_funcionario_id, trim(p_nome), nullif(trim(p_descricao), ''),
        p_horario_inicio, p_horario_inicio, p_horario_fim, p_dias_semana, v_data, now(), v_modelo.criado_por_id,
        v_modelo.criado_por_nome, coalesce(v_modelo.origem_lancamento, 'manual'), 'Ocorrencia recalculada pela edicao da programacao.',
        v_modelo.empresa_id, v_modelo.loja_id, 'pendente', p_agendamento_id, greatest(1, coalesce(p_intervalo, 1)),
        greatest(1, coalesce(p_duracao, 1)));
      v_incluidos := v_incluidos + 1;
    end if;
  end loop;

  if v_modelo.tarefa_id is not null then update public.tarefas set nome = trim(p_nome), descricao = nullif(trim(p_descricao), ''),
    horario_limite = p_horario_inicio where id = v_modelo.tarefa_id; end if;

  select min(data_programada) into v_vigencia from public.checklist_lancamentos where agendamento_id = p_agendamento_id
    and lower(coalesce(status, 'pendente')) = 'pendente' and data_programada >= v_hoje;
  v_resumo := concat_ws(' | ',
    case when coalesce(v_anterior.nome,'') <> trim(p_nome) then concat('Tarefa: ', coalesce(v_anterior.nome,'anterior'), ' -> ', trim(p_nome)) end,
    case when v_anterior.funcionario_id is distinct from p_funcionario_id then concat('Responsavel: ', coalesce(v_anterior_nome,'anterior'), ' -> ', coalesce(v_novo_nome,'novo')) end,
    case when v_anterior.horario_inicio is distinct from p_horario_inicio or v_anterior.horario_fim is distinct from p_horario_fim
      then concat('Horario: ', coalesce(to_char(v_anterior.horario_inicio,'HH24:MI'),'--:--'), '-', coalesce(to_char(v_anterior.horario_fim,'HH24:MI'),'--:--'),
        ' -> ', to_char(p_horario_inicio,'HH24:MI'), '-', to_char(p_horario_fim,'HH24:MI')) end,
    case when coalesce(v_anterior.dias_semana,'') <> coalesce(p_dias_semana,'') then concat('Dias: ', coalesce(v_anterior.dias_semana,'-'), ' -> ', p_dias_semana) end,
    case when coalesce(v_anterior.descricao,'') <> coalesce(nullif(trim(p_descricao),''),'') then 'Orientacao atualizada' end);
  if nullif(v_resumo,'') is null then v_resumo := 'Programacao recalculada e ocorrencias futuras atualizadas.'; end if;

  update public.checklist_lancamentos set programacao_alterada_em = now(), programacao_alteracao_valida_desde = v_vigencia,
    programacao_alteracao_resumo = v_resumo where agendamento_id = p_agendamento_id;

  return jsonb_build_object('excluidos',v_excluidos,'atualizados',v_atualizados,'incluidos',v_incluidos,
    'total_desejado',array_length(p_datas,1),'vigencia',v_vigencia,'resumo',v_resumo);
end;
$$;

grant execute on function public.recalcular_programacao_checklist(uuid,text,text,uuid,time,time,text,integer,integer,date[]) to anon, authenticated;
