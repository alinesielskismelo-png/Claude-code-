// Teste de ponta a ponta: login, importação, execução isolada, dados persistidos e versões.
// Uso: com o servidor rodando (APP_PASSWORD definido), rode
//   BASE=http://localhost:3100 PASSWORD=... node scripts/e2e.mjs arquivo1.html [arquivo2.html ...]
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { createRequire } from "node:module";

// Usa o Playwright instalado na máquina (npm i -D playwright, ou global com NODE_PATH).
const { chromium } = createRequire(import.meta.url)("playwright");

const BASE = process.env.BASE || "http://localhost:3000";
const PASSWORD = process.env.PASSWORD || "";
const SHOTS = process.env.SHOTS || "";
const files = process.argv.slice(2);
let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? "ok  " : "FAIL"} ${msg}`); if (!ok) failures++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (e) => console.log("  [página] erro:", e.message));

await page.goto(`${BASE}/`);
if (page.url().includes("/login")) {
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`);
}
check(!page.url().includes("/login"), "login");

const ids = [];
for (const f of files) {
  const code = readFileSync(f, "utf8");
  const r = await page.evaluate(async ({ code, filename }) => {
    const res = await fetch("/api/artifacts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code, filename, tags: "teste" }) });
    return { status: res.status, body: await res.json() };
  }, { code, filename: basename(f) });
  check(r.status === 201, `importar ${basename(f)} -> "${r.body.artifact?.title}" (${r.body.artifact?.kind})`);
  ids.push(r.body.artifact.id);
}

await page.goto(`${BASE}/`);
await page.waitForSelector(".card");
check((await page.locator(".card").count()) === files.length, "biblioteca lista os artefatos");
if (SHOTS) await page.screenshot({ path: `${SHOTS}/biblioteca.png` });
await page.fill('input[type="search"]', "zzzz-nada");
await sleep(500);
check((await page.locator(".card").count()) === 0, "busca filtra");

for (const [i, id] of ids.entries()) {
  const name = basename(files[i]);
  await page.goto(`${BASE}/view/${id}`);
  const handle = await page.waitForSelector(".runner iframe");
  await sleep(3500);
  const frame = await handle.contentFrame();
  const text = (await frame.evaluate(() => document.body.innerText)).trim();
  check(text.length > 50, `${name}: renderizou (${text.length} caracteres de texto)`);
  check(new URL(frame.url()).host !== new URL(BASE).host, `${name}: roda em outra origem (${new URL(frame.url()).host})`);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/view-${i}.png` });

  // Isolamento
  const sec = await frame.evaluate(async () => {
    const out = {};
    try { await fetch("/api/artifacts"); out.fetch = "permitido"; } catch { out.fetch = "bloqueado"; }
    try { out.cookie = document.cookie; } catch { out.cookie = "inacessível"; }
    try { void window.parent.document.body; out.parent = "acessível"; } catch { out.parent = "bloqueado"; }
    return out;
  });
  check(sec.fetch === "bloqueado", `${name}: fetch do artefato bloqueado pela CSP`);
  check(sec.cookie === "" || sec.cookie === "inacessível", `${name}: sem acesso a cookies`);
  check(sec.parent === "bloqueado", `${name}: sem acesso à página pai`);

  // Dados persistidos: localStorage e window.claude
  await frame.evaluate(() => localStorage.setItem("e2e", "persistiu"));
  const hasClaude = await frame.evaluate(async () => typeof window.claude?.use === "function" && !!(await window.claude.use("db")));
  check(hasClaude, `${name}: window.claude.use("db") disponível`);
  await sleep(1200);
  const kv = await page.evaluate(async (id) => (await (await fetch(`/api/artifacts/${id}/kv`)).json()).kv, id);
  check(kv["ls:e2e"] === "persistiu", `${name}: localStorage salvo no servidor`);
  await page.reload();
  const f2 = await (await page.waitForSelector(".runner iframe")).contentFrame();
  await sleep(2500);
  check((await f2.evaluate(() => localStorage.getItem("e2e"))) === "persistiu", `${name}: localStorage volta depois de recarregar`);
}

// Editor: salvar versão nova e restaurar
if (ids.length) {
  const id = ids[0];
  await page.goto(`${BASE}/artifacts/${id}`);
  await page.waitForSelector(".code-area");
  await sleep(2500);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/editor.png` });
  const area = page.locator(".code-area");
  const orig = await area.inputValue();
  await area.fill(orig.replace(/<\/body>/i, "<p id=\"e2e-mark\">editado no teste</p></body>"));
  await page.fill('input[aria-label="Mensagem da versão"]', "teste e2e");
  await page.click("text=Salvar versão");
  await page.waitForSelector("text=v2 salva");
  const vers = await page.evaluate(async (id) => (await (await fetch(`/api/artifacts/${id}/versions`)).json()).versions, id);
  check(vers.length === 2 && vers[0].message === "teste e2e", "editor salva versão nova com mensagem");
  await sleep(2500);
  const f = await (await page.waitForSelector(".runner iframe")).contentFrame();
  check(!!(await f.$("#e2e-mark")), "prévia mostra a versão salva");
  await page.click("text=Histórico");
  await page.locator(".version").nth(1).locator("text=Restaurar").click();
  await page.waitForSelector("text=v3 salva");
  const cur = await page.evaluate(async (id) => (await (await fetch(`/api/artifacts/${id}`)).json()).code, id);
  check(cur === orig, "restaurar v1 cria v3 com o código original");
}

await browser.close();
console.log(failures ? `\n${failures} falha(s)` : "\nTudo certo");
process.exit(failures ? 1 : 0);
