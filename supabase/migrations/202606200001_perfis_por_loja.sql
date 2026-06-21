-- Perfis passam a pertencer a uma loja.
-- Os perfis globais atuais viram a base da loja Zuqui e são replicados
-- para as demais lojas, preservando e corrigindo os vínculos existentes.

begin;

alter table public.perfis
  add column if not exists loja_id uuid;

-- Restrições globais antigas impedem repetir Administrador/Gerente/Funcionário
-- em lojas diferentes. A unicidade correta por loja é criada ao final.
alter table public.perfis drop constraint if exists perfis_codigo_key;
alter table public.perfis drop constraint if exists perfis_nome_key;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'perfis_loja_id_fkey'
      and conrelid = 'public.perfis'::regclass
  ) then
    alter table public.perfis
      add constraint perfis_loja_id_fkey
      foreign key (loja_id) references public.lojas(id)
      on update cascade on delete restrict;
  end if;
end;
$$;

-- A loja Zuqui é a origem preferencial. Se ela não existir, usa a primeira ativa.
with loja_origem as (
  select l.id, l.empresa_id
  from public.lojas l
  where l.ativo is not false
  order by
    case when lower(coalesce(l.nome, '')) like '%zuqui%' then 0 else 1 end,
    l.criado_em nulls last,
    l.id
  limit 1
)
update public.perfis p
set loja_id = o.id,
    empresa_id = o.empresa_id
from loja_origem o
where p.loja_id is null;

-- Replica exatamente nome, código, permissões e estado dos perfis-base.
with loja_origem as (
  select l.id
  from public.lojas l
  where l.ativo is not false
  order by
    case when lower(coalesce(l.nome, '')) like '%zuqui%' then 0 else 1 end,
    l.criado_em nulls last,
    l.id
  limit 1
),
perfis_base as (
  select distinct on (lower(coalesce(p.codigo, p.nome)))
    p.nome, p.codigo, p.permissoes, p.ativo
  from public.perfis p
  join loja_origem o on o.id = p.loja_id
  order by lower(coalesce(p.codigo, p.nome)), p.created_at nulls first, p.id
)
insert into public.perfis (nome, codigo, permissoes, ativo, empresa_id, loja_id)
select pb.nome, pb.codigo, pb.permissoes, pb.ativo, l.empresa_id, l.id
from public.lojas l
cross join perfis_base pb
where l.ativo is not false
  and not exists (
    select 1
    from public.perfis existente
    where existente.loja_id = l.id
      and lower(coalesce(existente.codigo, existente.nome)) = lower(coalesce(pb.codigo, pb.nome))
  );

-- Cada vínculo recebe o perfil equivalente da própria loja.
with mapa_vinculos as (
  select fl.id as vinculo_id, perfil_destino.id as perfil_destino_id
  from public.funcionario_lojas fl
  join public.funcionarios f on f.id = fl.funcionario_id
  join public.perfis perfil_origem on perfil_origem.id = coalesce(fl.perfil_id, f.perfil_id)
  join public.perfis perfil_destino
    on perfil_destino.loja_id = fl.loja_id
   and lower(coalesce(perfil_destino.codigo, perfil_destino.nome)) = lower(coalesce(perfil_origem.codigo, perfil_origem.nome))
)
update public.funcionario_lojas fl
set perfil_id = mapa.perfil_destino_id
from mapa_vinculos mapa
where fl.id = mapa.vinculo_id
  and fl.perfil_id is distinct from mapa.perfil_destino_id;

-- Funcionários com loja principal também apontam para o perfil local equivalente.
update public.funcionarios f
set perfil_id = perfil_destino.id
from public.perfis perfil_origem
join public.perfis perfil_destino
  on lower(coalesce(perfil_destino.codigo, perfil_destino.nome)) = lower(coalesce(perfil_origem.codigo, perfil_origem.nome))
where perfil_origem.id = f.perfil_id
  and perfil_destino.loja_id = f.loja_id
  and f.loja_id is not null
  and f.perfil_id is distinct from perfil_destino.id;

create unique index if not exists perfis_loja_codigo_unique
  on public.perfis (loja_id, lower(coalesce(codigo, nome)));

create index if not exists perfis_loja_ativo_nome_idx
  on public.perfis (loja_id, ativo, nome);

do $$
begin
  if exists (select 1 from public.lojas where ativo is not false)
     and not exists (select 1 from public.perfis where loja_id is null) then
    alter table public.perfis alter column loja_id set not null;
  end if;
end;
$$;

commit;
