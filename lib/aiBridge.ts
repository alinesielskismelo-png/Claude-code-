/**
 * Ponte com as IAs de fora (Claude, ChatGPT, Gemini).
 * O site não tem IA dentro: ele monta o pedido para você colar no chat e
 * lê a resposta que você cola de volta, para virar uma versão nova.
 */
import type { ArtifactKind } from "./types";

export interface PromptInput {
  title: string;
  kind: ArtifactKind;
  code: string;
  request: string;
}

/** Texto para colar no chat de uma IA: o pedido, as regras de resposta e o código atual. */
export function buildPrompt({ title, kind, code, request }: PromptInput): string {
  const lang = kind === "react" ? "jsx" : "html";
  const what = kind === "react" ? "um componente React (JSX) de arquivo único" : "uma página HTML de arquivo único";
  const pedido = request.trim() || "(escreva aqui o que você quer mudar)";
  return [
    `Este é o artefato "${title}", ${what}, que eu guardo no meu site Sielskis Workspace.`,
    "",
    "O que eu quero mudar:",
    pedido,
    "",
    "Como responder:",
    `1. Devolva o arquivo COMPLETO já alterado, num único bloco de código \`\`\`${lang}.`,
    '2. Não corte partes nem escreva "o resto continua igual": o arquivo inteiro vai substituir o atual.',
    "3. Mantenha tudo o que eu não pedi para mudar (visual, textos, dados e funções).",
    "4. Antes do bloco, diga em poucas linhas o que você mudou.",
    "",
    "Código atual:",
    "```" + lang,
    code,
    "```",
  ].join("\n");
}

export interface Extracted {
  /** Código encontrado na resposta (vazio se nada foi achado). */
  code: string;
  /** Quantos blocos de código a resposta tinha. */
  blocks: number;
  /** Avisos para mostrar antes de salvar. */
  warnings: string[];
}

const FENCE = /(^|\n)[ \t]*(`{3,}|~{3,})[ \t]*([\w+#.-]*)[^\n]*\n([\s\S]*?)\n[ \t]*\2[ \t]*(?=\n|$)/g;

/** Frases típicas de quando a IA cortou parte do arquivo. */
const CUT_MARKERS = [
  /\/\/\s*\.{3}/,
  /\/\*\s*\.{3}[\s\S]{0,80}?\*\//,
  /<!--\s*\.{3}[\s\S]{0,80}?-->/,
  /\b(resto|restante)\s+(do\s+c[oó]digo|igual|permanece|continua)/i,
  /\b(mant[eé]m|mantenha|continua)\s+(igual|o mesmo|inalterad)/i,
  /\b(rest of (the )?(code|file)|existing code|unchanged|same as before)\b/i,
  /\.\.\.\s*(c[oó]digo|code)\s*(anterior|existente|existing|previous)/i,
];

/**
 * Tira o código da resposta colada: o maior bloco ```...```; sem blocos, o texto todo
 * (quando ele parece código). Também avisa quando a resposta parece cortada.
 */
export function extractCode(reply: string, previous = ""): Extracted {
  const text = reply.replace(/\r\n?/g, "\n");
  const warnings: string[] = [];
  const blocks: string[] = [];
  for (const m of text.matchAll(FENCE)) blocks.push(m[4]);

  let code = "";
  if (blocks.length) {
    code = blocks.reduce((a, b) => (b.length > a.length ? b : a), "");
    if (blocks.length > 1) {
      warnings.push(`A resposta tinha ${blocks.length} blocos de código. Usei o maior; confira se é o arquivo inteiro.`);
    }
  } else {
    const t = text.trim();
    if (/^(<!doctype|<html|<|import\s|export\s|const\s|function\s|"use client")/i.test(t)) code = t;
  }
  code = code.replace(/^\n+/, "").replace(/\s+$/, "") + (code ? "\n" : "");

  if (!code.trim()) {
    return { code: "", blocks: blocks.length, warnings: ["Não achei código na resposta. Cole a resposta inteira da IA, com o bloco de código."] };
  }

  if (CUT_MARKERS.some((re) => re.test(code))) {
    warnings.push('O código parece ter partes cortadas (por exemplo "// ..." ou "o resto continua igual"). Peça à IA o arquivo completo antes de salvar.');
  }
  const prev = previous.trim().length;
  if (prev > 2000 && code.trim().length < prev * 0.6) {
    const pct = Math.round((1 - code.trim().length / prev) * 100);
    warnings.push(`O código novo é ${pct}% menor que o atual. Pode estar incompleto.`);
  }
  if (previous && code.trim() === previous.trim()) {
    warnings.push("O código da resposta é igual ao atual: nada mudou.");
  }
  return { code, blocks: blocks.length, warnings };
}
