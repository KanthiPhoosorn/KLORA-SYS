import { NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { reviewCustomEntry } from "@/lib/store";

// PATCH /api/custom-entries/[id] — KYN confirms / rejects a typed-in value; `ef` (kg CO₂e per unit)
// prices it in the carbon calculation from the next computation on.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(["kyn"]);
  if (g.deny) return g.deny;
  const { id } = await params;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 }); }
  const status = body.status === "approved" || body.status === "rejected" || body.status === "pending" ? body.status : null;
  if (!status) return NextResponse.json({ error: "สถานะไม่ถูกต้อง" }, { status: 400 });
  const ef = body.ef != null && body.ef !== "" && Number(body.ef) >= 0 ? Number(body.ef) : null;
  const note = body.note ? String(body.note).slice(0, 300) : null;
  const r = await reviewCustomEntry(id, { status, ef, note }, g.user.id);
  if (!r) return NextResponse.json({ error: "ไม่พบรายการ" }, { status: 404 });
  return NextResponse.json(r);
}
