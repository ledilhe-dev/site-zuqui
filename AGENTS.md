# Ambiente de publicacao

- O GitHub e o repositorio de codigo e historico, mas nao e a hospedagem de producao.
- O dominio `checkdiario.com.br` e publicado na VPS Hostinger acessada por `root@api.checkdiario.com.br`.
- O frontend ativo roda no container Docker `checkdiario-frontend`, com releases imutaveis em `/opt/checkdiario/frontend`.
- Nunca considerar um push ou um job do GitHub Pages como publicacao concluida.
- Toda publicacao deve criar um novo diretorio de release, preservar o anterior para rollback, trocar o container e validar no dominio publico os marcadores da alteracao.
- Quando arquivos listados em `assets/manifest.json`, `index.html` ou o registro do PWA mudarem, atualizar tambem o identificador de `CACHE_NAME` em `service-worker-v4.js` e a versao da URL usada em `registrarServiceWorkerPwa()`.
- O workflow do GitHub Pages deve permanecer somente manual enquanto producao estiver na VPS.
