// Secondary packaging (วัสดุภายในกล่อง / ห่อหุ้ม / ผูกยึด / รักษาความสด) from KYN's
// flower_shipping_packaging_ef_list master. Each material is counted in its natural unit
// (แผ่น / ใบ / กล่อง / เมตร / ชิ้น / ก้อน); carbon and weight follow the master row:
//   EF "kg CO2e / kg วัสดุ"  → qty × standard weight (midpoint) × EF
//   EF "kg CO2e / เมตร|ชิ้น|ก้อน" → qty × EF   (weight still = qty × standard weight)
import { PACKAGING_MATERIALS } from "./master-data";
import type { InnerMaterialLine } from "./types";

export interface InnerMaterial {
  name: string;          // Material_TH — the stored key
  countUnit: string;     // แผ่น / ใบ / กล่อง / เมตร / ชิ้น / ก้อน
  weightPerUnitKg: number;
  ef: number;
  perKg: boolean;        // true: EF is per kg of material; false: per counted unit
  defaultPerBox: number; // sensible default quantity per box
}

const mid = (range: string): number => {
  const nums = (range.match(/[\d.]+/g) ?? []).map(Number).filter((x) => Number.isFinite(x));
  return nums.length >= 2 ? (nums[0] + nums[1]) / 2 : nums[0] ?? 0;
};

export const INNER_MATERIALS: InnerMaterial[] = PACKAGING_MATERIALS
  .filter((m) => !m.category.startsWith("บรรจุภัณฑ์หลัก"))
  .map((m) => {
    const countUnit = (m.standardWeight.split("/")[1] ?? "ชิ้น").trim();
    const perKg = /\/\s*kg/.test(m.unit);
    const defaultPerBox = countUnit === "เมตร" ? 1.5 : 1; // KYN note: tape ≈ 1–2 m per box
    return { name: m.material, countUnit, weightPerUnitKg: mid(m.standardWeight), ef: m.efDefault, perKg, defaultPerBox };
  });

export const innerMaterial = (name?: string | null) => INNER_MATERIALS.find((m) => m.name === name);

/** Carbon + weight of a list of secondary materials. Unknown names count as zero. */
export function innerMaterialsTotals(lines: InnerMaterialLine[] | null | undefined): { weightKg: number; carbon: number } {
  let weightKg = 0, carbon = 0;
  for (const l of lines ?? []) {
    const m = innerMaterial(l.material);
    const q = Number(l.qty) > 0 ? Number(l.qty) : 0;
    if (!m || !q) continue;
    const w = q * m.weightPerUnitKg;
    weightKg += w;
    carbon += m.perKg ? w * m.ef : q * m.ef;
  }
  return { weightKg, carbon };
}
