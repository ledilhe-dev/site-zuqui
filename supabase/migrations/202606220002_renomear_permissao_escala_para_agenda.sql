-- O recurso exibido no menu como Agenda passa a usar a mesma nomenclatura
-- na configuração de perfis. Preserva o valor antigo e remove a chave legada.

begin;

update public.perfis
set permissoes = jsonb_set(
  coalesce(permissoes, '{}'::jsonb) - 'escala_plantoes',
  '{agenda}',
  coalesce(
    permissoes -> 'agenda',
    permissoes -> 'escala_plantoes',
    'false'::jsonb
  ),
  true
);

commit;
