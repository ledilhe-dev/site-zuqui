create or replace function public.request_store_authorized(p_empresa_id uuid, p_loja_id uuid)
returns boolean language plpgsql security definer stable
set search_path = pg_catalog, public, private, extensions
as $$ declare h jsonb:=private.request_headers_json(); v_id uuid; v_loja uuid; v_token text; v_global text;
begin
  begin v_id:=nullif(h->>'x-funcionario-id','')::uuid; exception when others then return false; end;
  begin v_loja:=nullif(h->>'x-loja-id','')::uuid; exception when others then return false; end;
  -- Durante a montagem segura da sessão, cada linha só é visível se pertencer a uma loja autorizada.
  v_loja:=coalesce(v_loja,p_loja_id);
  if v_id is null or v_loja is null or v_loja is distinct from p_loja_id then return false; end if;
  if not exists(select 1 from public.lojas l where l.id=v_loja and l.empresa_id=p_empresa_id and l.ativo is not false) then return false; end if;
  v_token:=coalesce(h->>'x-operational-token',''); v_global:=coalesce(h->>'x-global-admin-token','');
  if v_global<>'' and public.validar_sessao_admin_global(v_id,v_global) then return true; end if;
  if not exists(select 1 from private.sessoes_operacionais s where s.principal_id=v_id
    and s.token_hash=encode(extensions.digest(v_token,'sha256'),'hex') and s.revogado_em is null and s.expira_em>now()) then return false; end if;
  return exists(select 1 from private.sessoes_operacionais s
    where s.principal_id=v_id and s.token_hash=encode(extensions.digest(v_token,'sha256'),'hex')
      and ((s.principal_tipo='funcionario' and exists(select 1 from public.funcionario_lojas fl join public.perfis p on p.id=fl.perfil_id
             where fl.funcionario_id=v_id and fl.loja_id=v_loja and fl.ativo is true and p.loja_id=v_loja and p.ativo is true))
        or (s.principal_tipo='usuario_admin' and exists(select 1 from public.usuarios_admin a where a.id=v_id and a.loja_id=v_loja and a.ativo is true))));
end $$;

do $$ declare t text; pol record;
begin
  foreach t in array array[
    'checklists','checklist_lancamentos','checklist_execucoes','ponto_registros','ponto_intervalos',
    'ponto_ajustes_solicitacoes','alertas_rapidos','tarefas','agenda','escala_plantoes',
    'fatura_categoria_memoria','fatura_importacoes_log','raffinato_integracoes',
    'google_business_conexoes','google_business_locais','google_avaliacoes',
    'google_avaliacoes_metricas_diarias','google_sincronizacoes_logs'
  ] loop
    if to_regclass('public.'||t) is null
      or not exists(select 1 from information_schema.tables where table_schema='public' and table_name=t and table_type='BASE TABLE')
      or not exists(select 1 from information_schema.columns where table_schema='public' and table_name=t and column_name='empresa_id')
      or not exists(select 1 from information_schema.columns where table_schema='public' and table_name=t and column_name='loja_id')
    then continue; end if;
    execute format('alter table public.%I enable row level security',t);
    for pol in select policyname from pg_policies where schemaname='public' and tablename=t loop
      execute format('drop policy %I on public.%I',pol.policyname,t);
    end loop;
    execute format('create policy tenant_select on public.%I for select to anon,authenticated using (public.request_store_authorized(empresa_id,loja_id))',t);
    execute format('create policy tenant_insert on public.%I for insert to anon,authenticated with check (public.request_store_authorized(empresa_id,loja_id))',t);
    execute format('create policy tenant_update on public.%I for update to anon,authenticated using (public.request_store_authorized(empresa_id,loja_id)) with check (public.request_store_authorized(empresa_id,loja_id))',t);
    execute format('create policy tenant_delete on public.%I for delete to anon,authenticated using (public.request_store_authorized(empresa_id,loja_id))',t);
  end loop;
end $$;

notify pgrst,'reload schema';
