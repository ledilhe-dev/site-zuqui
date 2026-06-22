-- O perfil Financeiro não recebe funções de ponto ou escala por padrão.
-- As permissões continuam disponíveis para configuração explícita em outros perfis.

begin;

update public.perfis
set permissoes = coalesce(permissoes, '{}'::jsonb) || jsonb_build_object(
  'bater_ponto', false,
  'ponto_ajustes', false,
  'relatorio_ponto', false,
  'agenda', false,
  'relatorio_plantao', false,
  'cadastro_plantao', false,
  'agenda_editar', false,
  'excluir_agenda_cadastrada', false
)
where upper(trim(coalesce(codigo, ''))) = 'FINANCEIRO'
   or lower(trim(coalesce(nome, ''))) = 'financeiro';

commit;
