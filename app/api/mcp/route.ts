import { NextResponse } from "next/server";
import { assertSameOrigin, fail, readJson, str } from "@/lib/api";
import { GwsError } from "@/lib/gws/account";
import { callTool } from "@/lib/gws/tools";

/** Os artefatos chamam os conectores do Google por aqui: {server, tool, args} → {payload}. */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const body = await readJson(req);
    const server = str(body.server, "server", { required: true })!;
    const tool = str(body.tool, "tool", { required: true })!;
    const args = body.args && typeof body.args === "object" && !Array.isArray(body.args) ? (body.args as Record<string, unknown>) : {};
    try {
      const payload = await callTool(server, tool, args);
      return NextResponse.json({ payload });
    } catch (e) {
      if (e instanceof GwsError) return NextResponse.json({ error: { code: e.code, message: e.message } }, { status: 200 });
      throw e;
    }
  } catch (e) {
    return fail(e);
  }
}
