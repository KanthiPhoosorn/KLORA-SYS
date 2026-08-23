import { NextResponse } from "next/server";
import { getUserByLogin, setOtp } from "@/lib/store";
import { sendOtpEmail } from "@/lib/email";
import { clientIp, rateLimit, tooMany } from "@/lib/rate-limit";

// POST /api/auth/forgot — { email }. Generates a 6-digit OTP and emails it (Resend).
// SECURITY: the code is returned as `devCode` ONLY in non-production with no email provider,
// so it is never exposed over the wire in production.
export async function POST(req: Request) {
  // Rate-limit by source IP and by target email (anti-bombing / enumeration).
  const ip = clientIp(req);
  const byIp = await rateLimit(`forgot:ip:${ip}`, 5, 15 * 60 * 1000);
  if (!byIp.allowed) return tooMany(byIp.retryAfter);

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }
  const email = String(body.email ?? "").trim();
  if (!email) return NextResponse.json({ error: "กรุณากรอกอีเมล" }, { status: 400 });

  const byEmail = await rateLimit(`forgot:email:${email.toLowerCase()}`, 5, 15 * 60 * 1000);
  if (!byEmail.allowed) return tooMany(byEmail.retryAfter);

  const user = await getUserByLogin(email);
  if (!user) {
    // Don't leak which emails exist — same success shape as the real path.
    return NextResponse.json({ ok: true });
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  await setOtp(user.email, code);
  const { sent } = await sendOtpEmail(user.email, code);

  const resp: { ok: true; email: string; devCode?: string } = { ok: true, email: user.email };
  // Only surface the code for local/dev when no provider sent it. Never in production.
  if (!sent && process.env.NODE_ENV !== "production") resp.devCode = code;
  return NextResponse.json(resp);
}
