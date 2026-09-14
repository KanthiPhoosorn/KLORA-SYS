import { NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { getUsers, updateUser } from "@/lib/store";

// PATCH /api/users/[id] — KYN only: { status: "active" | "suspended" } on a logistic / KYN login.
// Farm accounts are governed by their supplier's status instead (PATCH /api/suppliers/[id]).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(["kyn"]);
  if (g.deny) return g.deny;
  const { id } = await params;
  let body: { status?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 }); }
  if (body.status !== "active" && body.status !== "suspended")
    return NextResponse.json({ error: "สถานะไม่ถูกต้อง" }, { status: 400 });
  const target = (await getUsers()).find((u) => u.id === id);
  if (!target) return NextResponse.json({ error: "ไม่พบบัญชี" }, { status: 404 });
  if (target.role === "supplier") return NextResponse.json({ error: "บัญชีฟาร์มจัดการผ่านสถานะของฟาร์ม" }, { status: 400 });
  if (target.id === g.user.id) return NextResponse.json({ error: "ไม่สามารถระงับบัญชีของตัวเองได้" }, { status: 400 });
  const updated = await updateUser(id, { status: body.status });
  const { passwordHash: _p, salt: _s, ...pub } = updated!;
  void _p; void _s;
  return NextResponse.json(pub);
}
