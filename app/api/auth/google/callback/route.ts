import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, createSessionToken, googleConfigured, isAllowedEmail, sessionCookieOptions } from "@/lib/auth";
import { STATE_COOKIE, emailFromCode, publicOrigin, safeNext } from "@/lib/google";

/** Volta do Google: confere o `state`, descobre o e-mail e só deixa entrar quem está na lista. */
export async function GET(req: NextRequest) {
  const origin = publicOrigin(req);
  const fail = (motivo: string) => {
    const res = NextResponse.redirect(`${origin}/login?erro=${motivo}`);
    res.cookies.set(STATE_COOKIE, "", { path: "/api/auth/google", maxAge: 0 });
    return res;
  };
  if (!googleConfigured()) return fail("google-desligado");

  const params = req.nextUrl.searchParams;
  const [savedState, savedNext] = (req.cookies.get(STATE_COOKIE)?.value || "").split("|");
  const state = params.get("state");
  const code = params.get("code");
  if (params.get("error")) return fail("cancelado");
  if (!savedState || !state || state !== savedState || !code) return fail("sessao-expirada");

  let email: string | null = null;
  try {
    email = await emailFromCode(req, code);
  } catch (e) {
    console.error("Falha no login com Google:", e);
  }
  if (!email) return fail("google-falhou");
  if (!isAllowedEmail(email)) return fail("email-nao-autorizado");

  const { value, maxAge } = await createSessionToken(email);
  const res = NextResponse.redirect(`${origin}${safeNext(decodeURIComponent(savedNext || ""))}`);
  res.cookies.set(SESSION_COOKIE, value, sessionCookieOptions(maxAge));
  res.cookies.set(STATE_COOKIE, "", { path: "/api/auth/google", maxAge: 0 });
  return res;
}
