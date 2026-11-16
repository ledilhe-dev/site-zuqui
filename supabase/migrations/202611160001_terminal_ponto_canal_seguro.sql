-- Mantem as regras de jornada no frontend, mas permite que o terminal leia e
-- atualize somente o ponto do funcionario cujo PIN foi validado pelo banco.
-- Isso evita que a RLS da sessao administrativa oculte um registro ja aberto.

create or replace function public.carregar_ponto_funcionario_seguro(
  p_funcionario_id uuid,
  p_pin text,
  p_data date
) returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_hash text;
  v_registro public.ponto_registros%rowtype;
  v_intervalos jsonb := '[]'::jsonb;
begin
  select c.segredo_hash into v_hash
    from private.credenciais_sistema c
   where c.tipo = 'funcionario'
     and c.finalidade = 'pin'
     and c.entidade_id = p_funcionario_id;

  if v_hash is null or v_hash <> extensions.crypt(trim(coalesce(p_pin, '')), v_hash) then
    raise exception 'PIN invalido.' using errcode = '28000';
  end if;

  select pr.* into v_registro
    from public.ponto_registros pr
   where pr.funcionario_id = p_funcionario_id
     and pr.data_ponto = p_data
   order by (pr.saida_em is null) desc, pr.created_at asc
   limit 1;

  if not found then
    return jsonb_build_object('registro', null, 'intervalos', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(to_jsonb(pi) order by pi.ordem), '[]'::jsonb)
    into v_intervalos
    from public.ponto_intervalos pi
   where pi.ponto_registro_id = v_registro.id;

  return jsonb_build_object(
    'registro', to_jsonb(v_registro),
    'intervalos', v_intervalos
  );
end;
$$;

create or replace function public.atualizar_ponto_funcionario_seguro(
  p_registro_id uuid,
  p_funcionario_id uuid,
  p_pin text,
  p_campos jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_hash text;
  v_registro public.ponto_registros%rowtype;
begin
  if p_campos - array[
    'entrada_em', 'inicio_intervalo_em', 'retorno_intervalo_em', 'saida_em',
    'loja_id', 'empresa_id', 'updated_at'
  ] <> '{}'::jsonb then
    raise exception 'Campos de ponto nao permitidos.' using errcode = '22023';
  end if;

  select c.segredo_hash into v_hash
    from private.credenciais_sistema c
   where c.tipo = 'funcionario'
     and c.finalidade = 'pin'
     and c.entidade_id = p_funcionario_id;

  if v_hash is null or v_hash <> extensions.crypt(trim(coalesce(p_pin, '')), v_hash) then
    raise exception 'PIN invalido.' using errcode = '28000';
  end if;

  select pr.* into v_registro
    from public.ponto_registros pr
   where pr.id = p_registro_id
     and pr.funcionario_id = p_funcionario_id
   for update;
  if not found then
    raise exception 'Registro de ponto nao encontrado.' using errcode = 'P0002';
  end if;

  update public.ponto_registros
     set entrada_em = case when p_campos ? 'entrada_em' then nullif(p_campos->>'entrada_em', '')::timestamptz else entrada_em end,
         inicio_intervalo_em = case when p_campos ? 'inicio_intervalo_em' then nullif(p_campos->>'inicio_intervalo_em', '')::timestamptz else inicio_intervalo_em end,
         retorno_intervalo_em = case when p_campos ? 'retorno_intervalo_em' then nullif(p_campos->>'retorno_intervalo_em', '')::timestamptz else retorno_intervalo_em end,
         saida_em = case when p_campos ? 'saida_em' then nullif(p_campos->>'saida_em', '')::timestamptz else saida_em end,
         loja_id = case when p_campos ? 'loja_id' and nullif(p_campos->>'loja_id', '') is not null then (p_campos->>'loja_id')::uuid else loja_id end,
         empresa_id = case when p_campos ? 'empresa_id' and nullif(p_campos->>'empresa_id', '') is not null then (p_campos->>'empresa_id')::uuid else empresa_id end,
         updated_at = coalesce(nullif(p_campos->>'updated_at', '')::timestamptz, now())
   where id = p_registro_id
   returning * into v_registro;

  return to_jsonb(v_registro);
end;
$$;

create or replace function public.inserir_intervalo_ponto_funcionario_seguro(
  p_registro_id uuid,
  p_funcionario_id uuid,
  p_pin text,
  p_ordem integer,
  p_inicio_em timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_hash text;
  v_intervalo public.ponto_intervalos%rowtype;
begin
  select c.segredo_hash into v_hash from private.credenciais_sistema c
   where c.tipo='funcionario' and c.finalidade='pin' and c.entidade_id=p_funcionario_id;
  if v_hash is null or v_hash <> extensions.crypt(trim(coalesce(p_pin, '')), v_hash) then
    raise exception 'PIN invalido.' using errcode = '28000';
  end if;
  if not exists (select 1 from public.ponto_registros where id=p_registro_id and funcionario_id=p_funcionario_id) then
    raise exception 'Registro de ponto nao encontrado.' using errcode = 'P0002';
  end if;
  insert into public.ponto_intervalos (ponto_registro_id, ordem, inicio_em, retorno_em)
  values (p_registro_id, p_ordem, p_inicio_em, null)
  returning * into v_intervalo;
  return to_jsonb(v_intervalo);
end;
$$;

create or replace function public.retornar_intervalo_ponto_funcionario_seguro(
  p_intervalo_id uuid,
  p_registro_id uuid,
  p_funcionario_id uuid,
  p_pin text,
  p_retorno_em timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_hash text;
  v_intervalo public.ponto_intervalos%rowtype;
begin
  select c.segredo_hash into v_hash from private.credenciais_sistema c
   where c.tipo='funcionario' and c.finalidade='pin' and c.entidade_id=p_funcionario_id;
  if v_hash is null or v_hash <> extensions.crypt(trim(coalesce(p_pin, '')), v_hash) then
    raise exception 'PIN invalido.' using errcode = '28000';
  end if;
  if not exists (select 1 from public.ponto_registros where id=p_registro_id and funcionario_id=p_funcionario_id) then
    raise exception 'Registro de ponto nao encontrado.' using errcode = 'P0002';
  end if;
  update public.ponto_intervalos set retorno_em=p_retorno_em
   where id=p_intervalo_id and ponto_registro_id=p_registro_id
   returning * into v_intervalo;
  if not found then raise exception 'Intervalo nao encontrado.' using errcode = 'P0002'; end if;
  return to_jsonb(v_intervalo);
end;
$$;

revoke all on function public.carregar_ponto_funcionario_seguro(uuid,text,date) from public;
revoke all on function public.atualizar_ponto_funcionario_seguro(uuid,uuid,text,jsonb) from public;
revoke all on function public.inserir_intervalo_ponto_funcionario_seguro(uuid,uuid,text,integer,timestamptz) from public;
revoke all on function public.retornar_intervalo_ponto_funcionario_seguro(uuid,uuid,uuid,text,timestamptz) from public;
grant execute on function public.carregar_ponto_funcionario_seguro(uuid,text,date) to anon, authenticated;
grant execute on function public.atualizar_ponto_funcionario_seguro(uuid,uuid,text,jsonb) to anon, authenticated;
grant execute on function public.inserir_intervalo_ponto_funcionario_seguro(uuid,uuid,text,integer,timestamptz) to anon, authenticated;
grant execute on function public.retornar_intervalo_ponto_funcionario_seguro(uuid,uuid,uuid,text,timestamptz) to anon, authenticated;

notify pgrst, 'reload schema';
