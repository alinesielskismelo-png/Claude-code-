import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { HttpError, fail } from "@/lib/api";

type Ctx = { params: Promise<{ id: string; vid: string }> };

/** Uma versão com o código. Com ?download=1, baixa como arquivo. */
export async function GET(req: Request, { params }: Ctx) {
  try {
    const { id, vid } = await params;
    const store = await getStore();
    const version = await store.getVersion(id, vid);
    if (!version) throw new HttpError(404, "Versão não encontrada.");
    if (new URL(req.url).searchParams.get("download")) {
      const artifact = await store.getArtifact(id);
      const ext = artifact?.kind === "react" ? "jsx" : "html";
      const base = (artifact?.title || "artefato").replace(/[^\p{L}\p{N} _-]+/gu, "").trim() || "artefato";
      return new Response(version.code, {
        headers: {
          "content-type": "application/octet-stream",
          "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`${base} v${version.number}.${ext}`)}`,
        },
      });
    }
    return NextResponse.json({ version });
  } catch (e) {
    return fail(e);
  }
}
