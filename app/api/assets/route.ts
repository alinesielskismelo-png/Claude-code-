import { NextResponse } from "next/server";
import { HttpError, assertSameOrigin, fail } from "@/lib/api";
import { MAX_ASSET_BYTES, newAssetId, safeContentType } from "@/lib/assets";
import { getStore } from "@/lib/store";

/** Recebe um arquivo do artefato (corpo cru) e devolve {id, url}. */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const len = Number(req.headers.get("content-length") || 0);
    if (len > MAX_ASSET_BYTES) throw new HttpError(413, "Arquivo grande demais (máx. 4 MB).");
    const buf = new Uint8Array(await req.arrayBuffer());
    if (!buf.length) throw new HttpError(400, "Arquivo vazio.");
    if (buf.length > MAX_ASSET_BYTES) throw new HttpError(413, "Arquivo grande demais (máx. 4 MB).");
    const { type } = safeContentType(req.headers.get("content-type"));
    const id = newAssetId();
    await (await getStore()).putAsset(id, buf, type);
    return NextResponse.json({ id, url: `/_blob/${id}`, size: buf.length, contentType: type }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
