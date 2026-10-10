import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { getBatch, activePrintOf, carrierOfLot, upsertRating, ratingSummary } from "@/lib/store";
import { rateLimit, tooMany, clientIp } from "@/lib/rate-limit";
import { RATER_COOKIE } from "@/lib/rating";

// POST /api/ratings — a visitor on the QR page rates the farm (สวน) and the carrier (การขนส่ง), 1–5 stars,
// with an optional comment (Thai Post doc §15). Public, no sign-in: one rating per device per lot (an
// anonymous cookie; sending again replaces it), only for a lot whose QR has been printed, rate-limited per
// IP. Comments are seen in the farm / carrier / KYN back offices only; the QR page shows averages.
const star = (v: unknown) => { const n = Number(v); return Number.isInteger(n) && n >= 1 && n <= 5 ? n : undefined; };

export async function POST(req: Request) {
  const lim = await rateLimit(`ratings:ip:${clientIp(req)}`, 30, 60 * 60 * 1000);
  if (!lim.allowed) return tooMany(lim.retryAfter);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 }); }
  const farmStars = star(body.farm);
  const transportStars = star(body.transport);
  if (!farmStars && !transportStars) return NextResponse.json({ error: "กรุณาให้คะแนนอย่างน้อย 1 หัวข้อ" }, { status: 400 });
  const batch = await getBatch(String(body.batchId ?? ""));
  if (!batch || batch.cancelledAt) return NextResponse.json({ error: "ไม่พบสินค้านี้" }, { status: 404 });
  const print = await activePrintOf(batch.id);
  if (!print) return NextResponse.json({ error: "ให้คะแนนได้หลังสินค้าถูกส่งออก" }, { status: 409 });

  const jar = await cookies();
  let rater = jar.get(RATER_COOKIE)?.value ?? "";
  const fresh = !/^[A-Za-z0-9_-]{16,32}$/.test(rater);
  if (fresh) rater = randomBytes(16).toString("base64url");
  const carrier = await carrierOfLot(batch, print);
  const comment = String(body.comment ?? "").trim().slice(0, 300) || undefined;
  await upsertRating({ batchId: batch.id, supplierId: batch.supplierId, carrierKey: carrier?.key, carrierName: carrier?.name, farmStars, transportStars, comment, rater });

  const res = NextResponse.json({ ok: true, summary: await ratingSummary(batch.supplierId, carrier?.key) });
  if (fresh) res.cookies.set(RATER_COOKIE, rater, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 730 });
  return res;
}
