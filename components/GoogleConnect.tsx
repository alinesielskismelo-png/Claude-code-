"use client";

import { useEffect, useState } from "react";

type Status = { configured: boolean; connected: boolean; email?: string };

/** Botão "Conectar Google": liga o site à Agenda, Drive, Planilhas e Gmail. */
export default function GoogleConnect() {
  const [s, setS] = useState<Status | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/google/status").then((r) => (r.ok ? r.json() : null)).then(setS).catch(() => {});
    const g = new URLSearchParams(window.location.search).get("google");
    if (g === "ok") setMsg("Google conectado.");
    else if (g === "erro") setMsg("Não deu para conectar o Google. Tente de novo.");
    else if (g === "sem-chave") setMsg("Falta a chave do Google no site (GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET).");
  }, []);

  async function disconnect() {
    if (!window.confirm("Desligar o Google do site? Os painéis deixam de ver Agenda, Drive, Planilhas e Gmail até você conectar de novo.")) return;
    const r = await fetch("/api/google/status", { method: "DELETE" });
    if (r.ok) setS(await r.json());
  }

  if (!s || !s.configured) return msg ? <span style={{ fontSize: 13, color: "var(--muted)" }}>{msg}</span> : null;
  return (
    <>
      {msg && <span style={{ fontSize: 13, color: "var(--muted)" }}>{msg}</span>}
      {s.connected ? (
        <button type="button" className="btn sm" onClick={disconnect} title={s.email ? `Conectado como ${s.email}` : "Google conectado"}>
          Google conectado
        </button>
      ) : (
        <a className="btn sm" href="/api/google/connect">
          Conectar Google
        </a>
      )}
    </>
  );
}
