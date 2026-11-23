// Rode com: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSessionToken, isAllowedEmail, nextMidnight, readSession } from "../lib/auth.ts";
import { safeNext } from "../lib/google.ts";

process.env.SESSION_SECRET = "teste-segredo";
process.env.ALLOWED_EMAILS = "Aline@Exemplo.com, outra@exemplo.com";
process.env.GOOGLE_CLIENT_ID = "id";
process.env.GOOGLE_CLIENT_SECRET = "segredo";

test("sessão vence na próxima meia-noite de São Paulo", () => {
  // 23/11/2026 15:59 em São Paulo (18:59 UTC) -> 24/11 00:00 em SP = 03:00 UTC
  const exp = nextMidnight(new Date("2026-11-23T18:59:00Z"), "America/Sao_Paulo");
  assert.equal(new Date(exp * 1000).toISOString(), "2026-11-24T03:00:00.000Z");
  // 23:59 em SP ainda vence na mesma noite
  const late = nextMidnight(new Date("2026-11-24T02:59:00Z"), "America/Sao_Paulo");
  assert.equal(new Date(late * 1000).toISOString(), "2026-11-24T03:00:00.000Z");
  // 00:01 em SP já vale até a meia-noite seguinte
  const early = nextMidnight(new Date("2026-11-24T03:01:00Z"), "America/Sao_Paulo");
  assert.equal(new Date(early * 1000).toISOString(), "2026-11-25T03:00:00.000Z");
});

test("só e-mails da lista são aceitos, sem diferenciar maiúsculas", () => {
  assert.equal(isAllowedEmail("aline@exemplo.com"), true);
  assert.equal(isAllowedEmail(" OUTRA@exemplo.com "), true);
  assert.equal(isAllowedEmail("intruso@exemplo.com"), false);
  assert.equal(isAllowedEmail(""), false);
});

test("cookie de sessão: válido, adulterado e e-mail removido da lista", async () => {
  const { value, maxAge } = await createSessionToken("aline@exemplo.com");
  assert.ok(maxAge > 0 && maxAge <= 24 * 3600);
  assert.equal(await readSession(value), "aline@exemplo.com");
  const parts = value.split(".");
  assert.equal(await readSession([parts[0], parts[1], parts[2], parts[3].slice(0, -1) + "x"].join(".")), null);
  assert.equal(await readSession([parts[0], String(Number(parts[1]) + 999999), parts[2], parts[3]].join(".")), null);
  process.env.ALLOWED_EMAILS = "outra@exemplo.com";
  assert.equal(await readSession(value), null);
  process.env.ALLOWED_EMAILS = "aline@exemplo.com";
});

test("cookie vencido não vale", async () => {
  const { value } = await createSessionToken("aline@exemplo.com", new Date("2020-01-01T12:00:00Z"));
  assert.equal(await readSession(value), null);
});

test("destino depois do login fica dentro do site", () => {
  assert.equal(safeNext("/artifacts/1"), "/artifacts/1");
  assert.equal(safeNext("//malicioso.com"), "/");
  assert.equal(safeNext("/\\malicioso.com"), "/");
  assert.equal(safeNext("https://malicioso.com"), "/");
  assert.equal(safeNext(null), "/");
});
