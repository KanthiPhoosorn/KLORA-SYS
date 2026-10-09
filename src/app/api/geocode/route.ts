import { NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { geocodeAddress } from "@/lib/geocode";
import { rateLimit, tooMany } from "@/lib/rate-limit";

// GET /api/geocode?q=<recipient address> — signed-in; the round forms use it to measure the
// transport distance from the origin branch to the recipient's real address.
export async function GET(req: Request) {
  const g = await guard();
  if (g.deny) return g.deny;
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < 4) return NextResponse.json({ error: "ที่อยู่สั้นเกินไป" }, { status: 400 });
  const lim = await rateLimit(`geocode:user:${g.user.id}`, 120, 60 * 60 * 1000);
  if (!lim.allowed) return tooMany(lim.retryAfter);
  const point = await geocodeAddress(q);
  return NextResponse.json({ point });
}
