-- O terminal pode registrar ponto de um funcionário em qualquer loja à qual
-- ele esteja ativamente vinculado. O trigger legado sobrescrevia a loja
-- explicitamente enviada com funcionarios.loja_id (loja principal), fazendo o
-- WITH CHECK da RLS comparar lojas diferentes e negar a batida.
create or replace function public.preencher_loja_empresa_ponto()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_loja_principal uuid;
  v_empresa_principal uuid;
  v_empresa_loja uuid;
begin
  select f.loja_id, f.empresa_id
    into v_loja_principal, v_empresa_principal
    from public.funcionarios f
   where f.id = new.funcionario_id;

  -- Preserve o tenant explícito da sessão. Use a loja principal apenas para
  -- linhas legadas que realmente não informarem loja_id.
  new.loja_id := coalesce(new.loja_id, v_loja_principal);

  if new.loja_id is not null then
    select l.empresa_id
      into v_empresa_loja
      from public.lojas l
     where l.id = new.loja_id
       and l.ativo is not false;
  end if;

  if v_empresa_loja is null then
    raise exception 'Loja do ponto inválida ou inativa' using errcode = '23514';
  end if;

  if new.funcionario_id is not null
     and new.loja_id is distinct from v_loja_principal
     and not exists (
       select 1
         from public.funcionario_lojas fl
        where fl.funcionario_id = new.funcionario_id
          and fl.loja_id = new.loja_id
          and fl.ativo is true
     ) then
    raise exception 'Funcionário sem vínculo ativo com a loja do ponto' using errcode = '23514';
  end if;

  -- A empresa é sempre derivada da loja escolhida, impedindo combinações
  -- empresa/loja forjadas e preservando o isolamento multiempresa.
  new.empresa_id := coalesce(v_empresa_loja, new.empresa_id, v_empresa_principal);
  return new;
end;
$$;

notify pgrst, 'reload schema';
