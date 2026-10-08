-- Quantidade e observacao no controle de validade e em todos os avisos Telegram.
alter table public.produtos_vencimento
  add column if not exists quantidade integer not null default 1 check (quantidade > 0),
  add column if not exists observacao text not null default '' check (length(observacao) <= 500);

create or replace function public.telegram_produto_cadastrado()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.alertar_telegram and new.ativo then
    insert into public.telegram_alertas(
      chave_unica,tipo,empresa_id,loja_id,descricao,funcionario_id,funcionario_nome,
      horario_previsto,horario_real
    ) values (
      'produto_cadastrado:'||new.id::text,'produto_cadastrado',new.empresa_id,new.loja_id,
      E'📦 PRODUTO CADASTRADO\nProduto: '||new.nome_produto||
      E'\nQuantidade: '||new.quantidade::text||
      case when new.codigo_barras<>'' then E'\nCódigo de barras: '||new.codigo_barras else '' end||
      case when new.observacao<>'' then E'\nObservação: '||new.observacao else '' end||
      E'\nVencimento: '||to_char(new.data_vencimento,'DD/MM/YYYY')||
      E'\nCadastrado por: '||new.funcionario_nome||
      E'\nRegistro: '||to_char(clock_timestamp() at time zone 'America/Sao_Paulo','DD/MM/YYYY HH24:MI:SS')||
      case when new.dias_antecedencia>0 then E'\nAlerta: '||new.dias_antecedencia||' dia(s) antes, às '||to_char(new.horario_alerta,'HH24:MI') else '' end,
      new.funcionario_id,new.funcionario_nome,now(),now()
    ) on conflict(chave_unica) do nothing;
  end if;
  return new;
end $$;

-- Acrescenta os novos detalhes sem duplicar a extensa rotina financeira/produtos existente.
create or replace function public.telegram_produto_enriquecer_descricao()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_produto public.produtos_vencimento%rowtype;
begin
  if new.tipo in ('produto_cadastrado','produto_vencimento') then
    select p.* into v_produto from public.produtos_vencimento p
    where new.chave_unica like '%'||p.id::text||'%' limit 1;
    if found and position(E'\nQuantidade:' in new.descricao)=0 then
      new.descricao := new.descricao||E'\nQuantidade: '||v_produto.quantidade::text||
        case when v_produto.observacao<>'' then E'\nObservação: '||v_produto.observacao else '' end||
        E'\nResponsável: '||v_produto.funcionario_nome;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_telegram_produto_enriquecer on public.telegram_alertas;
create trigger trg_telegram_produto_enriquecer before insert on public.telegram_alertas
for each row execute function public.telegram_produto_enriquecer_descricao();

notify pgrst,'reload schema';
