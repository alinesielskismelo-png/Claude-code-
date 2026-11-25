import { ASSET_ID_RE, safeContentType } from "@/lib/assets";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * Serve os arquivos dos artefatos na origem dos artefatos ("/_blob/<id>", como no claude.ai).
 * O id é aleatório (192 bits): só quem tem o link, guardado nos dados do artefato, consegue abrir.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!ASSET_ID_RE.test(id)) return new Response("Not found", { status: 404 });
  const a = await (await getStore()).getAsset(id).catch(() => null);
  if (!a) return new Response("Not found", { status: 404 });
  const { type, inline } = safeContentType(a.contentType);
  return new Response(new Blob([a.data as BlobPart]), {
    headers: {
      "content-type": type,
      "content-disposition": inline ? "inline" : "attachment",
      "cache-control": "private, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox",
      "referrer-policy": "no-referrer",
      "cross-origin-resource-policy": "cross-origin",
    },
  });
}
