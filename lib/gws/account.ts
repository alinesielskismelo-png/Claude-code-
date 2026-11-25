/**
 * Conexão do site com a conta Google da Aline (Agenda, Drive, Planilhas e Gmail).
 * O token de atualização fica cifrado (AES-GCM, chave derivada do segredo do site) na tabela app_settings.
 * Só o servidor fala com o Google; os artefatos pedem pela página do site (window.claude.use("mcp")).
 */
import { secret } from "@/lib/auth";
import { publicOrigin } from "@/lib/google";
import { getStore } from "@/lib/store";

export const GWS_STATE_COOKIE = "art_gws";
const SETTING = "google_workspace";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export const SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/gmail.readonly",
];

export function gwsConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function gwsRedirectUri(req: Request): string {
  return `${publicOrigin(req)}/api/google/callback`;
}

export function gwsAuthorizeUrl(req: Request, state: string): string {
  const u = new URL(AUTH_URL);
  u.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID || "");
  u.searchParams.set("redirect_uri", gwsRedirectUri(req));
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", SCOPES.join(" "));
  u.searchParams.set("access_type", "offline");
  u.searchParams.set("prompt", "consent");
  u.searchParams.set("include_granted_scopes", "true");
  u.searchParams.set("state", state);
  return u.toString();
}

/* ---------- cifra do token ---------- */
const enc = new TextEncoder();
async function key(): Promise<CryptoKey> {
  const raw = await crypto.subtle.digest("SHA-256", enc.encode(`gws:${secret()}`));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}
const b64 = (u: Uint8Array) => Buffer.from(u).toString("base64");
const unb64 = (s: string) => new Uint8Array(Buffer.from(s, "base64"));

async function seal(text: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(), enc.encode(text)));
  return `v1.${b64(iv)}.${b64(ct)}`;
}
async function open(sealed: string): Promise<string | null> {
  const [v, iv, ct] = sealed.split(".");
  if (v !== "v1" || !iv || !ct) return null;
  try {
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, await key(), unb64(ct));
    return new TextDecoder().decode(pt);
  } catch {
    return null;
  }
}

interface Saved {
  refresh_token: string;
  email?: string;
  scope?: string;
}

async function load(): Promise<Saved | null> {
  const raw = await (await getStore()).getSetting(SETTING);
  if (!raw) return null;
  const text = await open(raw);
  if (!text) return null;
  try {
    return JSON.parse(text) as Saved;
  } catch {
    return null;
  }
}

export async function gwsStatus(): Promise<{ configured: boolean; connected: boolean; email?: string }> {
  if (!gwsConfigured()) return { configured: false, connected: false };
  const s = await load();
  return { configured: true, connected: Boolean(s), email: s?.email };
}

export async function gwsDisconnect() {
  cache = null;
  await (await getStore()).setSetting(SETTING, null);
}

function emailFromIdToken(idToken?: string): string | undefined {
  if (!idToken) return undefined;
  try {
    const payload = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString("utf8"));
    return typeof payload.email === "string" ? payload.email : undefined;
  } catch {
    return undefined;
  }
}

/** Troca o código do Google pelos tokens e guarda o de atualização. */
export async function gwsSaveFromCode(req: Request, code: string): Promise<boolean> {
  const r = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      redirect_uri: gwsRedirectUri(req),
      grant_type: "authorization_code",
    }),
  });
  if (!r.ok) return false;
  const t = (await r.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; id_token?: string; scope?: string };
  if (!t.refresh_token) return false;
  const saved: Saved = { refresh_token: t.refresh_token, email: emailFromIdToken(t.id_token), scope: t.scope };
  await (await getStore()).setSetting(SETTING, await seal(JSON.stringify(saved)));
  if (t.access_token) cache = { token: t.access_token, exp: Date.now() + ((t.expires_in || 3600) - 60) * 1000 };
  return true;
}

export class GwsError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

let cache: { token: string; exp: number } | null = null;

/** Token de acesso válido (renova com o token de atualização quando preciso). */
export async function accessToken(): Promise<string> {
  if (!gwsConfigured()) throw new GwsError("server_not_connected", "Google não configurado no site.");
  if (cache && cache.exp > Date.now()) return cache.token;
  const s = await load();
  if (!s) throw new GwsError("server_not_connected", "Conecte o Google no site.");
  const r = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      refresh_token: s.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!r.ok) {
    if (r.status === 400 || r.status === 401) throw new GwsError("needs_reauth", "A conexão com o Google expirou.");
    throw new GwsError("server_unavailable", "O Google não respondeu.");
  }
  const t = (await r.json()) as { access_token: string; expires_in?: number };
  cache = { token: t.access_token, exp: Date.now() + ((t.expires_in || 3600) - 60) * 1000 };
  return t.access_token;
}
