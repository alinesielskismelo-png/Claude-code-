import { NextResponse } from "next/server";
import { normalizeTags } from "./detect";
import type { ArtifactKind, VersionSource } from "./types";

export const MAX_CODE_BYTES = 5 * 1024 * 1024;

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function fail(e: unknown) {
  if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error(e);
  return NextResponse.json({ error: "Erro interno. Veja os logs do servidor." }, { status: 500 });
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const v = await req.json();
    if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  } catch {
    /* cai no erro abaixo */
  }
  throw new HttpError(400, "Corpo da requisição precisa ser um objeto JSON.");
}

/** Bloqueia chamadas de outros sites (CSRF) para rotas que mudam dados. */
export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return;
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  try {
    if (new URL(origin).host === host) return;
  } catch {
    /* origem inválida */
  }
  throw new HttpError(403, "Origem não permitida.");
}

export function str(v: unknown, field: string, { max = 200, required = false } = {}): string | undefined {
  if (v === undefined || v === null) {
    if (required) throw new HttpError(400, `Campo "${field}" é obrigatório.`);
    return undefined;
  }
  if (typeof v !== "string") throw new HttpError(400, `Campo "${field}" precisa ser texto.`);
  const s = v.trim();
  if (required && !s) throw new HttpError(400, `Campo "${field}" é obrigatório.`);
  return s.slice(0, max);
}

export function code(v: unknown): string {
  if (typeof v !== "string" || !v.trim()) throw new HttpError(400, 'Campo "code" é obrigatório.');
  if (Buffer.byteLength(v, "utf8") > MAX_CODE_BYTES) throw new HttpError(413, "Código maior que 5 MB.");
  return v;
}

export function kind(v: unknown): ArtifactKind | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  if (v === "html" || v === "react") return v;
  throw new HttpError(400, 'Campo "kind" deve ser "html" ou "react".');
}

export function source(v: unknown): VersionSource {
  if (v === undefined || v === null) return "manual";
  if (v === "manual" || v === "ai" || v === "import" || v === "restore") return v;
  throw new HttpError(400, 'Campo "source" inválido.');
}

export function tags(v: unknown): string[] | undefined {
  return v === undefined ? undefined : normalizeTags(v);
}
