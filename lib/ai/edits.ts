// Aplicação de edições "procurar e substituir" e montagem do diff para a tela.
// Funções puras, sem dependências: usadas no servidor (aplicar) e no cliente (mostrar diff).

export interface CodeEdit {
  /** Trecho exato do código atual. Precisa aparecer exatamente uma vez. */
  old_str: string;
  /** Texto que entra no lugar. Vazio apaga o trecho. */
  new_str: string;
}

export interface DiffLine {
  kind: "context" | "removed" | "added";
  text: string;
  /** Número da linha no código antigo (removida/contexto) ou novo (adicionada). */
  line: number;
}

export interface DiffHunk {
  lines: DiffLine[];
}

export type ApplyResult =
  | { ok: true; code: string }
  | { ok: false; error: string; editIndex: number };

function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let from = 0;
  while (true) {
    const i = haystack.indexOf(needle, from);
    if (i === -1) return count;
    count++;
    if (count > 1) return count;
    from = i + 1;
  }
}

/** Aplica as edições em ordem. Cada old_str é procurado no texto já editado pelas anteriores. */
export function applyEdits(code: string, edits: CodeEdit[]): ApplyResult {
  let current = code;
  for (let i = 0; i < edits.length; i++) {
    const { old_str, new_str } = edits[i];
    if (old_str === "") {
      if (current.trim() === "") {
        current = new_str;
        continue;
      }
      return { ok: false, editIndex: i, error: `Edição ${i + 1}: old_str vazio só é permitido quando o código está vazio.` };
    }
    const n = countOccurrences(current, old_str);
    if (n === 0) {
      return { ok: false, editIndex: i, error: `Edição ${i + 1}: o trecho old_str não foi encontrado no código.` };
    }
    if (n > 1) {
      return { ok: false, editIndex: i, error: `Edição ${i + 1}: o trecho old_str aparece mais de uma vez; inclua mais contexto para torná-lo único.` };
    }
    const at = current.indexOf(old_str);
    current = current.slice(0, at) + new_str + current.slice(at + old_str.length);
  }
  return { ok: true, code: current };
}

/**
 * Diff por linhas entre dois textos, agrupado em blocos com contexto.
 * Remove prefixo e sufixo comuns e faz LCS só no miolo, o que é rápido para
 * edições localizadas mesmo em arquivos grandes. Se o miolo for grande demais
 * para LCS, mostra o miolo inteiro como removido/adicionado.
 */
export function diffLines(oldText: string, newText: string, context = 3): DiffHunk[] {
  const a = oldText.split("\n");
  const b = newText.split("\n");

  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length - 1;
  let endB = b.length - 1;
  while (endA >= start && endB >= start && a[endA] === b[endB]) {
    endA--;
    endB--;
  }

  const midA = a.slice(start, endA + 1);
  const midB = b.slice(start, endB + 1);
  if (midA.length === 0 && midB.length === 0) return [];

  // Sequência de operações para o miolo.
  type Op = { kind: DiffLine["kind"]; text: string; oldLine: number; newLine: number };
  const ops: Op[] = [];
  const LCS_LIMIT = 4_000_000; // células da tabela
  if (midA.length * midB.length <= LCS_LIMIT) {
    const n = midA.length;
    const m = midB.length;
    const table: Uint32Array[] = [];
    for (let i = 0; i <= n; i++) table.push(new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        table[i][j] = midA[i] === midB[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
      }
    }
    let i = 0;
    let j = 0;
    while (i < n || j < m) {
      if (i < n && j < m && midA[i] === midB[j]) {
        ops.push({ kind: "context", text: midA[i], oldLine: start + i + 1, newLine: start + j + 1 });
        i++;
        j++;
      } else if (i < n && (j === m || table[i + 1][j] >= table[i][j + 1])) {
        // Remoções antes de adições, como num diff tradicional.
        ops.push({ kind: "removed", text: midA[i], oldLine: start + i + 1, newLine: start + j + 1 });
        i++;
      } else {
        ops.push({ kind: "added", text: midB[j], oldLine: start + i + 1, newLine: start + j + 1 });
        j++;
      }
    }
  } else {
    midA.forEach((text, i) => ops.push({ kind: "removed", text, oldLine: start + i + 1, newLine: start + 1 }));
    midB.forEach((text, j) => ops.push({ kind: "added", text, oldLine: endA + 2, newLine: start + j + 1 }));
  }

  // Contexto antes e depois do miolo.
  const before: Op[] = [];
  for (let k = Math.max(0, start - context); k < start; k++) {
    before.push({ kind: "context", text: a[k], oldLine: k + 1, newLine: k + 1 });
  }
  const after: Op[] = [];
  for (let k = 1; k <= context && endA + k < a.length; k++) {
    after.push({ kind: "context", text: a[endA + k], oldLine: endA + k + 1, newLine: endB + k + 1 });
  }
  const all = [...before, ...ops, ...after];

  // Agrupa em blocos: corta trechos de contexto maiores que 2*context.
  const hunks: DiffHunk[] = [];
  let current: DiffLine[] = [];
  let contextRun: Op[] = [];
  const toLine = (op: Op): DiffLine => ({
    kind: op.kind,
    text: op.text,
    line: op.kind === "added" ? op.newLine : op.oldLine,
  });
  for (const op of all) {
    if (op.kind === "context") {
      contextRun.push(op);
      continue;
    }
    if (current.length > 0 && contextRun.length > context * 2) {
      current.push(...contextRun.slice(0, context).map(toLine));
      hunks.push({ lines: current });
      current = contextRun.slice(-context).map(toLine);
    } else {
      const lead = current.length === 0 ? contextRun.slice(-context) : contextRun;
      current.push(...lead.map(toLine));
    }
    contextRun = [];
    current.push(toLine(op));
  }
  if (current.length > 0) {
    current.push(...contextRun.slice(0, context).map(toLine));
    hunks.push({ lines: current });
  }
  return hunks;
}
