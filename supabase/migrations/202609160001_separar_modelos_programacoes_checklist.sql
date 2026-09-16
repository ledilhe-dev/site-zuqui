-- Separa a biblioteca fixa (public.checklists) das programações operacionais
-- (public.tarefas + public.checklist_lancamentos).
-- Os modelos existentes são preservados integralmente.
delete from public.checklist_lancamento_eventos;
delete from public.checklist_execucoes;
delete from public.checklist_lancamentos;
delete from public.tarefas;
