import { NextResponse } from "next/server";
import { addUser, getUserByLogin } from "@/lib/store";
import { hashPassword, setSessionCookie } from "@/lib/auth";
import { clientIp, rateLimit, lockedOut } from "@/lib/rate-limit";
import { orgByJoinToken, getBranches, addBranch, updateBranch, isUniqueViolation, dropBranch } from "@/lib/logistic-org";
import { checkPlace, checkAdmin, firstError } from "@/lib/logistic-signup";

// POST /api/auth/register-branch — a branch signs up through its company's link /logistic/join/<token>
// (doc "Logistic" แบบที่ 2, 17 Oct 2026). The company is fixed by the link; the branch starts `pending`
// — its admin can sign in and sees "รอการอนุมัติจากสำนักงานใหญ่" until the head office approves it.
export async function POST(req: Request) {
  const rl = await rateLimit(`register:ip:${clientIp(req)}`, 5, 15 * 60 * 1000);
  if (!rl.allowed) return lockedOut(rl.retryAfter, "ส่งแบบฟอร์มเกิน 5 ครั้ง กรุณารอสักครู่แล้วลองใหม่");

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง (invalid JSON)" }, { status: 400 });
  }
  const org = await orgByJoinToken(String(body.token ?? ""));
  if (!org || org.status === "rejected" || org.status === "suspended") {
    return NextResponse.json({ error: "ลิงก์นี้ใช้ไม่ได้แล้ว กรุณาขอลิงก์ใหม่จากสำนักงานใหญ่" }, { status: 404 });
  }
  const errors: Record<string, string> = {};
  const name = String(body.branchName ?? "").trim();
  if (!name) errors.branchName = "กรุณากรอกชื่อสาขา";
  const place = checkPlace(body, errors);
  const admin = checkAdmin(body, errors);
  const taken = (await getBranches(org.orgCode)).some((b) => b.status !== "rejected" && b.name.trim().toLowerCase() === name.toLowerCase());
  if (name && taken) errors.branchName = "บริษัทนี้มีสาขาชื่อนี้แล้ว";
  if (Object.keys(errors).length) return NextResponse.json({ error: firstError(errors), errors }, { status: 400 });
  if ((await getUserByLogin(admin.email)) || (await getUserByLogin(admin.username))) {
    return NextResponse.json({ error: "อีเมลหรือชื่อผู้ใช้นี้ถูกใช้แล้ว", errors: { email: "อีเมลหรือชื่อผู้ใช้นี้ถูกใช้แล้ว" } }, { status: 409 });
  }

  const now = new Date().toISOString();
  const branch = await addBranch({
    orgCode: org.orgCode, name, isHq: false, phone: place.phone,
    address: place.address, subdistrict: place.subdistrict, district: place.district, province: place.province, postcode: place.postcode,
    lat: place.lat, lng: place.lng, status: "pending",
    history: [{ at: now, text: "ลงทะเบียนสาขา", by: admin.username }],
  });
  // the admin login goes with the branch — if it fails, the branch is not left waiting without anyone
  try {
    const { hash, salt } = hashPassword(admin.password);
    const user = await addUser({
      role: "logistic", orgCode: org.orgCode, branchId: branch.id, company: org.company, branch: name, phone: place.phone,
      email: admin.email, username: admin.username, passwordHash: hash, salt,
    });
    await updateBranch(branch.id, { adminUserId: user.id });
    await setSessionCookie(user.id);
    return NextResponse.json({ userId: user.id, branchId: branch.id, redirect: "/logistic" }, { status: 201 });
  } catch (e) {
    await dropBranch(branch.id).catch(() => undefined);
    if (isUniqueViolation(e)) return NextResponse.json({ error: "มีการลงทะเบียนพร้อมกันพอดี กรุณากดลงทะเบียนอีกครั้ง" }, { status: 409 }); // an account id taken a moment earlier
    console.error("[register-branch]", e);
    return NextResponse.json({ error: "ลงทะเบียนไม่สำเร็จ ลองใหม่อีกครั้ง" }, { status: 500 });
  }
}
