// Rode com: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { detectKind, guessTitle, normalizeTags } from "../lib/detect.ts";
import { buildDocument, injectShim, runnerCsp } from "../lib/runner/build.ts";

test("detecta HTML e React", () => {
  assert.equal(detectKind("<!doctype html><html><body>oi</body></html>"), "html");
  assert.equal(detectKind("import { useState } from 'react';\nexport default function App(){ return <div/> }"), "react");
  assert.equal(detectKind("qualquer coisa", "x.tsx"), "react");
  assert.equal(detectKind("<div>solto</div>"), "html");
});

test("sugere título", () => {
  assert.equal(guessTitle("<title>Hub &amp; Cia</title>"), "Hub & Cia");
  assert.equal(guessTitle("<h1><b>Olá</b> mundo</h1>"), "Olá mundo");
  assert.equal(guessTitle("export default function MeuPainel(){}"), "Meu Painel");
  assert.equal(guessTitle("", "arquivo.html"), "arquivo");
});

test("normaliza tags", () => {
  assert.deepEqual(normalizeTags(" Estudos, painel,estudos ,, "), ["estudos", "painel"]);
});

test("shim entra como primeiro script do head, sem quebrar o doctype", () => {
  const out = injectShim('<!doctype html><html><head><meta charset="utf-8"><script>app()</script></head><body></body></html>');
  assert.ok(out.startsWith("<!doctype html><html><head><script>(function(){"));
  assert.ok(out.indexOf("window.claude") < out.indexOf("app()"));
  assert.ok(!injectShim("<header>x</header>").includes("<header><script>"));
  assert.ok(injectShim("<!DOCTYPE html><p>oi</p>").startsWith("<!DOCTYPE html><script>"));
});

test("React vira página com importmap e o código escapado", () => {
  const doc = buildDocument("export default () => <p>{'</script>'}</p>", "react");
  assert.ok(doc.includes('type="importmap"'));
  assert.ok(!doc.includes("'</script>'"));
});

test("CSP bloqueia conexões de rede do artefato", () => {
  const csp = runnerCsp("'self'");
  assert.match(csp, /connect-src 'none'/);
  assert.match(csp, /frame-ancestors 'self'/);
});
