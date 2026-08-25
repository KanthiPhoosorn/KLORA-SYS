// Carbon engine — faithful to the flowchart formula:
//
//   CO2e/ดอก = (คาร์บอนจากการปลูก + คาร์บอนจากการขนส่ง) / จำนวนดอกไม้ในตะกร้า
//             + คาร์บอนจากตะกร้าหมุนเวียน / จำนวนรอบการใช้งาน
//
//   ระยะเวลา (age) = วันที่ลงข้อมูล − วันที่ตัด
//
// Assumption noted here: the basket term is ALSO normalised per-flower (÷ flowerCount)
// so the whole expression yields a single "kg CO2e per flower" figure. Change the
// `/ flowerCount` on the basket line below if you want basket carbon reported per-basket.

import type { Supplier, Batch } from "./types";

// --- Emission factors --------------------------------------------------------
// kg CO2e per unit. Values reference Thailand's official Carbon Footprint (CFO/CFP)
// emission factors published by TGO (องค์การบริหารจัดการก๊าซเรือนกระจก). Update these to
// the exact latest TGO figures from the source below when finalising for production.
// Values marked [TGO] are quoted from the official TGO CFO factor list,
// "UPDATE: กุมภาพันธ์ 2569" (in force from 1 Jan 2569 / 2026) — thaicarbonlabel.tgo.or.th.
// They use the TOTAL kgCO2e column (CO2 fossil + CH4 + N2O), not the CO2-only column.
export const FACTORS = {
  FUEL: 2.979, // [TGO] Diesel: Agriculture (off-road) — kg CO2e / litre
  ELECTRICITY: 0.475, // [TGO] grid mix 2022–2024, CFO Scope 2 — kg CO2e / kWh
  //   ↑ replaces 0.4999 (grid mix 2016–2018), which TGO retired on 31 มี.ค. 2569.
  FERTILIZER: 3.5, // KYN spec — IPCC Tier-1 estimate, range 3.0–5.0 (not in the TGO list)
  AGROCHEMICAL: 10.0, // KYN spec — Tier-1 estimate, wide range 5–25 (not in the TGO list)
  WATER: 0.16, // KYN spec — range 0.15–0.17 (not in the TGO list)
  WASTE: 0.55, // KYN spec — organic waste, range 0.5–0.6 (not in the TGO list)
  BASKET: 2.0, // KYN packaging table — HDPE transport basket, per basket
  TRANSPORT: 0.2, // legacy flat per-km rate — superseded by lib/transport-ef.ts (t.km / v.km)
} as const;

// Source citation shown wherever the factors are displayed.
export const FACTOR_SOURCE = {
  org: "TGO · องค์การบริหารจัดการก๊าซเรือนกระจก",
  label: "อ้างอิงค่า Emission Factor (CFO) จาก TGO",
  url: "https://thaicarbonlabel.tgo.or.th/",
};

export const FACTOR_LABELS: Record<keyof typeof FACTORS, string> = {
  FUEL: "น้ำมัน (kg CO₂e / ลิตร)",
  ELECTRICITY: "ไฟฟ้า (kg CO₂e / kWh)",
  FERTILIZER: "ปุ๋ยเคมี (kg CO₂e / kg)",
  AGROCHEMICAL: "สารเคมีเกษตร (kg CO₂e / kg)",
  WATER: "น้ำ (kg CO₂e / ลบ.ม.)",
  WASTE: "ของเสียอินทรีย์ (kg CO₂e / kg)",
  BASKET: "ตะกร้า (kg CO₂e / ใบ)",
  TRANSPORT: "ขนส่ง (kg CO₂e / km)",
};

export interface CarbonBreakdown {
  plantingCarbon: number; // kg CO2e — from fuel + electricity + fertilizer
  transportCarbon: number; // kg CO2e — from distance
  basketCarbonPerCycle: number; // kg CO2e — basket amortised over reuse cycles
  co2ePerFlower: number; // kg CO2e per flower (final)
}

// คาร์บอนจากการปลูก — ครบทั้ง 6 รายการตามสเปก KYN (§2.3 Total_Farm_Carbon)
export function plantingCarbon(s: Supplier): number {
  return (
    (s.fuelLitres ?? 0) * FACTORS.FUEL +
    (s.electricityKwh ?? 0) * FACTORS.ELECTRICITY +
    (s.fertilizerKg ?? 0) * FACTORS.FERTILIZER +
    (s.agriChemicalsKg ?? 0) * FACTORS.AGROCHEMICAL +
    (s.waterM3 ?? 0) * FACTORS.WATER +
    (s.wasteKg ?? 0) * FACTORS.WASTE
  );
}

