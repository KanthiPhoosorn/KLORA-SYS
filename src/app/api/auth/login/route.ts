import { NextResponse } from "next/server";
import { getUserByLogin, getSupplier } from "@/lib/store";
import { verifyPassword, setSessionCookie, homeForRole } from "@/lib/auth";
import { clientIp, rateLimit, tooMany, peekRate, resetRate, restartRate, lockedOut } from "@/lib/rate-limit";
import { logisticAccess } from "@/lib/logistic-org";

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

  // 5 wrong tries on one account → locked for 5 minutes; the form shows a countdown (doc "Logistic", 17 Oct 2026)
  const failKey = `login:fail:${login.toLowerCase()}`;
  const FAIL_MAX = 5, FAIL_WINDOW = 5 * 60 * 1000;
  const already = await peekRate(failKey, FAIL_MAX, FAIL_WINDOW);
  if (!already.allowed) return lockedOut(already.retryAfter, "ใส่ชื่อผู้ใช้หรือรหัสผ่านผิดเกิน 5 ครั้ง กรุณารอสักครู่แล้วลองใหม่");

  const user = await getUserByLogin(login);
  // Same error for unknown user vs wrong password (don't leak which).
  if (!user || !verifyPassword(password, user.salt, user.passwordHash)) {
    const fail = await rateLimit(failKey, FAIL_MAX, FAIL_WINDOW);
    if (fail.count >= FAIL_MAX) {
      // the lock runs a full 5 minutes from this (fifth) wrong try, not from the first
      await restartRate(failKey, FAIL_MAX);
      return lockedOut(FAIL_WINDOW / 1000, "ใส่ชื่อผู้ใช้หรือรหัสผ่านผิดเกิน 5 ครั้ง กรุณารอสักครู่แล้วลองใหม่");
    }
    const left = FAIL_MAX - fail.count;
    return NextResponse.json(
      { error: `ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง${left <= 2 ? ` (ลองได้อีก ${left} ครั้ง)` : ""}` },
      { status: 401 },
    );
  }
  await resetRate(failKey);

  if (user.status === "suspended") {
    return NextResponse.json({ error: "บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อ KYN" }, { status: 403 });
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

  if (user.role === "logistic") {
    // a disabled / rejected branch or a suspended company cannot sign in; pending ones can (they see a waiting page)
    const a = await logisticAccess(user);
    if (a.state === "blocked") return NextResponse.json({ error: a.reason }, { status: 403 });
  }

  await setSessionCookie(user.id);
  return NextResponse.json({
    ok: true,
    role: user.role,
    supplierId: user.supplierId,
    redirect: homeForRole(user.role),
  });
}
