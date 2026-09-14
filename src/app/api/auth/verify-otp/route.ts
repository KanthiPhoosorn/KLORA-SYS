import { NextResponse } from "next/server";
import { clientIp, rateLimit, tooMany } from "@/lib/rate-limit";
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
  // Anti brute-force: a 6-digit code must not be guessable within its 10-minute life.
  const ip = clientIp(req);
  const byIp = await rateLimit(`otp:ip:${ip}`, 10, 15 * 60 * 1000);
  if (!byIp.allowed) return tooMany(byIp.retryAfter);
  const byEmail = await rateLimit(`otp:email:${email.toLowerCase()}`, 10, 15 * 60 * 1000);
  if (!byEmail.allowed) return tooMany(byEmail.retryAfter);
  if (!(await checkOtp(email, code))) {
    return NextResponse.json({ error: "รหัส OTP ไม่ถูกต้องหรือหมดอายุ" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
