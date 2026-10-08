-- Agenda/escala: avisa ao cadastrar e novamente no dia, a partir das 07:00.

alter table public.telegram_alertas drop constraint if exists telegram_alertas_tipo_check;
alter table public.telegram_alertas add constraint telegram_alertas_tipo_check check (tipo in (
  'tarefa_iniciada','tarefa_nao_iniciada','tarefa_finalizada','tarefa_nao_finalizada',
  'financeiro_vencimento','financeiro_saldo','produto_cadastrado','produto_vencimento',
  'agenda_cadastrada','agenda_dia'
));

create or replace function public.telegram_descricao_agenda(p public.agenda)
returns text language plpgsql stable set search_path=public as $$
declare v_funcionario text;
begin
  select nome into v_funcionario from public.funcionarios where id=p.funcionario_id;
  return E'📅 '||case when p.data_plantao=(now() at time zone 'America/Sao_Paulo')::date
    then 'AGENDA DE HOJE' else 'NOVA AGENDA / ESCALA' end||
    E'\nTítulo: '||coalesce(nullif(trim(p.titulo),''),initcap(coalesce(p.tipo,'Compromisso')))||
    E'\nResponsável: '||coalesce(nullif(v_funcionario,''),'Não informado')||
    E'\nDia: '||to_char(p.data_plantao,'DD/MM/YYYY')||
    E'\nHorário: '||coalesce(to_char(p.inicio_hora,'HH24:MI'),'Não informado')||
      case when p.fim_hora is not null then ' às '||to_char(p.fim_hora,'HH24:MI') else '' end||
    E'\nTipo: '||initcap(coalesce(nullif(p.tipo,''),'Compromisso'))||
    E'\nObservação: '||coalesce(nullif(trim(p.observacao),''),'Sem observação');
end $$;

create or replace function public.telegram_agenda_cadastrada()
returns trigger language plpgsql security definer set search_path=public,extensions as $$
begin
  insert into public.telegram_alertas(
    chave_unica,tipo,empresa_id,loja_id,descricao,funcionario_id,funcionario_nome,horario_previsto,horario_real
  ) values (
    'agenda_cadastrada:'||new.id::text,'agenda_cadastrada',new.empresa_id,new.loja_id,
    public.telegram_descricao_agenda(new),new.funcionario_id,
    coalesce((select nome from public.funcionarios where id=new.funcionario_id),'Não informado'),
    now(),now()
  ) on conflict(chave_unica) do nothing;

  perform net.http_post(
    url := 'https://tqfoxqbmslxoynrasltl.supabase.co/functions/v1/telegram-webhook',
    headers := jsonb_build_object('Content-Type','application/json'),
    body := '{"origem":"cron"}'::jsonb,
    timeout_milliseconds := 30000
  );
  return new;
end $$;

drop trigger if exists trg_telegram_agenda_cadastrada on public.agenda;
create trigger trg_telegram_agenda_cadastrada after insert on public.agenda
for each row execute function public.telegram_agenda_cadastrada();

create or replace function public.telegram_enfileirar_agendas_do_dia()
returns integer language plpgsql security definer set search_path=public as $$
declare v_hoje date:=(now() at time zone 'America/Sao_Paulo')::date;
  v_hora time:=(now() at time zone 'America/Sao_Paulo')::time; v_linhas integer:=0;
begin
  if v_hora < time '07:00' then return 0; end if;
  insert into public.telegram_alertas(
    chave_unica,tipo,empresa_id,loja_id,descricao,funcionario_id,funcionario_nome,horario_previsto
  )
  select 'agenda_dia:'||a.id::text,'agenda_dia',a.empresa_id,a.loja_id,
    public.telegram_descricao_agenda(a),a.funcionario_id,
    coalesce(f.nome,'Não informado'),
    (a.data_plantao::text||' 07:00')::timestamp at time zone 'America/Sao_Paulo'
  from public.agenda a left join public.funcionarios f on f.id=a.funcionario_id
  where a.data_plantao=v_hoje
  on conflict(chave_unica) do nothing;
  get diagnostics v_linhas=row_count;
  return v_linhas;
end $$;

revoke all on function public.telegram_enfileirar_agendas_do_dia() from public;
grant execute on function public.telegram_enfileirar_agendas_do_dia() to service_role;
