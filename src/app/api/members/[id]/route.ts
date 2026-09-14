import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getMembers, updateMember, removeMember } from "@/lib/store";
import { orgOf } from "@/lib/api-guard";
import type { MemberRole } from "@/lib/types";

// PATCH /api/members/[id] — { role } ; DELETE removes the member.
// Both only act on members of the caller's own organisation (no cross-org IDs).
async function ownsMember(user: { supplierId?: string; id: string }, id: string) {
  return (await getMembers(orgOf(user))).some((m) => m.id === id);
}
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const { id } = await params;
  let body: { role?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 }); }
  if (body.role !== "org_admin" && body.role !== "member")
    return NextResponse.json({ error: "บทบาทไม่ถูกต้อง" }, { status: 400 });
  if (!(await ownsMember(user, id))) return NextResponse.json({ error: "ไม่พบสมาชิก" }, { status: 404 });
  const updated = await updateMember(id, { role: body.role as MemberRole });
  if (!updated) return NextResponse.json({ error: "ไม่พบสมาชิก" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const { id } = await params;
  if (!(await ownsMember(user, id))) return NextResponse.json({ error: "ไม่พบสมาชิก" }, { status: 404 });
  const ok = await removeMember(id);
  if (!ok) return NextResponse.json({ error: "ไม่พบสมาชิก" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
