import { NextResponse } from "next/server";
import { getUserByLogin, checkOtp, clearOtp, updateUser } from "@/lib/store";
import { hashPassword } from "@/lib/auth";

// POST /api/auth/reset — { email, code, password }
export async function POST(req: Request) {
  let body: { email?: string; code?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }
  const email = String(body.email ?? "").trim();
  const code = String(body.code ?? "").trim();
  const password = String(body.password ?? "");
  if (password.length < 8) {
    return NextResponse.json({ error: "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร" }, { status: 400 });
  }
  if (!(await checkOtp(email, code))) {
    return NextResponse.json({ error: "รหัส OTP ไม่ถูกต้องหรือหมดอายุ" }, { status: 400 });
  }
  const user = await getUserByLogin(email);
  if (!user) return NextResponse.json({ error: "ไม่พบบัญชี" }, { status: 404 });
  const { hash, salt } = hashPassword(password);
  await updateUser(user.id, { passwordHash: hash, salt });
  await clearOtp(email);
  return NextResponse.json({ ok: true });
}
