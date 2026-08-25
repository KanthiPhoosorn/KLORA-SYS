// KYN full carbon engine — implements the Technical Specification supplied by KYN (24 Aug 2026,
// "Summary.docx"). This is the ISO-14067-aligned model that supersedes the simplified per-round
// engine in carbon.ts.
//
//   Total_Order_Carbon = CO2e_Farm + CO2e_Packaging + CO2e_Transport
//   Carbon_Per_Stem    = Total_Order_Carbon / จำนวนดอกไม้ในออเดอร์
//
// Every figure produced here is an ESTIMATE (IPCC Tier-1 reference factors), never a measurement —
// surfaces must label it "Estimated CO₂e" (see components/Co2eDisclosure.tsx).

// ---------------------------------------------------------------------------
// 1. Farm side — monthly resource inputs → a farm-specific EF per kg of flower
// ---------------------------------------------------------------------------

/** Farm-level emission factors (KYN §2.3). All inputs are MONTHLY totals. */
export const FARM_EF = {
  DIESEL: 2.979, // [TGO ก.พ. 2569] Diesel: Agriculture (off-road) — kg CO2e / litre
  ELECTRICITY: 0.475, // [TGO ก.พ. 2569] grid mix 2022–2024, CFO Scope 2 — kg CO2e / kWh
  //   ↑ KYN's spec quoted 0.4999 (grid mix 2016–2018); TGO retired that value on 31 มี.ค. 2569.
  FERTILIZER: 3.5, // kg CO2e / kg  (range 3.0–5.0, midpoint) ⚠ Tier-1 estimate
  AGROCHEMICAL: 10.0, // kg CO2e / kg (range 5–25)            ⚠ Tier-1 estimate
  WATER: 0.16, // kg CO2e / m³ (range 0.15–0.17)
  ORGANIC_WASTE: 0.55, // kg CO2e / kg (range 0.5–0.6)
} as const;

/** System-wide fallback when a farm has no monthly data yet (KYN: "Fallback Value"). */
export const FLOWER_EF_DEFAULT = 0.65; // kg CO2e / kg fresh cut flower

/** One month of resource use for one farm — mirrors KYN's `farm_monthly_inputs` table. */
export interface FarmMonthlyInputs {
  dieselLitres?: number;
  electricityKwh?: number;
  fertilizerKg?: number;
  agrochemicalKg?: number;
  waterM3?: number;
  organicWasteKg?: number;
  /** [required for a dynamic EF] total weight of flowers actually cut & sold that month. */
  totalFlowerYieldKg?: number;
}

const n = (v?: number) => (Number.isFinite(v) ? (v as number) : 0);

/** Total_Farm_Carbon (kg CO2e) for one reporting month. */
export function farmMonthlyCarbon(i: FarmMonthlyInputs): number {
  return (
    n(i.dieselLitres) * FARM_EF.DIESEL +
    n(i.electricityKwh) * FARM_EF.ELECTRICITY +
    n(i.fertilizerKg) * FARM_EF.FERTILIZER +
    n(i.agrochemicalKg) * FARM_EF.AGROCHEMICAL +
    n(i.waterM3) * FARM_EF.WATER +
    n(i.organicWasteKg) * FARM_EF.ORGANIC_WASTE
  );
}

/**
 * Dynamic_Flower_EF (kg CO2e / kg flower) — the farm's own carbon intensity.
 * Falls back to the 0.65 system default when there is no usable monthly record,
 * exactly as KYN's Conditional Logic requires (prevents divide-by-zero / new farms).
 */
export function dynamicFlowerEF(i?: FarmMonthlyInputs | null): number {
  const yieldKg = n(i?.totalFlowerYieldKg);
  if (!i || yieldKg <= 0) return FLOWER_EF_DEFAULT;
  const ef = farmMonthlyCarbon(i) / yieldKg;
  return ef > 0 ? ef : FLOWER_EF_DEFAULT;
}

// ---------------------------------------------------------------------------
// 2. Packaging side — dimensions (W×L×H cm) → material weight → carbon
// ---------------------------------------------------------------------------

/** KYN §1 `packaging_materials` master table. */
export const PACKAGING_SPEC = {
  corrugated_box: {
    label: "กล่องลูกฟูก",
    weightPerSqm: 0.55, // kg / m²
    ef: 0.86, // kg CO2e / kg
    safetyFactor: 1.2, // เผื่อลิ้น/ฝาเกย
    surface: "box" as const, // 6-sided surface area
  },
  plastic_film: {
    label: "แผ่นพลาสติก / ซองห่อช่อ",
    weightPerSqm: 0.04,
    ef: 2.75,
    safetyFactor: 1.0,
    surface: "flat" as const, // 2-D sheet, height ignored
  },
} as const;

export type PackagingType = keyof typeof PACKAGING_SPEC;

export interface PackagingItem {
  type: PackagingType;
  /** centimetres */
  width: number;
  length: number;
  /** centimetres — ignored for flat sheets (and for a box entered with height 0) */
  height?: number;
  quantity: number;
}

