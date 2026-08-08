alter table if exists public.contasapagar
  add column if not exists valor_original numeric(12,2);

update public.contasapagar
set valor_original = coalesce(valor_original, valor_compra, 0)
where valor_original is null;

alter table if exists public.contasapagar
  alter column valor_original set not null;

create or replace function public.preservar_valor_original_conta_pagar()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.valor_original := coalesce(new.valor_original, new.valor_compra, 0);
  elsif old.valor_original is not null and new.valor_original is null then
    new.valor_original := old.valor_original;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_preservar_valor_original_conta_pagar on public.contasapagar;
create trigger trg_preservar_valor_original_conta_pagar
before insert or update on public.contasapagar
for each row execute function public.preservar_valor_original_conta_pagar();

comment on column public.contasapagar.valor_original is
  'Valor previsto no cadastro inicial, preservado para comparar com o valor atualizado e pago.';
