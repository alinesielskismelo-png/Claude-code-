import type { ArtifactKind } from "../types";
import { SHIM_JS } from "./shim.ts";

/** Versões fixas das bibliotecas usadas para rodar artefatos React. */
const REACT_CDN = {
  babel: "https://unpkg.com/@babel/standalone@7.26.4/babel.min.js",
  tailwind: "https://cdn.tailwindcss.com/3.4.16",
  imports: {
    react: "https://esm.sh/react@18.3.1",
    "react/jsx-runtime": "https://esm.sh/react@18.3.1/jsx-runtime",
    "react-dom": "https://esm.sh/react-dom@18.3.1?deps=react@18.3.1",
    "react-dom/client": "https://esm.sh/react-dom@18.3.1/client?deps=react@18.3.1",
    "lucide-react": "https://esm.sh/lucide-react@0.454.0?deps=react@18.3.1",
    recharts: "https://esm.sh/recharts@2.13.3?deps=react@18.3.1,react-dom@18.3.1",
    lodash: "https://esm.sh/lodash@4.17.21",
    "date-fns": "https://esm.sh/date-fns@3.6.0",
    mathjs: "https://esm.sh/mathjs@13.2.0",
    papaparse: "https://esm.sh/papaparse@5.4.1",
    d3: "https://esm.sh/d3@7.9.0",
  } as Record<string, string>,
};

function shimTag(): string {
  return `<script>${SHIM_JS}</script>`;
}

/** Insere o shim como primeiro script do documento, sem tirar o doctype do lugar. */
export function injectShim(html: string): string {
  const tag = shimTag();
  const head = html.match(/<head(\s[^>]*)?>/i);
  if (head && head.index !== undefined) {
    const at = head.index + head[0].length;
    return html.slice(0, at) + tag + html.slice(at);
  }
  const htmlTag = html.match(/<html(\s[^>]*)?>/i);
  if (htmlTag && htmlTag.index !== undefined) {
    const at = htmlTag.index + htmlTag[0].length;
    return html.slice(0, at) + `<head>${tag}</head>` + html.slice(at);
  }
  const doctype = html.match(/^\s*<!doctype[^>]*>/i);
  if (doctype) return doctype[0] + tag + html.slice(doctype[0].length);
  return `<!doctype html><meta charset="utf-8">${tag}` + html;
}

function jsonForScript(v: unknown): string {
  return JSON.stringify(v).replace(/</g, "\\u003c");
}

/** Monta uma página que compila e renderiza um componente React (JSX/TSX) no navegador. */
export function reactDocument(code: string): string {
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<script src="${REACT_CDN.tailwind}"></script>
<script type="importmap">${jsonForScript({ imports: REACT_CDN.imports })}</script>
<script src="${REACT_CDN.babel}"></script>
</head><body><div id="root"></div>
<script>window.__ART_SRC = ${jsonForScript(code)};</script>
<script type="module">
const show = (msg) => { const pre = document.createElement("pre"); pre.style.cssText = "color:#b00020;white-space:pre-wrap;padding:16px;font:13px monospace"; pre.textContent = msg; document.body.prepend(pre); console.error(msg); };
try {
  const out = Babel.transform(window.__ART_SRC, { filename: "artefato.tsx", presets: [["react", { runtime: "automatic" }], ["typescript", { isTSX: true, allExtensions: true }]] }).code;
  const url = URL.createObjectURL(new Blob([out], { type: "text/javascript" }));
  const mod = await import(url);
  const { createRoot } = await import("react-dom/client");
  const { createElement } = await import("react");
  const App = mod.default || Object.values(mod).find((v) => typeof v === "function");
  if (!App) throw new Error("O código não exporta um componente (use export default).");
  createRoot(document.getElementById("root")).render(createElement(App));
} catch (e) { show("Não consegui rodar este componente:\\n" + (e && e.message ? e.message : e)); }
</script></body></html>`;
}

/** Documento final que vai para o iframe: o código do artefato com o shim na frente. */
export function buildDocument(code: string, kind: ArtifactKind): string {
  return injectShim(kind === "react" ? reactDocument(code) : code);
}

/**
 * CSP do runner. O ponto principal é connect-src 'none': o artefato não consegue fazer
 * fetch/XHR/WebSocket para lugar nenhum; tudo passa pela página pai via MessagePort.
 * Scripts e estilos só de CDNs conhecidas; imagens de qualquer https (limitação aceita:
 * uma URL de imagem pode carregar dados na query).
 */
export function runnerCsp(frameAncestors: string): string {
  const cdns = [
    "https://cdnjs.cloudflare.com",
    "https://cdn.jsdelivr.net",
    "https://unpkg.com",
    "https://esm.sh",
    "https://cdn.tailwindcss.com",
    "https://code.jquery.com",
  ].join(" ");
  return [
    "default-src 'none'",
    `script-src 'unsafe-inline' 'unsafe-eval' blob: ${cdns}`,
    `style-src 'unsafe-inline' https://fonts.googleapis.com ${cdns}`,
    `font-src data: https://fonts.gstatic.com ${cdns}`,
    "img-src data: blob: https:",
    "media-src data: blob: https:",
    "connect-src 'none'",
    "worker-src blob:",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    `frame-ancestors ${frameAncestors}`,
  ].join("; ");
}
