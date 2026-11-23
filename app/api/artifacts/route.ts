import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { assertSameOrigin, code, fail, kind, readJson, str, tags } from "@/lib/api";
import { detectKind, guessTitle } from "@/lib/detect";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const store = await getStore();
    const artifacts = await store.listArtifacts({
      q: url.searchParams.get("q") || undefined,
      tag: url.searchParams.get("tag") || undefined,
    });
    return NextResponse.json({ artifacts, store: store.name });
  } catch (e) {
    return fail(e);
  }
}

/** Importa um artefato: {code, title?, description?, tags?, kind?, filename?}. */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const body = await readJson(req);
    const c = code(body.code);
    const filename = str(body.filename, "filename", { max: 300 });
    const k = kind(body.kind) || detectKind(c, filename);
    const store = await getStore();
    const { artifact, version } = await store.createArtifact({
      code: c,
      kind: k,
      title: str(body.title, "title") || guessTitle(c, filename),
      description: str(body.description, "description", { max: 2000 }) || "",
      tags: tags(body.tags) || [],
    });
    return NextResponse.json({ artifact, version }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
