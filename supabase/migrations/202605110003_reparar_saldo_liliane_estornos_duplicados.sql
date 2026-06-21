-- Repara estornos duplicados gerados durante tentativas de exclusão de recebível.
-- Conta afetada: LILIANE.
-- Sintoma encontrado em 2026-05-11:
--   4 estornos de R$ 1.300,00 foram gravados em sequência, mas apenas 1 exclusão
--   efetiva deveria impactar o saldo.
-- Correção:
--   1. Registrar entrada de compensação de R$ 5.200,00.
--   2. Atualizar saldo_atual da conta para o saldo correto final.

do $$
declare
  v_conta_id uuid := '8f0a09e8-220c-4a76-8d28-2632cb37df6c';
  v_empresa_id uuid;
  v_loja_id uuid;
  v_saldo_atual numeric;
  v_valor_correcao numeric := 5200.00;
  v_saldo_corrigido numeric;
begin
  select empresa_id, loja_id, saldo_atual
    into v_empresa_id, v_loja_id, v_saldo_atual
  from public.contas_financeiras
  where id = v_conta_id;

  if v_conta_id is null or v_saldo_atual is null then
    raise exception 'Conta financeira LILIANE não encontrada para reparo de saldo.';
  end if;

  v_saldo_corrigido := v_saldo_atual + v_valor_correcao;

  insert into public.contas_financeiras_movimentacoes (
    conta_financeira_id,
    tipo,
    valor,
    descricao,
    saldo_apos,
    empresa_id,
    loja_id
  ) values (
    v_conta_id,
    'entrada',
    v_valor_correcao,
    'Correção de estornos duplicados de recebível em 11/05/2026',
    v_saldo_corrigido,
    v_empresa_id,
    v_loja_id
  );

  update public.contas_financeiras
  set saldo_atual = v_saldo_corrigido
  where id = v_conta_id;
end $$;

