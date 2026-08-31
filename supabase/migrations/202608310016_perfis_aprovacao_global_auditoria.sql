create or replace function public.listar_perfis_ativos_loja_admin_global(p_funcionario_id uuid,p_token text,p_loja_id uuid)
returns table(id uuid,nome text,codigo text,loja_id uuid)
language plpgsql security definer stable set search_path=pg_catalog,public,private,extensions as $$
begin
  if not public.validar_sessao_admin_global(p_funcionario_id,p_token) then raise exception 'Acesso global não autorizado' using errcode='42501'; end if;
  if not exists(select 1 from public.lojas l where l.id=p_loja_id and l.ativo is not false) then raise exception 'Loja inválida ou inativa' using errcode='22023'; end if;
  return query select p.id,p.nome,p.codigo,p.loja_id from public.perfis p where p.loja_id=p_loja_id and p.ativo is true order by p.nome;
end $$;
revoke all on function public.listar_perfis_ativos_loja_admin_global(uuid,text,uuid) from public;
grant execute on function public.listar_perfis_ativos_loja_admin_global(uuid,text,uuid) to anon,authenticated;

-- Auditoria somente leitura do perfil questionado; nenhuma linha é modificada.
do $$ declare r record;n integer;
begin
  for r in select p.*,l.nome as loja_nome,l.empresa_id as loja_empresa_id from public.perfis p left join public.lojas l on l.id=p.loja_id where lower(trim(p.nome))='eloa' loop
    raise notice 'AUDITORIA_ELOA=%',jsonb_build_object('perfil',to_jsonb(r)-'permissoes','permissoes',r.permissoes);
    select count(*) into n from public.perfis x where x.id<>r.id and (lower(trim(x.nome))=lower(trim(r.nome)) or x.permissoes=r.permissoes);
    raise notice 'AUDITORIA_ELOA_RELACIONADOS=%',n;
  end loop;
end $$;
notify pgrst,'reload schema';
