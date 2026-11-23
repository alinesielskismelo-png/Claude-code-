import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { HttpError, assertSameOrigin, code, fail, readJson, source, str } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const store = await getStore();
    if (!(await store.getArtifact(id))) throw new HttpError(404, "Artefato não encontrado.");
    return NextResponse.json({ versions: await store.listVersions(id) });
  } catch (e) {
    return fail(e);
  }
}

/** Salva uma nova versão: {code, message?, source?: "manual"|"ai"|"import"|"restore"}. */
export async function POST(req: Request, { params }: Ctx) {
  try {
    assertSameOrigin(req);
    const { id } = await params;
    const body = await readJson(req);
    const version = await (await getStore()).saveVersion(id, {
      code: code(body.code),
      message: str(body.message, "message", { max: 500 }) || "",
      source: source(body.source),
    });
    if (!version) throw new HttpError(404, "Artefato não encontrado.");
    return NextResponse.json({ version }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
