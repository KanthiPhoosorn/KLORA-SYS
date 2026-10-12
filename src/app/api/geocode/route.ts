import { NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { geocodeAddress, mapsLinkPoint } from "@/lib/geocode";
import { isShortMapsLink } from "@/lib/latlng";
import { rateLimit, tooMany } from "@/lib/rate-limit";

// GET /api/geocode?q=<recipient address> — signed-in; the round forms use it to measure the
// transport distance from the origin branch to the recipient's real address.
// GET /api/geocode?link=<maps.app.goo.gl/…> — the point behind a Google Maps share link (พิกัดปลายทาง).
export async function GET(req: Request) {
  const g = await guard();
  if (g.deny) return g.deny;
  const params = new URL(req.url).searchParams;
  const link = (params.get("link") ?? "").trim();
  const q = (params.get("q") ?? "").trim();
  if (link) {
    if (!isShortMapsLink(link)) return NextResponse.json({ error: "ลิงก์ไม่ใช่ Google Maps" }, { status: 400 });
  } else if (q.length < 4) {
    return NextResponse.json({ error: "ที่อยู่สั้นเกินไป" }, { status: 400 });
  }
  const lim = await rateLimit(`geocode:user:${g.user.id}`, 120, 60 * 60 * 1000);
  if (!lim.allowed) return tooMany(lim.retryAfter);
  const point = link ? await mapsLinkPoint(link) : await geocodeAddress(q);
  return NextResponse.json({ point });
}
