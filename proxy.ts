import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, authDisabled, authMisconfigured, verifySessionToken } from "@/lib/auth";
import { runnerHost } from "@/lib/origins";

const PUBLIC_PATHS = new Set(["/login", "/api/login"]);

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const host = req.headers.get("host") || "";
  const rHost = runnerHost();

  // A origem dos artefatos só serve o runner; a origem da plataforma não serve o runner.
  if (rHost && host === rHost) {
    if (pathname === "/run/shell") return NextResponse.next();
    return new NextResponse("Not found", { status: 404 });
  }
  if (pathname === "/run/shell") return NextResponse.next();

  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  if (authMisconfigured()) {
    return new NextResponse("Defina APP_PASSWORD nas variáveis de ambiente para usar a plataforma.", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  if (authDisabled()) return NextResponse.next();

  const ok = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (ok) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Faça login." }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(pathname + req.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
