# Leitor de documentos financeiros

Esta Edge Function valida a sessao e o tenant, verifica o arquivo e encaminha a leitura para o servico Codex Reader ja existente na VPS. O frontend nao chama diretamente a API de leitura nem armazena chaves.

## Secrets da Edge Function

- `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`: configuracao existente do Supabase.
- `CODEX_READER_URL` e `CODEX_READER_SECRET`: endereco interno e segredo compartilhado com o servico Codex Reader.
- `CODEX_READER_TIMEOUT_MS`: opcional; limite entre 30 e 180 segundos (padrao 165 segundos).

O processo Codex Reader na VPS usa `CODEX_READER_MODEL` (padrao `gpt-5.6-sol`) e `CODEX_READER_SECRET` no arquivo de ambiente local. Nao cadastre chaves no frontend, no Git ou em argumentos/historicos de shell.

## Endpoint e validacao

O endpoint existente e `POST /functions/v1/openai-document-reader`. A importacao exige os cabecalhos de sessao operacional e valida permissao financeira antes de encaminhar o documento.

Depois de uma publicacao, confirme em ambiente controlado que uma chamada sem sessao recebe `401` e que a resposta nao inclui o conteudo original nem segredos. A leitura real aciona o Codex Reader e nao deve ser usada em testes automatizados sem necessidade.

## Persistencia do aprendizado de categoria

A migracao `202611140001_fatura_categoria_memoria.sql` cria a memoria PostgreSQL com chave composta por empresa, loja e estabelecimento e politicas RLS vinculadas ao contexto operacional. Aplique as migrations antes de depender de novas sugestoes entre sessoes/dispositivos.
