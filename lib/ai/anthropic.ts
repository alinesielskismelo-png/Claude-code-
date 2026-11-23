// Chamadas à API da Claude. Só pode ser importado por código de servidor
// (rotas em app/api). A chave vem de ANTHROPIC_API_KEY no ambiente do servidor.
import Anthropic from "@anthropic-ai/sdk";
import { aiConfig } from "./config";
import { applyEdits, type CodeEdit } from "./edits";

if (typeof window !== "undefined") {
  throw new Error("lib/ai/anthropic.ts só pode ser usado no servidor.");
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

export class AiError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

/** Converte erros da SDK em mensagens em português e status HTTP coerentes. */
export function toAiError(error: unknown): AiError {
  if (error instanceof AiError) return error;
  if (error instanceof Anthropic.AuthenticationError) return new AiError("Chave da API da Claude inválida.", 500);
  if (error instanceof Anthropic.RateLimitError) return new AiError("Limite de uso da API atingido. Tente de novo em instantes.", 429);
  if (error instanceof Anthropic.BadRequestError) return new AiError(`Pedido recusado pela API: ${error.message}`, 400);
  if (error instanceof Anthropic.APIError) return new AiError(`Erro da API da Claude (${error.status ?? "rede"}).`, 502);
  return new AiError("Erro inesperado ao chamar a IA.", 500);
}

// ---------------------------------------------------------------------------
// Edição de artefatos
// ---------------------------------------------------------------------------

const EDIT_SYSTEM = `Você edita artefatos: páginas HTML/JS/React de arquivo único, criadas no Claude, que rodam num iframe isolado.
Receberá o código atual e um pedido da usuária, em português. Faça só a mudança pedida, preservando o resto do código, o estilo e o comportamento existente.

Responda com edições do tipo procurar e substituir:
- old_str é um trecho copiado exatamente do código atual (espaços e quebras de linha iguais) que aparece uma única vez. Inclua linhas vizinhas se precisar torná-lo único.
- new_str é o texto que entra no lugar. Para apagar, use new_str vazio.
- As edições são aplicadas em ordem; cada old_str é procurado no código já alterado pelas edições anteriores.
- Prefira trechos curtos e localizados. Não reescreva o arquivo inteiro se não for necessário.
- O artefato pode usar window.claude (complete, use) e localStorage; mantenha essas chamadas funcionando.

Em summary, explique em português, em uma ou duas frases, o que mudou.
Se o pedido for impossível ou ambíguo demais, devolva edits vazio e explique em summary.`;

const EDIT_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    edits: {
      type: "array",
      items: {
        type: "object",
        properties: {
          old_str: { type: "string" },
          new_str: { type: "string" },
        },
        required: ["old_str", "new_str"],
        additionalProperties: false,
      },
    },
  },
  required: ["summary", "edits"],
  additionalProperties: false,
} as const;

interface EditPayload {
  summary: string;
  edits: CodeEdit[];
}

export interface EditResult {
  code: string;
  summary: string;
  edits: CodeEdit[];
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number };
}

function parsePayload(message: Anthropic.Beta.BetaMessage): EditPayload {
  if (message.stop_reason === "refusal") {
    throw new AiError("A IA recusou este pedido.", 422);
  }
  if (message.stop_reason === "max_tokens") {
    throw new AiError("A resposta da IA ficou longa demais. Tente um pedido menor.", 422);
  }
  const text = message.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new AiError("A IA devolveu uma resposta em formato inválido.", 502);
  }
  const obj = data as Partial<EditPayload>;
  if (typeof obj?.summary !== "string" || !Array.isArray(obj.edits)) {
    throw new AiError("A IA devolveu uma resposta incompleta.", 502);
  }
  const edits = obj.edits.filter(
    (e): e is CodeEdit => typeof e?.old_str === "string" && typeof e?.new_str === "string",
  );
  return { summary: obj.summary, edits };
}

async function runEditTurn(messages: Anthropic.Beta.BetaMessageParam[]) {
  const stream = getClient().beta.messages.stream({
    model: aiConfig.model,
    max_tokens: 64000,
    // Se o modelo principal recusar, a API tenta outro modelo automaticamente.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: EDIT_SYSTEM,
    output_config: {
      effort: aiConfig.editEffort,
      format: { type: "json_schema", schema: EDIT_SCHEMA as unknown as Record<string, unknown> },
    },
    messages,
  });
  return stream.finalMessage();
}

/**
 * Pede à IA uma nova versão do código. Devolve o código já com as edições aplicadas.
 * Se alguma edição não casar com o código, devolve o erro à IA uma vez para ela corrigir.
 */
export async function editArtifact(input: { code: string; instruction: string; title?: string }): Promise<EditResult> {
  const header = input.title ? `Artefato: ${input.title}\n\n` : "";
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: "user",
      content: [
        {
          type: "text",
          // O código vem primeiro e marcado para cache: pedidos seguidos no mesmo artefato saem mais baratos.
          text: `${header}<codigo_atual>\n${input.code}\n</codigo_atual>`,
          cache_control: { type: "ephemeral" },
        },
        { type: "text", text: `Pedido da usuária:\n${input.instruction}` },
      ],
    },
  ];

  const usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 };
  for (let attempt = 0; attempt < 2; attempt++) {
    const message = await runEditTurn(messages);
    usage.inputTokens += message.usage.input_tokens;
    usage.outputTokens += message.usage.output_tokens;
    usage.cacheReadTokens += message.usage.cache_read_input_tokens ?? 0;

    const payload = parsePayload(message);
    if (payload.edits.length === 0) {
      return { code: input.code, summary: payload.summary, edits: [], usage };
    }
    const applied = applyEdits(input.code, payload.edits);
    if (applied.ok) {
      return { code: applied.code, summary: payload.summary, edits: payload.edits, usage };
    }
    // Segunda chance: devolve o erro e pede o conjunto completo de edições de novo.
    messages.push({ role: "assistant", content: message.content as Anthropic.Beta.BetaContentBlockParam[] });
    messages.push({
      role: "user",
      content: `${applied.error} Nenhuma edição foi aplicada. Envie de novo o conjunto completo de edições, com old_str copiado exatamente do <codigo_atual> original.`,
    });
  }
  throw new AiError("A IA não conseguiu gerar edições que se encaixem no código. Tente reformular o pedido.", 422);
}

// ---------------------------------------------------------------------------
// window.claude.complete
// ---------------------------------------------------------------------------

export type CompleteInput = { prompt: string } | { messages: Anthropic.MessageParam[] };

/** Equivalente a window.claude.complete dos artefatos: recebe texto, devolve texto. */
export async function complete(input: CompleteInput): Promise<string> {
  const messages: Anthropic.Beta.BetaMessageParam[] =
    "prompt" in input ? [{ role: "user", content: input.prompt }] : (input.messages as Anthropic.Beta.BetaMessageParam[]);

  const stream = getClient().beta.messages.stream({
    model: aiConfig.model,
    max_tokens: 32000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: aiConfig.completeEffort },
    messages,
  });
  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal") {
    throw new AiError("A IA recusou este pedido.", 422);
  }
  return message.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}
