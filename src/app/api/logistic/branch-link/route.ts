import { NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { logisticAccess, updateOrg, newJoinToken } from "@/lib/logistic-org";

// POST /api/logistic/branch-link { action: "new" | "close" } — the head office's one branch sign-up link
// (doc "Logistic", 17 Oct 2026). "new" makes a fresh link and the old one stops at once (branches that
// already registered are not touched); "close" turns the link off.
export async function POST(req: Request) {
  const g = await guard(["logistic"]);
  if (g.deny) return g.deny;
  const a = await logisticAccess(g.user);
  if (!a.hq || !a.org) return NextResponse.json({ error: "เฉพาะบัญชีสำนักงานใหญ่" }, { status: 403 });
  if (a.state !== "active") return NextResponse.json({ error: "บริษัทยังรอการตรวจสอบจากผู้ดูแลระบบ ยังสร้างลิงก์ไม่ได้" }, { status: 403 });
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty */ }
  const now = new Date().toISOString();
  const org = body.action === "close"
    ? await updateOrg(a.org.orgCode, { joinToken: undefined, joinCreatedAt: now, joinCreatedBy: g.user.username })
    : await updateOrg(a.org.orgCode, { joinToken: newJoinToken(), joinCreatedAt: now, joinCreatedBy: g.user.username });
  return NextResponse.json({ token: org?.joinToken ?? null, createdAt: org?.joinCreatedAt, createdBy: org?.joinCreatedBy });
}
