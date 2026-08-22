import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { updateMember, removeMember } from "@/lib/store";
import type { MemberRole } from "@/lib/types";

// PATCH /api/members/[id] — { role } ; DELETE removes the member.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const { id } = await params;
  let body: { role?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 }); }
  if (body.role !== "org_admin" && body.role !== "member")
    return NextResponse.json({ error: "บทบาทไม่ถูกต้อง" }, { status: 400 });
  const updated = await updateMember(id, { role: body.role as MemberRole });
  if (!updated) return NextResponse.json({ error: "ไม่พบสมาชิก" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const { id } = await params;
  const ok = await removeMember(id);
  if (!ok) return NextResponse.json({ error: "ไม่พบสมาชิก" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
