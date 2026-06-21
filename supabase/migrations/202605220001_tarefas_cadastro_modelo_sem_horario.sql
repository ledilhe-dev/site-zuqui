-- Cadastro de checklist como modelo por loja/empresa.
-- O horario fica no lancamento manual/agenda, nao no cadastro base da tarefa.

ALTER TABLE IF EXISTS public.tarefas
  ALTER COLUMN horario_limite DROP NOT NULL;

ALTER TABLE IF EXISTS public.tarefas
  ALTER COLUMN funcionario_id DROP NOT NULL;
