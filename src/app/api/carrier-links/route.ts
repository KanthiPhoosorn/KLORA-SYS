import { NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { createCarrierLink, getCarrierLinks } from "@/lib/store";
import { asCarrierKey, carrierKeyFromCompany } from "@/lib/carriers";
import { rateLimit, tooMany } from "@/lib/rate-limit";

// Carrier sign-up links (10 Oct 2026): a carrier makes a link on /logistic/incoming and sends it to the
// farms that ship with it; a farm joining through it ships only with this carrier (see lib/carrier-lock).
const NO_ORG = () => NextResponse.json({ error: "บัญชีนี้ยังไม่มีรหัสองค์กร (CID) — ติดต่อ KYN ก่อนสร้างลิงก์" }, { status: 409 });

export async function GET() {
  const g = await guard(["logistic"]);
  if (g.deny) return g.deny;
  if (!g.user.orgCode) return NO_ORG();
  return NextResponse.json(await getCarrierLinks(g.user.orgCode));
}

export async function POST(req: Request) {
  const g = await guard(["logistic"]);
  if (g.deny) return g.deny;
  if (!g.user.orgCode) return NO_ORG();
  const lim = await rateLimit(`carrier-links:user:${g.user.id}`, 30, 60 * 60 * 1000);
  if (!lim.allowed) return tooMany(lim.retryAfter);
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* defaults */ }
  const branch = String(body.branch ?? g.user.branch ?? "").trim().slice(0, 80);
  const link = await createCarrierLink({
    orgCode: g.user.orgCode,
    company: g.user.company,
    carrierKey: asCarrierKey(body.carrierKey) ?? carrierKeyFromCompany(g.user.company),
    branch: branch || undefined,
    createdBy: g.user.id,
  });
  return NextResponse.json(link, { status: 201 });
}
