// POST /api/ai/complete  (usada por window.claude.complete dentro dos artefatos)
// Corpo: { prompt: string }  ou  { messages: [{ role: "user" | "assistant", content: string }] }
// Resposta 200: { text }
// Erros: { error } com 400, 403, 413, 422, 429, 501 (sem chave) ou 502.
import type Anthropic from "@anthropic-ai/sdk";
import { aiConfig, hasApiKey } from "@/lib/ai/config";
import { checkRequest, clientKey, rateLimit } from "@/lib/ai/guard";
import { complete, toAiError } from "@/lib/ai/anthropic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function fail(error: string, status: number) {
  return Response.json({ error }, { status });
}

function validMessages(value: unknown): value is Anthropic.MessageParam[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        (typeof m.content === "string" || Array.isArray(m.content)),
    ) &&
    value[value.length - 1].role === "user"
  );
}

export async function POST(req: Request) {
  const denied = checkRequest(req);
  if (denied) return fail(denied, 403);
  if (!hasApiKey()) return fail("A IA não está configurada: defina ANTHROPIC_API_KEY no servidor.", 501);
  if (!rateLimit(`complete:${clientKey(req)}`, aiConfig.completeRequestsPerMinute)) {
    return fail("Muitos pedidos seguidos. Espere um minuto.", 429);
  }

  const raw = await req.text();
  if (raw.length > aiConfig.maxCompleteChars) return fail("Pedido grande demais.", 413);
  let body: { prompt?: unknown; messages?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return fail("Corpo JSON inválido.", 400);
  }

  let input: Parameters<typeof complete>[0];
  if (typeof body.prompt === "string" && body.prompt.trim() !== "") {
    input = { prompt: body.prompt };
  } else if (validMessages(body.messages)) {
    input = { messages: body.messages };
  } else {
    return fail("Envie prompt (texto) ou messages (lista terminando em user).", 400);
  }

  try {
    const text = await complete(input);
    return Response.json({ text });
  } catch (error) {
    const e = toAiError(error);
    return fail(e.message, e.status);
  }
}
