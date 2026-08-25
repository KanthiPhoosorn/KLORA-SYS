import { NextResponse } from "next/server";
import { addSupplier, addUser, getUserByLogin } from "@/lib/store";
import { hashPassword, setSessionCookie } from "@/lib/auth";
import { provinceFromAddress } from "@/lib/geo";
import { clientIp, rateLimit, tooMany } from "@/lib/rate-limit";
import type { SupplierInput } from "@/lib/types";

// POST /api/auth/register — creates a farm profile + a login account in one step,
// issues a SUP ID, and signs the new user in.
export async function POST(req: Request) {
  const rl = await rateLimit(`register:ip:${clientIp(req)}`, 5, 15 * 60 * 1000);
  if (!rl.allowed) return tooMany(rl.retryAfter);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง (invalid JSON)" }, { status: 400 });
  }

  const s = (k: string) => (body[k] != null ? String(body[k]).trim() : "");
  const n = (k: string) => (body[k] != null && body[k] !== "" ? Number(body[k]) : undefined);

  // Multi-step register maps onto the supplier profile:
  //  contactName → owner · phone+lineId → contact · details → highlights
  const contactName = s("contactName") || s("owner");
  const phone = s("phone");
  const lineId = s("lineId");
  const contact = s("contact") || [phone && `โทร ${phone}`, lineId && `LINE ${lineId}`].filter(Boolean).join(" / ");
  const highlights = s("highlights") || s("details");
  const varieties = Array.isArray(body.varieties)
    ? (body.varieties as unknown[]).map((x) => String(x).trim()).filter(Boolean)
    : undefined;

  // Mandatory farm profile.
  const farmName = s("farmName");
  const address = s("address");
  const flowerType = s("flowerType");
  if (!farmName || !address || !contactName || !flowerType) {
    return NextResponse.json(
      { error: "กรอกข้อมูลผู้ผลิตไม่ครบ (ชื่อแหล่งผลิต / ผู้ติดต่อ / ที่อยู่ / ชนิดดอกไม้)" },
      { status: 400 },
    );
  }

  // Account.
  const email = s("email");
  const username = s("username");
  const password = s("password");
  const confirm = s("confirmPassword");
  if (!email || !username || !password) {
    return NextResponse.json({ error: "กรอกอีเมล ชื่อผู้ใช้ และรหัสผ่าน" }, { status: 400 });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "อีเมลไม่ถูกต้อง" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร" }, { status: 400 });
  }
  if (password !== confirm) {
    return NextResponse.json({ error: "รหัสผ่านและการยืนยันไม่ตรงกัน" }, { status: 400 });
  }
  if ((await getUserByLogin(email)) || (await getUserByLogin(username))) {
    return NextResponse.json(
      { error: "อีเมลหรือชื่อผู้ใช้นี้ถูกใช้แล้ว" },
      { status: 409 },
    );
  }

  // GPS may arrive as "lat, lng" in a single field.
  let gpsLat = n("gpsLat") ?? 0;
  let gpsLng = n("gpsLng") ?? 0;
  const gpsStr = s("gps");
  if (gpsStr && (!gpsLat || !gpsLng)) {
    const [la, ln] = gpsStr.split(",").map((x) => Number(x.trim()));
    if (!Number.isNaN(la)) gpsLat = la;
    if (!Number.isNaN(ln)) gpsLng = ln;
  }

  const input: SupplierInput = {
    farmName,
    address,
    province: provinceFromAddress(address) || undefined,
    gpsLat,
    gpsLng,
    owner: contactName,
    contactName,
    phone: phone || undefined,
    lineId: lineId || undefined,
    flowerType,
    varieties,
    flowerTypes: Array.isArray(body.flowerTypes)
      ? (body.flowerTypes as Record<string, unknown>[])
          .map((g) => ({
            type: String(g.type ?? "").trim(),
            varieties: Array.isArray(g.varieties)
              ? (g.varieties as unknown[]).map((v) => String(v).trim()).filter(Boolean)
              : [],
          }))
          .filter((g) => g.type)
      : undefined,
    highlights: highlights || "—",
    contact: contact || "—",
    fuelLitres: n("fuelLitres"),
    electricityKwh: n("electricityKwh"),
    fertilizerKg: n("fertilizerKg"),
    agriChemicalsKg: n("agriChemicalsKg"),
    waterM3: n("waterM3"),
    wasteKg: n("wasteKg"),
    flowersPerMonth: n("flowersPerMonth"),
  };

  const supplier = await addSupplier(input);
  const { hash, salt } = hashPassword(password);
  const user = await addUser({
    role: "supplier",
    supplierId: supplier.id,
    email,
    username,
    passwordHash: hash,
    salt,
  });
  await setSessionCookie(user.id);

  // Note: a real confirmation email would be sent here (stubbed for the demo).
  return NextResponse.json({ supplier, userId: user.id }, { status: 201 });
}
