import { NextResponse } from "next/server";
import { getCurrentUser, verifyPassword, hashPassword } from "@/lib/auth";
import { updateUser } from "@/lib/store";

// POST /api/auth/change-password — { oldPassword, newPassword }
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  let body: { oldPassword?: string; newPassword?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 }); }
  const oldPassword = String(body.oldPassword ?? "");
  const newPassword = String(body.newPassword ?? "");
  if (!verifyPassword(oldPassword, user.salt, user.passwordHash))
    return NextResponse.json({ error: "รหัสผ่านเดิมไม่ถูกต้อง" }, { status: 400 });
  if (newPassword.length < 8)
    return NextResponse.json({ error: "รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัวอักษร" }, { status: 400 });
  const { hash, salt } = hashPassword(newPassword);
  await updateUser(user.id, { passwordHash: hash, salt });
  return NextResponse.json({ ok: true });
}
