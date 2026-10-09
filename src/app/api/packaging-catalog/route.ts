import { NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { getCatalog, saveCatalog } from "@/lib/store";

// GET /api/packaging-catalog — KYN's central packaging table (any signed-in user; the forms use it).
// PUT /api/packaging-catalog — KYN only: replace it (merged over the defaults, junk dropped).
export async function GET() {
  const g = await guard();
  if (g.deny) return g.deny;
  return NextResponse.json(await getCatalog());
}

export async function PUT(req: Request) {
  const g = await guard(["kyn"]);
  if (g.deny) return g.deny;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 }); }
  return NextResponse.json(await saveCatalog(body, g.user.id));
}
