import { NextResponse, type NextRequest } from "next/server";
import { publicOrigin } from "@/lib/google";
import { GWS_STATE_COOKIE, gwsSaveFromCode } from "@/lib/gws/account";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const saved = req.cookies.get(GWS_STATE_COOKIE)?.value;
  let result = "erro";
  if (code && state && saved && state === saved) {
    try {
      result = (await gwsSaveFromCode(req, code)) ? "ok" : "erro";
    } catch (e) {
      console.error(e);
    }
  }
  const res = NextResponse.redirect(`${publicOrigin(req)}/biblioteca?google=${result}`);
  res.cookies.set(GWS_STATE_COOKIE, "", { path: "/api/google", maxAge: 0 });
  return res;
}
