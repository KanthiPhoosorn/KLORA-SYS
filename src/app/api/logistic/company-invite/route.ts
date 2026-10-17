import { NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { setCompanyInvite } from "@/lib/logistic-org";

// POST /api/logistic/company-invite { action: "new" | "close" } — KYN's company invite link
// (/logistic/register?invite=…): a company that signs up through it starts active, without the KYN check.
export async function POST(req: Request) {
  const g = await guard(["kyn"]);
  if (g.deny) return g.deny;
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty */ }
  const inv = await setCompanyInvite(g.user.username, body.action === "close");
  return NextResponse.json({ token: inv?.token ?? null, createdAt: inv?.createdAt });
}
