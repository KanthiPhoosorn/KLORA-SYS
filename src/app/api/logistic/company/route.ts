import { NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { logisticAccess, renameCompanyEverywhere } from "@/lib/logistic-org";

// PATCH /api/logistic/company { company } — the head office renames its company (doc "Logistic", 18 Oct 2026:
// the name in the header and on จัดการระบบ is the company's, not the account's ชื่อผู้ใช้).
export async function PATCH(req: Request) {
  const g = await guard(["logistic"]);
  if (g.deny) return g.deny;
  const a = await logisticAccess(g.user);
  if (!a.hq || !a.org) return NextResponse.json({ error: "เฉพาะบัญชีสำนักงานใหญ่แก้ไขชื่อบริษัทได้" }, { status: 403 });
  if (a.state !== "active") return NextResponse.json({ error: "บริษัทยังรอการตรวจสอบจากผู้ดูแลระบบ" }, { status: 403 });
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 }); }
  const company = String(body.company ?? "").replace(/\s+/g, " ").trim();
  if (!company) return NextResponse.json({ error: "กรุณากรอกชื่อบริษัท" }, { status: 400 });
  if (company.length > 120) return NextResponse.json({ error: "ชื่อบริษัทยาวเกินไป" }, { status: 400 });
  if (company !== a.org.company) await renameCompanyEverywhere(a.org.orgCode, company);
  return NextResponse.json({ company });
}
