import { runnerCsp } from "@/lib/runner/build";
import { appOrigin } from "@/lib/origins";

export const dynamic = "force-dynamic";

/**
 * Página vazia que recebe o artefato da plataforma e o escreve em si mesma.
 * Roda numa origem separada e num iframe sandbox sem allow-same-origin: o código do
 * artefato não alcança cookies, sessão nem APIs da plataforma.
 */
const SHELL = `<!doctype html><html><head><meta charset="utf-8"><title>Artefato</title></head><body><script>
(function(){
  var parentOrigin = new URLSearchParams(location.search).get("parent") || "*";
  function onMsg(e){
    if (e.source !== window.parent) return;
    if (parentOrigin !== "*" && e.origin !== parentOrigin) return;
    var m = e.data;
    if (!m || m.type !== "load" || typeof m.html !== "string") return;
    window.removeEventListener("message", onMsg);
    window.__ART_BOOT = { kv: m.kv || {}, port: e.ports && e.ports[0] };
    document.open();
    document.write(m.html);
    document.close();
  }
  window.addEventListener("message", onMsg);
  window.parent.postMessage({ type: "shell:ready" }, parentOrigin);
})();
</script></body></html>`;

export function GET() {
  const app = appOrigin();
  const ancestors = app ? app : "'self' http://localhost:* http://127.0.0.1:*";
  return new Response(SHELL, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": runnerCsp(ancestors),
      "cache-control": "no-cache",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    },
  });
}
