# Auditoria de performance da VPS - 2026-11-10

## Evidencias iniciais

- VPS: 2 vCPU, 7,8 GiB RAM, 5,3 GiB disponiveis, disco 16% ocupado, sem swap.
- Load average medido: 0,16 / 0,33 / 0,38; sem espera relevante de I/O.
- Containers principais saudaveis e sem reinicios; banco com 482 MiB e PostgREST com 138 MiB no momento da medicao.
- PostgreSQL: 24 conexoes observadas de 100 maximas, majoritariamente ociosas.
- `contasapagar`: 2.316 registros, 1.323 ativos e 616 pendentes. A maior loja tem 1.183 ativos.
- Consultas de contas no `pg_stat_statements`: medias entre 83 e 140 ms. A VPS nao esta saturada.
- Frontend e API resolvem para a VPS e o frontend usa `https://api.checkdiario.com.br`.

## Causa-raiz confirmada

O carregador de Contas a Pagar realizava uma unica consulta sem `range()`. Uma loja ja possuia 1.183 registros ativos, superior ao limite de resposta, e o frontend tratava as primeiras linhas como conjunto completo. Os filtros eram aplicados depois no navegador. O dashboard financeiro repetia o mesmo padrao para o ano.

## Correcao

- Paginacao completa em lotes de 500, com ordenacao deterministica por data e `id`.
- Respostas parciais sao descartadas em qualquer erro e a interface oferece nova tentativa.
- Requisicoes obsoletas de Contas a Pagar nao podem sobrescrever uma consulta mais nova.
- Data, status, categoria e janela padrao de 30 dias sao enviados ao banco quando semanticamente seguros.
- Dashboard financeiro usa a mesma primitiva de leitura completa.

## Medicoes

Antes:

- Consulta unica da loja principal: 1.000 linhas em 0,0314 s, `Content-Range: 0-999/*`; 183 registros ausentes.
- TTFB publico inicial observado: aproximadamente 0,458 s para frontend/API a partir da estacao de auditoria.

Depois, pela rede interna do PostgREST:

- Janela padrao de Contas a Pagar: 185 linhas em 0,0302 s.
- Consulta completa: 1.183 linhas em 3 paginas, 0,0170 a 0,0399 s nas repeticoes.
- Dashboard financeiro de 2026: 822 linhas em 2 paginas, 0,0109 s.
- Filtro da categoria com maior volume: 274 linhas em 0,0055 s.
- Filtro do fornecedor com maior volume: 283 linhas em 0,0048 s.
- TTFB publico apos a publicacao: aproximadamente 0,028 s para o frontend e 0,031 s para a API sem autenticacao.

## Integridade

API e SQL direto coincidiram exatamente na loja principal:

- 1.183 registros: 706 pagos e 477 pendentes.
- Pago: R$ 232.133,80.
- Pendente: R$ 390.971,73.
- Total: R$ 623.105,53.
- Dashboard 2026: 822 registros e R$ 279.055,12 em ambos os caminhos.

Durante a janela de publicacao, uma conta de R$ 600 foi confirmada como paga por PATRICK. A quantidade total e o valor total nao mudaram; a auditoria registrou `pago_confirmado_em` em 2026-11-10 21:48:10 UTC.

## Backup, publicacao e rollback

- Backup validado: `/opt/checkdiario/backups/checkdiario-pre-performance-20261110T214704Z.dump`.
- Formato custom do PostgreSQL, 12 MiB, catalogo com 1.911 entradas e checksum SHA-256 registrado ao lado do dump.
- Release publicado: `/opt/checkdiario/frontend/release-v304-performance-20261110-184829`.
- Container ativo: `checkdiario-frontend`.
- Rollback preservado: release anterior e container parado `checkdiario-frontend-rollback-v303`.
- Hashes dos tres assets publicos coincidiram com os arquivos locais.
- PostgREST, pooler e PostgreSQL permaneceram saudaveis; nenhum erro recente foi encontrado nos logs apos a publicacao.
