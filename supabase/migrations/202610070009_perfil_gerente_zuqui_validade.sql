-- O gerente da Zuqui opera validades, mas nao acessa dashboards gerais.
update public.perfis p
set permissoes=coalesce(p.permissoes,'{}'::jsonb)||jsonb_build_object(
  'dashboard',false,
  'estatisticas_atendimento',false,
  'estatisticas_atendimento_responder',false,
  'estatisticas_atendimento_conectar',false,
  'produtos_vencimento',true,
  'produtos_vencimento_criar',true,
  'produtos_vencimento_editar',true,
  'produtos_vencimento_excluir',true
)
from public.lojas l
where l.id=p.loja_id and lower(l.nome) like '%zuqui%'
  and upper(coalesce(p.codigo,''))='GERENTE' and p.ativo;

do $$
begin
  if not exists (
    select 1 from public.perfis p join public.lojas l on l.id=p.loja_id
    where lower(l.nome) like '%zuqui%' and upper(coalesce(p.codigo,''))='GERENTE' and p.ativo
      and coalesce((p.permissoes->>'dashboard')::boolean,true)=false
      and coalesce((p.permissoes->>'estatisticas_atendimento')::boolean,true)=false
      and coalesce((p.permissoes->>'produtos_vencimento')::boolean,false)=true
  ) then
    raise exception 'Perfil Gerente da Zuqui nao ficou com as permissoes esperadas.';
  end if;
end $$;
