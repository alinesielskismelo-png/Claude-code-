// POST /api/ai/edit
// Corpo: { code: string, instruction: string, title?: string }
// Resposta 200: { code, summary, edits, usage }  (nada é salvo; quem salva é o editor ao aceitar)
// Erros: { error } com 400, 403, 413, 422, 429, 501 (sem chave) ou 502.
import { aiConfig, hasApiKey } from "@/lib/ai/config";
import { checkRequest, clientKey, rateLimit } from "@/lib/ai/guard";
import { editArtifact, toAiError } from "@/lib/ai/anthropic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Edições em arquivos grandes podem levar alguns minutos.
export const maxDuration = 300;

function fail(error: string, status: number) {
  return Response.json({ error }, { status });
}

export async function POST(req: Request) {
  const denied = checkRequest(req);
  if (denied) return fail(denied, 403);
  if (!hasApiKey()) return fail("A IA não está configurada: defina ANTHROPIC_API_KEY no servidor.", 501);
  if (!rateLimit(`edit:${clientKey(req)}`, 10)) return fail("Muitos pedidos seguidos. Espere um minuto.", 429);

  let body: { code?: unknown; instruction?: unknown; title?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail("Corpo JSON inválido.", 400);
  }
  const { code, instruction, title } = body;
  if (typeof code !== "string") return fail("Campo code é obrigatório.", 400);
  if (typeof instruction !== "string" || instruction.trim() === "") return fail("Descreva o que deve mudar.", 400);
  if (code.length > aiConfig.maxCodeChars) return fail("O artefato é grande demais para edição por IA.", 413);
  if (instruction.length > aiConfig.maxInstructionChars) return fail("O pedido é longo demais.", 413);

  try {
    const result = await editArtifact({
      code,
      instruction: instruction.trim(),
      title: typeof title === "string" ? title : undefined,
    });
    return Response.json(result);
  } catch (error) {
    const e = toAiError(error);
    return fail(e.message, e.status);
  }
}
