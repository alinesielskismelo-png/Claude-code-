import type { ArtifactKind } from "./types";

/** Adivinha se o código é uma página HTML ou um componente React (JSX/TSX). */
export function detectKind(code: string, filename?: string): ArtifactKind {
  const name = (filename || "").toLowerCase();
  if (/\.(jsx|tsx)$/.test(name)) return "react";
  if (/\.html?$/.test(name)) return "html";
  const head = code.slice(0, 4000);
  if (/<!doctype html|<html[\s>]|<head[\s>]|<body[\s>]/i.test(head)) return "html";
  if (/export\s+default\b/.test(code) || /from\s+["']react["']/.test(head)) return "react";
  return "html";
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

/** Sugere um título a partir de <title>, do primeiro <h1> ou do nome do arquivo. */
export function guessTitle(code: string, filename?: string): string {
  const t = code.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  if (t && t.trim()) return decodeEntities(t.replace(/\s+/g, " ").trim()).slice(0, 200);
  const h1 = code.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  if (h1) {
    const txt = decodeEntities(h1.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());
    if (txt) return txt.slice(0, 200);
  }
  const fn = code.match(/export\s+default\s+function\s+([A-Za-z0-9_]+)/)?.[1];
  if (fn) return fn.replace(/([a-z])([A-Z])/g, "$1 $2");
  if (filename) return filename.replace(/\.[^.]+$/, "");
  return "Artefato sem título";
}

/** Normaliza uma lista de tags vinda de texto ("a, b, c") ou array. */
export function normalizeTags(input: unknown): string[] {
  const arr = Array.isArray(input) ? input : typeof input === "string" ? input.split(",") : [];
  const out: string[] = [];
  for (const raw of arr) {
    const t = String(raw).trim().toLowerCase().slice(0, 40);
    if (t && !out.includes(t)) out.push(t);
  }
  return out.slice(0, 20);
}

/** Texto sem acentos e em minúsculas, para busca. */
export function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
