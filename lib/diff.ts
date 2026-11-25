/** Comparação linha a linha entre duas versões, para mostrar o que a IA mudou. */

export type DiffLine = { type: "same" | "add" | "del"; text: string; oldNo?: number; newNo?: number };

export interface DiffResult {
  lines: DiffLine[];
  added: number;
  removed: number;
  /** true quando o trecho mudado era grande demais para comparar com precisão. */
  approximate: boolean;
}

const MAX_CELLS = 4_000_000;

export function diffLines(before: string, after: string): DiffResult {
  const a = before.replace(/\r\n?/g, "\n").split("\n");
  const b = after.replace(/\r\n?/g, "\n").split("\n");

  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }

  const lines: DiffLine[] = [];
  for (let i = 0; i < start; i++) lines.push({ type: "same", text: a[i], oldNo: i + 1, newNo: i + 1 });

  const n = endA - start;
  const m = endB - start;
  let approximate = false;

  if (n * m <= MAX_CELLS) {
    // Maior subsequência comum (LCS) só no miolo que mudou.
    const w = m + 1;
    const dp = new Uint32Array((n + 1) * w);
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        dp[i * w + j] = a[start + i] === b[start + j] ? dp[(i + 1) * w + j + 1] + 1 : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1]);
      }
    }
    let i = 0;
    let j = 0;
    while (i < n || j < m) {
      if (i < n && j < m && a[start + i] === b[start + j]) {
        lines.push({ type: "same", text: a[start + i], oldNo: start + i + 1, newNo: start + j + 1 });
        i++;
        j++;
      } else if (j < m && (i >= n || dp[i * w + j + 1] >= dp[(i + 1) * w + j])) {
        lines.push({ type: "add", text: b[start + j], newNo: start + j + 1 });
        j++;
      } else {
        lines.push({ type: "del", text: a[start + i], oldNo: start + i + 1 });
        i++;
      }
    }
  } else {
    approximate = true;
    for (let i = 0; i < n; i++) lines.push({ type: "del", text: a[start + i], oldNo: start + i + 1 });
    for (let j = 0; j < m; j++) lines.push({ type: "add", text: b[start + j], newNo: start + j + 1 });
  }

  for (let k = 0; k < a.length - endA; k++) {
    lines.push({ type: "same", text: a[endA + k], oldNo: endA + k + 1, newNo: endB + k + 1 });
  }

  let added = 0;
  let removed = 0;
  for (const l of lines) {
    if (l.type === "add") added++;
    else if (l.type === "del") removed++;
  }
  return { lines, added, removed, approximate };
}

export type Hunk = { lines: DiffLine[] } | { skipped: number };

/** Só os trechos que mudaram, com algumas linhas de contexto em volta. */
export function hunks(lines: DiffLine[], context = 2): Hunk[] {
  const keep = new Array(lines.length).fill(false);
  lines.forEach((l, i) => {
    if (l.type === "same") return;
    for (let k = Math.max(0, i - context); k <= Math.min(lines.length - 1, i + context); k++) keep[k] = true;
  });
  const out: Hunk[] = [];
  let cur: DiffLine[] = [];
  let skipped = 0;
  lines.forEach((l, i) => {
    if (keep[i]) {
      if (skipped) {
        out.push({ skipped });
        skipped = 0;
      }
      cur.push(l);
    } else {
      if (cur.length) {
        out.push({ lines: cur });
        cur = [];
      }
      skipped++;
    }
  });
  if (cur.length) out.push({ lines: cur });
  if (skipped) out.push({ skipped });
  return out;
}
