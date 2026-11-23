"use client";

import { useState } from "react";

export default function LoginForm({
  google,
  password: hasPassword,
  next,
  initialError,
}: {
  google: boolean;
  password: boolean;
  next: string;
  initialError: string;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(initialError);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await fetch("/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setBusy(false);
    if (r.ok) window.location.href = next;
    else setError((await r.json().catch(() => ({}))).error || "Não foi possível entrar.");
  }

  return (
    <div className="login-box">
      <h1 style={{ fontSize: 22 }}>Artefatos</h1>
      <p className="muted small" style={{ margin: 0 }}>
        Sua biblioteca privada. O acesso vale até a meia-noite.
      </p>
      {google && (
        <a className="btn primary" href={`/api/auth/google?next=${encodeURIComponent(next)}`}>
          Entrar com Google
        </a>
      )}
      {google && hasPassword && <p className="muted small" style={{ margin: 0, textAlign: "center" }}>ou</p>}
      {hasPassword && (
        <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
          <label className="field">
            <span>Senha</span>
            <input
              className="input"
              type="password"
              autoFocus={!google}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button className={google ? "btn" : "btn primary"} disabled={busy || !password} type="submit">
            {busy ? "Entrando…" : "Entrar com senha"}
          </button>
        </form>
      )}
      {!google && !hasPassword && (
        <p className="muted small" style={{ margin: 0 }}>
          Nenhuma forma de login configurada. Veja o guia de instalação.
        </p>
      )}
      {error && (
        <p className="error small" role="alert" style={{ margin: 0 }}>
          {error}
        </p>
      )}
    </div>
  );
}
