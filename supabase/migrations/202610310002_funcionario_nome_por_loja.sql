begin;

drop index if exists public.funcionarios_nome_unique_idx;
drop index if exists public.ux_funcionarios_nome_normalizado;

create unique index if not exists ux_funcionarios_nome_loja_normalizado
  on public.funcionarios (empresa_id, loja_id, lower(regexp_replace(btrim(nome), '\s+', ' ', 'g')))
  where loja_id is not null and nome is not null and btrim(nome) <> '';

create unique index if not exists ux_funcionarios_nome_empresa_sem_loja
  on public.funcionarios (empresa_id, lower(regexp_replace(btrim(nome), '\s+', ' ', 'g')))
  where loja_id is null and nome is not null and btrim(nome) <> '';

commit;
