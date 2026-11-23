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
}

const SANDBOX = "allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads";

/**
 * Roda um artefato num iframe sandbox (sem allow-same-origin) servido de outra origem.
 * A página pai é a ponte: carrega/salva os dados do artefato e atende window.claude.complete.
 */
export default function Runner({ artifactId, code, kind, runKey = 0, onLog, className, title }: Props) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [origin, setOrigin] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "running" | "error">("loading");
  const logRef = useRef(onLog);
  logRef.current = onLog;
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

    const handleRpc = async (id: number, method: string, args: unknown[]) => {
      if (method !== "complete") return answer(id, undefined, { code: "unknown_method", message: method });
      try {
        const r = await fetch("/api/ai/complete", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ prompt: String(args[0] ?? "") }),
        });
        const json = await r.json().catch(() => ({}));
        if (r.ok) return answer(id, { text: json.text ?? "" });
        const code = r.status === 429 ? "rate_limited" : r.status === 404 || r.status === 501 ? "not_granted" : "error";
        answer(id, undefined, { code, message: json.error || `Erro ${r.status}` });
      } catch {
        answer(id, undefined, { code: "network", message: "Sem conexão" });
      }
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
          handleRpc(m.id, m.method, Array.isArray(m.args) ? m.args : []);
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
