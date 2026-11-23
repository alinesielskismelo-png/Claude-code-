import { NextResponse } from "next/server";
import { googleConfigured, randomToken } from "@/lib/auth";
import { STATE_COOKIE, authorizeUrl, publicOrigin, safeNext } from "@/lib/google";

/** Começa o login: manda para a tela de escolha de conta do Google. */
export async function GET(req: Request) {
  if (!googleConfigured()) {
    return NextResponse.redirect(`${publicOrigin(req)}/login?erro=google-desligado`);
  }
  const state = randomToken();
  const next = safeNext(new URL(req.url).searchParams.get("next"));
  const res = NextResponse.redirect(authorizeUrl(req, state));
  res.cookies.set(STATE_COOKIE, `${state}|${encodeURIComponent(next)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth/google",
    maxAge: 600,
  });
  return res;
}
