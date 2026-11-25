import { NextResponse } from "next/server";
import { randomToken } from "@/lib/auth";
import { publicOrigin } from "@/lib/google";
import { GWS_STATE_COOKIE, gwsAuthorizeUrl, gwsConfigured } from "@/lib/gws/account";

/** Liga o site à conta Google (Agenda, Drive, Planilhas e Gmail). */
export async function GET(req: Request) {
  if (!gwsConfigured()) return NextResponse.redirect(`${publicOrigin(req)}/biblioteca?google=sem-chave`);
  const state = randomToken();
  const res = NextResponse.redirect(gwsAuthorizeUrl(req, state));
  res.cookies.set(GWS_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/google",
    maxAge: 600,
  });
  return res;
}
