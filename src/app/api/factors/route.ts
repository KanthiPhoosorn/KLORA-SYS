import { NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { getFactors, saveFactors, getFactorsMeta } from "@/lib/store";

// GET /api/factors — current reference factors (any signed-in user: forms use the package sizes).
// PUT /api/factors — KYN only: replace the document (merged over defaults, junk dropped).
export async function GET() {
  const g = await guard();
  if (g.deny) return g.deny;
  return NextResponse.json({ factors: await getFactors(), ...(await getFactorsMeta()) });
}

export async function PUT(req: Request) {
  const g = await guard(["kyn"]);
  if (g.deny) return g.deny;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 }); }
  const factors = await saveFactors(body, g.user.id);
  return NextResponse.json({ factors });
}
