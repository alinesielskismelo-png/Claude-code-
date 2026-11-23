/**
 * Sessão de usuária única: senha em APP_PASSWORD, cookie assinado com HMAC (Web Crypto,
 * funciona no proxy e nas rotas). Sem APP_PASSWORD em desenvolvimento, o acesso fica aberto.
 */
export const SESSION_COOKIE = "art_session";
const MAX_AGE_S = 60 * 60 * 24 * 30;

const enc = new TextEncoder();

function secret(): string {
  return process.env.SESSION_SECRET || `pw:${process.env.APP_PASSWORD || ""}`;
}

export function authDisabled(): boolean {
  return !process.env.APP_PASSWORD && process.env.NODE_ENV !== "production";
}

export function authMisconfigured(): boolean {
  return !process.env.APP_PASSWORD && process.env.NODE_ENV === "production";
}

function b64url(buf: ArrayBuffer): string {
  let s = "";
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function createSessionToken(): Promise<{ value: string; maxAge: number }> {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_S;
  const payload = `v1.${exp}`;
  return { value: `${payload}.${await hmac(payload)}`, maxAge: MAX_AGE_S };
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return false;
  const exp = Number(parts[1]);
  if (!Number.isFinite(exp) || exp < Date.now() / 1000) return false;
  return safeEqual(parts[2], await hmac(`v1.${parts[1]}`));
}

export async function checkPassword(input: string): Promise<boolean> {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return false;
  // Compara os HMACs para não vazar o tamanho/conteúdo por tempo de resposta.
  return safeEqual(await hmac(`pw.${input}`), await hmac(`pw.${expected}`));
}
