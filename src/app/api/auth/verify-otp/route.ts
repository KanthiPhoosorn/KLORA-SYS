import { NextResponse } from "next/server";
import { checkOtp } from "@/lib/store";

// POST /api/auth/verify-otp — { email, code }
export async function POST(req: Request) {
  let body: { email?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }
  const email = String(body.email ?? "").trim();
  const code = String(body.code ?? "").trim();
  if (!(await checkOtp(email, code))) {
    return NextResponse.json({ error: "รหัส OTP ไม่ถูกต้องหรือหมดอายุ" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
