import { NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { getOrg, updateOrg, getBranches } from "@/lib/logistic-org";
import { getUsers } from "@/lib/store";
import { asCarrierKey } from "@/lib/carriers";
import { sendCompanyDecisionEmail } from "@/lib/email";
import { siteOrigin } from "@/lib/origin";

// PATCH /api/logistic/companies/[code] — KYN runs the logistic companies (doc "Logistic", 17 Oct 2026):
//   { action: "approve" }                pending (signed up alone) → active, mail to the admin
//   { action: "reject", reason }         pending → rejected, mail with the reason
//   { action: "suspend" | "activate" }   active ⇄ suspended (its accounts cannot sign in while suspended)
//   { action: "type", providerType }     ประเภทผู้ให้บริการขนส่ง (decides the "เพิ่มข้อมูลรอบส่งออก" menu)
export async function PATCH(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const g = await guard(["kyn"]);
  if (g.deny) return g.deny;
  const { code } = await params;
  const org = await getOrg(code);
  if (!org) return NextResponse.json({ error: "ไม่พบบริษัทนี้" }, { status: 404 });
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 }); }
  const now = new Date().toISOString();
  const by = g.user.username;
  const hq = (await getBranches(code)).find((b) => b.isHq);
  const admin = hq?.adminUserId ? (await getUsers()).find((u) => u.id === hq.adminUserId) : undefined;
  const login = `${siteOrigin(req)}/logistic/login`;

  switch (body.action) {
    case "approve": {
      if (org.status !== "pending") return NextResponse.json({ error: "บริษัทนี้ไม่ได้รอการตรวจสอบ" }, { status: 409 });
      const o = await updateOrg(code, { status: "active", decidedAt: now, decidedBy: by, rejectReason: undefined });
      const mail = admin ? await sendCompanyDecisionEmail(admin.email, org.company, true, login) : { sent: false };
      return NextResponse.json({ org: o, emailSent: mail.sent });
    }
    case "reject": {
      if (org.status !== "pending") return NextResponse.json({ error: "บริษัทนี้ไม่ได้รอการตรวจสอบ" }, { status: 409 });
      const reason = String(body.reason ?? "").trim().slice(0, 300);
      if (!reason) return NextResponse.json({ error: "กรุณาระบุเหตุผล" }, { status: 400 });
      const o = await updateOrg(code, { status: "rejected", rejectReason: reason, decidedAt: now, decidedBy: by });
      const mail = admin ? await sendCompanyDecisionEmail(admin.email, org.company, false, login, reason) : { sent: false };
      return NextResponse.json({ org: o, emailSent: mail.sent });
    }
    case "suspend":
      if (org.status !== "active") return NextResponse.json({ error: "บริษัทนี้ไม่ได้ใช้งานอยู่" }, { status: 409 });
      return NextResponse.json({ org: await updateOrg(code, { status: "suspended", decidedAt: now, decidedBy: by }) });
    case "activate":
      if (org.status !== "suspended") return NextResponse.json({ error: "บริษัทนี้ไม่ได้ถูกระงับ" }, { status: 409 });
      return NextResponse.json({ org: await updateOrg(code, { status: "active", decidedAt: now, decidedBy: by }) });
    case "type": {
      const t = asCarrierKey(body.providerType);
      if (!t) return NextResponse.json({ error: "ประเภทผู้ให้บริการไม่ถูกต้อง" }, { status: 400 });
      return NextResponse.json({ org: await updateOrg(code, { providerType: t }) });
    }
    default:
      return NextResponse.json({ error: "ไม่รู้จักคำสั่งนี้" }, { status: 400 });
  }
}
