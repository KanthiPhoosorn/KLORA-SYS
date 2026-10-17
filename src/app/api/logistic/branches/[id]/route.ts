import { NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { logisticAccess, getBranch, getBranches, updateBranch, branchUsers } from "@/lib/logistic-org";
import { getUsers, updateUser } from "@/lib/store";
import { placeOf } from "@/lib/places";
import { parseLatLng } from "@/lib/latlng";
import { phoneOk } from "@/lib/signup-rules";
import { sendBranchDecisionEmail } from "@/lib/email";
import { siteOrigin } from "@/lib/origin";

// PATCH /api/logistic/branches/[id] — the head office runs its branches (doc "Logistic", 17 Oct 2026):
//   { action: "approve" }                 pending → active, mail to the branch admin
//   { action: "reject", reason }          pending → rejected (reason required), mail with the reason
//   { action: "disable" | "enable" }      active ⇄ disabled (the head office itself cannot be disabled)
//   { action: "edit", name?, phone?, address?, province?, district?, subdistrict?, gps? }
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(["logistic"]);
  if (g.deny) return g.deny;
  const a = await logisticAccess(g.user);
  if (!a.hq || !a.org) return NextResponse.json({ error: "เฉพาะบัญชีสำนักงานใหญ่" }, { status: 403 });
  if (a.state !== "active") return NextResponse.json({ error: "บริษัทยังรอการตรวจสอบจากผู้ดูแลระบบ" }, { status: 403 });
  const { id } = await params;
  const branch = await getBranch(id);
  if (!branch || branch.orgCode !== a.org.orgCode) return NextResponse.json({ error: "ไม่พบสาขานี้" }, { status: 404 });
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 }); }
  const by = g.user.username;
  const now = new Date().toISOString();
  const admin = branch.adminUserId ? (await getUsers()).find((u) => u.id === branch.adminUserId) : undefined;
  const login = `${siteOrigin(req)}/logistic/login`;

  switch (body.action) {
    case "approve": {
      if (branch.status !== "pending") return NextResponse.json({ error: "สาขานี้ไม่ได้รอการอนุมัติ" }, { status: 409 });
      const b = await updateBranch(id, { status: "active", decidedAt: now, decidedBy: by }, { text: "อนุมัติสาขา", by });
      const mail = admin ? await sendBranchDecisionEmail(admin.email, a.org.company, branch.name, true, login) : { sent: false };
      return NextResponse.json({ branch: b, emailSent: mail.sent });
    }
    case "reject": {
      if (branch.status !== "pending") return NextResponse.json({ error: "สาขานี้ไม่ได้รอการอนุมัติ" }, { status: 409 });
      const reason = String(body.reason ?? "").trim().slice(0, 300);
      if (!reason) return NextResponse.json({ error: "กรุณาระบุเหตุผล" }, { status: 400 });
      const b = await updateBranch(id, { status: "rejected", rejectReason: reason, decidedAt: now, decidedBy: by }, { text: `ไม่อนุมัติ: ${reason}`, by });
      const mail = admin ? await sendBranchDecisionEmail(admin.email, a.org.company, branch.name, false, login, reason) : { sent: false };
      return NextResponse.json({ branch: b, emailSent: mail.sent });
    }
    case "disable": {
      if (branch.isHq) return NextResponse.json({ error: "ปิดการใช้งานสำนักงานใหญ่ไม่ได้" }, { status: 409 });
      if (branch.status !== "active") return NextResponse.json({ error: "สาขานี้ไม่ได้เปิดใช้งานอยู่" }, { status: 409 });
      return NextResponse.json({ branch: await updateBranch(id, { status: "disabled" }, { text: "ปิดการใช้งานสาขา", by }) });
    }
    case "enable": {
      if (branch.status !== "disabled") return NextResponse.json({ error: "สาขานี้ไม่ได้ถูกปิดการใช้งาน" }, { status: 409 });
      return NextResponse.json({ branch: await updateBranch(id, { status: "active" }, { text: "เปิดการใช้งานสาขา", by }) });
    }
    case "edit": {
      const s = (k: string) => (body[k] != null ? String(body[k]).trim() : undefined);
      const patch: Parameters<typeof updateBranch>[1] = {};
      const name = s("name");
      if (name !== undefined && name !== branch.name) {
        if (!name) return NextResponse.json({ error: "กรุณากรอกชื่อสาขา" }, { status: 400 });
        if (branch.isHq) return NextResponse.json({ error: "เปลี่ยนชื่อสำนักงานใหญ่ไม่ได้" }, { status: 400 });
        const clash = (await getBranches(a.org.orgCode)).some((x) => x.id !== id && x.status !== "rejected" && x.name.trim().toLowerCase() === name.toLowerCase());
        if (clash) return NextResponse.json({ error: "บริษัทนี้มีสาขาชื่อนี้แล้ว" }, { status: 409 });
        patch.name = name;
      }
      const phone = s("phone");
      if (phone !== undefined) {
        if (!phoneOk(phone)) return NextResponse.json({ error: "หมายเลขโทรศัพท์ต้องขึ้นต้นด้วย 0 และมี 9–10 หลัก" }, { status: 400 });
        patch.phone = phone.replace(/[\s-]/g, "");
      }
      const address = s("address");
      if (address !== undefined) {
        if (!address) return NextResponse.json({ error: "กรุณากรอกที่อยู่" }, { status: 400 });
        patch.address = address;
      }
      if (s("subdistrict") !== undefined) {
        const place = placeOf(s("province"), s("district"), s("subdistrict"));
        if (!place) return NextResponse.json({ error: "กรุณาเลือกจังหวัด อำเภอ และตำบลให้ครบ" }, { status: 400 });
        Object.assign(patch, { province: s("province"), district: s("district"), subdistrict: place.name, postcode: place.postcode });
      }
      const gps = s("gps");
      if (gps !== undefined) {
        const p = parseLatLng(gps);
        if (!p) return NextResponse.json({ error: "รูปแบบพิกัดไม่ถูกต้อง (ละติจูด, ลองจิจูด)" }, { status: 400 });
        Object.assign(patch, { lat: p.lat, lng: p.lng });
      }
      if (!Object.keys(patch).length) return NextResponse.json({ branch });
      const b = await updateBranch(id, patch, { text: "แก้ไขข้อมูลสาขา", by });
      // the accounts of the branch show its name
      if (patch.name) for (const u of await branchUsers(id)) await updateUser(u.id, { branch: patch.name });
      return NextResponse.json({ branch: b });
    }
    default:
      return NextResponse.json({ error: "ไม่รู้จักคำสั่งนี้" }, { status: 400 });
  }
}
