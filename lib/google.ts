/** Login com Google (OAuth 2.0, fluxo de código). Sem bibliotecas extras. */
export const STATE_COOKIE = "art_oauth";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

/** Endereço público da plataforma (APP_ORIGIN, ou o da própria requisição). */
export function publicOrigin(req: Request): string {
  return process.env.APP_ORIGIN?.replace(/\/+$/, "") || new URL(req.url).origin;
}

export function redirectUri(req: Request): string {
  return `${publicOrigin(req)}/api/auth/google/callback`;
}

/** Só aceita caminhos internos como destino depois do login. */
export function safeNext(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}

export function authorizeUrl(req: Request, state: string, loginHint?: string): string {
  const u = new URL(AUTH_URL);
  u.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID || "");
  u.searchParams.set("redirect_uri", redirectUri(req));
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", "openid email");
  u.searchParams.set("state", state);
  u.searchParams.set("prompt", "select_account");
  if (loginHint) u.searchParams.set("login_hint", loginHint);
  return u.toString();
}

/** Troca o código pelo e-mail verificado da conta Google. */
export async function emailFromCode(req: Request, code: string): Promise<string | null> {
  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      redirect_uri: redirectUri(req),
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) return null;
  const token = (await tokenRes.json()) as { access_token?: string };
  if (!token.access_token) return null;
  const infoRes = await fetch(USERINFO_URL, { headers: { authorization: `Bearer ${token.access_token}` } });
  if (!infoRes.ok) return null;
  const info = (await infoRes.json()) as { email?: string; email_verified?: boolean };
  if (!info.email || info.email_verified !== true) return null;
  return info.email.toLowerCase();
}
