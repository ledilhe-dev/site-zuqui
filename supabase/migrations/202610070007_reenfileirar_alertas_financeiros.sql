-- Reenvia apenas alertas financeiros que falharam por causa do antigo escopo
-- loja/empresa. A chave unica continua impedindo duplicacao.
update public.telegram_alertas
set status='pendente',ultimo_erro=null,processando_em=null
where tipo in ('financeiro_vencimento','financeiro_saldo','financeiro_ajuste')
  and status='erro'
  and ultimo_erro='Nenhum destino ativo para a empresa/loja.';
