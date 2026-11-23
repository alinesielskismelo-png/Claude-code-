"use client";
// Painel "Editar com IA": a usuária descreve a mudança, vê o diff, aceita ou descarta.
// Aceitar chama onAccept (que salva uma nova versão). Desfazer salva de volta o código anterior,
// também como nova versão, para o histórico continuar linear e nada se perder.
import { useMemo, useState } from "react";
import { diffLines, type DiffHunk } from "@/lib/ai/edits";

export interface AiEditPanelProps {
  artifactId: string;
  code: string;
  title?: string;
  /** Salva o novo código como nova versão. Deve lançar erro se não conseguir salvar. */
  onAccept: (newCode: string, summary: string) => Promise<void> | void;
}

type Proposal = { code: string; summary: string; base: string };
type Accepted = { previous: string; summary: string };

export default function AiEditPanel({ artifactId, code, title, onAccept }: AiEditPanelProps) {
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [accepted, setAccepted] = useState<Accepted | null>(null);

  const hunks = useMemo<DiffHunk[]>(
    () => (proposal ? diffLines(proposal.base, proposal.code) : []),
    [proposal],
  );

  async function requestEdit() {
    if (!instruction.trim() || loading) return;
    setLoading(true);
    setError(null);
    setProposal(null);
    try {
      const res = await fetch("/api/ai/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, instruction, title, artifactId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
      if (data.code === code) {
        setError(data.summary || "A IA não propôs nenhuma mudança.");
      } else {
        setProposal({ code: data.code, summary: data.summary, base: code });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao falar com a IA.");
    } finally {
      setLoading(false);
    }
  }

  async function accept() {
    if (!proposal) return;
    if (proposal.base !== code) {
      setError("O código mudou depois deste pedido. Peça a edição de novo.");
      setProposal(null);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onAccept(proposal.code, `IA: ${proposal.summary}`);
      setAccepted({ previous: proposal.base, summary: proposal.summary });
      setProposal(null);
      setInstruction("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar a nova versão.");
    } finally {
      setSaving(false);
    }
  }

  async function undo() {
    if (!accepted) return;
    setSaving(true);
    setError(null);
    try {
      await onAccept(accepted.previous, `Desfeito: ${accepted.summary}`);
      setAccepted(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível desfazer.");
    } finally {
      setSaving(false);
    }
  }

  const added = hunks.reduce((n, h) => n + h.lines.filter((l) => l.kind === "added").length, 0);
  const removed = hunks.reduce((n, h) => n + h.lines.filter((l) => l.kind === "removed").length, 0);

  return (
    <section style={styles.panel} aria-label="Editar com IA">
      <h3 style={styles.heading}>Editar com IA</h3>
      <textarea
        style={styles.textarea}
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) requestEdit();
        }}
        placeholder="Descreva a mudança. Ex.: deixe o cabeçalho azul-escuro e adicione um botão de imprimir."
        rows={3}
        disabled={loading || saving}
      />
      <div style={styles.row}>
        <button style={styles.primary} onClick={requestEdit} disabled={loading || saving || !instruction.trim()}>
          {loading ? "Gerando proposta…" : "Pedir alteração"}
        </button>
        {accepted && !proposal && (
          <button style={styles.secondary} onClick={undo} disabled={saving}>
            Desfazer última alteração da IA
          </button>
        )}
      </div>

      {error && (
        <p role="alert" style={styles.error}>
          {error}
        </p>
      )}

      {proposal && (
        <div style={styles.proposal}>
          <p style={styles.summary}>{proposal.summary}</p>
          <p style={styles.stats}>
            <span style={{ color: "var(--ai-added, #1a7f37)" }}>+{added}</span>{" "}
            <span style={{ color: "var(--ai-removed, #cf222e)" }}>−{removed}</span> linhas
          </p>
          <div style={styles.diff}>
            {hunks.map((hunk, i) => (
              <div key={i} style={styles.hunk}>
                {hunk.lines.map((line, j) => (
                  <div key={j} style={{ ...styles.line, ...lineStyle[line.kind] }}>
                    <span style={styles.lineNo}>{line.line}</span>
                    <span style={styles.sign}>{line.kind === "added" ? "+" : line.kind === "removed" ? "−" : " "}</span>
                    <span>{line.text || " "}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div style={styles.row}>
            <button style={styles.primary} onClick={accept} disabled={saving}>
              {saving ? "Salvando…" : "Aceitar e salvar versão"}
            </button>
            <button style={styles.secondary} onClick={() => setProposal(null)} disabled={saving}>
              Descartar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  panel: { display: "flex", flexDirection: "column", gap: 8, padding: 12, border: "1px solid #d0d7de", borderRadius: 8 },
  heading: { margin: 0, fontSize: 15 },
  textarea: { width: "100%", boxSizing: "border-box", font: "inherit", padding: 8, borderRadius: 6, border: "1px solid #d0d7de", resize: "vertical" },
  row: { display: "flex", gap: 8, flexWrap: "wrap" },
  primary: { padding: "6px 12px", borderRadius: 6, border: "none", background: "#1f6feb", color: "#fff", cursor: "pointer" },
  secondary: { padding: "6px 12px", borderRadius: 6, border: "1px solid #d0d7de", background: "transparent", color: "inherit", cursor: "pointer" },
  error: { margin: 0, color: "#cf222e" },
  proposal: { display: "flex", flexDirection: "column", gap: 8 },
  summary: { margin: 0 },
  stats: { margin: 0, fontSize: 13 },
  diff: { maxHeight: 420, overflow: "auto", border: "1px solid #d0d7de", borderRadius: 6, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 },
  hunk: { borderBottom: "1px solid #d0d7de" },
  line: { display: "flex", whiteSpace: "pre", padding: "0 6px" },
  lineNo: { width: 48, flexShrink: 0, color: "#8c959f", textAlign: "right", paddingRight: 8, userSelect: "none" },
  sign: { width: 14, flexShrink: 0, userSelect: "none" },
};

const lineStyle: Record<string, React.CSSProperties> = {
  context: {},
  added: { background: "rgba(46, 160, 67, 0.15)" },
  removed: { background: "rgba(248, 81, 73, 0.15)" },
};
