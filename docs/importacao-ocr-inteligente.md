# Importação OCR inteligente

## Comportamento

- Lê múltiplas notificações Nubank na mesma imagem e combina a leitura específica com o parser genérico sem repetir contas.
- Aprende por loja a relação entre descrição original, observação corrigida, fornecedor e categoria.
- Consulta também o histórico recente de contas a pagar para sugerir padrões já usados.
- Mostra a confiança da observação sugerida e mantém observação, fornecedor, categoria e vencimento editáveis.
- Recalcula vencimento usando a configuração do fornecedor e mantém as proteções existentes contra duplicidade.

## Normalização

Variações jurídicas, identificadores numéricos, acentos e termos de adquirentes são removidos antes da comparação. Alguns aliases conhecidos ajudam a reconhecer marcas, por exemplo `CHAT GPT BR` como `CHATGPT` e `SPAL IND DE BEBIDAS` como `COCA COLA`.

## Aprendizado

Ao confirmar uma importação, a tabela `fatura_importacao_memoria` registra a descrição original e as escolhas finais. Na próxima ocorrência semelhante, a sugestão com maior confiança é aplicada, mas nunca bloqueia a edição manual.

O aprendizado é isolado por `empresa_id` e `loja_id`. Nenhuma imagem ou texto completo do OCR é enviado para um serviço de IA externo.
