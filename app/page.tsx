"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { HOME_TAG, findByTag } from "@/lib/links";

/** Página inicial: abre o artefato marcado com a tag "inicio" (o Hub); sem ele, a biblioteca. */
export default function Home() {
  const router = useRouter();
  useEffect(() => {
    findByTag(HOME_TAG)
      .catch(() => null)
      .then((id) => router.replace(id ? `/view/${id}` : "/biblioteca"));
  }, [router]);
  return <main className="page muted">Carregando…</main>;
}
