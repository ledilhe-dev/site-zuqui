# Auditoria da interface - 2026-11-10

## Causa-raiz

O frontend e um documento HTML monolitico com dezenas de folhas de estilo em cascata. As camadas `99`, `104`, `113`, `119` e `121` redefinem os mesmos controles com breakpoints e alturas diferentes. Filtros importantes tambem usam largura, posicionamento e dimensoes inline. O resultado depende da ordem de carregamento e da largura da janela, em vez da largura real do conteiner.

## Inventario

- Controles nativos e filtros: `index.html` e modulos `assets/js/20` a `98`.
- Datas: inputs nativos e padronizador `92-date-filter-standardizer.js`.
- Multisselecao: filtros de relatorios, Raffinato e categorias de Contas a Pagar.
- Tabelas e dashboards: financeiro, relatorios, atendimento, Raffinato, checklist, ponto e escalas.
- Layout: sidebar/topbar globais e paginas `.pagina`.

## Fundacao consolidada

`125-app-design-system.css` e a ultima camada e define tokens, controles, barras fluidas, tabelas, modais, popovers, touch targets e container queries. `99-app-design-system.js` classifica o markup legado sem trocar IDs, handlers, consultas ou estado.

## Contas a Pagar

O filtro de categorias continua usando o `Set` e os handlers existentes. Foi adicionado apenas filtro visual por texto, sem remover checkboxes ou limpar selecoes. O popover passa a ser medido contra a viewport e abre acima quando nao existe espaco abaixo.

## Escopo preservado

Nao houve alteracao de banco, API, integracao, permissao, calculo financeiro ou publicacao. A migracao e compativel com o markup atual e pode ser adotada gradualmente pelos modulos.

## Validacao executada

- 6 testes de contrato e regressao de datas: aprovados.
- Auditoria real em Chrome headless: 14/14 viewports aprovadas, sem overflow de pagina, sobreposicao de topbar ou menu fora da tela.
- Viewports: 320, 360, 375, 390, 430, 667 (paisagem), 768, 834, 1024, 1180, 1366, 1440, 1600 e 1920 px.
- O teste agora usa perfil temporario e uma aba isolada por viewport, eliminando estado residual entre resolucoes.

## Pendencias conhecidas

- A arvore de trabalho ja continha alteracoes extensas e nao relacionadas, inclusive conversao de encoding em `index.html`. Elas foram preservadas e nao foram corrigidas neste trabalho.
- Validacao de zoom em 125%, 150% e 200% e screenshots de sessao autenticada dependem de credenciais/dados operacionais e nao foram automatizadas nesta etapa.
