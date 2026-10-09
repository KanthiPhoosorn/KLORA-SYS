// Server-side helpers that send "อื่นๆ (ระบุ)" values to KYN's review queue.
import { queueCustomEntry } from "./store";
import { OTHER_KIND, type ResourceLines } from "./resource-types";
import { PROVIDERS } from "./carriers";
import { BRANCHES } from "./branches";
import { DESTINATIONS } from "./geo";
import { GRADE_OPTIONS } from "./produce";
import { VEHICLE_FUELS } from "./master-data";
import { AIRLINES, DEST_AIRPORTS } from "./airports";
import { PRODUCTS } from "./master-data";
import type { PackagingLine } from "./types";

export async function queueResourceOthers(lines: ResourceLines | null | undefined, ctx: { supplierId?: string; userId?: string }) {
  if (!lines) return;
  for (const group of ["fuel", "fertilizer", "chemical"] as const) {
    for (const l of lines[group]) {
      if (l.kind === OTHER_KIND && l.other) await queueCustomEntry({ field: group, value: l.other, detail: { amount: l.amount }, ...ctx });
    }
  }
}

/** Typed-in ("อื่นๆ") values of a round → KYN's review queue. */
export async function queueRoundOthers(b: { grade?: string; destination?: string; provider?: string; branch?: string; ageDays?: number }, ctx: { supplierId?: string; userId?: string; batchId?: string }) {
  const q = (field: string, value?: string, known?: string[]) => (value && known && !known.includes(value) ? queueCustomEntry({ field, value, ...ctx }) : undefined);
  await q("grade", b.grade, GRADE_OPTIONS);
  await q("destination", b.destination, [...DESTINATIONS.map((d) => d.name), "ต่างประเทศ"]);
  await q("provider", b.provider, PROVIDERS);
  await q("branch", b.branch, BRANCHES.map((x) => x.id));
}

/** Typed-in transport values the carrier entered on /logistic/new → KYN's review queue. */
export async function queueTransportOthers(b: { vehicleOther?: string; fuelKey?: string; airline?: string; destAirport?: string }, ctx: { userId?: string; batchId?: string; supplierId?: string }) {
  if (b.vehicleOther) await queueCustomEntry({ field: "vehicle", value: b.vehicleOther, ...ctx });
  if (b.fuelKey && !VEHICLE_FUELS.some((v) => v.fuelKey === b.fuelKey)) await queueCustomEntry({ field: "vehicle_fuel", value: b.fuelKey, ...ctx });
  if (b.airline && !AIRLINES.includes(b.airline)) await queueCustomEntry({ field: "airline", value: b.airline, ...ctx });
  if (b.destAirport && !DEST_AIRPORTS.some((a) => a.code === b.destAirport)) await queueCustomEntry({ field: "airport", value: b.destAirport, ...ctx });
}

/** Product types a farm typed in ("อื่นๆ" ชนิดสินค้า) → KYN's review queue. */
export async function queueProductOthers(groups: { type: string; category?: string }[] | null | undefined, ctx: { supplierId?: string; userId?: string }) {
  if (!groups) return;
  const known = new Set(PRODUCTS.map((p) => p.type));
  for (const g of groups) if (g.type && !known.has(g.type)) await queueCustomEntry({ field: "product_type", value: g.type, detail: { category: g.category }, ...ctx });
}

/** "อื่นๆ" packaging / inner materials of a round → KYN's review queue (with material + weight class). */
export async function queuePackagingOthers(items: PackagingLine[] | null | undefined, ctx: { supplierId?: string; userId?: string; batchId?: string }) {
  for (const p of items ?? []) {
    if (p.v !== 2) continue;
    if (p.kind === "other" && p.other?.name) await queueCustomEntry({ field: "packaging", value: p.other.name, detail: { material: p.other.material, weightClass: p.other.weightClass, weighedKg: p.other.weighedKg }, ...ctx });
    for (const i of p.inners ?? []) if (i.kind === "other" && i.other?.name) await queueCustomEntry({ field: "inner", value: i.other.name, detail: { material: i.other.material, unit: i.unit }, ...ctx });
  }
}
