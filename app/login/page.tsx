"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

function LoginForm() {
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
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
    if (r.ok) {
      const next = params.get("next") || "/";
      window.location.href = next.startsWith("/") && !next.startsWith("//") ? next : "/";
    } else {
      setError((await r.json().catch(() => ({}))).error || "Não foi possível entrar.");
    }
  }

  return (
    <form onSubmit={submit}>
      <h1 style={{ fontSize: 22 }}>Artefatos</h1>
      <p className="muted small" style={{ margin: 0 }}>Sua biblioteca privada.</p>
      <label className="field">
        <span>Senha</span>
        <input className="input" type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      {error && <p className="error small" style={{ margin: 0 }}>{error}</p>}
      <button className="btn primary" disabled={busy || !password} type="submit">
        {busy ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="login">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
