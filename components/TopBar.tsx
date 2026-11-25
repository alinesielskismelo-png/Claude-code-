"use client";

import Link from "next/link";

export default function TopBar({ children }: { children?: React.ReactNode }) {
  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login";
  }
  return (
    <header className="topbar">
      <Link href="/" className="brand">
        <i aria-hidden /> Sielskis Workspace
      </Link>
      <div className="spacer" />
      {children}
      <a className="btn sm" href="/api/backup" download title="Baixa uma cópia de todos os artefatos, versões e dados">
        Baixar backup
      </a>
      <button className="btn sm" type="button" onClick={logout}>
        Sair
      </button>
    </header>
  );
}
