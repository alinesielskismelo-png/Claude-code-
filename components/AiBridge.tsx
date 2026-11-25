"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildPrompt, extractCode, type Extracted } from "@/lib/aiBridge";
import { diffLines, hunks } from "@/lib/diff";
import type { ArtifactKind } from "@/lib/types";

const MAX_SHOWN = 600;
const BIG_CODE = 150 * 1024;

interface Props {
  artifactId: string;
  title: string;
  kind: ArtifactKind;
  /** Código que está no editor agora (base do pedido e da comparação). */
  code: string;
  /** Mostra um código na prévia como rascunho; null volta ao código do editor. */
  onPreview: (code: string | null) => void;
  /** Salva como versão nova marcada como "IA". */
  onSave: (code: string, message: string) => Promise<void>;
  /** Coloca o código no editor para ajustes à mão, sem salvar. */
  onUseInEditor: (code: string) => void;
}

function readDraft(key: string): string {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function writeDraft(key: string, value: string) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    /* sem armazenamento local: o rascunho só não fica guardado */
  }
}

export default function AiBridge({ artifactId, title, kind, code, onPreview, onSave, onUseInEditor }: Props) {
  const draftKey = `pedido-ia:${artifactId}`;
  const [request, setRequest] = useState("");
  const [reply, setReply] = useState("");
  const [copied, setCopied] = useState<"" | "ok" | "manual">("");
  const [result, setResult] = useState<Extracted | null>(null);
  const [base, setBase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const promptBox = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setRequest(readDraft(draftKey)), [draftKey]);

  const prompt = useMemo(() => buildPrompt({ title, kind, code, request }), [title, kind, code, request]);

  const diff = useMemo(() => (result?.code ? diffLines(base, result.code) : null), [base, result]);
  const parts = useMemo(() => (diff ? hunks(diff.lines) : []), [diff]);

  async function copyPrompt() {
    setError("");
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied("ok");
    } catch {
      // Sem acesso à área de transferência: mostra o texto selecionado para copiar à mão.
      setCopied("manual");
      requestAnimationFrame(() => promptBox.current?.select());
    }
  }

  function check() {
    setError("");
    const r = extractCode(reply, code);
    setBase(code);
    setResult(r);
    onPreview(r.code || null);
  }

  function discard() {
    setResult(null);
    setReply("");
    onPreview(null);
  }

  async function save() {
    if (!result?.code) return;
    setBusy(true);
    setError("");
    try {
      const msg = request.trim() ? `IA: ${request.trim().replace(/\s+/g, " ").slice(0, 200)}` : "Mudança feita com IA";
      await onSave(result.code, msg);
      setResult(null);
      setReply("");
      setRequest("");
      setCopied("");
      writeDraft(draftKey, "");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  let shown = 0;

  return (
    <div className="bridge">
      <p className="muted small" style={{ margin: 0 }}>
        O site não tem IA dentro. Aqui você leva o artefato para o Claude, o ChatGPT ou o Gemini e traz a resposta de volta
        como versão nova.
      </p>

      <section className="bridge-step">
        <h4>1. Peça a mudança</h4>
        <label className="field">
          <span>O que você quer mudar?</span>
          <textarea
            id="bridge-request"
            className="input"
            rows={4}
            value={request}
            onChange={(e) => {
              setRequest(e.target.value);
              writeDraft(draftKey, e.target.value);
              setCopied("");
            }}
            placeholder="Ex.: trocar o fundo para off-white e aumentar a letra dos cartões"
          />
        </label>
        <button className="btn primary" type="button" onClick={copyPrompt}>
          Copiar pedido com o código
        </button>
        {copied === "ok" && <p className="small ok-text">Copiado. Agora cole no chat da IA.</p>}
        {copied === "manual" && (
          <>
            <p className="small">Não consegui copiar sozinho. O texto abaixo já está selecionado: copie e cole no chat da IA.</p>
            <textarea ref={promptBox} id="bridge-prompt" className="textarea" rows={6} readOnly value={prompt} />
          </>
        )}
        {code.length > BIG_CODE && (
          <p className="small muted" style={{ margin: 0 }}>
            Este artefato tem {(code.length / 1024).toFixed(0)} KB. Se a IA reclamar do tamanho, anexe o arquivo baixado no
            Histórico em vez de colar.
          </p>
        )}
      </section>

      <section className="bridge-step">
        <h4>2. Cole a resposta da IA</h4>
        <textarea
          id="bridge-reply"
          className="textarea"
          rows={6}
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Cole aqui a resposta inteira, com o bloco de código"
          aria-label="Resposta da IA"
        />
        <button className="btn" type="button" onClick={check} disabled={!reply.trim()}>
          Ver o que mudou
        </button>
      </section>

      {result && (
        <section className="bridge-step">
          <h4>3. Confira e salve</h4>
          {result.warnings.map((w) => (
            <p key={w} className="notice small warn" style={{ margin: 0 }}>
              {w}
            </p>
          ))}
          {result.code && diff && (
            <>
              <p className="small" style={{ margin: 0 }}>
                <b>+{diff.added}</b> linhas novas e <b>−{diff.removed}</b> linhas tiradas. A prévia ao lado já mostra a versão
                da IA, como rascunho.
              </p>
              {diff.approximate && (
                <p className="small muted" style={{ margin: 0 }}>
                  A mudança é grande demais para comparar linha a linha; o resumo mostra o trecho inteiro como trocado.
                </p>
              )}
              <div className="diff" role="region" aria-label="Diferenças">
                {parts.map((h, i) => {
                  if ("skipped" in h) {
                    return (
                      <div key={i} className="diff-skip">
                        {h.skipped} linhas iguais
                      </div>
                    );
                  }
                  if (shown >= MAX_SHOWN) return null;
                  const ls = h.lines.slice(0, MAX_SHOWN - shown);
                  shown += ls.length;
                  return ls.map((l, k) => (
                    <div key={`${i}-${k}`} className={`diff-line ${l.type}`}>
                      <span className="diff-mark">{l.type === "add" ? "+" : l.type === "del" ? "−" : " "}</span>
                      {l.text || " "}
                    </div>
                  ));
                })}
                {shown >= MAX_SHOWN && <div className="diff-skip">Mais mudanças não mostradas aqui.</div>}
              </div>
              <div className="row" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn primary" type="button" onClick={save} disabled={busy}>
                  {busy ? "Salvando…" : "Salvar como versão nova"}
                </button>
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    onUseInEditor(result.code);
                    setResult(null);
                  }}
                >
                  Ajustar no editor
                </button>
                <button className="btn" type="button" onClick={discard}>
                  Descartar
                </button>
              </div>
            </>
          )}
          {error && <p className="small error">{error}</p>}
        </section>
      )}
    </div>
  );
}
