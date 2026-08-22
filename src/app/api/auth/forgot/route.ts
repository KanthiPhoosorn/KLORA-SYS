import { NextResponse } from "next/server";
import { getUserByLogin, setOtp } from "@/lib/store";

// POST /api/auth/forgot — { email }. Generates a 6-digit OTP. Email is stubbed:
// the code is returned as `devCode` (and logged) so the demo can proceed.
export async function POST(req: Request) {
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }
  const email = String(body.email ?? "").trim();
  if (!email) return NextResponse.json({ error: "กรุณากรอกอีเมล" }, { status: 400 });

  const user = await getUserByLogin(email);
  if (!user) {
    // Don't leak which emails exist, but nothing to send.
    return NextResponse.json({ ok: true });
  }
  const code = String(Math.floor(100000 + Math.random() * 900000));
  await setOtp(user.email, code);
  console.log(`[KLORA] OTP for ${user.email}: ${code}`);
  return NextResponse.json({ ok: true, email: user.email, devCode: code });
}
