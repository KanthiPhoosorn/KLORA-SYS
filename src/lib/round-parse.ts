// Request-body parsing of a farm round — shared by POST /api/batches (create) and
// PUT /api/batches/[id] (แก้ไขรอบส่งออก), so an edit is validated exactly like a new round.
import type { BatchInput } from "./types";
import { asCategory, asUnit, asRipeness } from "./produce-parse";
import { parsePackagingItems, basketIdsOf } from "./packaging-parse";

export type RoundFields = Omit<BatchInput, "supplierId" | "status">;

export function parseRound(body: Record<string, unknown>): { fields: RoundFields } | { error: string } {
  if (!body.cutDate) return { error: "ต้องระบุวันที่ตัด/เก็บเกี่ยว" };
  // Product category + counting unit. Flowers count stems (flowerCount); produce is weighed
  // (quantity in kg/ton) and keeps flowerCount = 0 so stem-based totals never mix units.
  const productCategory = asCategory(body.productCategory) ?? "flower";
  const unit = asUnit(body.unit) ?? (productCategory === "flower" ? "stem" : "kg");
  const weightBased = unit === "kg" || unit === "ton";
  const quantity = Number(body.quantity ?? body.flowerCount) || 0;
  const flowerCount = weightBased ? 0 : Math.round(quantity);
  if (weightBased && quantity <= 0) return { error: "น้ำหนักสินค้าต้องมากกว่า 0" };
  if (!weightBased && flowerCount <= 0) return { error: "จำนวนดอกไม้ต้องมากกว่า 0" };

  const packagingItems = parsePackagingItems(body.packagingItems);
  // New-style lines (with ประเภทการใช้งาน) define the reusable codes; older clients send basketIds.
  const basketIds = packagingItems?.some((p) => p.usage)
    ? basketIdsOf(packagingItems)
    : Array.isArray(body.basketIds) ? (body.basketIds as unknown[]).map((x) => String(x).trim()).filter(Boolean) : [];
  const str = (k: string) => (body[k] ? String(body[k]) : undefined);
  const num = (k: string) => (body[k] != null && body[k] !== "" && Number.isFinite(Number(body[k])) ? Number(body[k]) : undefined);
  return {
    fields: {
      flowerCount,
      variety: str("variety"),
      cutDate: String(body.cutDate),
      shipDate: /^\d{4}-\d{2}-\d{2}$/.test(String(body.shipDate ?? "")) ? String(body.shipDate) : undefined,
      distanceKm: Number(body.distanceKm) || 0,
      destination: str("destination"),
      destinationAddress: str("destinationAddress"),
      innerMaterials: Array.isArray(body.innerMaterials)
        ? (body.innerMaterials as Record<string, unknown>[]).map((m) => ({ material: String(m.material ?? "").trim(), qty: Number(m.qty) || 0 })).filter((m) => m.material && m.qty > 0)
        : undefined,
      destLat: num("destLat"),
      destLng: num("destLng"),
      carrier: str("carrier"),
      provider: str("provider"),
      postalCode: str("postalCode"),
      branch: str("branch"),
      boxMaterial: str("boxMaterial"),
      weightKg: num("weightKg"),
      basketIds,
      packagingItems,
      shippedWeightKg: num("shippedWeightKg"),
      vehicleKey: str("vehicleKey"),
      fuelKey: str("fuelKey"),
      isReeferUsed: body.isReeferUsed === true || body.isReeferUsed === "true",
      productCategory,
      productType: str("productType"),
      quantity,
      unit,
      plantingDate: str("plantingDate"),
      ripenessAtHarvest: asRipeness(body.ripenessAtHarvest),
      grade: str("grade"),
      ethyleneUsed: body.ethyleneUsed === true || body.ethyleneUsed === "true",
      ethyleneNote: str("ethyleneNote"),
      expectedAgeDays: Number(body.expectedAgeDays) > 0 ? Math.min(365, Math.round(Number(body.expectedAgeDays))) : undefined,
    },
  };
}
