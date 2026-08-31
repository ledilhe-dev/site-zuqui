-- Toda loja recebe uma cópia explícita dos perfis-base; vínculo ativo nunca fica sem perfil.
create or replace function private.criar_perfis_iniciais_loja(p_loja_id uuid, p_empresa_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare v_loja_modelo uuid;
begin
  select p.loja_id into v_loja_modelo
  from public.perfis p
  where p.ativo is true and p.loja_id <> p_loja_id
  group by p.loja_id
  order by count(*) desc, p.loja_id
  limit 1;

  if v_loja_modelo is null then return; end if;
  insert into public.perfis (nome, codigo, permissoes, ativo, empresa_id, loja_id)
  select p.nome, p.codigo, p.permissoes, true, p_empresa_id, p_loja_id
  from public.perfis p
  where p.loja_id = v_loja_modelo and p.ativo is true
  on conflict (loja_id, (lower(coalesce(codigo, nome)))) do nothing;
end;
$$;

do $$ declare l record;
begin
  for l in select id, empresa_id from public.lojas where ativo is not false loop
    perform private.criar_perfis_iniciais_loja(l.id, l.empresa_id);
  end loop;
end $$;

create or replace function private.criar_perfis_apos_loja()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, private
as $$ begin
  perform private.criar_perfis_iniciais_loja(new.id, new.empresa_id);
  return new;
end $$;
drop trigger if exists trg_criar_perfis_apos_loja on public.lojas;
create trigger trg_criar_perfis_apos_loja
after insert on public.lojas for each row execute function private.criar_perfis_apos_loja();

-- Recupera vínculos legados sem perfil pelo perfil equivalente da loja principal.
update public.funcionario_lojas fl
set perfil_id = destino.id
from public.funcionarios f
join public.perfis origem on origem.id = f.perfil_id
join public.perfis destino
  on lower(coalesce(destino.codigo, destino.nome)) = lower(coalesce(origem.codigo, origem.nome))
where f.id = fl.funcionario_id
  and destino.loja_id = fl.loja_id
  and fl.perfil_id is null;

-- Um vínculo legado ainda sem perfil fica bloqueado, nunca com permissões implícitas.
update public.funcionario_lojas set ativo = false where perfil_id is null;

alter table public.funcionario_lojas drop constraint if exists funcionario_lojas_ativo_exige_perfil;
alter table public.funcionario_lojas add constraint funcionario_lojas_ativo_exige_perfil
  check (ativo is not true or perfil_id is not null);

create or replace function private.validar_perfil_vinculo_loja()
returns trigger language plpgsql
set search_path = pg_catalog, public
as $$ begin
  if new.ativo is true and not exists (
    select 1 from public.perfis p
    where p.id = new.perfil_id and p.loja_id = new.loja_id and p.ativo is true
  ) then
    raise exception 'Perfil obrigatório, ativo e pertencente à mesma loja' using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists trg_validar_perfil_vinculo_loja on public.funcionario_lojas;
create trigger trg_validar_perfil_vinculo_loja
before insert or update of loja_id, perfil_id, ativo on public.funcionario_lojas
for each row execute function private.validar_perfil_vinculo_loja();

notify pgrst, 'reload schema';
