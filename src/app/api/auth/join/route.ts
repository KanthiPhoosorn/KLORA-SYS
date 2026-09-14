import { NextResponse } from "next/server";
import { getInviteByToken, getUserByLogin, getUsers, addUser, addMember, updateInvite, getSupplier } from "@/lib/store";
import { hashPassword, setSessionCookie, homeForRole } from "@/lib/auth";
import { clientIp, rateLimit, tooMany } from "@/lib/rate-limit";
import type { UserRole } from "@/lib/types";

// POST /api/auth/join — { token, username, password, confirmPassword }
// Accepts a team invite: creates a login INSIDE the inviting organisation (same supplierId /
// same company for logistic orgs), records the Member row, marks the invite accepted and
// signs the new user in. The invite's email is the account email — it cannot be changed here.
export async function POST(req: Request) {
  const rl = await rateLimit(`join:ip:${clientIp(req)}`, 10, 15 * 60 * 1000);
  if (!rl.allowed) return tooMany(rl.retryAfter);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }
  const s = (k: string) => (body[k] != null ? String(body[k]).trim() : "");
  const token = s("token");
  const username = s("username");
  const password = String(body.password ?? "");
  const confirm = String(body.confirmPassword ?? "");

  const invite = await getInviteByToken(token);
  if (!invite || invite.status !== "pending") {
    return NextResponse.json({ error: "ลิงก์คำเชิญไม่ถูกต้อง หรือถูกใช้/ยกเลิกไปแล้ว" }, { status: 404 });
  }
  if (!username || !password) return NextResponse.json({ error: "กรอกชื่อผู้ใช้และรหัสผ่าน" }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร" }, { status: 400 });
  if (password !== confirm) return NextResponse.json({ error: "รหัสผ่านและการยืนยันไม่ตรงกัน" }, { status: 400 });
  if (await getUserByLogin(invite.email)) {
    return NextResponse.json({ error: "อีเมลนี้มีบัญชี KLORA อยู่แล้ว กรุณาเข้าสู่ระบบ" }, { status: 409 });
  }
  if (await getUserByLogin(username)) {
    return NextResponse.json({ error: "ชื่อผู้ใช้นี้ถูกใช้แล้ว" }, { status: 409 });
  }

  // Which organisation is inviting: a farm (SUP-…) or a logistic/KYN account (USR-…).
  let role: UserRole = "supplier";
  let supplierId: string | undefined = invite.supplierId;
  let company: string | undefined;
  let branch: string | undefined;
  if (invite.supplierId.startsWith("SUP-")) {
    if (!(await getSupplier(invite.supplierId))) return NextResponse.json({ error: "ไม่พบองค์กรที่เชิญ" }, { status: 404 });
  } else {
    const inviter = (await getUsers()).find((u) => u.id === invite.supplierId);
    if (!inviter) return NextResponse.json({ error: "ไม่พบองค์กรที่เชิญ" }, { status: 404 });
    role = inviter.role;
    supplierId = inviter.supplierId;
    company = inviter.company;
    branch = inviter.branch;
  }

  const { hash, salt } = hashPassword(password);
  const user = await addUser({ role, supplierId, company, branch, email: invite.email, username, passwordHash: hash, salt });
  await addMember({ supplierId: invite.supplierId, name: username, email: invite.email, role: invite.role, lastActiveAt: new Date().toISOString() });
  await updateInvite(invite.id, "accepted");
  await setSessionCookie(user.id);
  return NextResponse.json({ ok: true, redirect: homeForRole(role) }, { status: 201 });
}
