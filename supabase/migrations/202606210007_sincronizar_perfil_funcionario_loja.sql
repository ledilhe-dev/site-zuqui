create unique index if not exists perfis_loja_nome_unique
  on public.perfis (loja_id, lower(trim(nome)));

create or replace function public.fn_sincronizar_perfil_funcionario_na_loja()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_loja_perfil uuid;
begin
  if new.perfil_id is null or new.perfil_id is not distinct from old.perfil_id then
    return new;
  end if;

  select p.loja_id into v_loja_perfil
  from public.perfis p
  where p.id = new.perfil_id;

  if v_loja_perfil is not null then
    update public.funcionario_lojas
    set perfil_id = new.perfil_id
    where funcionario_id = new.id
      and loja_id = v_loja_perfil
      and ativo is true
      and perfil_id is distinct from new.perfil_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sincronizar_perfil_funcionario_na_loja on public.funcionarios;
create trigger trg_sincronizar_perfil_funcionario_na_loja
after update of perfil_id on public.funcionarios
for each row execute function public.fn_sincronizar_perfil_funcionario_na_loja();

-- Corrige somente vínculos conflitantes quando o perfil principal pertence
-- exatamente à mesma loja do vínculo. Perfis de outras lojas são preservados.
update public.funcionario_lojas fl
set perfil_id = f.perfil_id
from public.funcionarios f
join public.perfis p on p.id = f.perfil_id
where fl.funcionario_id = f.id
  and fl.loja_id = p.loja_id
  and fl.ativo is true
  and fl.perfil_id is distinct from f.perfil_id;
