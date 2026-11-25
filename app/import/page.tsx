"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import TopBar from "@/components/TopBar";
import { detectKind, guessTitle } from "@/lib/detect";
import type { ArtifactKind } from "@/lib/types";

interface Pending {
  name: string;
  code: string;
}

const ACCEPT = ".html,.htm,.jsx,.tsx,.js,.txt";

export default function ImportPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [files, setFiles] = useState<Pending[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [kind, setKind] = useState<"" | ArtifactKind>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function addFiles(list: FileList | null) {
    if (!list) return;
    const read = await Promise.all([...list].map(async (f) => ({ name: f.name, code: await f.text() })));
    const ok = read.filter((f) => f.code.trim());
    if (ok.length === 1 && files.length === 0) {
      setCode(ok[0].code);
      setFiles([{ name: ok[0].name, code: ok[0].code }]);
      if (!title) setTitle(guessTitle(ok[0].code, ok[0].name));
    } else {
      setFiles((prev) => [...prev, ...ok]);
      setCode("");
    }
  }

  const multi = files.length > 1;
  const single = !multi ? (code ? { name: files[0]?.name, code } : null) : null;
  const detected = single ? detectKind(single.code, single.name) : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const batch = multi ? files : single ? [{ name: single.name || "", code: single.code }] : [];
      if (!batch.length) throw new Error("Cole um código ou escolha um arquivo.");
      let lastId = "";
      for (const f of batch) {
        const r = await fetch("/api/artifacts", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            code: f.code,
            filename: f.name || undefined,
            title: multi ? undefined : title || undefined,
            description,
            tags,
            kind: multi ? undefined : kind || undefined,
          }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(`${f.name || "Código"}: ${j.error || r.status}`);
        lastId = j.artifact.id;
      }
      router.push(multi ? "/biblioteca" : `/artifacts/${lastId}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <>
      <TopBar />
      <main className="page" style={{ maxWidth: 860 }}>
        <h1 style={{ fontSize: 26, marginBottom: 6 }}>Importar artefato</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          No Claude, abra o artefato, copie o código (ou baixe o arquivo) e traga para cá. Funciona com HTML de arquivo
          único e com componentes React (.jsx/.tsx).
        </p>
        <form className="form-grid" onSubmit={submit}>
          <div
            className={`drop ${over ? "over" : ""}`}
            onClick={() => input.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); addFiles(e.dataTransfer.files); }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") input.current?.click(); }}
          >
            Arraste arquivos aqui ou <b style={{ color: "var(--accent)" }}>escolha no computador</b> (pode ser mais de um)
            <input ref={input} type="file" accept={ACCEPT} multiple hidden onChange={(e) => addFiles(e.target.files)} />
          </div>

          {multi ? (
            <div className="notice">
              {files.length} arquivos: {files.map((f) => f.name).join(", ")}. O título de cada um vem do próprio código.{" "}
              <button type="button" className="btn sm" onClick={() => setFiles([])}>Limpar</button>
            </div>
          ) : (
            <label className="field">
              <span>Código</span>
              <textarea
                className="textarea"
                rows={14}
                placeholder="<!doctype html>… ou export default function App() { … }"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  if (files.length) setFiles([]);
                }}
                onBlur={() => { if (!title && code) setTitle(guessTitle(code)); }}
              />
            </label>
          )}

          {!multi && (
            <div className="two">
              <label className="field">
                <span>Título</span>
                <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Detectado do código" />
              </label>
              <label className="field">
                <span>Tipo</span>
                <select className="select" value={kind} onChange={(e) => setKind(e.target.value as "" | ArtifactKind)}>
                  <option value="">Automático{detected ? ` (${detected === "react" ? "React" : "HTML"})` : ""}</option>
                  <option value="html">HTML</option>
                  <option value="react">React (JSX/TSX)</option>
                </select>
              </label>
            </div>
          )}
          <label className="field">
            <span>Descrição</span>
            <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Opcional" />
          </label>
          <label className="field">
            <span>Tags</span>
            <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="separadas por vírgula: estudos, painel" />
          </label>
          {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
          <div>
            <button className="btn primary" type="submit" disabled={busy || (!code.trim() && !multi)}>
              {busy ? "Importando…" : multi ? `Importar ${files.length} arquivos` : "Importar"}
            </button>
          </div>
        </form>
      </main>
    </>
  );
}
