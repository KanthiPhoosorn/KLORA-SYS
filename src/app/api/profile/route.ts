import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUserByLogin, updateUser } from "@/lib/store";

// PATCH /api/profile — update the signed-in user's own ชื่อผู้ใช้ / เบอร์โทร / อีเมล
export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  let body: { username?: string; email?: string; phone?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 }); }

  const username = String(body.username ?? "").trim();
  const email = String(body.email ?? "").trim();
  const phone = String(body.phone ?? "").trim();

  if (!username) return NextResponse.json({ error: "กรุณาระบุชื่อผู้ใช้" }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "รูปแบบอีเมลไม่ถูกต้อง" }, { status: 400 });

  // uniqueness — username / email must not collide with a different account
  if (username.toLowerCase() !== user.username.toLowerCase()) {
    const hit = await getUserByLogin(username);
    if (hit && hit.id !== user.id) return NextResponse.json({ error: "ชื่อผู้ใช้นี้ถูกใช้แล้ว" }, { status: 409 });
  }
  if (email.toLowerCase() !== user.email.toLowerCase()) {
    const hit = await getUserByLogin(email);
    if (hit && hit.id !== user.id) return NextResponse.json({ error: "อีเมลนี้ถูกใช้แล้ว" }, { status: 409 });
  }

  const updated = await updateUser(user.id, { username, email, phone: phone || undefined });
  return NextResponse.json({ ok: true, user: { username: updated?.username, email: updated?.email, phone: updated?.phone } });
}
