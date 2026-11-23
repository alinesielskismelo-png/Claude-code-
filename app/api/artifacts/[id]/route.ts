import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { HttpError, assertSameOrigin, fail, kind, readJson, str, tags } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

/** Metadados + código da versão atual. */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const store = await getStore();
    const artifact = await store.getArtifact(id);
    if (!artifact) throw new HttpError(404, "Artefato não encontrado.");
    const version = artifact.currentVersionId ? await store.getVersion(id, artifact.currentVersionId) : null;
    return NextResponse.json({ artifact, code: version?.code ?? "", version: version && { ...version, code: undefined } });
  } catch (e) {
    return fail(e);
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    assertSameOrigin(req);
    const { id } = await params;
    const body = await readJson(req);
    const title = str(body.title, "title");
    if (title === "") throw new HttpError(400, "O título não pode ficar vazio.");
    const artifact = await (await getStore()).updateArtifact(id, {
      title,
      description: str(body.description, "description", { max: 2000 }),
      tags: tags(body.tags),
      kind: kind(body.kind),
    });
    if (!artifact) throw new HttpError(404, "Artefato não encontrado.");
    return NextResponse.json({ artifact });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    assertSameOrigin(req);
    const { id } = await params;
    const ok = await (await getStore()).deleteArtifact(id);
    if (!ok) throw new HttpError(404, "Artefato não encontrado.");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
