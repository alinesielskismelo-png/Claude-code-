import { NextResponse } from "next/server";
import { fail } from "@/lib/api";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * Cópia de segurança completa: todos os artefatos, com TODAS as versões (código) e os dados
 * salvos por cada artefato. Baixa como um arquivo .json.
 */
export async function GET() {
  try {
    const store = await getStore();
    const artifacts = await store.listArtifacts();
    const items = [];
    for (const a of artifacts) {
      const versions = await store.listVersions(a.id);
      const withCode = [];
      for (const v of versions) {
        const full = await store.getVersion(a.id, v.id);
        if (full) withCode.push(full);
      }
      items.push({ artifact: a, versions: withCode, data: await store.getKv(a.id) });
    }
    const now = new Date();
    const day = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(now);
    const body = JSON.stringify(
      { format: "artefatos-backup", version: 1, exportedAt: now.toISOString(), store: store.name, artifacts: items },
      null,
      2,
    );
    return new NextResponse(body, {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="artefatos-backup-${day}.json"`,
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    return fail(e);
  }
}
