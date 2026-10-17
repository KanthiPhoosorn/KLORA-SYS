import { NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { createCarrierLink, getCarrierLinks } from "@/lib/store";
import { carrierKeyFromCompany } from "@/lib/carriers";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { logisticAccess, logisticWriteRefusal } from "@/lib/logistic-org";

// Carrier sign-up links (10 Oct 2026): a carrier makes a link on /logistic/incoming and sends it to the
// farms that ship with it; a farm joining through it ships only with this carrier (see lib/carrier-lock).
// 17 Oct 2026 (doc "Logistic"): no type / branch to choose — the link is the signed-in account's own:
// its company's provider type and its branch. The head office sees every link of the company.
const NO_ORG = () => NextResponse.json({ error: "บัญชีนี้ยังไม่มีรหัสองค์กร (CID) — ติดต่อ KYN ก่อนสร้างลิงก์" }, { status: 409 });

export async function GET() {
  const g = await guard(["logistic"]);
  if (g.deny) return g.deny;
  if (!g.user.orgCode) return NO_ORG();
  const a = await logisticAccess(g.user);
  const links = await getCarrierLinks(g.user.orgCode);
  return NextResponse.json(a.hq || !a.branch ? links : links.filter((l) => l.branchId === a.branch!.id));
}

export async function POST() {
  const g = await guard(["logistic"]);
  if (g.deny) return g.deny;
  if (!g.user.orgCode) return NO_ORG();
  const refusal = await logisticWriteRefusal(g.user);
  if (refusal) return NextResponse.json({ error: refusal }, { status: 403 });
  const lim = await rateLimit(`carrier-links:user:${g.user.id}`, 30, 60 * 60 * 1000);
  if (!lim.allowed) return tooMany(lim.retryAfter);
  const a = await logisticAccess(g.user);
  const link = await createCarrierLink({
    orgCode: g.user.orgCode,
    company: a.org?.company ?? g.user.company,
    carrierKey: a.org?.providerType ?? carrierKeyFromCompany(g.user.company),
    branch: a.branch?.name ?? g.user.branch ?? undefined,
    branchId: a.branch?.id,
    createdBy: g.user.id,
  });
  return NextResponse.json(link, { status: 201 });
}
