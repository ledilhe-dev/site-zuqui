# Integrações Financeiras — Fase 1

## Escopo

Esta fase cria somente a fundação do módulo. Não há autenticação bancária, consentimento Open Finance, webhook, coleta externa ou execução de inteligência artificial.

## Arquitetura

- O domínio usa o prefixo `integracoes_financeiras_` para não alterar o financeiro operacional legado.
- Todas as entidades pertencem a `empresa_id` e `loja_id`, com validação automática da relação entre os tenants.
- As configurações são agnósticas de provedor e aceitam futuramente Open Finance, Pluggy, Belvo ou outro adaptador.
- Segredos não devem ser gravados em `configuracao_publica`; `referencia_segredo` deverá apontar para um cofre seguro.
- Movimentações preservam o payload original em `dados_origem` para auditoria e reprocessamento.
- Fornecedores importados ficam separados do cadastro operacional, com vínculo opcional por `fornecedor_legado_id`.

## Front-end

As nove seções existem no `index.html` e o módulo `assets/js/33-financial-integrations.js` renderiza os componentes comuns. Essa abordagem evita duplicação e mantém o padrão global do projeto.

## Provedores e Finance AI

`integracoesFinanceirasProviders` contém contratos inativos para Manual, Open Finance, Pluggy e Belvo. `FinanceAI` é uma fachada inativa para classificação, duplicidades, assinaturas, categorias, padrões e insights. Nenhum SDK, endpoint ou modelo foi implementado.

## Segurança

- RLS limita as dez tabelas à empresa retornada por `current_empresa_id()`.
- Triggers garantem que a loja pertença à empresa informada.
- Índices cobrem tenant, status, datas, categorias, deduplicação, conciliação, regras e sincronizações.
