-- Abre o ponto usando o tenant do cadastro do funcionario, sem depender dos
-- claims/sessao do terminal. A credencial e validada novamente dentro do banco.
create or replace function public.abrir_ponto_funcionario_seguro(
  p_funcionario_id uuid,
  p_pin text,
  p_data date,
  p_entrada_em timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_funcionario public.funcionarios%rowtype;
  v_registro public.ponto_registros%rowtype;
  v_hash text;
  v_criado boolean := false;
begin
  if p_funcionario_id is null or p_data is null or p_entrada_em is null
     or nullif(trim(coalesce(p_pin, '')), '') is null then
    raise exception 'Dados obrigatorios do ponto nao informados.' using errcode = '22023';
  end if;

  select f.* into v_funcionario
  from public.funcionarios f
  where f.id = p_funcionario_id and f.ativo is true;
  if not found then
    raise exception 'Funcionario inexistente ou inativo.' using errcode = 'P0002';
  end if;

  select c.segredo_hash into v_hash
  from private.credenciais_sistema c
  where c.tipo = 'funcionario'
    and c.finalidade = 'pin'
    and c.entidade_id = p_funcionario_id;
  if v_hash is null or v_hash <> extensions.crypt(trim(p_pin), v_hash) then
    raise exception 'PIN invalido.' using errcode = '28000';
  end if;

  select pr.* into v_registro
  from public.ponto_registros pr
  where pr.funcionario_id = p_funcionario_id and pr.data_ponto = p_data
  order by pr.created_at asc
  limit 1;

  if not found then
    insert into public.ponto_registros (
      funcionario_id, data_ponto, entrada_em, inicio_intervalo_em,
      retorno_intervalo_em, saida_em, loja_id, empresa_id
    ) values (
      p_funcionario_id, p_data, p_entrada_em, null,
      null, null, v_funcionario.loja_id, v_funcionario.empresa_id
    )
    returning * into v_registro;
    v_criado := true;
  end if;

  return jsonb_build_object(
    'id', v_registro.id,
    'criado', v_criado,
    'loja_id', v_registro.loja_id,
    'empresa_id', v_registro.empresa_id
  );
end;
$$;

revoke all on function public.abrir_ponto_funcionario_seguro(uuid, text, date, timestamptz) from public;
grant execute on function public.abrir_ponto_funcionario_seguro(uuid, text, date, timestamptz) to anon, authenticated;
