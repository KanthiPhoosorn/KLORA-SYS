import { NextResponse } from "next/server";
import { addUser, getUserByLogin } from "@/lib/store";
import { hashPassword, setSessionCookie } from "@/lib/auth";

// POST /api/auth/register-logistic — creates a logistic (โรงคัดแยก/ขนส่ง) account and signs in.
// { username, email, company, password, confirmPassword }
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง (invalid JSON)" }, { status: 400 });
  }

  const s = (k: string) => (body[k] != null ? String(body[k]).trim() : "");
  const username = s("username");
  const email = s("email");
  const company = s("company");
  const password = s("password");
  const confirm = s("confirmPassword");

  if (!username || !email || !company || !password) {
    return NextResponse.json({ error: "กรอกชื่อผู้ใช้ อีเมล ชื่อบริษัท และรหัสผ่าน" }, { status: 400 });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "อีเมลไม่ถูกต้อง" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร" }, { status: 400 });
  }
  if (password !== confirm) {
    return NextResponse.json({ error: "รหัสผ่านและการยืนยันไม่ตรงกัน" }, { status: 400 });
  }
  if ((await getUserByLogin(email)) || (await getUserByLogin(username))) {
    return NextResponse.json({ error: "อีเมลหรือชื่อผู้ใช้นี้ถูกใช้แล้ว" }, { status: 409 });
  }

  const { hash, salt } = hashPassword(password);
  const user = await addUser({
    role: "logistic",
    company,
    email,
    username,
    passwordHash: hash,
    salt,
  });
  await setSessionCookie(user.id);

  return NextResponse.json({ userId: user.id, redirect: "/logistic" }, { status: 201 });
}
