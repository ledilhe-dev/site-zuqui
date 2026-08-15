-- Metadados nao sensiveis do mapeamento CheckDiario -> perfil local -> filial Raffinato.
-- Servidor, usuario e senha continuam protegidos localmente por DPAPI.
alter table public.raffinato_integracoes
  add column if not exists connection_profile_id uuid,
  add column if not exists connector_instance_id uuid,
  add column if not exists raffinato_filial_id integer not null default 1,
  add column if not exists nome_conexao text;

update public.raffinato_integracoes
set connection_profile_id = coalesce(connection_profile_id, gen_random_uuid()),
    nome_conexao = coalesce(nullif(nome_conexao, ''), 'Zuqui')
where connection_profile_id is null or nome_conexao is null;

alter table public.raffinato_integracoes
  add constraint raffinato_integracoes_filial_positiva
  check (raffinato_filial_id > 0) not valid;

create index if not exists raffinato_integracoes_instancia_idx
  on public.raffinato_integracoes (connector_instance_id);
create index if not exists raffinato_integracoes_perfil_idx
  on public.raffinato_integracoes (connection_profile_id);

comment on column public.raffinato_integracoes.connection_profile_id is 'UUID do perfil protegido na instalacao local; nao contem credenciais.';
comment on column public.raffinato_integracoes.connector_instance_id is 'Identidade estavel da instalacao do conector, independente de IP.';
comment on column public.raffinato_integracoes.raffinato_filial_id is 'IdFilial externo; nunca substitui lojas.id do CheckDiario.';
