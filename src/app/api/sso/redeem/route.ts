import { NextResponse } from "next/server";
import { rateLimit, clientIp, tooMany } from "@/lib/rate-limit";
import { ssoOn, isHandoff, redeemHandoff, memberCookie, SsoError, ssoFingerprint } from "@/lib/thp-sso";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const json = (body: unknown, status: number) => NextResponse.json(body, { status, headers: NO_STORE });

// Thai Post SuperApp sign-in: the page posts the one-time handoff, we redeem it and set the member cookie.
// Nothing about the handoff, challenge or tokens is logged; only a code and HTTP status on failure.
export async function POST(req: Request) {
  if (!ssoOn()) return json({ error: "Corta ยังไม่เปิดให้ใช้งานในแอปไปรษณีย์ไทย", code: "500010" }, 503);

  const rl = await rateLimit(`sso-redeem:ip:${clientIp(req)}`, 30, 60_000);
  if (!rl.allowed) return tooMany(rl.retryAfter);

  const body = (await req.json().catch(() => null)) as { handoffToken?: unknown } | null;
  const handoff = body?.handoffToken;
  if (!isHandoff(handoff)) {
    return json({ error: "ลิงก์เข้าใช้งานไม่ถูกต้อง กรุณาเปิด Corta ใหม่จากแอปไปรษณีย์ไทย", code: "004001" }, 400);
  }

  try {
    const { name } = await redeemHandoff(handoff);
    const res = json({ ok: true, name: name ?? "" }, 200);
    const c = memberCookie(name);
    res.cookies.set(c.name, c.value, c.options);
    return res;
  } catch (e) {
    if (e instanceof SsoError) {
      console.warn(`[sso] redeem failed code=${e.code} status=${e.status}`);
      const status = [400, 401, 403, 429].includes(e.status) ? e.status : e.status === 503 ? 503 : 502;
      // the gateway's message helps while testing on UAT; production never shows it
      if (e.detail) console.warn(`[sso] gateway said: ${e.detail}`);
      const uat = /-uat\./.test(process.env.THP_SSO_BASE_URL ?? "");
      return json({ error: e.message, code: e.code, ...(uat && e.detail ? { detail: `${e.detail} [${ssoFingerprint()}]` } : {}) }, status);
    }
    console.warn("[sso] redeem failed: unexpected");
    return json({ error: "ระบบของไปรษณีย์ไทยขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง", code: "internal" }, 502);
  }
}
