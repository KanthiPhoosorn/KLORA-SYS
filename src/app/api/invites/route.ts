import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { orgOf } from "@/lib/api-guard";
import { getInvites, addInvite, getSupplier } from "@/lib/store";
import { sendInviteEmail } from "@/lib/email";
import { siteOrigin } from "@/lib/origin";
import type { MemberRole } from "@/lib/types";

// GET /api/invites — pending invites for the org.  POST — invite by email (sends the invite mail).
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
  const orgName = (user.supplierId && (await getSupplier(user.supplierId))?.farmName) || user.company || user.username;
  const { sent } = await sendInviteEmail(email, orgName, role, siteOrigin(req));
  return NextResponse.json({ ...inv, emailSent: sent }, { status: 201 });
}
