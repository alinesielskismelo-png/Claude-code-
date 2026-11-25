import { NextResponse } from "next/server";
import { assertSameOrigin, fail } from "@/lib/api";
import { gwsDisconnect, gwsStatus } from "@/lib/gws/account";

export async function GET() {
  try {
    return NextResponse.json(await gwsStatus());
  } catch (e) {
    return fail(e);
  }
}

/** Desliga o Google do site (apaga o token guardado). */
export async function DELETE(req: Request) {
  try {
    assertSameOrigin(req);
    await gwsDisconnect();
    return NextResponse.json(await gwsStatus());
  } catch (e) {
    return fail(e);
  }
}
