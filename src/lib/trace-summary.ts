// Consumer-safe traceability summary of one batch — the payload a partner app (e.g. the
// Thai Post Super App "My Item" order detail) would pull from KLORA. No account PII: farm name,
// province and certifications only. Shared by GET /api/trace/[id] and the /superapp prototype.
import type { Batch, Supplier } from "./types";
import {
  categoryOf, categoryLabel, unitOf, unitsOf, perUnitLabel, ripenessAtScan, shelfLifeLeft,
  coldChainWarning, isWeightBased, UNIT_LABEL, RIPENESS_LABEL, harvestLabel, ageLabel,
} from "./produce";

export interface TraceSummary {
  batchId: string;
  supplierId: string;
  product: { category: string; categoryLabel: string; type: string; variety?: string; grade?: string };
  quantity: { value: number; unit: string; unitLabel: string };
  dates: { plantingDate?: string; harvestDate: string; harvestLabel: string; daysSinceHarvest: number; ageLabel: string };
  freshness: { ripeness?: string; ripenessLabel?: string; ripenessAtHarvest?: string; shelfLifeDays: number; shelfLifeLeftDays: number; storageMinC: number; storageMaxC: number; chillSensitive: boolean; warning?: string };
  carbon: { status: string; perUnit: number; perUnitLabel: string; totalKg: number; breakdown?: { farm: number; packaging: number; transport: number; engine: string } };
  origin: { farmName: string; province?: string; address: string; description?: string; certifications: { kind: string; name?: string; certNo?: string; expiresAt?: string }[] };
  shipment: { status: string; destination?: string; carrier?: string; provider?: string; distanceKm: number; reefer: boolean };
  links: { passport: string };
}

export function buildTraceSummary(b: Batch, s: Supplier, origin: string): TraceSummary {
  const category = categoryOf(b);
  const { stage, daysSinceHarvest, profile } = ripenessAtScan(b);
  const showRipeness = category !== "flower" && (profile.ripens || category === "fruit");
  const units = unitsOf(b);
  const chill = coldChainWarning(b) ?? undefined;
  const bd = b.carbonBreakdown;
  return {
    batchId: b.id,
    supplierId: s.id,
    product: { category, categoryLabel: categoryLabel(category), type: b.productType || s.flowerType, variety: b.variety, grade: b.grade },
    quantity: { value: isWeightBased(b) ? (b.quantity ?? 0) : b.flowerCount, unit: unitOf(b), unitLabel: UNIT_LABEL[unitOf(b)] },
    dates: { plantingDate: b.plantingDate, harvestDate: b.cutDate, harvestLabel: harvestLabel(category), daysSinceHarvest, ageLabel: ageLabel(category) },
    freshness: {
      ripeness: showRipeness ? stage : undefined,
      ripenessLabel: showRipeness ? RIPENESS_LABEL[stage] : undefined,
      ripenessAtHarvest: b.ripenessAtHarvest,
      shelfLifeDays: profile.shelfLifeDays,
      shelfLifeLeftDays: shelfLifeLeft(b),
      storageMinC: profile.storageMinC,
      storageMaxC: profile.storageMaxC,
      chillSensitive: profile.chillSensitive,
      warning: chill,
    },
    carbon: {
      status: b.status,
      perUnit: b.co2ePerFlower,
      perUnitLabel: perUnitLabel(b),
      totalKg: Math.round(b.co2ePerFlower * units * 100) / 100,
      breakdown: bd ? { farm: bd.farm, packaging: bd.packaging, transport: bd.transport, engine: bd.engine } : undefined,
    },
    origin: {
      farmName: s.farmName,
      province: s.province,
      address: s.address,
      description: s.description || s.highlights,
      certifications: (s.certifications ?? []).filter((c) => c.appliesTo.includes(category)).map((c) => ({ kind: c.kind, name: c.name, certNo: c.certNo, expiresAt: c.expiresAt })),
    },
    shipment: { status: b.shipmentStatus, destination: b.destination, carrier: b.carrier, provider: b.provider, distanceKm: b.distanceKm, reefer: !!b.isReeferUsed },
    links: { passport: `${origin}/trace/${b.id}` },
  };
}
