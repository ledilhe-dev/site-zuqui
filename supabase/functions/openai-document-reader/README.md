# OpenAI document reader

Endpoint server-side usado somente pela importacao de imagens e PDFs do Contas a Pagar.

## Secrets no runtime da VPS

Configure no ambiente da Edge Runtime, nunca no frontend ou em arquivo versionado:

- `OPENAI_API_KEY`: nova chave de projeto da OpenAI.
- `OPENAI_DOCUMENT_MODEL`: opcional; padrao `gpt-6-luna`.
- `OPENAI_DOCUMENT_DETAIL`: opcional; `low`, `high` (padrao) ou `auto`.
- `OPENAI_DOCUMENT_TIMEOUT_MS`: opcional; padrao `45000`.
- `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`: ja exigidos pelas demais funcoes server-side.

Depois de rotacionar a chave exposta, cadastre o novo valor diretamente no gerenciador de secrets da Edge Runtime self-hosted. Nao use `config.js`, GitHub Pages, argumentos de linha de comando ou historico do shell.

## Publicacao

Publique a pasta `openai-document-reader` na mesma Edge Runtime que atende `https://api.checkdiario.com.br/functions/v1/`. O endpoint esperado e:

`POST /functions/v1/openai-document-reader`

O deploy deve preservar os secrets existentes. Confirme depois do deploy que uma requisicao sem os cabecalhos operacionais retorna `401` e que a resposta nunca inclui secrets ou o conteudo bruto do documento.
