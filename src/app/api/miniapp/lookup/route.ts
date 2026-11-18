import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { rateLimit, clientIp, tooMany } from "@/lib/rate-limit";
import { MEMBER_COOKIE, readMember } from "@/lib/thp-sso";
import { getBatch, getBatchByTracking } from "@/lib/store";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

// Mini app lookup: a lot code (LOT-/BAT-) or a tracking number -> the LOT code only.
// An unknown code and an unknown tracking number get the very same 404.
export async function GET(req: Request) {
  const store = await cookies();
  if (!readMember(store.get(MEMBER_COOKIE)?.value)) {
    return NextResponse.json({ error: "กรุณาเปิด Corta จากแอปไปรษณีย์ไทย" }, { status: 401, headers: NO_STORE });
  }
  const rl = await rateLimit(`miniapp-lookup:ip:${clientIp(req)}`, 60, 60_000);
  if (!rl.allowed) return tooMany(rl.retryAfter);

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().toUpperCase().slice(0, 60);
  const notFound = () => NextResponse.json({ error: "ไม่พบสินค้านี้ในระบบ Corta" }, { status: 404, headers: NO_STORE });
  if (!q) return notFound();

  let lot = /^(LOT|BAT)-/.test(q) ? await getBatch(q) : null;
  if (!lot) lot = await getBatchByTracking(q);
  if (!lot || lot.cancelledAt) return notFound();
  return NextResponse.json({ id: lot.id }, { headers: NO_STORE });
}
