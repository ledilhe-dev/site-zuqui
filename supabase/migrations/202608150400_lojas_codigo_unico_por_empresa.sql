-- O codigo sequencial identifica a loja dentro da empresa, nao globalmente.
-- Remove a restricao legada global que impedia Empresa B/001 quando Empresa A/001 existia.
alter table public.lojas drop constraint if exists lojas_codigo_unique;
drop index if exists public.lojas_codigo_unique;

-- Mantem a regra correta e atomica por tenant.
create unique index if not exists lojas_empresa_codigo_uidx
  on public.lojas (empresa_id, codigo);

comment on index public.lojas_empresa_codigo_uidx is
  'Codigo da loja unico somente dentro da empresa; empresas diferentes podem possuir loja 001.';
