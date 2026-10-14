-- O restore preservou as politicas RLS, mas nao os privilegios-base da API.
-- GRANT permite que PostgREST alcance as tabelas; as politicas tenant_* abaixo
-- continuam decidindo quais linhas cada sessao operacional pode acessar.
do $$
declare
  t text;
begin
  foreach t in array array[
    'fornecedores',
    'formas_pagamento',
    'contasapagar',
    'contas_financeiras',
    'contas_financeiras_movimentacoes',
    'contas_financeiras_ajustes_saldo',
    'recebiveis',
    'recebiveis_futuros',
    'categorias_compra',
    'grupos_fornecedor'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format(
        'grant select, insert, update, delete on table public.%I to anon, authenticated',
        t
      );
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
