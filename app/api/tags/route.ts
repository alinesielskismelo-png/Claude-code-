import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { fail } from "@/lib/api";

export async function GET() {
  try {
    return NextResponse.json({ tags: await (await getStore()).listTags() });
  } catch (e) {
    return fail(e);
  }
}
