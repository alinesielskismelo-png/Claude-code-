"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useState } from "react";
import Runner from "@/components/runner/Runner";
import type { Artifact } from "@/lib/types";
import { claudeTag, findByTag } from "@/lib/links";

export default function ViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<{ artifact: Artifact; code: string } | null>(null);
  const [error, setError] = useState("");
  const router = useRouter();

  // Link para outro artefato do claude.ai: abre a cópia do site, se existir; senão, o claude.ai.
  const openRef = useCallback(
    async (ref: string) => {
      const target = await findByTag(claudeTag(ref)).catch(() => null);
      if (target) router.push(`/view/${target}`);
      else window.open(`https://claude.ai/artifact/${encodeURIComponent(ref)}`, "_blank", "noopener,noreferrer");
    },
    [router],
  );

  useEffect(() => {
    fetch(`/api/artifacts/${id}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        setData(j);
        document.title = j.artifact.title;
      })
      .catch((e) => setError(e.message || "Falha ao carregar."));
  }, [id]);

  if (error) return <main className="page"><p className="error">{error}</p><Link href="/biblioteca">Voltar</Link></main>;
  if (!data) return <main className="page muted">Carregando…</main>;
  return (
    <div className="viewer">
      <div className="viewer-bar">
        <Link href="/biblioteca">← Biblioteca</Link>
        <b>{data.artifact.title}</b>
        <span className="muted small">v{data.artifact.versionCount}</span>
        <div className="spacer" />
        <Link className="btn sm" href={`/artifacts/${id}`}>Editar</Link>
      </div>
      <Runner artifactId={id} code={data.code} kind={data.artifact.kind} title={data.artifact.title} onOpenArtifact={openRef} />
    </div>
  );
}
