-- Permite o fluxo de autenticacao proprio do CheckDiario enquanto preserva
-- a consistencia empresa/loja. A mesma conexao SQL pode ser usada por lojas
-- diferentes; a unicidade permanece somente em loja_id.

drop policy if exists raffinato_integracoes_select on public.raffinato_integracoes;
drop policy if exists raffinato_integracoes_insert on public.raffinato_integracoes;
drop policy if exists raffinato_integracoes_update on public.raffinato_integracoes;
drop policy if exists raffinato_integracoes_delete on public.raffinato_integracoes;
create policy raffinato_integracoes_select
  on public.raffinato_integracoes
  for select
  to anon, authenticated
  using (
    public.current_empresa_id() is null
    or empresa_id = public.current_empresa_id()
  );
create policy raffinato_integracoes_insert
  on public.raffinato_integracoes
  for insert
  to anon, authenticated
  with check (
    (public.current_empresa_id() is null or empresa_id = public.current_empresa_id())
    and exists (
      select 1
      from public.lojas loja
      where loja.id = loja_id
        and loja.empresa_id = empresa_id
    )
  );
create policy raffinato_integracoes_update
  on public.raffinato_integracoes
  for update
  to anon, authenticated
  using (
    public.current_empresa_id() is null
    or empresa_id = public.current_empresa_id()
  )
  with check (
    (public.current_empresa_id() is null or empresa_id = public.current_empresa_id())
    and exists (
      select 1
      from public.lojas loja
      where loja.id = loja_id
        and loja.empresa_id = empresa_id
    )
  );
create policy raffinato_integracoes_delete
  on public.raffinato_integracoes
  for delete
  to anon, authenticated
  using (
    public.current_empresa_id() is null
    or empresa_id = public.current_empresa_id()
  );
