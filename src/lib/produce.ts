// Produce helpers (ดอกไม้ / ผลไม้ / ผัก): units, labels, ripeness-at-scan, cold-chain checks.
// Pure functions — safe for client and server.
import type { Batch, ProductCategory, QuantityUnit, Ripeness } from "./types";
import { CATEGORY_LABEL, profileFor, type ProduceProfile } from "./master-data";

export const UNIT_LABEL: Record<QuantityUnit, string> = { stem: "ดอก", bunch: "ช่อ", kg: "กก.", ton: "ตัน" };
export const RIPENESS_LABEL: Record<Ripeness, string> = { unripe: "ดิบ", turning: "เริ่มสุก", ripe: "สุกพอดี", overripe: "สุกเกิน" };
export const GRADE_OPTIONS = ["A", "B", "C", "ส่งออก"];
export const CATEGORY_TAG: Record<ProductCategory, string> = {
  flower: "bg-brand-pink-light text-brand-pink",
  fruit: "bg-orange-50 text-orange-600",
  vegetable: "bg-emerald-50 text-emerald-600",
};

export function categoryOf(b: Pick<Batch, "productCategory">): ProductCategory {
  return b.productCategory ?? "flower";
}
export function unitOf(b: Pick<Batch, "unit" | "productCategory">): QuantityUnit {
  return b.unit ?? (categoryOf(b) === "flower" ? "stem" : "kg");
}
/** Weight-based products (ผัก/ผลไม้) — CO₂e is reported per kg, flowers per stem. */
export function isWeightBased(b: Pick<Batch, "unit" | "productCategory">): boolean {
  const u = unitOf(b);
  return u === "kg" || u === "ton";
}
/** Number of counting units in the batch (stems, or kg for produce). Never 0. */
export function unitsOf(b: Pick<Batch, "unit" | "productCategory" | "quantity" | "flowerCount">): number {
  const u = unitOf(b);
  if (u === "kg") return (b.quantity ?? 0) > 0 ? b.quantity! : 1;
  if (u === "ton") return (b.quantity ?? 0) > 0 ? b.quantity! * 1000 : 1;
  const n = b.quantity ?? b.flowerCount;
  return n > 0 ? n : 1;
}
/** "500 ดอก" / "120 กก." — quantity with its own unit (never fix the unit in a table header). */
export function quantityLabel(b: Pick<Batch, "unit" | "productCategory" | "quantity" | "flowerCount">): string {
  const u = unitOf(b);
  const q = b.quantity ?? b.flowerCount;
  return `${q.toLocaleString("th-TH", { maximumFractionDigits: 1 })} ${UNIT_LABEL[u]}`;
}
/** Denominator label for CO₂e: "ต่อดอก" / "ต่อกก." */
export function perUnitLabel(b: Pick<Batch, "unit" | "productCategory">): string {
  return isWeightBased(b) ? "ต่อกก." : unitOf(b) === "bunch" ? "ต่อช่อ" : "ต่อดอก";
}
export function categoryLabel(c: ProductCategory): string {
  return CATEGORY_LABEL[c];
}
/** วันที่ตัด (ดอกไม้) vs วันที่เก็บเกี่ยว (ผัก/ผลไม้) */
export function harvestLabel(c: ProductCategory): string {
  return c === "flower" ? "วันที่ตัด" : "วันที่เก็บเกี่ยว";
}
export function ageLabel(c: ProductCategory): string {
  return c === "flower" ? "อายุหลังตัด" : "อายุหลังเก็บเกี่ยว";
}

export function daysBetween(fromYmd: string, toDate = new Date()): number {
  const from = new Date(fromYmd + "T00:00:00");
  if (Number.isNaN(from.getTime())) return 0;
  return Math.max(0, Math.floor((toDate.getTime() - from.getTime()) / 86_400_000));
}

// Ripening stages advance with time after harvest for climacteric produce. Stage length is
// derived from the type's shelf life (a fruit picked "ดิบ" reaches "สุกพอดี" around 60 % of its
// shelf life and "สุกเกิน" past it). Non-ripening produce keeps its harvest stage until it is
// past shelf life, then reads as "สุกเกิน" (= ควรบริโภคโดยเร็ว).
const ORDER: Ripeness[] = ["unripe", "turning", "ripe", "overripe"];
export function ripenessAtScan(
  b: Pick<Batch, "cutDate" | "ripenessAtHarvest" | "productType" | "productCategory" | "ethyleneUsed">,
  now = new Date(),
): { stage: Ripeness; daysSinceHarvest: number; profile: ProduceProfile } {
  const profile = profileFor(b.productType, categoryOf(b));
  const days = daysBetween(b.cutDate, now);
  const start = b.ripenessAtHarvest ?? (profile.ripens ? "turning" : "ripe");
  let idx = ORDER.indexOf(start);
  if (profile.ripens) {
    // Ethylene-treated fruit (บ่ม) ripens about twice as fast.
    const step = Math.max(1, profile.shelfLifeDays * (b.ethyleneUsed ? 0.15 : 0.3));
    idx = Math.min(ORDER.length - 1, idx + Math.floor(days / step));
  } else if (days > profile.shelfLifeDays) {
    idx = ORDER.length - 1;
  }
  return { stage: ORDER[idx], daysSinceHarvest: days, profile };
}

/** Remaining shelf life in days (negative = past its standard shelf life). */
export function shelfLifeLeft(b: Pick<Batch, "cutDate" | "productType" | "productCategory">, now = new Date()): number {
  const profile = profileFor(b.productType, categoryOf(b));
  return profile.shelfLifeDays - daysBetween(b.cutDate, now);
}

/** Cold-chain sanity: reefer transport on chill-sensitive produce (กล้วย มะม่วง ทุเรียน ฯลฯ) damages it. */
export function coldChainWarning(b: Pick<Batch, "isReeferUsed" | "productType" | "productCategory">): string | null {
  if (!b.isReeferUsed) return null;
  const p = profileFor(b.productType, categoryOf(b));
  if (!p.chillSensitive) return null;
  return `${p.type || categoryLabel(categoryOf(b))} ไวต่อความเย็น — ควรเก็บที่ ${p.storageMinC}–${p.storageMaxC}°C ไม่ควรแช่เย็นต่ำกว่านั้น${p.note ? ` (${p.note})` : ""}`;
}
