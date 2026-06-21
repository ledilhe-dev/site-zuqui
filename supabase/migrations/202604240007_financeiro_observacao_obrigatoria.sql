-- Torna a observacao obrigatoria no lancamento de contas a pagar.
alter table if exists public.contasapagar
  add column if not exists observacao text;

update public.contasapagar
set observacao = 'Sem observacao informada'
where observacao is null or btrim(observacao) = '';

alter table public.contasapagar
  alter column observacao set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'contasapagar_observacao_nao_vazia_ck'
      and conrelid = 'public.contasapagar'::regclass
  ) then
    alter table public.contasapagar
      add constraint contasapagar_observacao_nao_vazia_ck
      check (char_length(btrim(observacao)) > 0);
  end if;
end $$;