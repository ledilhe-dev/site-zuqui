alter table if exists public.checklist_execucoes
  add column if not exists lancamento_id uuid references public.checklist_lancamentos(id) on delete set null;

create index if not exists checklist_execucoes_lancamento_idx
  on public.checklist_execucoes (lancamento_id);

update public.checklist_execucoes e
set lancamento_id = (
  select l.id
  from public.checklist_lancamentos l
  where l.tarefa_id = e.tarefa_id
    and (l.funcionario_id is not distinct from e.funcionario_id)
    and (
      e.data_execucao is null
      or l.lancado_em is null
      or (l.lancado_em at time zone 'utc')::date = e.data_execucao
    )
  order by
    case
      when e.iniciado_em is not null and l.lancado_em is not null then abs(extract(epoch from (e.iniciado_em - l.lancado_em)))
      else 0
    end,
    l.lancado_em desc nulls last
  limit 1
)
where e.lancamento_id is null
  and e.tarefa_id is not null;