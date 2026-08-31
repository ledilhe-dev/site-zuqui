-- Preserva evidência antes de retirar vínculos artificiais de identidades globais.
create table if not exists private.auditoria_vinculos_admin_global (
  funcionario_id uuid not null,
  loja_id uuid not null,
  perfil_id uuid,
  vinculo_ativo_anterior boolean,
  registrado_em timestamptz not null default now(),
  motivo text not null,
  primary key(funcionario_id,loja_id)
);
revoke all on private.auditoria_vinculos_admin_global from public,anon,authenticated;

insert into private.auditoria_vinculos_admin_global(funcionario_id,loja_id,perfil_id,vinculo_ativo_anterior,motivo)
select fl.funcionario_id,fl.loja_id,fl.perfil_id,fl.ativo,
  'Administrador do Sistema não pertence operacionalmente à loja'
from public.funcionario_lojas fl
join public.funcionarios f on f.id=fl.funcionario_id
where f."é_administrador" is true
on conflict(funcionario_id,loja_id) do nothing;

update public.funcionario_lojas fl set ativo=false
from public.funcionarios f
where f.id=fl.funcionario_id and f."é_administrador" is true and fl.ativo is true;

do $$ declare n integer;
begin
  select count(*) into n from private.auditoria_vinculos_admin_global;
  raise notice 'Vínculos históricos de administradores globais preservados: %',n;
end $$;

notify pgrst,'reload schema';
