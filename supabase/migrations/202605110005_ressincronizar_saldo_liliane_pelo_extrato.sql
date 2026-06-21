-- Ressincroniza a conta LILIANE pelo extrato gravado.
-- Em 11/05/2026 o recebivel de R$ 1.300,00 foi lancado, mas o saldo_atual
-- permaneceu defasado em relacao aos movimentos da propria conta.
--
-- Esta migration nao cria movimento novo. Ela apenas coloca contas_financeiras
-- no mesmo saldo calculado pelo extrato existente.

with saldo_extrato as (
  select
    conta_financeira_id,
    round(sum(
      case
        when lower(coalesce(tipo, '')) in ('saida', 'estorno') then -abs(coalesce(valor, 0))
        else abs(coalesce(valor, 0))
      end
    )::numeric, 2) as saldo_calculado
  from public.contas_financeiras_movimentacoes
  where conta_financeira_id = '8f0a09e8-220c-4a76-8d28-2632cb37df6c'
  group by conta_financeira_id
)
update public.contas_financeiras c
set saldo_atual = s.saldo_calculado
from saldo_extrato s
where c.id = s.conta_financeira_id
  and abs(coalesce(c.saldo_atual, 0) - s.saldo_calculado) > 0.009;
