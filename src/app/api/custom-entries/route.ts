import { NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { getCustomEntries } from "@/lib/store";

// GET /api/custom-entries — KYN: every "อื่นๆ (ระบุ)" value users typed, newest first.
export async function GET() {
  const g = await guard(["kyn"]);
  if (g.deny) return g.deny;
  return NextResponse.json(await getCustomEntries());
}
