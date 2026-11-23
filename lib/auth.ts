/**
 * Sessão de usuária única, com cookie assinado por HMAC (Web Crypto: funciona no proxy e nas rotas).
 *
 * Duas formas de entrar, que podem coexistir:
 * - Google (recomendado online): GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET + ALLOWED_EMAILS.
 *   Só os e-mails da lista entram.
 * - Senha única: APP_PASSWORD (bom para usar no computador ou como reserva).
 *
 * A sessão vale até a próxima meia-noite no fuso SESSION_TIMEZONE (padrão America/Sao_Paulo):
 * todo dia é preciso entrar de novo. Sem nenhuma forma de login configurada, em desenvolvimento
 * o acesso fica aberto; em produção a plataforma se recusa a funcionar.
 */
export const SESSION_COOKIE = "art_session";
export const DEFAULT_TIMEZONE = "America/Sao_Paulo";

const enc = new TextEncoder();

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && allowedEmails().length);
}

export function passwordConfigured(): boolean {
  return Boolean(process.env.APP_PASSWORD);
}

export function allowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS || "")
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return allowedEmails().includes(email.trim().toLowerCase());
}

const production = () => process.env.NODE_ENV === "production";

export function authDisabled(): boolean {
  return !googleConfigured() && !passwordConfigured() && !production();
}

/** Mensagem explicando o que falta configurar, ou null se está tudo certo. */
export function authProblem(): string | null {
  if (!production()) return null;
  if (!googleConfigured() && !passwordConfigured()) {
    return "Configure o login: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e ALLOWED_EMAILS (ou APP_PASSWORD).";
  }
  if (googleConfigured() && !process.env.SESSION_SECRET) {
    return "Defina SESSION_SECRET (um texto aleatório longo) nas variáveis de ambiente.";
  }
  return null;
}

export function authMisconfigured(): boolean {
  return authProblem() !== null;
}

function secret(): string {
  return process.env.SESSION_SECRET || `pw:${process.env.APP_PASSWORD || ""}`;
}

function b64url(buf: ArrayBuffer | Uint8Array): string {
  let s = "";
  for (const b of buf instanceof Uint8Array ? buf : new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlText(text: string): string {
  return b64url(enc.encode(text));
}

function fromB64urlText(s: string): string {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(pad);
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
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

/** Diferença (ms) entre o relógio do fuso e o UTC num instante. */
function tzOffsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** Próxima meia-noite no fuso indicado, em segundos Unix. */
export function nextMidnight(now: Date = new Date(), timeZone: string = DEFAULT_TIMEZONE): number {
  const local = new Date(now.getTime() + tzOffsetMs(now, timeZone));
  const midnightAsUtc = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + 1);
  // Corrige pelo deslocamento do fuso na própria meia-noite (caso haja horário de verão).
  const guess = midnightAsUtc - tzOffsetMs(now, timeZone);
  return Math.floor((midnightAsUtc - tzOffsetMs(new Date(guess), timeZone)) / 1000);
}

function sessionTimezone(): string {
  return process.env.SESSION_TIMEZONE || DEFAULT_TIMEZONE;
}

/** Cria o cookie de sessão. `who` é o e-mail (Google) ou "senha". */
export async function createSessionToken(who: string, now: Date = new Date()): Promise<{ value: string; maxAge: number }> {
  const exp = nextMidnight(now, sessionTimezone());
  const payload = `v2.${exp}.${b64urlText(who)}`;
  const maxAge = Math.max(60, exp - Math.floor(now.getTime() / 1000));
  return { value: `${payload}.${await hmac(payload)}`, maxAge };
}

/** Devolve quem está logado, ou null se o cookie é inválido ou expirou. */
export async function readSession(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== "v2") return null;
  const exp = Number(parts[1]);
  if (!Number.isFinite(exp) || exp < Date.now() / 1000) return null;
  if (!safeEqual(parts[3], await hmac(`v2.${parts[1]}.${parts[2]}`))) return null;
  let who: string;
  try {
    who = fromB64urlText(parts[2]);
  } catch {
    return null;
  }
  // Se o e-mail saiu da lista, a sessão deixa de valer na hora.
  if (who !== "senha" && !isAllowedEmail(who)) return null;
  if (who === "senha" && !passwordConfigured()) return null;
  return who;
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  return (await readSession(token)) !== null;
}

export async function checkPassword(input: string): Promise<boolean> {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return false;
  // Compara os HMACs para não vazar o tamanho/conteúdo por tempo de resposta.
  return safeEqual(await hmac(`pw.${input}`), await hmac(`pw.${expected}`));
}

/** Valor aleatório para o parâmetro `state` do OAuth. */
export function randomToken(bytes = 24): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return b64url(a);
}

export function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: production(),
    path: "/",
    maxAge,
  };
}