export interface PackagingResult {
  weightKg: number;
  carbon: number; // kg CO2e
}

/** Surface area in m² for one unit. Boxes use all 6 faces; sheets use W×L only. */
export function packagingAreaSqm(item: PackagingItem): number {
  const w = n(item.width);
  const l = n(item.length);
  const h = n(item.height);
  const spec = PACKAGING_SPEC[item.type];
  // A box entered with no height degrades to a flat sheet, per KYN's H = 0 rule.
  if (spec.surface === "flat" || h <= 0) return (w * l) / 10_000;
  return (2 * (w * l + w * h + l * h)) / 10_000;
}

/** Weight + carbon for one packaging line item. */
export function packagingItemCarbon(item: PackagingItem): PackagingResult {
  const spec = PACKAGING_SPEC[item.type];
  const qty = Math.max(0, n(item.quantity));
  const weightKg = packagingAreaSqm(item) * spec.safetyFactor * spec.weightPerSqm * qty;
  return { weightKg, carbon: weightKg * spec.ef };
}

/** Rolled-up packaging weight + carbon for a whole order. */
export function packagingTotals(items: PackagingItem[]): PackagingResult {
  return (items ?? []).reduce<PackagingResult>(
    (acc, item) => {
      const r = packagingItemCarbon(item);
      return { weightKg: acc.weightKg + r.weightKg, carbon: acc.carbon + r.carbon };
    },
    { weightKg: 0, carbon: 0 },
  );
}

/** Net flower weight = weighed parcel − packaging. Never negative (KYN uses max(0, …)). */
export function netFlowerWeight(shippedWeightKg: number, packagingWeightKg: number): number {
  return Math.max(0, n(shippedWeightKg) - n(packagingWeightKg));
}

/** CO2e_Farm for one order. */
export function flowerCarbon(netWeightKg: number, flowerEF: number): number {
  return n(netWeightKg) * (Number.isFinite(flowerEF) ? flowerEF : FLOWER_EF_DEFAULT);
}

// ---------------------------------------------------------------------------
// 3. Transport side — t.km (preferred) or vehicle.km, + reefer surcharge
// ---------------------------------------------------------------------------

/** Running a refrigerated container adds 15% to the logistics leg (KYN §2.4). */
export const REEFER_MULTIPLIER = 1.15;

export type TransportMethod = "tkm" | "vkm";

export interface TransportInput {
  method: TransportMethod;
  distanceKm: number;
  /** gross parcel weight in KILOGRAMS (converted to tonnes internally) — method "tkm" only */
  grossWeightKg?: number;
  /** kg CO2e per tonne-km — from the vehicle/fuel EF table */
  efTkm?: number;
  /** kg CO2e per vehicle-km — from the vehicle/fuel EF table */
  efVkm?: number;
  isReeferUsed?: boolean;
}

/**
 * CO2e_Transport for one leg.
 *
 * ⚠ The EF value must be supplied by the caller from the vehicle/fuel EF table.
 * KYN's `vehicle_and_fuel_mapping_list` provides the vehicle × fuel ENUM only — the
 * numeric EF_tkm / EF_vkm values are not in it and must come from KYN or TGO.
 */
export function transportCarbon(input: TransportInput): number {
  const distance = n(input.distanceKm);
  let carbon = 0;
  if (input.method === "tkm") {
    const tonnes = n(input.grossWeightKg) / 1000;
    carbon = tonnes * distance * n(input.efTkm);
  } else {
    carbon = distance * n(input.efVkm);
  }
  return input.isReeferUsed ? carbon * REEFER_MULTIPLIER : carbon;
}

// ---------------------------------------------------------------------------
// 4. Order roll-up
// ---------------------------------------------------------------------------

export interface OrderCarbonBreakdown {
  farm: number;
  packaging: number;
  transport: number;
  total: number;
  perStem: number;
  packagingWeightKg: number;
  netFlowerWeightKg: number;
  flowerEF: number;
}

export interface OrderCarbonInput {
  packagingItems: PackagingItem[];
  /** weight of the finished parcel on the scale, in kg */
  shippedWeightKg: number;
  flowerCount: number;
  /** the farm's latest monthly record — omit to use the 0.65 fallback */
  farmMonthly?: FarmMonthlyInputs | null;
  transport?: TransportInput;
}

export function computeOrderCarbon(input: OrderCarbonInput): OrderCarbonBreakdown {
  const pack = packagingTotals(input.packagingItems ?? []);
  const netWeight = netFlowerWeight(input.shippedWeightKg, pack.weightKg);
  const ef = dynamicFlowerEF(input.farmMonthly);
  const farm = flowerCarbon(netWeight, ef);
  const transport = input.transport ? transportCarbon(input.transport) : 0;
  const total = farm + pack.carbon + transport;
  const stems = n(input.flowerCount) > 0 ? n(input.flowerCount) : 1;
  return {
    farm,
    packaging: pack.carbon,
    transport,
    total,
    perStem: total / stems,
    packagingWeightKg: pack.weightKg,
    netFlowerWeightKg: netWeight,
    flowerEF: ef,
  };
}
