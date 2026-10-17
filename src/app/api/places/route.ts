import { NextResponse } from "next/server";
import { provincesByRegion, districtsOf, subdistrictsOf } from "@/lib/places";

// GET /api/places                          → { regions: [{ name, provinces }] }
// GET /api/places?province=P               → { districts: [...] }
// GET /api/places?province=P&district=D    → { subdistricts: [{ name, postcode, lat, lng }] }
// Public (the sign-up forms use it) and the same for everyone, so it is cached.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const province = (q.get("province") ?? "").trim();
  const district = (q.get("district") ?? "").trim();
  const body = !province ? { regions: provincesByRegion() } : !district ? { districts: districtsOf(province) } : { subdistricts: subdistrictsOf(province, district) };
  return NextResponse.json(body, { headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800" } });
}
