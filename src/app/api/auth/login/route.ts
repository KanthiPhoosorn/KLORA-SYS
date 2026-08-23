import { NextResponse } from "next/server";
import { getUserByLogin, getSupplier } from "@/lib/store";
import { verifyPassword, setSessionCookie, homeForRole } from "@/lib/auth";
import { clientIp, rateLimit, tooMany } from "@/lib/rate-limit";

// POST /api/auth/login — { login (username or email), password }
export async function POST(req: Request) {
  let body: { login?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  const login = String(body.login ?? "").trim();
  const password = String(body.password ?? "");
  if (!login || !password) {
    return NextResponse.json({ error: "กรอกชื่อผู้ใช้และรหัสผ่าน" }, { status: 400 });
  }

  // Brute-force / credential-stuffing protection: cap by source IP AND by target account.
  const ip = clientIp(req);
  const byIp = await rateLimit(`login:ip:${ip}`, 10, 5 * 60 * 1000);
  if (!byIp.allowed) return tooMany(byIp.retryAfter);
  const byAcct = await rateLimit(`login:acct:${login.toLowerCase()}`, 20, 15 * 60 * 1000);
  if (!byAcct.allowed) return tooMany(byAcct.retryAfter);

  const user = await getUserByLogin(login);
  // Same error for unknown user vs wrong password (don't leak which).
  if (!user || !verifyPassword(password, user.salt, user.passwordHash)) {
    return NextResponse.json(
      { error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" },
      { status: 401 },
    );
  }

  if (user.role === "supplier" && user.supplierId) {
    const supplier = await getSupplier(user.supplierId);
    if (supplier?.status === "suspended") {
      return NextResponse.json(
        { error: "บัญชีฟาร์มนี้ถูกระงับการใช้งาน กรุณาติดต่อ KYN" },
        { status: 403 },
      );
    }
  }

  await setSessionCookie(user.id);
  return NextResponse.json({
    ok: true,
    role: user.role,
    supplierId: user.supplierId,
    redirect: homeForRole(user.role),
  });
}