// คาร์บอนจากการขนส่ง
export function transportCarbon(distanceKm: number): number {
  return distanceKm * FACTORS.TRANSPORT;
}

// คาร์บอนจากตะกร้าหมุนเวียน สำหรับ 1 รอบ.
// ระบบนับจำนวนการใช้ซ้ำของแต่ละตะกร้าเอง (reuseCountOf) — ยิ่งใช้ซ้ำมาก คาร์บอน/รอบยิ่งน้อย.
// basketCarbonForRound = Σ (BASKET / จำนวนครั้งที่ตะกร้าใบนั้นถูกใช้)
export function basketCarbonForRound(
  basketIds: string[],
  reuseCountOf: (id: string) => number,
): number {
  return (basketIds ?? []).reduce((sum, id) => {
    const uses = Math.max(1, reuseCountOf(id));
    return sum + FACTORS.BASKET / uses;
  }, 0);
}

export function computeCarbon(
  s: Supplier,
  flowerCount: number,
  distanceKm: number,
  basketCarbonRound: number,
): CarbonBreakdown {
  const flowers = flowerCount > 0 ? flowerCount : 1;
  const planting = plantingCarbon(s);
  const transport = transportCarbon(distanceKm);

  const co2ePerFlower =
    (planting + transport + basketCarbonRound) / flowers;

  return {
    plantingCarbon: planting,
    transportCarbon: transport,
    basketCarbonPerCycle: basketCarbonRound,
    co2ePerFlower,
  };
}

// ระยะเวลาดอกไม้หลังตัด — days between cut date and data-entry date (never negative)
export function flowerAgeDays(cutDate: string, entryDate: string): number {
  const cut = new Date(cutDate + "T00:00:00Z").getTime();
  const entry = new Date(entryDate + "T00:00:00Z").getTime();
  if (Number.isNaN(cut) || Number.isNaN(entry)) return 0;
  const days = Math.round((entry - cut) / 86_400_000);
  return days > 0 ? days : 0;
}

// Aggregate carbon by source across a set of batches for one (or many) supplier(s).
// Used by the farm carbon dashboard's "สัดส่วนที่มาของคาร์บอน" and KYN reports.
export interface SourceBreakdown {
  transport: number; // kg CO2e
  planting: number; // kg CO2e (ปุ๋ย/ไฟฟ้า/น้ำมัน)
  basket: number; // kg CO2e (บรรจุภัณฑ์/ตะกร้า)
  total: number;
  pct: { transport: number; planting: number; basket: number }; // 0..100
}

export function sourceBreakdown(
  batches: Pick<Batch, "supplierId" | "distanceKm" | "basketIds">[],
  supplierById: (id: string) => Supplier | undefined,
  reuseCountOf: (id: string) => number,
): SourceBreakdown {
  let transport = 0;
  let planting = 0;
  let basket = 0;
  for (const b of batches) {
    const s = supplierById(b.supplierId);
    transport += transportCarbon(b.distanceKm);
    basket += basketCarbonForRound(b.basketIds ?? [], reuseCountOf);
    if (s) planting += plantingCarbon(s);
  }
  const total = transport + planting + basket;
  const p = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  return {
    transport,
    planting,
    basket,
    total,
    pct: { transport: p(transport), planting: p(planting), basket: p(basket) },
  };
}

// Convenience: recompute everything for a batch given its supplier + a basket
// reuse-count lookup (how many rounds each basket has been used in).
export function enrichBatch(
  batch: Pick<Batch, "flowerCount" | "distanceKm" | "cutDate" | "entryDate" | "basketIds">,
  supplier: Supplier,
  reuseCountOf: (id: string) => number,
): { co2ePerFlower: number; ageDays: number; breakdown: CarbonBreakdown } {
  const basketCarbonRound = basketCarbonForRound(batch.basketIds ?? [], reuseCountOf);
  const breakdown = computeCarbon(
    supplier,
    batch.flowerCount,
    batch.distanceKm,
    basketCarbonRound,
  );
  return {
    co2ePerFlower: breakdown.co2ePerFlower,
    ageDays: flowerAgeDays(batch.cutDate, batch.entryDate),
    breakdown,
  };
}

// Count how many of a supplier's rounds used each basket id (the reuse count).
export function basketReuseCounts(
  batches: Pick<Batch, "basketIds">[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const b of batches) {
    for (const id of b.basketIds ?? []) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return counts;
}
