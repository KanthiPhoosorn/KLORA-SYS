import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { orgOf } from "@/lib/api-guard";
import { getInvites, addInvite, getSupplier } from "@/lib/store";
import { sendInviteEmail } from "@/lib/email";
import { siteOrigin } from "@/lib/origin";
import { clientIp, rateLimit, tooMany } from "@/lib/rate-limit";
import type { Invite, MemberRole } from "@/lib/types";

// The join token is a secret for the invitee only — never echo it to the inviter's browser.
const pub = ({ token: _t, ...i }: Invite) => (void _t, i);

// GET /api/invites — pending invites for the org.  POST — invite by email (sends the invite mail).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const invites = await getInvites(orgOf(user));
  return NextResponse.json(invites.map(pub));
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  // This sends mail to an arbitrary address — cap it like /forgot (per caller and per target).
  const byIp = await rateLimit(`invites:ip:${clientIp(req)}`, 20, 60 * 60 * 1000);
  if (!byIp.allowed) return tooMany(byIp.retryAfter);
  let body: { email?: string; role?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 }); }
  const email = String(body.email ?? "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return NextResponse.json({ error: "อีเมลไม่ถูกต้อง" }, { status: 400 });
  const byEmail = await rateLimit(`invites:email:${email.toLowerCase()}`, 3, 60 * 60 * 1000);
  if (!byEmail.allowed) return tooMany(byEmail.retryAfter);
  const org = orgOf(user);
  if ((await getInvites(org)).some((i) => i.status === "pending" && i.email.toLowerCase() === email.toLowerCase()))
    return NextResponse.json({ error: "อีเมลนี้มีคำเชิญที่รอตอบรับอยู่แล้ว" }, { status: 409 });
  const role: MemberRole = body.role === "org_admin" ? "org_admin" : "member";
  const inv = await addInvite(org, email, role);
  const orgName = (user.supplierId && (await getSupplier(user.supplierId))?.farmName) || user.company || user.username;
  const { sent } = await sendInviteEmail(email, orgName, role, `${siteOrigin(req)}/join/${inv.token}`);
  return NextResponse.json({ ...pub(inv), emailSent: sent }, { status: 201 });
}
