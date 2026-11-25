"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import TopBar from "@/components/TopBar";
import type { Artifact } from "@/lib/types";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function LibraryPage() {
  const [items, setItems] = useState<Artifact[] | null>(null);
  const [tags, setTags] = useState<{ tag: string; count: number }[]>([]);
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const [storeName, setStoreName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/tags").then((r) => r.json()).then((j) => setTags(j.tags || [])).catch(() => {});
  }, []);

  useEffect(() => {
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const p = new URLSearchParams();
        if (q.trim()) p.set("q", q.trim());
        if (tag) p.set("tag", tag);
        const r = await fetch(`/api/artifacts?${p}`, { signal: ctl.signal });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        setItems(j.artifacts);
        setStoreName(j.store);
        setError("");
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError((e as Error).message || "Falha ao carregar.");
      }
    }, 150);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [q, tag]);

  return (
    <>
      <TopBar>
        <Link className="btn primary sm" href="/import">
          + Importar
        </Link>
      </TopBar>
      <main className="page">
        <h1 style={{ fontSize: 26 }}>Biblioteca</h1>
        <div className="toolbar">
          <input className="input" type="search" placeholder="Buscar por título, descrição ou tag" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar" />
          <div className="chips">
            {tags.map((t) => (
              <button key={t.tag} type="button" className={`chip ${tag === t.tag ? "on" : ""}`} onClick={() => setTag(tag === t.tag ? "" : t.tag)}>
                {t.tag} · {t.count}
              </button>
            ))}
          </div>
        </div>
        {error && <p className="error">{error}</p>}
        {items === null && !error && <p className="muted">Carregando…</p>}
        {items && items.length === 0 && (
          <div className="empty">
            {q || tag ? (
              <p>Nada encontrado com esse filtro.</p>
            ) : (
              <>
                <p style={{ fontSize: 17, color: "var(--text)" }}>Sua biblioteca está vazia.</p>
                <p>Cole o código de um artefato do Claude ou envie um arquivo .html / .jsx.</p>
                <Link className="btn primary" href="/import">Importar o primeiro artefato</Link>
              </>
            )}
          </div>
        )}
        {items && items.length > 0 && (
          <div className="grid">
            {items.map((a) => (
              <article className="card" key={a.id}>
                <h3>
                  <Link href={`/artifacts/${a.id}`}>{a.title}</Link>
                </h3>
                {a.description && <p className="muted small" style={{ margin: 0 }}>{a.description}</p>}
                <div className="meta">
                  <span>{a.kind === "react" ? "React" : "HTML"}</span>
                  <span>v{a.versionCount}</span>
                  <span>{fmtDate(a.updatedAt)}</span>
                </div>
                {a.tags.length > 0 && (
                  <div className="chips">
                    {a.tags.map((t) => (
                      <span className="tag" key={t}>{t}</span>
                    ))}
                  </div>
                )}
                <div className="actions">
                  <Link className="btn sm" href={`/view/${a.id}`}>Abrir</Link>
                  <Link className="btn sm" href={`/artifacts/${a.id}`}>Editar</Link>
                </div>
              </article>
            ))}
          </div>
        )}
        {storeName === "local" && (
          <p className="muted small" style={{ marginTop: 30 }}>
            Os dados estão em arquivos locais (pasta data). Para hospedar online, configure o Supabase.
          </p>
        )}
      </main>
    </>
  );
}
