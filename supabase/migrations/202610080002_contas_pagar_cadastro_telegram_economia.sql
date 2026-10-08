-- Notifica novos lancamentos de contas a pagar sem aumentar consultas recorrentes.
create or replace function public.telegram_conta_pagar_cadastrada()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_fornecedor text;
  v_categoria text;
  v_conta text;
begin
  select nome into v_fornecedor from public.fornecedores where id=new.fornecedor_id;
  select nome into v_categoria from public.categorias_compra where id=new.categoria_id;
  select nome into v_conta from public.contas_financeiras where id=new.conta_financeira_id;

  insert into public.telegram_alertas(
    chave_unica,tipo,empresa_id,loja_id,descricao,funcionario_nome,horario_previsto,horario_real
  ) values (
    'financeiro:cadastro:'||new.id::text,
    'financeiro_vencimento',new.empresa_id,new.loja_id,
    E'🧾 CONTA A PAGAR CADASTRADA\nFornecedor: '||coalesce(v_fornecedor,'Não informado')||
    E'\nValor: R$ '||replace(to_char(new.valor_compra,'FM999G999G990D00'),'.',',')||
    E'\nVencimento: '||to_char(new.data_vencimento,'DD/MM/YYYY')||
    E'\nCategoria: '||coalesce(v_categoria,'Não informada')||
    E'\nConta: '||coalesce(v_conta,'Não informada')||
    case when nullif(trim(coalesce(new.observacao,'')),'') is not null then E'\nObservação: '||trim(new.observacao) else '' end,
    'Financeiro',now(),now()
  ) on conflict(chave_unica) do nothing;
  return new;
end $$;

drop trigger if exists trg_telegram_conta_pagar_cadastrada on public.contasapagar;
create trigger trg_telegram_conta_pagar_cadastrada
after insert on public.contasapagar
for each row execute function public.telegram_conta_pagar_cadastrada();

do $$
begin
  if exists (select 1 from cron.job where jobname='checkdiario-telegram-alertas') then
    perform cron.unschedule('checkdiario-telegram-alertas');
  end if;
  perform cron.schedule(
    'checkdiario-telegram-alertas','*/10 * * * *',
    $cron$
      select net.http_post(
        url := 'https://tqfoxqbmslxoynrasltl.supabase.co/functions/v1/telegram-webhook',
        headers := jsonb_build_object('Content-Type','application/json'),
        body := '{"origem":"cron"}'::jsonb,
        timeout_milliseconds := 50000
      );
    $cron$
  );
end $$;

notify pgrst,'reload schema';
