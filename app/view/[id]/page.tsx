"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import Runner from "@/components/runner/Runner";
import type { Artifact } from "@/lib/types";

export default function ViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<{ artifact: Artifact; code: string } | null>(null);
  const [error, setError] = useState("");

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

  if (error) return <main className="page"><p className="error">{error}</p><Link href="/">Voltar</Link></main>;
  if (!data) return <main className="page muted">Carregando…</main>;
  return (
    <div className="viewer">
      <div className="viewer-bar">
        <Link href="/">← Biblioteca</Link>
        <b>{data.artifact.title}</b>
        <span className="muted small">v{data.artifact.versionCount}</span>
        <div className="spacer" />
        <Link className="btn sm" href={`/artifacts/${id}`}>Editar</Link>
      </div>
      <Runner artifactId={id} code={data.code} kind={data.artifact.kind} title={data.artifact.title} />
    </div>
  );
}
