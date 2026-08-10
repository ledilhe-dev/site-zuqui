alter table public.raffinato_documentos_faturados_cache
  add column if not exists modulo_venda text not null default 'VENDA_RAPIDA';

create index if not exists raffinato_documentos_faturados_modulo_idx
  on public.raffinato_documentos_faturados_cache (loja_id, modulo_venda, data, hora);
