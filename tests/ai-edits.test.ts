// Testes das funções puras de edição e diff. Rode com: node --test --experimental-strip-types tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyEdits, diffLines } from "../lib/ai/edits.ts";

test("aplica edições em ordem", () => {
  const r = applyEdits("a\nb\nc", [
    { old_str: "b", new_str: "B" },
    { old_str: "B\nc", new_str: "B\nC\nD" },
  ]);
  assert.deepEqual(r, { ok: true, code: "a\nB\nC\nD" });
});

test("recusa trecho ausente", () => {
  const r = applyEdits("abc", [{ old_str: "x", new_str: "y" }]);
  assert.equal(r.ok, false);
});

test("recusa trecho repetido", () => {
  const r = applyEdits("aa", [{ old_str: "a", new_str: "b" }]);
  assert.equal(r.ok, false);
});

test("old_str vazio só em código vazio", () => {
  assert.deepEqual(applyEdits("", [{ old_str: "", new_str: "novo" }]), { ok: true, code: "novo" });
  assert.equal(applyEdits("x", [{ old_str: "", new_str: "novo" }]).ok, false);
});

test("diff sem mudanças é vazio", () => {
  assert.deepEqual(diffLines("a\nb", "a\nb"), []);
});

test("diff mostra linha trocada com contexto", () => {
  const old = Array.from({ length: 20 }, (_, i) => `l${i + 1}`).join("\n");
  const neu = old.replace("l10", "L10");
  const hunks = diffLines(old, neu);
  assert.equal(hunks.length, 1);
  const kinds = hunks[0].lines.map((l) => `${l.kind}:${l.text}:${l.line}`);
  assert.deepEqual(kinds, [
    "context:l7:7", "context:l8:8", "context:l9:9",
    "removed:l10:10", "added:L10:10",
    "context:l11:11", "context:l12:12", "context:l13:13",
  ]);
});

test("diff separa mudanças distantes em blocos", () => {
  const old = Array.from({ length: 40 }, (_, i) => `l${i + 1}`).join("\n");
  const neu = old.replace("l5\n", "L5\n").replace("l35", "L35");
  assert.equal(diffLines(old, neu).length, 2);
});

test("diff de arquivo grande com edição pequena é rápido", () => {
  const old = Array.from({ length: 50_000 }, (_, i) => `linha ${i}`).join("\n");
  const neu = old.replace("linha 25000\n", "linha 25000\nnova\n");
  const t = Date.now();
  const hunks = diffLines(old, neu);
  assert.ok(Date.now() - t < 500);
  assert.equal(hunks[0].lines.filter((l) => l.kind === "added").length, 1);
});
