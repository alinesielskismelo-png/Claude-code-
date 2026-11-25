"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildDocument } from "@/lib/runner/build";
import type { ArtifactKind, KvMap } from "@/lib/types";
import { getRunnerOrigin } from "./runnerOrigin";

export interface RunnerLog {
  level: "error" | "warn" | "info";
  message: string;
  at: number;
}

interface Props {
  artifactId: string;
  code: string;
  kind: ArtifactKind;
  /** Mude para rodar de novo do zero. */
  runKey?: number;
  onLog?: (log: RunnerLog) => void;
  className?: string;
  title?: string;
  /** O artefato pediu para abrir outro artefato do claude.ai (id do endereço). */
  onOpenArtifact?: (ref: string) => void;
}

const SANDBOX = "allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads";

/**
 * Roda um artefato num iframe sandbox (sem allow-same-origin) servido de outra origem.
 * A página pai é a ponte: carrega/salva os dados do artefato e responde a window.claude.complete que a IA não está disponível.
 */
export default function Runner({ artifactId, code, kind, runKey = 0, onLog, className, title, onOpenArtifact }: Props) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [origin, setOrigin] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "running" | "error">("loading");
  const logRef = useRef(onLog);
  logRef.current = onLog;
  const openRef = useRef(onOpenArtifact);
  openRef.current = onOpenArtifact;
  const doc = useMemo(() => buildDocument(code, kind), [code, kind]);
  const docHash = useMemo(() => hash(doc), [doc]);

  useEffect(() => setOrigin(getRunnerOrigin()), []);

  useEffect(() => {
    if (!origin) return;
    let disposed = false;
    let port: MessagePort | null = null;
    const pendingKv = new Map<string, unknown>();
    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    setStatus("loading");

    const flush = (keepalive = false) => {
      if (flushTimer) clearTimeout(flushTimer);
      flushTimer = null;
      if (!pendingKv.size) return;
      const entries = [...pendingKv.entries()].map(([key, value]) => ({ key, value }));
      pendingKv.clear();
      fetch(`/api/artifacts/${artifactId}/kv`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entries }),
        keepalive,
      }).then(
        (r) => { if (!r.ok) logRef.current?.({ level: "error", message: "Não consegui salvar os dados do artefato.", at: Date.now() }); },
        () => logRef.current?.({ level: "error", message: "Sem conexão: dados do artefato não foram salvos.", at: Date.now() }),
      );
    };

    const answer = (id: number, result?: unknown, error?: { code: string; message: string }) =>
      port?.postMessage({ type: "rpc:result", id, result, error });

    // Sem IA dentro do site (decisão da Aline): window.claude.complete responde "não disponível".
    const handleRpc = async (id: number, method: string, args: unknown) => {
      if (method === "mcp" && Array.isArray(args)) {
        const [server, tool, toolArgs] = args;
        try {
          const r = await fetch("/api/mcp", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ server, tool, args: toolArgs || {} }),
          });
          const j = await r.json().catch(() => ({}));
          if (j && j.error && typeof j.error === "object") return answer(id, undefined, j.error);
          if (!r.ok) return answer(id, undefined, { code: "server_unavailable", message: String(j?.error || r.status) });
          return answer(id, j);
        } catch {
          return answer(id, undefined, { code: "server_unavailable", message: "Sem conexão com o site." });
        }
      }
      if (method === "asset:upload" && Array.isArray(args) && args[0] instanceof Blob) {
        const blob = args[0] as Blob;
        try {
          const r = await fetch("/api/assets", {
            method: "POST",
            headers: { "content-type": blob.type || "application/octet-stream" },
            body: blob,
          });
          const j = await r.json().catch(() => ({}));
          if (r.status === 413) return answer(id, undefined, { code: "too_large", message: String(j?.error || "Arquivo grande demais.") });
          if (!r.ok) return answer(id, undefined, { code: "upload_failed", message: String(j?.error || r.status) });
          return answer(id, j);
        } catch {
          return answer(id, undefined, { code: "upload_failed", message: "Sem conexão com o site." });
        }
      }
      answer(id, undefined, method === "complete"
        ? { code: "not_granted", message: "A IA não está disponível neste site." }
        : { code: "unknown_method", message: method });
    };

    const onMessage = async (e: MessageEvent) => {
      if (!frame.current || e.source !== frame.current.contentWindow) return;
      if (e.data?.type !== "shell:ready" || port) return;
      let kv: KvMap = {};
      try {
        const r = await fetch(`/api/artifacts/${artifactId}/kv`);
        if (r.ok) kv = (await r.json()).kv || {};
      } catch {
        /* roda sem dados salvos */
      }
      if (disposed || !frame.current?.contentWindow) return;
      const channel = new MessageChannel();
      port = channel.port1;
      port.onmessage = (ev) => {
        const m = ev.data || {};
        if (m.type === "kv:set" && typeof m.key === "string") {
          pendingKv.set(m.key, m.value ?? null);
          if (!flushTimer) flushTimer = setTimeout(() => flush(), 500);
        } else if (m.type === "rpc") {
          handleRpc(m.id, String(m.method), m.args);
        } else if (m.type === "open" && typeof m.ref === "string" && /^[A-Za-z0-9-]{1,64}$/.test(m.ref)) {
          openRef.current?.(m.ref);
        } else if (m.type === "log") {
          logRef.current?.({ level: m.level === "warn" ? "warn" : "error", message: String(m.message), at: Date.now() });
        }
      };
      // O iframe tem origem opaca ("null"), então o alvo precisa ser "*"; a checagem é pela fonte acima.
      frame.current.contentWindow.postMessage({ type: "load", html: doc, kv }, "*", [channel.port2]);
      setStatus("running");
    };

    const onUnload = () => flush(true);
    window.addEventListener("message", onMessage);
    window.addEventListener("pagehide", onUnload);
    const timeout = setTimeout(() => { if (!port && !disposed) setStatus("error"); }, 15000);
    return () => {
      disposed = true;
      clearTimeout(timeout);
      window.removeEventListener("message", onMessage);
      window.removeEventListener("pagehide", onUnload);
      flush(true);
      port?.close();
    };
  }, [origin, doc, artifactId, runKey]);

  if (!origin) return <div className={className} />;
  const src = `${origin}/run/shell?parent=${encodeURIComponent(window.location.origin)}`;
  return (
    <div className={`runner ${className || ""}`}>
      {status === "error" && (
        <div className="runner-error">
          O artefato não carregou. Verifique se a origem dos artefatos ({origin}) está no ar.
        </div>
      )}
      <iframe
        key={`${runKey}:${docHash}:${origin}`}
        ref={frame}
        src={src}
        sandbox={SANDBOX}
        allow="clipboard-write; fullscreen"
        referrerPolicy="no-referrer"
        title={title || "Artefato"}
      />
    </div>
  );
}

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
