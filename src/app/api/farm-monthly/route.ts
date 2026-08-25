import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { upsertFarmMonthly, getFarmMonthlyInputs } from "@/lib/store";

// GET /api/farm-monthly — this farm's monthly resource records (newest first).
export async function GET() {
  const user = await requireRole("supplier");
  if (!user.supplierId) return NextResponse.json({ error: "ไม่พบฟาร์ม" }, { status: 400 });
  return NextResponse.json({ records: await getFarmMonthlyInputs(user.supplierId) });
}

// POST /api/farm-monthly — record (or overwrite) one reporting month.
// { reportingMonth: "YYYY-MM", dieselLitres, electricityKwh, fertilizerKg,
//   agrochemicalKg, waterM3, organicWasteKg, totalFlowerYieldKg }
export async function POST(req: Request) {
  const user = await requireRole("supplier");
  if (!user.supplierId) return NextResponse.json({ error: "ไม่พบฟาร์ม" }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  const month = String(body.reportingMonth ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "ระบุเดือนในรูปแบบ YYYY-MM" }, { status: 400 });
  }

  const num = (k: string): number | undefined => {
    if (body[k] === undefined || body[k] === null || body[k] === "") return undefined;
    const v = Number(body[k]);
    return Number.isFinite(v) && v >= 0 ? v : undefined;
  };

  const record = await upsertFarmMonthly(user.supplierId, month, {
    dieselLitres: num("dieselLitres"),
    electricityKwh: num("electricityKwh"),
    fertilizerKg: num("fertilizerKg"),
    agrochemicalKg: num("agrochemicalKg"),
    waterM3: num("waterM3"),
    organicWasteKg: num("organicWasteKg"),
    totalFlowerYieldKg: num("totalFlowerYieldKg"),
  });

  return NextResponse.json({ record }, { status: 201 });
}
