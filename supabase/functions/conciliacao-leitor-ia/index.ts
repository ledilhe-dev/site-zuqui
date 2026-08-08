const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type RequestBody = {
  arquivo_base64?: string;
  mime_type?: string;
  arquivo_nome?: string;
  empresa_id?: string;
  loja_id?: string;
  fornecedor_id?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return json({ error: "IA não configurada", code: "AI_NOT_CONFIGURED" }, 503);

    const body = await req.json() as RequestBody;
    if (!body.empresa_id || !body.loja_id || !body.fornecedor_id) {
      return json({ error: "Empresa, loja e fornecedor são obrigatórios." }, 400);
    }
    if (!body.arquivo_base64 || !body.mime_type) return json({ error: "Arquivo ausente." }, 400);
    if (body.arquivo_base64.length > 27_000_000) return json({ error: "Arquivo maior que 20 MB." }, 413);

    const isPdf = body.mime_type === "application/pdf";
    const inputFile = isPdf
      ? { type: "input_file", filename: body.arquivo_nome || "fatura.pdf", file_data: `data:application/pdf;base64,${body.arquivo_base64}` }
      : { type: "input_image", image_url: `data:${body.mime_type};base64,${body.arquivo_base64}`, detail: "high" };

    const schema = {
      type: "object",
      additionalProperties: false,
      properties: {
        instituicao: { type: ["string", "null"] },
        documento_tipo: { type: "string", enum: ["fatura_cartao", "extrato_bancario", "comprovante", "desconhecido"] },
        periodo_inicio: { type: ["string", "null"] },
        periodo_fim: { type: ["string", "null"] },
        vencimento: { type: ["string", "null"] },
        total_documento: { type: ["number", "null"] },
        moeda: { type: "string" },
        confianca_documento: { type: "number" },
        alertas: { type: "array", items: { type: "string" } },
        lancamentos: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              data: { type: ["string", "null"] },
              descricao: { type: "string" },
              valor: { type: "number" },
              tipo: { type: "string", enum: ["debito", "credito", "pagamento", "estorno", "tarifa", "juros", "outro"] },
              identificador: { type: ["string", "null"] },
              parcela_atual: { type: ["integer", "null"] },
              parcelas_total: { type: ["integer", "null"] },
              pagina: { type: ["integer", "null"] },
              texto_evidencia: { type: "string" },
              confianca: { type: "number" },
            },
            required: ["data", "descricao", "valor", "tipo", "identificador", "parcela_atual", "parcelas_total", "pagina", "texto_evidencia", "confianca"],
          },
        },
      },
      required: ["instituicao", "documento_tipo", "periodo_inicio", "periodo_fim", "vencimento", "total_documento", "moeda", "confianca_documento", "alertas", "lancamentos"],
    };

    const prompt = `Você é um extrator contábil brasileiro. Transcreva com máxima fidelidade cada lançamento visível.
Não invente, não complete descrições cortadas e não transforme totais, limites, saldos ou cabeçalhos em lançamentos.
Valores devem ser positivos; classifique pagamentos/estornos/créditos separadamente.
Datas devem ser YYYY-MM-DD. Se o ano não estiver demonstrado no documento, use null.
texto_evidencia deve ser um trecho curto exatamente como aparece no documento.
Confiança entre 0 e 1 mede legibilidade e certeza de cada campo. Marque alertas para páginas ilegíveis, totais inconsistentes,
datas sem ano ou qualquer ambiguidade. Extraia lançamentos de todas as páginas, inclusive parcelas.`;

    const openai = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: Deno.env.get("OPENAI_RECONCILIATION_MODEL") || "gpt-5.6-sol",
        reasoning: { effort: "high" },
        input: [{ role: "user", content: [{ type: "input_text", text: prompt }, inputFile] }],
        text: { format: { type: "json_schema", name: "extrato_financeiro", strict: true, schema } },
      }),
    });
    const resposta = await openai.json();
    if (!openai.ok) {
      console.error("OpenAI:", resposta);
      return json({ error: "Falha na leitura inteligente.", detail: resposta?.error?.message }, 502);
    }
    const outputText = resposta.output_text ||
      resposta.output?.flatMap((o: any) => o.content || []).find((c: any) => c.type === "output_text")?.text;
    if (!outputText) return json({ error: "A IA não retornou dados estruturados." }, 502);
    const extraido = JSON.parse(outputText);
    return json({ ...extraido, leitor: "openai", modelo: resposta.model, response_id: resposta.id });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "Erro inesperado." }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
