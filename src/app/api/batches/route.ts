import { NextResponse } from "next/server";
import { getBatches, getBatchesBySupplier, addBatch, getSupplier } from "@/lib/store";
import { getCurrentUser } from "@/lib/auth";
import { guard } from "@/lib/api-guard";
import type { BatchStatus } from "@/lib/types";
import { asCategory, asUnit, asRipeness } from "@/lib/produce-parse";

// GET /api/batches[?supplierId=] — signed-in only. A farm account only ever sees its own rounds;
// logistic / KYN may list every farm (optionally filtered).
export async function GET(req: Request) {
  const g = await guard();
  if (g.deny) return g.deny;
  const q = new URL(req.url).searchParams.get("supplierId");
  const supplierId = g.user.role === "supplier" ? (g.user.supplierId ?? "") : q;
  const batches = supplierId
    ? await getBatchesBySupplier(supplierId)
    : await getBatches();
  return NextResponse.json(batches);
}

// POST /api/batches — the logged-in SUP logs a new cutting round for their own farm.
// supplierId is taken from the session, never from the body.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง (invalid JSON)" }, { status: 400 });
  }

  // SUP logs a round for its own farm (supplierId from session). A logistic/Exporter
  // account logs an export on behalf of a farm, passing that farm's supplierId explicitly.
  let supplierId: string;
  if (user.role === "supplier" && user.supplierId) {
    supplierId = user.supplierId;
  } else if (user.role === "logistic" && body.supplierId) {
    const sup = await getSupplier(String(body.supplierId));
    if (!sup) return NextResponse.json({ error: "ไม่พบฟาร์มที่เลือก" }, { status: 400 });
    supplierId = sup.id;
  } else {
    return NextResponse.json({ error: "เฉพาะบัญชีฟาร์มหรือผู้ส่งออกเท่านั้น" }, { status: 403 });
  }

  if (!body.cutDate) {
    return NextResponse.json({ error: "ต้องระบุวันที่ตัด/เก็บเกี่ยว" }, { status: 400 });
  }
  // Product category + counting unit. Flowers count stems (flowerCount); produce is weighed
  // (quantity in kg/ton) and keeps flowerCount = 0 so stem-based totals never mix units.
  const productCategory = asCategory(body.productCategory) ?? "flower";
  const unit = asUnit(body.unit) ?? (productCategory === "flower" ? "stem" : "kg");
  const weightBased = unit === "kg" || unit === "ton";
  const quantity = Number(body.quantity ?? body.flowerCount) || 0;
  const flowerCount = weightBased ? 0 : Math.round(quantity);
  if (weightBased && quantity <= 0) {
    return NextResponse.json({ error: "น้ำหนักสินค้าต้องมากกว่า 0" }, { status: 400 });
  }
  if (!weightBased && flowerCount <= 0) {
    return NextResponse.json({ error: "จำนวนดอกไม้ต้องมากกว่า 0" }, { status: 400 });
  }

  const status: BatchStatus = body.status === "draft" ? "draft" : "submitted";

  try {
    const basketIds = Array.isArray(body.basketIds)
      ? (body.basketIds as unknown[]).map((x) => String(x).trim()).filter(Boolean)
      : [];
    const str = (k: string) => (body[k] ? String(body[k]) : undefined);
    const batch = await addBatch({
      supplierId,
      flowerCount,
      variety: str("variety"),
      cutDate: String(body.cutDate),
      distanceKm: Number(body.distanceKm) || 0,
      destination: str("destination"),
      carrier: str("carrier"),
      provider: str("provider"),
      postalCode: str("postalCode"),
      branch: str("branch"),
      boxMaterial: str("boxMaterial"),
      weightKg: body.weightKg != null && body.weightKg !== "" ? Number(body.weightKg) : undefined,
      basketIds,
      // KYN full-spec inputs (optional)
      packagingItems: Array.isArray(body.packagingItems)
        ? (body.packagingItems as Record<string, unknown>[])
            .map((p) => ({
              kind: String(p.kind) as "basket" | "corrugated_box" | "plastic_film",
              width: p.width != null && p.width !== "" ? Number(p.width) : undefined,
              length: p.length != null && p.length !== "" ? Number(p.length) : undefined,
              height: p.height != null && p.height !== "" ? Number(p.height) : undefined,
              quantity: Number(p.quantity) || 0,
              basketNo: p.basketNo ? String(p.basketNo) : undefined,
              boxMaterial: p.boxMaterial ? String(p.boxMaterial) : undefined,
            }))
            .filter((p) => ["basket", "corrugated_box", "plastic_film"].includes(p.kind))
        : undefined,
      shippedWeightKg:
        body.shippedWeightKg != null && body.shippedWeightKg !== "" ? Number(body.shippedWeightKg) : undefined,
      vehicleKey: str("vehicleKey"),
      fuelKey: str("fuelKey"),
      isReeferUsed: body.isReeferUsed === true || body.isReeferUsed === "true",
      status,
      productCategory,
      productType: str("productType"),
      quantity,
      unit,
      plantingDate: str("plantingDate"),
      ripenessAtHarvest: asRipeness(body.ripenessAtHarvest),
      grade: str("grade"),
      ethyleneUsed: body.ethyleneUsed === true || body.ethyleneUsed === "true",
      ethyleneNote: str("ethyleneNote"),
    });
    return NextResponse.json(batch, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
