-- Uma solicitação pública existe antes de qualquer vínculo com empresa/loja.
alter table public.solicitacoes_acesso
  add column if not exists telefone text,
  add column if not exists empresa_informada text,
  add column if not exists loja_informada text,
  add column if not exists empresa_id uuid references public.empresas(id) on delete set null,
  add column if not exists loja_id uuid references public.lojas(id) on delete set null;

alter table public.solicitacoes_acesso alter column empresa_id drop not null;
alter table public.solicitacoes_acesso alter column loja_id drop not null;

drop index if exists public.ux_solicitacoes_pendentes_email_normalizado;
drop index if exists public.ux_solicitacoes_pendentes_nome_normalizado;
drop index if exists public.ux_solicitacoes_pendentes_pin_normalizado;

-- CNPJ e nomes informados ajudam a análise, mas não escolhem o tenant.
drop trigger if exists trg_localizar_solicitacao_acesso on public.solicitacoes_acesso;

alter table public.solicitacoes_acesso enable row level security;

drop policy if exists solicitacoes_acesso_insert_empresa_transition on public.solicitacoes_acesso;
drop policy if exists solicitacoes_acesso_insert_publico on public.solicitacoes_acesso;
create policy solicitacoes_acesso_insert_publico
  on public.solicitacoes_acesso
  for insert
  to anon, authenticated
  with check (
    status = 'pendente'
    and empresa_id is null
    and loja_id is null
    and nullif(btrim(nome), '') is not null
    and nullif(btrim(email), '') is not null
    and nullif(btrim(empresa_informada), '') is not null
    and nullif(btrim(loja_informada), '') is not null
  );

-- O frontend legado usa INSERT ... RETURNING para só declarar sucesso após persistir.
drop policy if exists solicitacoes_acesso_confirmar_insert_publico on public.solicitacoes_acesso;
create policy solicitacoes_acesso_confirmar_insert_publico
  on public.solicitacoes_acesso
  for select
  to anon, authenticated
  using (true);

-- Update/delete existentes são preservados para o painel administrativo legado.
notify pgrst, 'reload schema';
