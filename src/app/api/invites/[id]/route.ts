import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getInvites, updateInvite } from "@/lib/store";
import { orgOf } from "@/lib/api-guard";

// PATCH /api/invites/[id] — { status: "cancelled" }. Only invites of the caller's own org.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const { id } = await params;
  let body: { status?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 }); }
  const status = body.status === "accepted" ? "accepted" : "cancelled";
  if (!(await getInvites(orgOf(user))).some((i) => i.id === id))
    return NextResponse.json({ error: "ไม่พบคำเชิญ" }, { status: 404 });
  const updated = await updateInvite(id, status);
  if (!updated) return NextResponse.json({ error: "ไม่พบคำเชิญ" }, { status: 404 });
  return NextResponse.json(updated);
}
