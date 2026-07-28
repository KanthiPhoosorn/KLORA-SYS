import { NextResponse } from "next/server";
import { addSupplier, addUser, getUserByLogin } from "@/lib/store";
import { hashPassword, setSessionCookie } from "@/lib/auth";
import { provinceFromAddress } from "@/lib/geo";
import type { SupplierInput } from "@/lib/types";

// POST /api/auth/register — creates a farm profile + a login account in one step,
// issues a SUP ID, and signs the new user in.
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง (invalid JSON)" }, { status: 400 });
  }

  const s = (k: string) => (body[k] != null ? String(body[k]).trim() : "");
  const n = (k: string) => (body[k] != null && body[k] !== "" ? Number(body[k]) : undefined);

  // Mandatory farm profile.
  const requiredFarm = ["farmName", "address", "owner", "flowerType", "highlights", "contact"];
  const missingFarm = requiredFarm.filter((k) => !s(k));
  if (missingFarm.length) {
    return NextResponse.json(
      { error: `กรอกข้อมูลฟาร์มไม่ครบ: ${missingFarm.join(", ")}` },
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

  const address = s("address");
  const input: SupplierInput = {
    farmName: s("farmName"),
    address,
    province: provinceFromAddress(address) || undefined,
    gpsLat: n("gpsLat") ?? 0,
    gpsLng: n("gpsLng") ?? 0,
    owner: s("owner"),
    flowerType: s("flowerType"),
    highlights: s("highlights"),
    contact: s("contact"),
    fuelLitres: n("fuelLitres"),
    electricityKwh: n("electricityKwh"),
    fertilizerKg: n("fertilizerKg"),
    basketId: s("basketId") || undefined,
    reuseCycles: n("reuseCycles"),
  };

  const supplier = await addSupplier(input);
  const { hash, salt } = hashPassword(password);
  const user = await addUser({
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
