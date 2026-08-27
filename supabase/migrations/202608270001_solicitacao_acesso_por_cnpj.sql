-- Entrada publica estreita: resolve o tenant exclusivamente pelo CNPJ informado.
alter table public.solicitacoes_acesso
  add column if not exists mensagem text;

drop index if exists public.ux_solicitacoes_pendentes_email_normalizado;
drop index if exists public.ux_solicitacoes_pendentes_nome_normalizado;

create unique index if not exists ux_solicitacoes_pendentes_empresa_email
  on public.solicitacoes_acesso (empresa_id, lower(btrim(email)))
  where status = 'pendente' and email is not null and btrim(email) <> '';

create or replace function public.solicitar_acesso_por_cnpj(
  p_nome text,
  p_cnpj text,
  p_email text,
  p_mensagem text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_nome text := btrim(coalesce(p_nome, ''));
  v_cnpj text := regexp_replace(coalesce(p_cnpj, ''), '[^0-9]', '', 'g');
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_mensagem text := nullif(btrim(coalesce(p_mensagem, '')), '');
  v_empresa_id uuid;
  v_loja_id uuid;
  v_loja_obrigatoria boolean := false;
begin
  if length(v_nome) < 4
    or length(v_cnpj) <> 14
    or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or length(coalesce(v_mensagem, '')) > 500 then
    return jsonb_build_object('ok', false, 'codigo', 'dados_invalidos');
  end if;

  select e.id
    into v_empresa_id
    from public.empresas e
   where regexp_replace(coalesce(e.cnpj, ''), '[^0-9]', '', 'g') = v_cnpj
     and e.ativo is true
   limit 1;

  if v_empresa_id is null then
    return jsonb_build_object('ok', false, 'codigo', 'empresa_nao_encontrada');
  end if;

  if exists (
    select 1
      from public.solicitacoes_acesso s
     where s.empresa_id = v_empresa_id
       and lower(btrim(s.email)) = v_email
       and s.status = 'pendente'
  ) then
    return jsonb_build_object('ok', false, 'codigo', 'solicitacao_pendente');
  end if;

  select a.attnotnull
    into v_loja_obrigatoria
    from pg_catalog.pg_attribute a
   where a.attrelid = 'public.solicitacoes_acesso'::regclass
     and a.attname = 'loja_id'
     and a.attnum > 0
     and not a.attisdropped;

  if coalesce(v_loja_obrigatoria, false) then
    select l.id
      into v_loja_id
      from public.lojas l
     where l.empresa_id = v_empresa_id
       and l.ativo is true
     order by l.id
     limit 1;

    if v_loja_id is null then
      return jsonb_build_object('ok', false, 'codigo', 'loja_nao_encontrada');
    end if;

    execute $insert$
      insert into public.solicitacoes_acesso
        (empresa_id, loja_id, nome, cnpj, email, mensagem, observacao, status, created_at)
      values ($1, $2, $3, $4, $5, $6, $6, 'pendente', now())
    $insert$ using v_empresa_id, v_loja_id, v_nome, v_cnpj, v_email, v_mensagem;
  else
    insert into public.solicitacoes_acesso
      (empresa_id, nome, cnpj, email, mensagem, observacao, status, created_at)
    values
      (v_empresa_id, v_nome, v_cnpj, v_email, v_mensagem, v_mensagem, 'pendente', now());
  end if;

  return jsonb_build_object('ok', true);
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'codigo', 'solicitacao_pendente');
end;
$$;

revoke all on function public.solicitar_acesso_por_cnpj(text, text, text, text) from public;
grant execute on function public.solicitar_acesso_por_cnpj(text, text, text, text) to anon, authenticated;

-- O formulario pre-login nao pode escrever diretamente nem ler/alterar registros.
revoke insert, select, update, delete on public.solicitacoes_acesso from anon;
