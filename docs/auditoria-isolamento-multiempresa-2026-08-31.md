# Auditoria de isolamento multiempresa/multiloja — 31/08/2026

## 1. Resumo executivo

Foram confirmadas duas causas independentes: o dashboard conservava o título/cache da loja anterior após uma troca de contexto, e parte das tabelas aceitava a chave pública sem uma sessão operacional opaca validada no banco. A correção fecha o acesso no Supabase (RLS), invalida respostas assíncronas antigas, limpa caches na troca de loja e restringe o conector Raffinato à empresa e loja autorizadas.

## 2. Classificação do incidente

- “LILIANE EMPRÉSTIMOS” com valores zerados: vazamento visual por estado residual do frontend.
- Policies públicas históricas (`USING/WITH CHECK true`): risco real de leitura/gravação direta, independentemente da tela.
- Raffinato: autorização administrativa aceitava um administrador ativo sem comparar empresa e loja.

## 3. Modelo de isolamento adotado

`empresa_id` e `loja_id` continuam sendo o tenant dos registros operacionais. O frontend envia apenas o contexto; a autoridade é uma sessão operacional aleatória, com hash no schema `private`, expiração e vínculo ativo com perfil da loja. `request_store_authorized()` valida token, principal, empresa, loja, vínculo e perfil.

## 4. Frontend

- Toda troca/logout chama a limpeza central de dados visuais.
- O dashboard captura empresa, loja e número sequencial da requisição; respostas de contexto anterior são descartadas.
- Título, séries, mapas, filtros e opções financeiras são zerados antes de novo carregamento.
- Agenda deixou de aceitar `localStorage` antigo como fonte de loja.

## 5. RLS e policies

As migrations `005`, `006` e `007` substituem policies permissivas nas tabelas financeiras, operacionais e auxiliares. A policy exige `request_store_authorized(empresa_id, loja_id)` ou deriva o tenant da loja/tabela-pai. A fila `email_alertas` deixou de ser exposta ao navegador.

## 6. RPCs, functions e views

- RPCs de autenticação emitem sessão operacional opaca; PIN/senha não viram autorização de acesso a dados.
- Views operacionais existentes usam `security_invoker` quando aplicável.
- Helpers de RLS são `SECURITY DEFINER`, com `search_path` fixo e execução explicitamente concedida.
- O relay Raffinato, que usa `service_role`, filtra consultas pelo vínculo da integração e agora exige correspondência exata de `empresa_id` e `loja_id` para administrador.

## 7. Matriz auditada

| Área | Escopo | Proteção principal |
|---|---|---|
| Dashboard/Financeiro/Recebíveis | empresa + loja | RLS 005 + invalidação de requisição |
| Tarefas/Checklist/Relatórios | empresa + loja | RLS 006; auxiliares via tabela-pai na 007 |
| Agenda/Ponto/Alertas | empresa + loja | RLS 006/007; contexto persistido removido |
| Configurações/E-mail/Feriados | loja | RLS 007 derivando empresa pela loja |
| Raffinato | integração + empresa + loja | Edge Function + RLS da configuração |
| Solicitações globais | pendente, sem tenant obrigatório | RPC global dedicada; não usa policy operacional |

## 8. Caches e concorrência

Foi introduzido um contador monotônico por carregamento financeiro. A renderização só ocorre se contador, empresa e loja ainda forem idênticos. A troca de contexto incrementa o contador e limpa o DOM imediatamente.

## 9. Armazenamento local

O armazenamento do navegador permanece apenas para preferências não autoritativas. IDs persistidos não concedem acesso: RLS exige token opaco e vínculo ativo. Os fallbacks de loja encontrados nos patches de agenda foram removidos.

## 10. Service role

O uso encontrado no código publicado é o `raffinato-relay`. Cada operação de cache/credencial é ligada à integração e ao par empresa/loja. A falha de autorização administrativa foi corrigida e a função foi republicada.

## 11. Testes executados

- Validação sintática dos JavaScripts alterados.
- Consulta REST com chave `anon`, sem sessão operacional: zero linhas nas tabelas financeiras e operacionais.
- Repetição nas auxiliares: `checklist_lancamento_eventos`, `checklist_execucao_usuarios`, `checklist_respostas`, `ponto_batidas_auditoria`, `email_notificacoes`, `configuracoes_loja`, `preferencias_usuario`, `feriados_loja` e `email_alertas`: zero linhas.
- Validação visual do cenário de troca: título genérico e componentes vazios são aplicados antes da nova carga; resposta atrasada não pode renderizar.
- Deploy transacional das migrations e publicação da Edge Function.

## 12. Arquivos e migrations

- `assets/js/10-dashboard.js`
- `assets/js/79-runtime-extensions.js`
- `assets/js/81-schedule-modal-patch.js`
- `assets/js/84-schedule-report-patch.js`
- `supabase/functions/raffinato-relay/index.ts`
- `202608310005_rls_financeiro_contexto_opaco.sql`
- `202608310006_rls_tenant_tabelas_operacionais.sql`
- `202608310007_rls_tenant_tabelas_auxiliares.sql`

## 13. Critério de segurança e operação

O sistema falha fechado: sem token, vínculo, perfil ativo ou contexto coerente, o banco retorna zero linhas/nega a mutação. Trocar IDs no navegador não amplia acesso. Sessões anteriores à versão 3.2.41 devem efetuar novo login para receber o token operacional. Novas tabelas operacionais precisam declarar empresa/loja e entrar na revisão de RLS antes de serem expostas ao cliente.
