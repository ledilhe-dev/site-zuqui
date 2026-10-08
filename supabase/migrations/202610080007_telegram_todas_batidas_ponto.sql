-- Enfileira no Telegram todas as batidas reais do ponto. O envio continua
-- agrupado pelo cron, sem chamada direta ao Telegram a cada clique.
create or replace function public.telegram_enfileirar_batida_ponto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ponto public.ponto_registros%rowtype;
  v_funcionario_nome text;
  v_tipo text := lower(coalesce(new.tipo_batida, ''));
  v_titulo text;
begin
  -- A entrada ja e coberta pelo gatilho de ponto_registros. Ajustes anulados
  -- e linhas sem tipo nao representam uma nova batida do funcionario.
  if v_tipo in ('', 'entrada')
     or lower(coalesce(new.origem_registro, '')) like '%anulado%' then
    return new;
  end if;

  select * into v_ponto
  from public.ponto_registros
  where id = new.ponto_registro_id;
  if v_ponto.id is null or v_ponto.empresa_id is null or v_ponto.loja_id is null then
    return new;
  end if;

  select nome into v_funcionario_nome
  from public.funcionarios
  where id = coalesce(new.funcionario_id, v_ponto.funcionario_id);

  v_titulo := case
    when v_tipo like 'saida_intervalo%' then '🟠 Intervalo iniciado'
    when v_tipo like 'retorno_intervalo%' then '🔵 Retorno do intervalo'
    when v_tipo = 'saida' or v_tipo like 'saida_reparada%' then '🔴 Saida registrada'
    else '🕒 Batida de ponto registrada'
  end;

  insert into public.telegram_alertas (
    chave_unica, tipo, empresa_id, loja_id, descricao,
    funcionario_id, funcionario_nome, horario_previsto, horario_real
  ) values (
    'ponto_batida:' || new.id::text,
    'ponto_entrada',
    v_ponto.empresa_id,
    v_ponto.loja_id,
    v_titulo || E'\nFuncionario: ' || coalesce(nullif(v_funcionario_nome, ''), 'Nao identificado') ||
      E'\nHorario: ' || to_char(new.registrado_em at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'),
    coalesce(new.funcionario_id, v_ponto.funcionario_id),
    coalesce(nullif(v_funcionario_nome, ''), 'Funcionario nao identificado'),
    new.registrado_em,
    new.registrado_em
  ) on conflict (chave_unica) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_telegram_batida_ponto on public.ponto_batidas_auditoria;
create trigger trg_telegram_batida_ponto
after insert on public.ponto_batidas_auditoria
for each row execute function public.telegram_enfileirar_batida_ponto();

-- Recupera as batidas de hoje que ocorreram antes deste ajuste.
insert into public.telegram_alertas (
  chave_unica, tipo, empresa_id, loja_id, descricao,
  funcionario_id, funcionario_nome, horario_previsto, horario_real
)
select
  'ponto_batida:' || b.id::text,
  'ponto_entrada',
  p.empresa_id,
  p.loja_id,
  (case
    when lower(coalesce(b.tipo_batida,'')) like 'saida_intervalo%' then '🟠 Intervalo iniciado'
    when lower(coalesce(b.tipo_batida,'')) like 'retorno_intervalo%' then '🔵 Retorno do intervalo'
    when lower(coalesce(b.tipo_batida,'')) = 'saida' or lower(coalesce(b.tipo_batida,'')) like 'saida_reparada%' then '🔴 Saida registrada'
    else '🕒 Batida de ponto registrada'
  end) || E'\nFuncionario: ' || coalesce(nullif(f.nome,''), 'Nao identificado') ||
    E'\nHorario: ' || to_char(b.registrado_em at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'),
  coalesce(b.funcionario_id, p.funcionario_id),
  coalesce(nullif(f.nome,''), 'Funcionario nao identificado'),
  b.registrado_em,
  b.registrado_em
from public.ponto_batidas_auditoria b
join public.ponto_registros p on p.id = b.ponto_registro_id
left join public.funcionarios f on f.id = coalesce(b.funcionario_id, p.funcionario_id)
where lower(coalesce(b.tipo_batida,'')) not in ('', 'entrada')
  and lower(coalesce(b.origem_registro,'')) not like '%anulado%'
  and p.empresa_id is not null and p.loja_id is not null
  and (b.registrado_em at time zone 'America/Sao_Paulo')::date =
      (now() at time zone 'America/Sao_Paulo')::date
on conflict (chave_unica) do nothing;

revoke all on function public.telegram_enfileirar_batida_ponto() from public;
