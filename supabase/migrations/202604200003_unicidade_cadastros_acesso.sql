with duplicadas_email as (
  select id
  from (
    select
      id,
      row_number() over (
        partition by lower(btrim(email))
        order by created_at desc nulls last, id desc
      ) as linha
    from public.solicitacoes_acesso
    where status = 'pendente'
      and email is not null
      and btrim(email) <> ''
  ) base
  where linha > 1
), duplicadas_nome as (
  select id
  from (
    select
      id,
      row_number() over (
        partition by lower(regexp_replace(btrim(nome), '\s+', ' ', 'g'))
        order by created_at desc nulls last, id desc
      ) as linha
    from public.solicitacoes_acesso
    where status = 'pendente'
      and nome is not null
      and btrim(nome) <> ''
  ) base
  where linha > 1
), duplicadas_pin as (
  select id
  from (
    select
      id,
      row_number() over (
        partition by btrim(pin)
        order by created_at desc nulls last, id desc
      ) as linha
    from public.solicitacoes_acesso
    where status = 'pendente'
      and pin is not null
      and btrim(pin) <> ''
  ) base
  where linha > 1
), ids_remover as (
  select id from duplicadas_email
  union
  select id from duplicadas_nome
  union
  select id from duplicadas_pin
)
delete from public.solicitacoes_acesso
where id in (select id from ids_remover);

create unique index if not exists ux_funcionarios_email_normalizado
  on public.funcionarios (lower(btrim(email)))
  where email is not null and btrim(email) <> '';

create unique index if not exists ux_funcionarios_nome_normalizado
  on public.funcionarios (lower(regexp_replace(btrim(nome), '\s+', ' ', 'g')))
  where nome is not null and btrim(nome) <> '';

create unique index if not exists ux_funcionarios_pin_normalizado
  on public.funcionarios (btrim(pin))
  where pin is not null and btrim(pin) <> '';

create unique index if not exists ux_solicitacoes_pendentes_email_normalizado
  on public.solicitacoes_acesso (lower(btrim(email)))
  where status = 'pendente'
    and email is not null
    and btrim(email) <> '';

create unique index if not exists ux_solicitacoes_pendentes_nome_normalizado
  on public.solicitacoes_acesso (lower(regexp_replace(btrim(nome), '\s+', ' ', 'g')))
  where status = 'pendente'
    and nome is not null
    and btrim(nome) <> '';

create unique index if not exists ux_solicitacoes_pendentes_pin_normalizado
  on public.solicitacoes_acesso (btrim(pin))
  where status = 'pendente'
    and pin is not null
    and btrim(pin) <> '';