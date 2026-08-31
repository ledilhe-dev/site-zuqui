create or replace function public.bloquear_retenant_funcionario_cliente()
returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin
  if current_user in ('anon','authenticated')
    and (new.empresa_id is distinct from old.empresa_id or new.loja_id is distinct from old.loja_id) then
    raise exception 'Não é permitido transferir funcionário entre tenants por atualização' using errcode='42501';
  end if;
  return new;
end $$;
drop trigger if exists trg_funcionario_tenant_imutavel on public.funcionarios;
create trigger trg_funcionario_tenant_imutavel before update of empresa_id,loja_id on public.funcionarios
for each row execute function public.bloquear_retenant_funcionario_cliente();
notify pgrst,'reload schema';
