import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { HttpError, assertSameOrigin, fail, readJson } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };
const MAX_VALUE_BYTES = 1024 * 1024;

/** Dados que o artefato salvou (localStorage, window.storage, db). */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    return NextResponse.json({ kv: await (await getStore()).getKv(id) });
  } catch (e) {
    return fail(e);
  }
}

/** {key, value}; value null apaga. Aceita também {entries: [{key, value}, ...]}. */
export async function PUT(req: Request, { params }: Ctx) {
  try {
    assertSameOrigin(req);
    const { id } = await params;
    const body = await readJson(req);
    const store = await getStore();
    if (!(await store.getArtifact(id))) throw new HttpError(404, "Artefato não encontrado.");
    const entries = Array.isArray(body.entries) ? body.entries : [{ key: body.key, value: body.value }];
    for (const e of entries as { key: unknown; value: unknown }[]) {
      if (typeof e.key !== "string" || !e.key || e.key.length > 500) throw new HttpError(400, "Chave inválida.");
      if (e.value !== null && JSON.stringify(e.value ?? null).length > MAX_VALUE_BYTES) {
        throw new HttpError(413, "Valor maior que 1 MB.");
      }
    }
    for (const e of entries as { key: string; value: unknown }[]) await store.setKv(id, e.key, e.value ?? null);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}

/** Apaga todos os dados salvos do artefato. */
export async function DELETE(req: Request, { params }: Ctx) {
  try {
    assertSameOrigin(req);
    const { id } = await params;
    const store = await getStore();
    const kv = await store.getKv(id);
    for (const k of Object.keys(kv)) await store.setKv(id, k, null);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
