-- O cadastrante pode ser um funcionário ou um usuário administrativo.
-- Mantém o identificador para auditoria sem limitar a uma única tabela de identidade.
alter table if exists public.tarefas
  drop constraint if exists tarefas_criado_por_id_fkey;
