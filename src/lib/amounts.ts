// Amounts of lots without mixing units (doc "Logistic", 19 Oct 2026): flowers count ดอก or ช่อ, fruit and
// vegetables are weighed in กก. (ตัน → กก.). One unit in view → that unit and CO₂e per it; several units →
// each listed ("1,000 ดอก · 5 กก.") and CO₂e per รอบ, as on the dashboards. Pure; client and server.
import type { Batch } from "./types";
import { unitOf, batchCo2e } from "./produce";

export type AmountUnit = "stem" | "bunch" | "kg";
export type UnitMode = AmountUnit | "mixed" | null; // null = no lots
export const AMOUNT_UNIT: Record<AmountUnit, string> = { stem: "ดอก", bunch: "ช่อ", kg: "กก." };

type Lot = Pick<Batch, "unit" | "productCategory" | "quantity" | "flowerCount">;
export const amountUnit = (l: Lot): AmountUnit => { const u = unitOf(l); return u === "ton" ? "kg" : u; };
export const amountOf = (l: Lot) => { const q = l.quantity ?? l.flowerCount ?? 0; return unitOf(l) === "ton" ? q * 1000 : q; };

export function amountsOf(lots: Lot[]): Partial<Record<AmountUnit, number>> {
  const out: Partial<Record<AmountUnit, number>> = {};
  for (const l of lots) out[amountUnit(l)] = (out[amountUnit(l)] ?? 0) + amountOf(l);
  return out;
}
export function unitMode(lots: Lot[]): UnitMode {
  const s = new Set(lots.map(amountUnit));
  return s.size === 0 ? null : s.size > 1 ? "mixed" : [...s][0];
}
export const fmtAmount = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 1 });
/** "1,000" in the single unit of `mode`, else every unit: "1,000 ดอก · 5 กก." */
export function amountText(a: Partial<Record<AmountUnit, number>>, mode: UnitMode): string {
  if (mode && mode !== "mixed") return fmtAmount(a[mode] ?? 0);
  const parts = (Object.keys(AMOUNT_UNIT) as AmountUnit[]).filter((k) => a[k]);
  return parts.length ? parts.map((k) => `${fmtAmount(a[k]!)} ${AMOUNT_UNIT[k]}`).join(" · ") : "0";
}
/** With no lots yet, the unit the category filter implies (ดอกไม้ → ดอก, ผลไม้/ผัก → กก.). */
export const modeFor = (m: UnitMode, cat?: string): Exclude<UnitMode, null> => m ?? (cat === "fruit" || cat === "vegetable" ? "kg" : "stem");
/** "ดอก" / "กก." / "รอบ" (mixed) / "หน่วย" (no lots) — what an average is per. */
export const perLabel = (mode: UnitMode) => (mode === "mixed" ? "รอบ" : mode ? AMOUNT_UNIT[mode] : "หน่วย");
/** Average CO₂e: per unit (mean of each lot's per-unit figure) or, with mixed units, per รอบ. null = no lots. */
export function avgCo2e(lots: Batch[], mode: UnitMode): number | null {
  if (!lots.length) return null;
  return mode === "mixed" ? lots.reduce((n, b) => n + batchCo2e(b), 0) / lots.length : lots.reduce((n, b) => n + b.co2ePerFlower, 0) / lots.length;
}
