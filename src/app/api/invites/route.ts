import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getInvites, addInvite } from "@/lib/store";
import type { MemberRole } from "@/lib/types";

function orgOf(u: { supplierId?: string; id: string }) {
  return u.supplierId ?? u.id;
}

// GET /api/invites — pending invites for the org.  POST — invite by email (stubbed email).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const invites = await getInvites(orgOf(user));
  return NextResponse.json(invites);
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  let body: { email?: string; role?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 }); }
  const email = String(body.email ?? "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return NextResponse.json({ error: "อีเมลไม่ถูกต้อง" }, { status: 400 });
  const role: MemberRole = body.role === "org_admin" ? "org_admin" : "member";
  const inv = await addInvite(orgOf(user), email, role);
  // Note: a real invite email would be sent here (stubbed for the demo).
  return NextResponse.json(inv, { status: 201 });
}
