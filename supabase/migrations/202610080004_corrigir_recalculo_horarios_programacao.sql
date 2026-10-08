-- Corrige horario_limite para o tipo time e preserva funcionarios ao editar.
create or replace function public.recalcular_programacao_checklist(
  p_agendamento_id uuid,
  p_nome text,
  p_descricao text,
  p_funcionario_id uuid,
  p_horario_inicio time,
  p_horario_fim time,
  p_dias_semana text,
  p_intervalo integer,
  p_duracao integer,
  p_datas date[]
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_modelo public.checklist_lancamentos%rowtype;
  v_data date;
  v_excluidos integer := 0;
  v_atualizados integer := 0;
  v_incluidos integer := 0;
  v_linhas integer := 0;
begin
  if p_agendamento_id is null or coalesce(array_length(p_datas, 1), 0) = 0 then
    raise exception 'Programacao e datas sao obrigatorias.';
  end if;
  if nullif(trim(p_nome), '') is null or p_funcionario_id is null then
    raise exception 'Nome e funcionario sao obrigatorios.';
  end if;

  select * into v_modelo
  from public.checklist_lancamentos
  where agendamento_id = p_agendamento_id
  order by data_programada, lancado_em
  limit 1
  for update;

  if v_modelo.id is null then
    raise exception 'Programacao nao encontrada ou sem acesso.';
  end if;

  delete from public.checklist_lancamentos
  where agendamento_id = p_agendamento_id
    and lower(coalesce(status, 'pendente')) = 'pendente'
    and not (data_programada = any(p_datas));
  get diagnostics v_excluidos = row_count;

  update public.checklist_lancamentos
  set nome = trim(p_nome),
      descricao = nullif(trim(p_descricao), ''),
      funcionario_id = p_funcionario_id,
      horario_limite = p_horario_inicio,
      horario_inicio = p_horario_inicio,
      horario_fim = p_horario_fim,
      dias_semana = p_dias_semana,
      repeticao_intervalo_dias = greatest(1, coalesce(p_intervalo, 1)),
      repeticao_duracao_dias = greatest(1, coalesce(p_duracao, 1))
  where agendamento_id = p_agendamento_id
    and lower(coalesce(status, 'pendente')) = 'pendente'
    and data_programada = any(p_datas);
  get diagnostics v_atualizados = row_count;

  foreach v_data in array p_datas loop
    if not exists (
      select 1
      from public.checklist_lancamentos l
      where l.agendamento_id = p_agendamento_id
        and l.data_programada = v_data
        and lower(coalesce(l.status, 'pendente')) not in
            ('cancelado', 'cancelada', 'excluido', 'excluida')
    ) then
      insert into public.checklist_lancamentos (
        tarefa_id, checklist_id, funcionario_id, nome, descricao,
        horario_limite, horario_inicio, horario_fim, dias_semana,
        data_programada, lancado_em, criado_por_id, criado_por_nome,
        origem_lancamento, observacao_lancamento, empresa_id, loja_id,
        status, agendamento_id, repeticao_intervalo_dias, repeticao_duracao_dias
      ) values (
        v_modelo.tarefa_id, v_modelo.checklist_id, p_funcionario_id,
        trim(p_nome), nullif(trim(p_descricao), ''),
        p_horario_inicio, p_horario_inicio, p_horario_fim, p_dias_semana,
        v_data, now(), v_modelo.criado_por_id, v_modelo.criado_por_nome,
        coalesce(v_modelo.origem_lancamento, 'manual'),
        'Ocorrencia recalculada pela edicao da programacao.',
        v_modelo.empresa_id, v_modelo.loja_id, 'pendente', p_agendamento_id,
        greatest(1, coalesce(p_intervalo, 1)),
        greatest(1, coalesce(p_duracao, 1))
      );
      v_incluidos := v_incluidos + 1;
    end if;
  end loop;

  -- O cadastro-base pode ser compartilhado por programacoes de pessoas diferentes.
  -- Atualiza somente os textos/horario comuns; responsavel e dias ficam por agenda.
  if v_modelo.tarefa_id is not null then
    update public.tarefas
    set nome = trim(p_nome),
        descricao = nullif(trim(p_descricao), ''),
        horario_limite = p_horario_inicio
    where id = v_modelo.tarefa_id;
  end if;

  return jsonb_build_object(
    'excluidos', v_excluidos,
    'atualizados', v_atualizados,
    'incluidos', v_incluidos,
    'total_desejado', array_length(p_datas, 1)
  );
end;
$$;

grant execute on function public.recalcular_programacao_checklist(
  uuid, text, text, uuid, time, time, text, integer, integer, date[]
) to anon, authenticated;



do $$
declare
  v_total integer;
  v_ativas integer;
  v_vinculos_ativos integer;
begin
  select count(*), count(*) filter (where ativo is true)
  into v_total, v_ativas
  from public.funcionarios
  where lower(nome) like '%salete%';

  select count(*)
  into v_vinculos_ativos
  from public.funcionario_lojas fl
  join public.funcionarios f on f.id = fl.funcionario_id
  where lower(f.nome) like '%salete%'
    and fl.ativo is true;

  raise notice 'Auditoria SALETE: cadastros=%, funcionarios_ativos=%, vinculos_loja_ativos=%',
    v_total, v_ativas, v_vinculos_ativos;
end;
$$;


