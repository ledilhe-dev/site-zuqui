-- Corrige o identificador corrompido que impedia o painel de abrir apos o login.
-- Usa a coluna ASCII equivalente para evitar nova corrupcao por locale/encoding.
create or replace function public.obter_painel_admin_global(p_funcionario_id uuid, p_token text)
returns jsonb language plpgsql security definer stable
set search_path = public, private, extensions
as $$
begin
  if not public.validar_sessao_admin_global(p_funcionario_id,p_token) then
    raise exception 'Acesso global nao autorizado' using errcode='42501';
  end if;
  return jsonb_build_object(
    'empresas',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'nome',e.nome,'slug',e.slug,'cnpj',e.cnpj,'ativo',e.ativo) order by e.nome) from public.empresas e),'[]'::jsonb),
    'lojas',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'empresa_id',l.empresa_id,'nome',l.nome,'codigo',l.codigo,'ativo',l.ativo) order by l.nome) from public.lojas l),'[]'::jsonb),
    'usuarios',coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'nome',f.nome,'email',f.email,'empresa_id',f.empresa_id,'loja_id',f.loja_id,'perfil_id',f.perfil_id,'ativo',f.ativo,'global_admin',f.e_administrador) order by f.nome) from public.funcionarios f),'[]'::jsonb),
    'connector_instances',coalesce((select jsonb_agg(jsonb_build_object(
      'id',c.id,'empresa_id',c.empresa_id,'nome',c.nome,'versao',c.versao,
      'status',case when c.status='revogado' then 'revogado' when c.ultimo_contato_em > now()-interval '150 seconds' then 'online' else 'offline' end,
      'ultimo_contato_em',c.ultimo_contato_em,'perfis_cadastrados',c.perfis_cadastrados,
      'filiais_vinculadas',c.filiais_vinculadas,'operacoes_pausadas',c.operacoes_pausadas,'criado_em',c.criado_em
    ) order by c.ultimo_contato_em desc nulls last) from public.raffinato_connector_instances c),'[]'::jsonb),
    'conectores',coalesce((select jsonb_agg(jsonb_build_object(
      'id',r.id,'empresa_id',r.empresa_id,'loja_id',r.loja_id,'nome_conexao',r.nome_conexao,
      'connector_instance_id',r.connector_instance_id,'connection_profile_id',r.connection_profile_id,
      'raffinato_filial_id',r.raffinato_filial_id,'status',r.status,
      'ultima_sincronizacao_em',r.ultima_sincronizacao_em,'ultimo_teste_em',r.ultimo_teste_em,
      'ultimo_erro',r.ultimo_erro,'atualizado_em',r.atualizado_em
    ) order by r.atualizado_em desc) from public.raffinato_integracoes r),'[]'::jsonb)
  );
end $$;

revoke all on function public.obter_painel_admin_global(uuid,text) from public;
grant execute on function public.obter_painel_admin_global(uuid,text) to anon,authenticated;
notify pgrst,'reload schema';
