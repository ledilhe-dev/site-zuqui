# Integração Google Business Profile

## Pré-requisitos

1. Criar um projeto no Google Cloud e solicitar acesso às Business Profile APIs.
2. Ativar:
   - My Business Account Management API
   - My Business Business Information API
   - Google My Business API
3. Criar um cliente OAuth 2.0 do tipo aplicação Web.
4. Cadastrar como URI de redirecionamento:
   `https://tqfoxqbmslxoynrasltl.supabase.co/functions/v1/google-business`

## Aplicação no Supabase

Execute a migration:

```bash
supabase db push
```

Cadastre os segredos (use valores aleatórios longos para `STATE_SECRET` e `TOKEN_KEY`):

```bash
supabase secrets set GOOGLE_BUSINESS_CLIENT_ID="..."
supabase secrets set GOOGLE_BUSINESS_CLIENT_SECRET="..."
supabase secrets set GOOGLE_BUSINESS_REDIRECT_URI="https://tqfoxqbmslxoynrasltl.supabase.co/functions/v1/google-business"
supabase secrets set GOOGLE_BUSINESS_STATE_SECRET="..."
supabase secrets set GOOGLE_BUSINESS_TOKEN_KEY="..."
supabase secrets set APP_URL="https://checkdiario.com.br/"
```

Publique a função sem verificação JWT na borda, pois o callback OAuth do Google é uma
requisição GET assinada pelo parâmetro `state` e não possui uma sessão Supabase:

```bash
supabase functions deploy google-business --no-verify-jwt
```

O `client_secret` fica somente nos Secrets da Edge Function. O `refresh_token` é
criptografado com AES-GCM antes de ser salvo e nunca é exposto ao frontend.

## Operação

- Abra **Estatísticas de atendimento**.
- Clique em **Conectar Google** e autorize a conta que administra os perfis.
- Clique em **Sincronizar**.
- Vincule cada registro de `google_business_locais.loja_id` à loja correspondente
  quando uma conta Google administrar mais de uma unidade.

## Acesso consolidado por loja

O painel nunca usa todas as lojas da empresa automaticamente. Para cada usuário:

- são consultados os vínculos ativos em `funcionario_lojas`;
- o perfil daquele vínculo precisa ter `estatisticas_atendimento: true`;
- perfis `ADM` e `MASTER` vinculados à loja também são aceitos;
- lojas às quais o usuário tem acesso operacional, mas sem essa permissão no perfil
  local, não aparecem no painel;
- a opção “Visão geral” consolida somente os locais autorizados por essa regra.

Portanto, a autorização deve ser configurada em **Perfis**, dentro de cada loja. Isso
permite que um proprietário visualize várias unidades em uma única tela sem conceder
as avaliações a outros usuários que compartilham acessos diferentes.

Para atualização automática, agende uma chamada POST à função com `action: "sync"`
a cada poucas horas usando um job autenticado do Supabase.
