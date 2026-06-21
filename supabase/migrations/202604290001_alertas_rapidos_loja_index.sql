-- Garantia de isolamento por loja para alertas rápidos.
-- A coluna loja_id já existe no ambiente atual; este índice mantém consultas filtradas por loja rápidas e idempotentes.

create index if not exists idx_alertas_rapidos_loja_status_criado
  on public.alertas_rapidos (loja_id, status, criado_em desc);
