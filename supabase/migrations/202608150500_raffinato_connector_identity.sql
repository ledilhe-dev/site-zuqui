-- Identidade física e pareamento outbound do Conector Raffinato.
create table if not exists public.raffinato_connector_instances (
  id uuid primary key,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nome text not null default 'Conector Raffinato',
  versao text,
  status text not null default 'offline' check (status in ('online','offline','revogado')),
  ultimo_contato_em timestamptz,
  credencial_hash text not null unique,
  perfis_cadastrados integer not null default 0,
  filiais_vinculadas integer not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table public.raffinato_connector_instances enable row level security;
revoke all on public.raffinato_connector_instances from anon, authenticated;

create table if not exists private.raffinato_connector_pairing_codes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  codigo_hash text not null unique,
  expira_em timestamptz not null,
  usado_em timestamptz,
  criado_por uuid,
  criado_em timestamptz not null default now()
);
create index if not exists raffinato_pairing_codes_validos_idx
  on private.raffinato_connector_pairing_codes (codigo_hash, expira_em)
  where usado_em is null;

alter table public.raffinato_integracoes
  drop constraint if exists raffinato_integracoes_connector_instance_fk;
alter table public.raffinato_integracoes
  add constraint raffinato_integracoes_connector_instance_fk
  foreign key (connector_instance_id) references public.raffinato_connector_instances(id) on delete set null
  not valid;

create or replace function public.gerar_codigo_pareamento_raffinato(
  p_funcionario_id uuid, p_token text, p_empresa_id uuid
) returns jsonb
language plpgsql security definer
set search_path = public, private, extensions
as $$
declare
  v_prefixo text;
  v_codigo text;
  v_expira timestamptz := now() + interval '10 minutes';
begin
  if not public.validar_sessao_admin_global(p_funcionario_id, p_token) then
    raise exception 'Sessão administrativa global inválida ou expirada.' using errcode = '42501';
  end if;
  select upper(substr(regexp_replace(coalesce(nullif(slug,''), nome), '[^a-zA-Z0-9]', '', 'g'), 1, 3))
    into v_prefixo from public.empresas where id = p_empresa_id and ativo is not false;
  if v_prefixo is null then raise exception 'Empresa ativa não encontrada.'; end if;
  v_prefixo := rpad(v_prefixo, 3, 'X');
  v_codigo := v_prefixo || '-' || upper(substr(encode(gen_random_bytes(4),'hex'),1,4)) || '-' || upper(substr(encode(gen_random_bytes(4),'hex'),1,4));
  insert into private.raffinato_connector_pairing_codes(empresa_id,codigo_hash,expira_em,criado_por)
  values (p_empresa_id, encode(digest(v_codigo,'sha256'),'hex'), v_expira, p_funcionario_id);
  return jsonb_build_object('codigo',v_codigo,'expira_em',v_expira,'empresa_id',p_empresa_id);
end $$;
revoke all on function public.gerar_codigo_pareamento_raffinato(uuid,text,uuid) from public;
grant execute on function public.gerar_codigo_pareamento_raffinato(uuid,text,uuid) to anon, authenticated;

create or replace function public.consumir_codigo_pareamento_raffinato(
  p_codigo text, p_connector_instance_id uuid, p_credencial_hash text,
  p_nome text, p_versao text
) returns jsonb
language plpgsql security definer
set search_path = public, private, extensions
as $$
declare v_codigo private.raffinato_connector_pairing_codes%rowtype;
begin
  select * into v_codigo from private.raffinato_connector_pairing_codes
   where codigo_hash=encode(digest(upper(trim(p_codigo)),'sha256'),'hex')
     and usado_em is null and expira_em > now()
   for update skip locked;
  if v_codigo.id is null then raise exception 'Código inválido, expirado ou já utilizado.' using errcode='22023'; end if;
  if exists(select 1 from public.raffinato_connector_instances where id=p_connector_instance_id) then
    raise exception 'Esta instalação já está vinculada.' using errcode='23505';
  end if;
  insert into public.raffinato_connector_instances(id,empresa_id,nome,versao,status,ultimo_contato_em,credencial_hash)
  values(p_connector_instance_id,v_codigo.empresa_id,left(coalesce(nullif(trim(p_nome),''),'Conector Raffinato'),120),left(p_versao,30),'online',now(),p_credencial_hash);
  update private.raffinato_connector_pairing_codes set usado_em=now() where id=v_codigo.id;
  return jsonb_build_object('empresa_id',v_codigo.empresa_id,'connector_instance_id',p_connector_instance_id);
end $$;
revoke all on function public.consumir_codigo_pareamento_raffinato(text,uuid,text,text,text) from public;
grant execute on function public.consumir_codigo_pareamento_raffinato(text,uuid,text,text,text) to service_role;

comment on table public.raffinato_connector_instances is 'Instalações físicas pareadas; credenciais SQL permanecem exclusivamente no Windows/DPAPI.';
comment on table private.raffinato_connector_pairing_codes is 'Códigos de vínculo de uso único e validade curta.';

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
    'usuarios',coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'nome',f.nome,'email',f.email,'empresa_id',f.empresa_id,'loja_id',f.loja_id,'perfil_id',f.perfil_id,'ativo',f.ativo,'global_admin',f."é_administrador") order by f.nome) from public.funcionarios f),'[]'::jsonb),
    'connector_instances',coalesce((select jsonb_agg(jsonb_build_object(
      'id',c.id,'empresa_id',c.empresa_id,'nome',c.nome,'versao',c.versao,
      'status',case when c.status='revogado' then 'revogado' when c.ultimo_contato_em > now()-interval '150 seconds' then 'online' else 'offline' end,
      'ultimo_contato_em',c.ultimo_contato_em,'perfis_cadastrados',c.perfis_cadastrados,
      'filiais_vinculadas',c.filiais_vinculadas,'criado_em',c.criado_em
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
grant execute on function public.obter_painel_admin_global(uuid,text) to anon, authenticated;
