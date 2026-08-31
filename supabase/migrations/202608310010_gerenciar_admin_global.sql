create or replace function public.atualizar_administrador_sistema(
  p_funcionario_id uuid,p_token text,p_alvo_id uuid,p_nome text default null,
  p_email text default null,p_ativo boolean default null
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,private,extensions
as $$
begin
  if not public.validar_sessao_admin_global(p_funcionario_id,p_token) then raise exception 'Acesso global não autorizado' using errcode='42501'; end if;
  if not exists(select 1 from public.funcionarios where id=p_alvo_id and "é_administrador" is true) then raise exception 'Administrador do Sistema não encontrado' using errcode='P0002'; end if;
  if p_alvo_id=p_funcionario_id and p_ativo is false then raise exception 'Não é permitido desativar a própria sessão administrativa' using errcode='22023'; end if;
  update public.funcionarios set nome=coalesce(nullif(trim(p_nome),''),nome),
    email=case when p_email is null then email else nullif(lower(trim(p_email)),'') end,
    ativo=coalesce(p_ativo,ativo),"é_administrador"=true where id=p_alvo_id;
  return jsonb_build_object('ok',true,'id',p_alvo_id);
end $$;
revoke all on function public.atualizar_administrador_sistema(uuid,text,uuid,text,text,boolean) from public;
grant execute on function public.atualizar_administrador_sistema(uuid,text,uuid,text,text,boolean) to anon,authenticated;
notify pgrst,'reload schema';
