// Rode com: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPrompt, extractCode } from "../lib/aiBridge.ts";
import { diffLines, hunks } from "../lib/diff.ts";

test("pedido leva o título, o pedido e o código inteiro", () => {
  const p = buildPrompt({ title: "Hub", kind: "html", code: "<p>oi</p>", request: "trocar a cor" });
  assert.ok(p.includes('"Hub"'));
  assert.ok(p.includes("trocar a cor"));
  assert.ok(p.includes("```html\n<p>oi</p>\n```"));
  assert.ok(buildPrompt({ title: "X", kind: "react", code: "x", request: "" }).includes("```jsx"));
});

test("pega o maior bloco de código da resposta", () => {
  const reply = "Mudei a cor.\n\n```css\na{}\n```\n\n```html\n<!doctype html>\n<p>novo</p>\n```\nPronto!";
  const r = extractCode(reply);
  assert.equal(r.code, "<!doctype html>\n<p>novo</p>\n");
  assert.equal(r.blocks, 2);
  assert.equal(r.warnings.length, 1);
});

test("aceita código colado sem bloco", () => {
  assert.equal(extractCode("<html><body>x</body></html>").code, "<html><body>x</body></html>\n");
  const nada = extractCode("Claro! Posso ajudar com isso.");
  assert.equal(nada.code, "");
  assert.equal(nada.warnings.length, 1);
});

test("avisa quando a IA cortou o arquivo", () => {
  const r = extractCode("```jsx\nfunction A(){}\n// ... resto do código igual\n```");
  assert.ok(r.warnings.some((w) => w.includes("cortadas")));
  const longo = "x".repeat(5000);
  assert.ok(extractCode("```html\n<p>curto</p>\n```", longo).warnings.some((w) => w.includes("menor")));
});

test("compara linhas e resume os trechos", () => {
  const d = diffLines("a\nb\nc\nd\ne\nf\ng\nh", "a\nb\nC\nd\ne\nf\ng\nh\ni");
  assert.equal(d.added, 2);
  assert.equal(d.removed, 1);
  assert.equal(d.approximate, false);
  const h = hunks(d.lines, 1);
  assert.ok(h.some((x) => "skipped" in x));
  assert.equal(diffLines("igual", "igual").added, 0);
});
