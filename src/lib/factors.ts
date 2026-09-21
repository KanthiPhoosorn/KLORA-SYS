// KYN-editable reference factors (หน้า KYN → ค่าสัมประสิทธิ์). Stored as one JSON document in
// app_settings under key "factors"; anything left empty falls back to the defaults below, which
// are the values the engine has always used. Pure module — safe on client and server.
import { FARM_EF } from "./carbon-kyn";

export interface PackageSize { label: string; w: number; l: number; h: number }

export interface Factors {
  /** kg CO2e per unit of each farm input (overrides FARM_EF; per-type fuel/fertilizer/chemical
   *  choices from the resource sheet still win over these generic values). */
  farm: { DIESEL: number; ELECTRICITY: number; FERTILIZER: number; AGROCHEMICAL: number; WATER: number; ORGANIC_WASTE: number };
  /** kg CO2e per tonne-km for air freight, split at 3,700 km (DEFRA short-/long-haul). */
  air: { shortHaul: number; longHaul: number };
  /** kg CO2e per tonne-km by "vehicleKey|fuelKey" — replaces the derived value when set. */
  vehicleTkm: Record<string, number>;
  /** Standard package sizes offered as quick-fill on the packaging W×L×H fields. */
  packageSizes: PackageSize[];
}

// Air freight — UK Government GHG Conversion Factors (DEFRA/BEIS), freight flights incl. RF
// and the 8% distance uplift: long-haul 0.89939 (2025 set), short-haul 2.30229 (2021 set).
export const AIR_EF_SOURCE = "DEFRA/BEIS GHG Conversion Factors — freight flights incl. RF (long-haul 2025, short-haul 2021)";
export const SHORT_HAUL_MAX_KM = 3700;

export const DEFAULT_FACTORS: Factors = {
  farm: { ...FARM_EF },
  air: { shortHaul: 2.30229, longHaul: 0.89939 },
  vehicleTkm: {},
  packageSizes: [
    { label: "กล่องเล็ก 20 × 30 × 15 ซม.", w: 20, l: 30, h: 15 },
    { label: "กล่องกลาง 30 × 40 × 20 ซม.", w: 30, l: 40, h: 20 },
    { label: "กล่องใหญ่ 40 × 60 × 30 ซม.", w: 40, l: 60, h: 30 },
    { label: "กล่องดอกไม้ยาว 30 × 100 × 20 ซม.", w: 30, l: 100, h: 20 },
    { label: "ซองห่อช่อ 50 × 70 ซม.", w: 50, l: 70, h: 0 },
  ],
};

const pos = (v: unknown): number | undefined => {
  const x = Number(v);
  return Number.isFinite(x) && x >= 0 ? x : undefined;
};

/** Merge a stored (possibly partial / hand-edited) document over the defaults, dropping junk. */
export function mergeFactors(stored: unknown): Factors {
  const s = (stored && typeof stored === "object" ? stored : {}) as Partial<Record<keyof Factors, unknown>>;
  const farmIn = (s.farm ?? {}) as Record<string, unknown>;
  const airIn = (s.air ?? {}) as Record<string, unknown>;
  const farm = { ...DEFAULT_FACTORS.farm };
  for (const k of Object.keys(farm) as (keyof Factors["farm"])[]) farm[k] = pos(farmIn[k]) ?? farm[k];
  const vehicleTkm: Record<string, number> = {};
  for (const [k, v] of Object.entries((s.vehicleTkm ?? {}) as Record<string, unknown>)) {
    const x = pos(v);
    if (x != null && x > 0 && /^[\w-]+\|[\w-]+$/.test(k)) vehicleTkm[k] = x;
  }
  const sizes = Array.isArray(s.packageSizes)
    ? (s.packageSizes as Record<string, unknown>[])
        .map((p) => ({ label: String(p.label ?? "").trim(), w: pos(p.w) ?? 0, l: pos(p.l) ?? 0, h: pos(p.h) ?? 0 }))
        .filter((p) => p.label && p.w > 0 && p.l > 0)
    : [];
  return {
    farm,
    air: { shortHaul: pos(airIn.shortHaul) ?? DEFAULT_FACTORS.air.shortHaul, longHaul: pos(airIn.longHaul) ?? DEFAULT_FACTORS.air.longHaul },
    vehicleTkm,
    packageSizes: sizes.length ? sizes : DEFAULT_FACTORS.packageSizes,
  };
}

/** Air-freight CO₂e for one shipment leg (kg CO₂e). */
export function airFreightCarbon(grossWeightKg: number, flightKm: number, f: Factors = DEFAULT_FACTORS): number {
  if (!(grossWeightKg > 0) || !(flightKm > 0)) return 0;
  const ef = flightKm < SHORT_HAUL_MAX_KM ? f.air.shortHaul : f.air.longHaul;
  return (grossWeightKg / 1000) * flightKm * ef;
}
