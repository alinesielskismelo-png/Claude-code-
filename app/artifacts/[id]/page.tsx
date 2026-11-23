"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Runner, { type RunnerLog } from "@/components/runner/Runner";
import AiEditPanel from "@/components/ai/AiEditPanel";
import type { Artifact, ArtifactKind, Version } from "@/lib/types";

type Tab = "ia" | "historico" | "console" | "detalhes";

const SOURCE_LABEL: Record<string, string> = { import: "importação", manual: "manual", ai: "IA", restore: "restauração" };

function fmt(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init && { ...init, headers: { "content-type": "application/json", ...(init.headers || {}) } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Erro ${r.status}`);
  return j as T;
}

export default function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [code, setCode] = useState("");
  const [saved, setSaved] = useState("");
  const [runCode, setRunCode] = useState("");
  const [runKey, setRunKey] = useState(0);
  const [tab, setTab] = useState<Tab>("ia");
  const [logs, setLogs] = useState<RunnerLog[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [tagsText, setTagsText] = useState("");
  const area = useRef<HTMLTextAreaElement>(null);
  const dirty = code !== saved;

  const flash = (t: string) => {
    setToast(t);
    setTimeout(() => setToast(""), 2500);
  };

  const loadVersions = useCallback(async () => {
    const j = await api<{ versions: Version[] }>(`/api/artifacts/${id}/versions`);
    setVersions(j.versions);
  }, [id]);

  useEffect(() => {
    api<{ artifact: Artifact; code: string }>(`/api/artifacts/${id}`)
      .then((j) => {
        setArtifact(j.artifact);
        setTagsText(j.artifact.tags.join(", "));
        setCode(j.code);
        setSaved(j.code);
        setRunCode(j.code);
        document.title = `${j.artifact.title} · Artefatos`;
      })
      .catch((e) => setError(e.message));
    loadVersions().catch(() => {});
  }, [id, loadVersions]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const run = useCallback(() => {
    setLogs([]);
    setRunCode(code);
    setRunKey((k) => k + 1);
  }, [code]);

  const saveVersion = useCallback(
    async (newCode: string, msg: string, source: "manual" | "ai" | "restore") => {
      await api(`/api/artifacts/${id}/versions`, { method: "POST", body: JSON.stringify({ code: newCode, message: msg, source }) });
      setSaved(newCode);
      setCode(newCode);
      setRunCode(newCode);
      setRunKey((k) => k + 1);
      setLogs([]);
      const a = await api<{ artifact: Artifact }>(`/api/artifacts/${id}`);
      setArtifact(a.artifact);
      await loadVersions();
    },
    [id, loadVersions],
  );

  const save = useCallback(async () => {
    if (!dirty || busy) return;
    setBusy(true);
    setError("");
    try {
      await saveVersion(code, message.trim() || "Edição manual", "manual");
      setMessage("");
      flash("Versão salva");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [busy, code, dirty, message, saveVersion]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        run();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save, run]);

  async function patch(body: Partial<{ title: string; description: string; tags: string; kind: ArtifactKind }>) {
    try {
      const j = await api<{ artifact: Artifact }>(`/api/artifacts/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      setArtifact(j.artifact);
      setTagsText(j.artifact.tags.join(", "));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function openVersion(v: Version, restore: boolean) {
    try {
      const j = await api<{ version: { code: string } }>(`/api/artifacts/${id}/versions/${v.id}`);
      if (restore) {
        await saveVersion(j.version.code, `Restaurado da v${v.number}`, "restore");
        flash(`v${v.number} restaurada como versão nova`);
      } else {
        if (dirty && !confirm("Descartar as mudanças não salvas no editor?")) return;
        setCode(j.version.code);
        setRunCode(j.version.code);
        setRunKey((k) => k + 1);
        flash(`v${v.number} aberta no editor (ainda não salva)`);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function remove() {
    if (!artifact || !confirm(`Excluir "${artifact.title}" e todas as versões? Não dá para desfazer.`)) return;
    await api(`/api/artifacts/${id}`, { method: "DELETE" });
    router.push("/");
  }

  async function clearData() {
    if (!confirm("Apagar os dados que este artefato salvou (anotações, progresso etc.)?")) return;
    await api(`/api/artifacts/${id}/kv`, { method: "DELETE" });
    run();
    flash("Dados apagados");
  }

  function onTab(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Tab" || e.shiftKey) return;
    e.preventDefault();
    const t = e.currentTarget;
    const { selectionStart: s, selectionEnd: end } = t;
    const next = code.slice(0, s) + "  " + code.slice(end);
    setCode(next);
    requestAnimationFrame(() => { t.selectionStart = t.selectionEnd = s + 2; });
  }

  if (error && !artifact) {
    return (
      <main className="page">
        <p className="error">{error}</p>
        <Link href="/">Voltar à biblioteca</Link>
      </main>
    );
  }
  if (!artifact) return <main className="page muted">Carregando…</main>;

  const current = versions.find((v) => v.id === artifact.currentVersionId);
  const errors = logs.filter((l) => l.level === "error").length;

  return (
    <div className="editor">
      <div className="editor-head">
        <Link className="btn sm" href="/">← Biblioteca</Link>
        <input
          className="title-input"
          defaultValue={artifact.title}
          key={artifact.title}
          aria-label="Título"
          onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== artifact.title) patch({ title: v }); }}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
        />
        <span className="dirty">{dirty ? "● mudanças não salvas" : current ? `v${current.number} salva` : ""}</span>
        {toast && <span className="small" style={{ color: "var(--ok)" }}>{toast}</span>}
        {error && <span className="small error">{error}</span>}
        <div className="spacer" />
        <input
          className="input"
          style={{ maxWidth: 220 }}
          placeholder="Descreva a mudança (opcional)"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); }}
          aria-label="Mensagem da versão"
        />
        <button className="btn primary" type="button" onClick={save} disabled={!dirty || busy} title="Ctrl+S">
          {busy ? "Salvando…" : "Salvar versão"}
        </button>
        <Link className="btn" href={`/view/${id}`} target="_blank">Tela cheia ↗</Link>
      </div>

      <div className="editor-body">
        <section className="pane">
          <div className="pane-head">
            Código · {artifact.kind === "react" ? "React" : "HTML"} · {(code.length / 1024).toFixed(0)} KB
            <div className="spacer" />
            <button className="btn sm" type="button" onClick={run} title="Ctrl+Enter">▶ Executar</button>
          </div>
          <textarea
            ref={area}
            className="code-area"
            value={code}
            spellCheck={false}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={onTab}
            aria-label="Código do artefato"
          />
        </section>

        <section className="pane">
          <div className="pane-head">
            Prévia {runCode !== saved && <span className="tag">rascunho</span>}
            <div className="spacer" />
            <button className="btn sm" type="button" onClick={() => setRunKey((k) => k + 1)}>↻ Recarregar</button>
          </div>
          <Runner
            artifactId={id}
            code={runCode}
            kind={artifact.kind}
            runKey={runKey}
            title={artifact.title}
            onLog={(l) => setLogs((prev) => [...prev.slice(-199), l])}
          />
        </section>

        <aside className="side">
          <div className="tabs" role="tablist">
            {([
              ["ia", "IA"],
              ["historico", `Histórico (${versions.length})`],
              ["console", `Console${errors ? ` (${errors})` : ""}`],
              ["detalhes", "Detalhes"],
            ] as [Tab, string][]).map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
                {label}
              </button>
            ))}
          </div>
          <div className="side-body">
            {tab === "ia" && (
              <AiEditPanel
                artifactId={id}
                code={code}
                title={artifact.title}
                onAccept={async (newCode, summary) => {
                  await saveVersion(newCode, summary || "Edição com IA", "ai");
                }}
              />
            )}

            {tab === "historico" &&
              versions.map((v) => (
                <div key={v.id} className={`version ${v.id === artifact.currentVersionId ? "current" : ""}`}>
                  <div className="row">
                    <b>v{v.number}</b>
                    <span className="tag">{SOURCE_LABEL[v.source] || v.source}</span>
                    {v.id === artifact.currentVersionId && <span className="tag">atual</span>}
                    <span className="muted small">{fmt(v.createdAt)}</span>
                  </div>
                  {v.message && <div className="small">{v.message}</div>}
                  <div className="row">
                    <button className="btn sm" type="button" onClick={() => openVersion(v, false)}>Abrir no editor</button>
                    {v.id !== artifact.currentVersionId && (
                      <button className="btn sm" type="button" onClick={() => openVersion(v, true)}>Restaurar</button>
                    )}
                    <a className="btn sm" href={`/api/artifacts/${id}/versions/${v.id}?download=1`}>Baixar</a>
                  </div>
                </div>
              ))}

            {tab === "console" && (
              <>
                {logs.length === 0 && <p className="muted small">Sem erros ou avisos nesta execução.</p>}
                {logs.map((l, i) => (
                  <div key={i} className={`log ${l.level}`}>{l.message}</div>
                ))}
              </>
            )}

            {tab === "detalhes" && (
              <>
                <label className="field">
                  <span>Descrição</span>
                  <textarea
                    className="input"
                    rows={3}
                    defaultValue={artifact.description}
                    onBlur={(e) => { if (e.target.value !== artifact.description) patch({ description: e.target.value }); }}
                  />
                </label>
                <label className="field">
                  <span>Tags</span>
                  <input
                    className="input"
                    value={tagsText}
                    onChange={(e) => setTagsText(e.target.value)}
                    onBlur={() => { if (tagsText !== artifact.tags.join(", ")) patch({ tags: tagsText }); }}
                    placeholder="separadas por vírgula"
                  />
                </label>
                <label className="field">
                  <span>Tipo</span>
                  <select className="select" value={artifact.kind} onChange={(e) => patch({ kind: e.target.value as ArtifactKind })}>
                    <option value="html">HTML</option>
                    <option value="react">React (JSX/TSX)</option>
                  </select>
                </label>
                <p className="muted small" style={{ margin: 0 }}>
                  Criado em {fmt(artifact.createdAt)}. Os dados que o artefato salva (localStorage, anotações) ficam
                  guardados na plataforma e valem para todas as versões.
                </p>
                <div className="row" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="btn sm" type="button" onClick={clearData}>Apagar dados salvos</button>
                  <button className="btn sm danger" type="button" onClick={remove}>Excluir artefato</button>
                </div>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
