import { NextResponse } from "next/server";
import { addUser, getUserByLogin, newOrgCode } from "@/lib/store";
import { hashPassword, setSessionCookie } from "@/lib/auth";
import { clientIp, rateLimit, lockedOut } from "@/lib/rate-limit";
import { addOrg, addBranch, updateBranch, getCompanyInvite, isUniqueViolation, dropOrg } from "@/lib/logistic-org";
import { checkCompany, checkPlace, checkAdmin, firstError } from "@/lib/logistic-signup";
import type { LogisticOrg } from "@/lib/types";

// POST /api/auth/register-logistic — a logistic company signs up (doc "Logistic" แบบที่ 1, 17 Oct 2026).
// Creates the company (CID-…), its head office (สำนักงานใหญ่, at the address given) and the admin login,
// then signs in. Through KYN's invite link (`invite`) the company is active at once; signing up alone it
// waits for KYN to check it (the account can sign in and sees a waiting page).
export async function POST(req: Request) {
  const rl = await rateLimit(`register:ip:${clientIp(req)}`, 5, 15 * 60 * 1000);
  if (!rl.allowed) return lockedOut(rl.retryAfter, "ส่งแบบฟอร์มเกิน 5 ครั้ง กรุณารอสักครู่แล้วลองใหม่");

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง (invalid JSON)" }, { status: 400 });
  }
  const errors: Record<string, string> = {};
  const co = checkCompany(body, errors);
  const place = checkPlace(body, errors);
  const admin = checkAdmin(body, errors);
  if (Object.keys(errors).length) return NextResponse.json({ error: firstError(errors), errors }, { status: 400 });
  if ((await getUserByLogin(admin.email)) || (await getUserByLogin(admin.username))) {
    return NextResponse.json({ error: "อีเมลหรือชื่อผู้ใช้นี้ถูกใช้แล้ว", errors: { email: "อีเมลหรือชื่อผู้ใช้นี้ถูกใช้แล้ว" } }, { status: 409 });
  }

  const invite = await getCompanyInvite();
  const viaKyn = !!invite && String(body.invite ?? "").toUpperCase() === invite.token;
  const now = new Date().toISOString();
  let org: LogisticOrg | null = null;
  for (let attempt = 0; attempt < 5 && !org; attempt++) {
    try {
      org = await addOrg({
        orgCode: await newOrgCode(attempt), company: co.company, providerType: co.providerType, phone: place.phone, taxId: co.taxId,
        address: place.address, subdistrict: place.subdistrict, district: place.district, province: place.province, postcode: place.postcode,
        lat: place.lat, lng: place.lng,
        status: viaKyn ? "active" : "pending",
        decidedAt: viaKyn ? now : undefined, decidedBy: viaKyn ? "KYN (ลิงก์เชิญ)" : undefined,
      });
    } catch (e) {
      if (!isUniqueViolation(e)) { console.error("[register-logistic] company", e); return NextResponse.json({ error: "ลงทะเบียนไม่สำเร็จ ลองใหม่อีกครั้ง" }, { status: 500 }); }
      // the code was just taken by another sign-up — next one
    }
  }
  if (!org) return NextResponse.json({ error: "สร้างรหัสบริษัทไม่สำเร็จ ลองใหม่อีกครั้ง" }, { status: 500 });

  // the head office and the admin login go with the company — if either fails, nothing is left behind
  try {
  const hq = await addBranch({
    orgCode: org.orgCode, name: "สำนักงานใหญ่", isHq: true, phone: place.phone,
    address: place.address, subdistrict: place.subdistrict, district: place.district, province: place.province, postcode: place.postcode,
    lat: place.lat, lng: place.lng, status: "active", decidedAt: now,
    history: [{ at: now, text: "ลงทะเบียนบริษัท · สร้างสำนักงานใหญ่", by: admin.username }],
  });
  const { hash, salt } = hashPassword(admin.password);
  const user = await addUser({
    role: "logistic", orgCode: org.orgCode, branchId: hq.id, company: co.company, branch: hq.name, phone: place.phone,
    email: admin.email, username: admin.username, passwordHash: hash, salt,
  });
  await updateBranch(hq.id, { adminUserId: user.id });
  await setSessionCookie(user.id);
  return NextResponse.json({ userId: user.id, orgCode: org.orgCode, status: org.status, redirect: "/logistic" }, { status: 201 });
  } catch (e) {
    await dropOrg(org.orgCode).catch(() => undefined);
    if (isUniqueViolation(e)) return NextResponse.json({ error: "มีการลงทะเบียนพร้อมกันพอดี กรุณากดลงทะเบียนอีกครั้ง" }, { status: 409 }); // an account id taken a moment earlier
    console.error("[register-logistic]", e);
    return NextResponse.json({ error: "ลงทะเบียนไม่สำเร็จ ลองใหม่อีกครั้ง" }, { status: 500 });
  }
}
