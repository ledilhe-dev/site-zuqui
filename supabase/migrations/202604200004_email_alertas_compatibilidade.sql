do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'email_alertas'
      and column_name = 'tentativas'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'email_alertas'
      and column_name = 'attempts'
  ) then
    execute 'alter table public.email_alertas rename column tentativas to attempts';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'email_alertas'
      and column_name = 'enviado_em'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'email_alertas'
      and column_name = 'sent_at'
  ) then
    execute 'alter table public.email_alertas rename column enviado_em to sent_at';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'email_alertas'
      and column_name = 'erro_em'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'email_alertas'
      and column_name = 'failed_at'
  ) then
    execute 'alter table public.email_alertas rename column erro_em to failed_at';
  end if;
end
$$;

alter table public.email_alertas add column if not exists sent_at timestamptz;
alter table public.email_alertas add column if not exists failed_at timestamptz;
alter table public.email_alertas add column if not exists attempts integer;
alter table public.email_alertas add column if not exists ultimo_erro text;

update public.email_alertas
set attempts = 0
where attempts is null;

alter table public.email_alertas alter column attempts set default 0;
alter table public.email_alertas alter column attempts set not null;

alter table public.email_alertas drop constraint if exists email_alertas_status_check;

update public.email_alertas
set status = case lower(coalesce(status, ''))
  when 'pendente' then 'pending'
  when 'enviado' then 'sent'
  when 'erro' then 'error'
  else coalesce(status, 'pending')
end;

alter table public.email_alertas alter column status set default 'pending';
alter table public.email_alertas alter column status set not null;

alter table public.email_alertas
  add constraint email_alertas_status_check
  check (status in ('pending', 'sent', 'error'));

create index if not exists email_alertas_status_created_at_idx
  on public.email_alertas (status, created_at);