import { NextResponse } from "next/server";
import { SESSION_COOKIE, checkPassword, createSessionToken, sessionCookieOptions } from "@/lib/auth";
import { assertSameOrigin, fail, readJson } from "@/lib/api";

const attempts = new Map<string, { n: number; at: number }>();

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    const a = attempts.get(ip);
    const now = Date.now();
    if (a && now - a.at < 15 * 60_000 && a.n >= 10) {
      return NextResponse.json({ error: "Muitas tentativas. Espere 15 minutos." }, { status: 429 });
    }
    const body = await readJson(req);
    const ok = typeof body.password === "string" && (await checkPassword(body.password));
    if (!ok) {
      attempts.set(ip, { n: (a && now - a.at < 15 * 60_000 ? a.n : 0) + 1, at: a?.at && now - a.at < 15 * 60_000 ? a.at : now });
      return NextResponse.json({ error: "Senha incorreta." }, { status: 401 });
    }
    attempts.delete(ip);
    const { value, maxAge } = await createSessionToken("senha");
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, value, sessionCookieOptions(maxAge));
    return res;
  } catch (e) {
    return fail(e);
  }
}
