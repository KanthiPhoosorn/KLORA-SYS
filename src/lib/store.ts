// Postgres (Neon) store via Drizzle. The public function signatures are identical to the
// previous JSON-file store, so API routes and pages need no changes.
//
// Convention: nullable columns come back from Drizzle as `null`; the domain types use
// optional (`?`, i.e. `undefined`). `clean()` converts null -> undefined on every row read.

import { eq, and, or, desc, sql, isNull, inArray, like } from "drizzle-orm";
import { randomBytes } from "crypto";
import { db } from "./db";
import { suppliers, batches, users, members, invites, notifications, prints, otp, farmMonthlyInputs, appSettings, packagingAssets, customEntries, batchEvents } from "./db/schema";
import { mergeFactors, airFreightCarbon, type Factors } from "./factors";
import { mergeCatalog, rowsCarbon, type PackCatalog, type PackRow } from "./packaging-catalog";
import { innerMaterialsTotals } from "./inner-materials";
import type {
  Supplier,
  Batch,
  SupplierInput,
  BatchInput,
  User,
  PrintLog,
  Member,
  Invite,
  MemberRole,
  Notification,
  FarmMonthlyInput,
  CarbonBreakdownRecord,
  PackagingAsset,
  CustomEntry,
  BatchEvent,
} from "./types";
import {
  codeNumber,
  formatCid,
  formatLot,
  formatPkg,
  nextUserId,
  nextPrintId,
  nextMemberId,
  nextInviteId,
  nextNotificationId,
} from "./ids";
import { enrichBatch, flowerAgeDays, basketReuseCounts, FACTORS } from "./carbon";
import { isWeightBased, unitsOf } from "./produce";
import { fuelEf, fertilizerEf, chemicalEf, weightedEf } from "./resource-types";

// --- KYN-editable reference factors (app_settings "factors") ------------------
export async function getFactors(): Promise<Factors> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, "factors")).limit(1);
  return mergeFactors(row?.value);
}
export async function saveFactors(value: unknown, userId: string): Promise<Factors> {
  const merged = mergeFactors(value);
  const now = new Date().toISOString();
  await db.insert(appSettings).values({ key: "factors", value: merged, updatedAt: now, updatedBy: userId })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: merged, updatedAt: now, updatedBy: userId } });
  return merged;
}
// --- "อื่นๆ (ระบุ)" review queue ---------------------------------------------------
/** Record a typed-in value; the same field+value (any case) only bumps the counter. */
export async function queueCustomEntry(e: { field: string; value: string; detail?: Record<string, unknown>; supplierId?: string; userId?: string; batchId?: string }): Promise<void> {
  const value = e.value.trim().slice(0, 120);
  if (!value) return;
  const [hit] = await db.select({ id: customEntries.id }).from(customEntries)
    .where(and(eq(customEntries.field, e.field), sql`lower(${customEntries.value}) = ${value.toLowerCase()}`)).limit(1);
  if (hit) {
    await db.update(customEntries).set({ uses: sql`${customEntries.uses} + 1` }).where(eq(customEntries.id, hit.id));
    return;
  }
  await db.insert(customEntries).values({
    id: `CUS-${Date.now().toString(36)}${randomBytes(2).toString("hex")}`.toUpperCase(),
    field: e.field, value, detail: e.detail ?? null, supplierId: e.supplierId ?? null, userId: e.userId ?? null, batchId: e.batchId ?? null,
    createdAt: new Date().toISOString(),
  });
}

export async function getCustomEntries(): Promise<CustomEntry[]> {
  const rows = await db.select().from(customEntries).orderBy(desc(customEntries.createdAt));
  return rows.map((r) => clean<CustomEntry>(r as Record<string, unknown>));
}

export async function reviewCustomEntry(id: string, patch: { status: "approved" | "rejected" | "pending"; ef?: number | null; note?: string | null }, userId: string): Promise<CustomEntry | null> {
  const [r] = await db.update(customEntries).set({ status: patch.status, ef: patch.ef ?? null, note: patch.note ?? null, reviewedAt: new Date().toISOString(), reviewedBy: userId })
    .where(eq(customEntries.id, id)).returning();
  return r ? clean<CustomEntry>(r as Record<string, unknown>) : null;
}

/** KYN-confirmed factors for typed-in values: field → lower(value) → ef. */
export async function approvedCustomEfs(fields: string[]): Promise<Map<string, Map<string, number>>> {
  const rows = await db.select({ field: customEntries.field, value: customEntries.value, ef: customEntries.ef }).from(customEntries)
    .where(and(eq(customEntries.status, "approved"), inArray(customEntries.field, fields)));
  const out = new Map<string, Map<string, number>>();
  for (const r of rows) if (r.ef != null) (out.get(r.field) ?? out.set(r.field, new Map()).get(r.field)!).set(r.value.toLowerCase(), r.ef);
  return out;
}

// --- Reusable packaging registry (บรรจุภัณฑ์หมุนเวียน) ---------------------------

/** How many rounds reference each asset code (packaging_items[].assetId). */
async function assetUseCounts(): Promise<Map<string, number>> {
  const res = await db.execute(sql`SELECT e->>'assetId' AS id, count(DISTINCT b.id)::int AS n FROM batches b, jsonb_array_elements(coalesce(b.packaging_items, '[]'::jsonb)) e WHERE e ? 'assetId' AND b.cancelled_at IS NULL GROUP BY 1`);
  const rows = ((res as unknown as { rows?: { id: string; n: number }[] }).rows ?? (res as unknown as { id: string; n: number }[]));
  return new Map(rows.map((r) => [r.id, Number(r.n)]));
}

/** A farm sees its own items plus carrier/KYN-owned ones; logistic and KYN see everything. */
export async function listPackagingAssets(viewer?: { role: string; supplierId?: string }): Promise<PackagingAsset[]> {
  const rows = await db.select().from(packagingAssets).orderBy(desc(packagingAssets.createdAt));
  const uses = await assetUseCounts();
  return rows
    .map((r) => ({ ...clean<PackagingAsset>(r as Record<string, unknown>), uses: uses.get(r.id) ?? 0 }))
    .filter((a) => viewer?.role !== "supplier" || !a.ownerSupplierId || a.ownerSupplierId === viewer.supplierId);
}

export async function getPackagingAssetsByIds(ids: string[]): Promise<PackagingAsset[]> {
  if (!ids.length) return [];
  const rows = await db.select().from(packagingAssets).where(inArray(packagingAssets.id, ids));
  return rows.map((r) => clean<PackagingAsset>(r as Record<string, unknown>));
}

export async function createPackagingAsset(input: {
  kind: PackagingAsset["kind"]; width?: number; length?: number; height?: number; priorUses?: number;
  ownerSupplierId?: string; ownerLabel?: string; createdBy?: string;
}): Promise<PackagingAsset> {
  const factors = await getFactors();
  for (let attempt = 0; attempt < 5; attempt++) {
    const taken = await db.select({ id: packagingAssets.id }).from(packagingAssets).where(like(packagingAssets.id, "PKG-%"));
    const max = taken.reduce((m, r) => Math.max(m, codeNumber(r.id)), 0);
    const row = {
      id: formatPkg(max + 1 + attempt),
      kind: input.kind,
      width: input.width ?? null, length: input.length ?? null, height: input.height ?? null,
      designLife: (await getCatalog()).packs.find((p) => p.id === input.kind)?.lifetime ?? (factors.reuseLife as Record<string, number>)[input.kind] ?? 100,
      priorUses: Math.max(0, Math.round(input.priorUses ?? 0)),
      ownerSupplierId: input.ownerSupplierId ?? null,
      ownerLabel: input.ownerLabel ?? null,
      createdAt: new Date().toISOString(),
      createdBy: input.createdBy ?? null,
    };
    const inserted = await db.insert(packagingAssets).values(row).onConflictDoNothing().returning();
    if (inserted.length) return { ...clean<PackagingAsset>(inserted[0] as Record<string, unknown>), uses: 0 };
  }
  throw new Error("สร้างรหัสบรรจุภัณฑ์ไม่สำเร็จ ลองใหม่อีกครั้ง");
}

// --- KYN central packaging table (app_settings "packaging_catalog") -----------
export async function getCatalog(): Promise<PackCatalog> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, "packaging_catalog")).limit(1);
  return mergeCatalog(row?.value);
}
export async function saveCatalog(value: unknown, userId: string): Promise<PackCatalog> {
  const merged = mergeCatalog(value);
  const now = new Date().toISOString();
  await db.insert(appSettings).values({ key: "packaging_catalog", value: merged, updatedAt: now, updatedBy: userId })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: merged, updatedAt: now, updatedBy: userId } });
  return merged;
}

export async function getFactorsMeta(): Promise<{ updatedAt?: string; updatedBy?: string }> {
  const [row] = await db.select({ updatedAt: appSettings.updatedAt, updatedBy: appSettings.updatedBy }).from(appSettings).where(eq(appSettings.key, "factors")).limit(1);
  return { updatedAt: row?.updatedAt, updatedBy: row?.updatedBy ?? undefined };
}
import { computeOrderCarbon, packagingTotals, BASKET_SPEC, basketCarbonPerUse, FARM_EF } from "./carbon-kyn";
import { deriveTransportEF } from "./transport-ef";

// Fallback average weight of one fresh cut-flower stem (kg). Used only to derive the
// parcel weight when the farm has not entered its monthly count/yield yet — a real
// weighing or the farm's own stem-weight (yield ÷ count) always takes precedence.
const AVG_STEM_KG = 0.05;

// The SUP "ข้อมูลการใช้ทรัพยากร" form stores monthly resource use + a monthly flower COUNT
// on the supplier profile. Map it onto the KYN monthly-inputs shape so the same
// Dynamic_Flower_EF engine can run off it (count → kg via the avg stem weight).
/** Per-farm input factors: amount-weighted over the farm's lines when it declared several types
 *  (อื่นๆ lines priced with KYN's generic factor), else the single declared type. */
type Generic = { DIESEL: number; FERTILIZER: number; AGROCHEMICAL: number };
function farmEfs(s: Supplier, generic: Generic = FARM_EF, approved?: Map<string, Map<string, number>>) {
  const l = s.resourceLines;
  return l
    ? { fuelEf: weightedEf("fuel", l.fuel, generic.DIESEL, approved?.get("fuel")), fertilizerEf: weightedEf("fertilizer", l.fertilizer, generic.FERTILIZER, approved?.get("fertilizer")), agrochemicalEf: weightedEf("chemical", l.chemical, generic.AGROCHEMICAL, approved?.get("chemical")) }
    : { fuelEf: fuelEf(s.fuelKind), fertilizerEf: fertilizerEf(s.fertilizerKind), agrochemicalEf: chemicalEf(s.chemicalKind) };
}

function supplierToMonthly(s: Supplier, generic?: Generic, approved?: Map<string, Map<string, number>>): FarmMonthlyInput | null {
  const any =
    s.fuelLitres || s.electricityKwh || s.fertilizerKg || s.agriChemicalsKg || s.waterM3 || s.wasteKg;
  if (!any && !s.flowersPerMonth) return null;
  return {
    id: `PROFILE-${s.id}`,
    supplierId: s.id,
    reportingMonth: new Date().toISOString().slice(0, 7),
    dieselLitres: s.fuelLitres,
    electricityKwh: s.electricityKwh,
    fertilizerKg: s.fertilizerKg,
    agrochemicalKg: s.agriChemicalsKg,
    waterM3: s.waterM3,
    organicWasteKg: s.wasteKg,
    // Yield: per-product lines when the farm entered them (stems → kg via avg stem weight),
    // else the legacy single number (a stem count for flower farms, kg for produce farms).
    totalFlowerYieldKg: yieldKgOf(s),
    ...farmEfs(s, generic, approved),
    createdAt: s.createdAt,
  };
}
export function yieldKgOf(s: Pick<Supplier, "yieldLines" | "flowersPerMonth" | "productCategories">): number | undefined {
  const lines = (s.yieldLines ?? []).filter((l) => l.amount > 0);
  if (lines.length) return lines.reduce((sum, l) => sum + (l.unit === "kg" ? l.amount : l.amount * AVG_STEM_KG), 0);
  if (!s.flowersPerMonth) return undefined;
  return growsProduce(s) ? s.flowersPerMonth : s.flowersPerMonth * AVG_STEM_KG;
}
export function growsProduce(s: Pick<Supplier, "productCategories">): boolean {
  return (s.productCategories ?? []).some((c) => c !== "flower");
}

// null -> undefined so rows match the domain types' optional fields.
function clean<T>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const k in row) out[k] = row[k] === null ? undefined : row[k];
  return out as T;
}

const trailingNum = (id: string): number => {
  const m = /(\d+)$/.exec(id);
  return m ? parseInt(m[1], 10) : 0;
};

// --- Suppliers ------------------------------------------------------------

export async function getSuppliers(): Promise<Supplier[]> {
  const rows = await db.select().from(suppliers);
  return rows.map((r) => clean<Supplier>(r));
}

export async function getSupplier(id: string): Promise<Supplier | null> {
  const r = await db.select().from(suppliers).where(or(eq(suppliers.id, id), eq(suppliers.code, id))).limit(1);
  return r[0] ? clean<Supplier>(r[0]) : null;
}

/** Next CID running number — one sequence for farms and logistic organisations. */
async function nextCidNumber(): Promise<number> {
  const [s] = await db.select({ code: suppliers.code }).from(suppliers).where(sql`${suppliers.code} like 'CID-%'`).orderBy(desc(suppliers.code)).limit(1);
  const [u] = await db.select({ code: users.orgCode }).from(users).where(sql`${users.orgCode} like 'CID-%'`).orderBy(desc(users.orgCode)).limit(1);
  return Math.max(codeNumber(s?.code), codeNumber(u?.code)) + 1;
}

export async function addSupplier(input: SupplierInput): Promise<Supplier> {
  const now = new Date();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = formatCid((await nextCidNumber()) + attempt);
    const row = { ...input, id: code, code, status: "active" as const, createdAt: now.toISOString() };
    const inserted = await db.insert(suppliers).values(row).onConflictDoNothing().returning();
    if (inserted.length) return clean<Supplier>(inserted[0]);
  }
  throw new Error("สร้างรหัสองค์กรไม่สำเร็จ ลองใหม่อีกครั้ง");
}

export async function updateSupplier(
  id: string,
  patch: Partial<Omit<Supplier, "id" | "createdAt">>,
): Promise<Supplier | null> {
  const [updated] = await db.update(suppliers).set(patch).where(eq(suppliers.id, id)).returning();
  return updated ? clean<Supplier>(updated) : null;
}

// --- Batches --------------------------------------------------------------

/** Every active lot — cancelled ones (ยกเลิกรายการ) are kept for the farm's history but leave
 *  logistic / KYN lists and every total. Pass { withCancelled: true } to include them. */
export async function getBatches(opts: { withCancelled?: boolean } = {}): Promise<Batch[]> {
  const rows = await db.select().from(batches).where(opts.withCancelled ? undefined : isNull(batches.cancelledAt));
  return rows.map((r) => clean<Batch>(r));
}

// --- lot history (ประวัติการแก้ไข) ---------------------------------------------------
export async function addBatchEvent(e: Omit<BatchEvent, "id" | "at"> & { at?: string }): Promise<void> {
  await db.insert(batchEvents).values({
    id: `EVT-${Date.now().toString(36)}${randomBytes(3).toString("hex")}`.toUpperCase(),
    batchId: e.batchId, at: e.at ?? new Date().toISOString(), actorId: e.actorId ?? null, actorName: e.actorName ?? null,
    action: e.action, detail: e.detail ?? null,
  });
}
export async function getBatchEvents(batchId: string): Promise<BatchEvent[]> {
  const rows = await db.select().from(batchEvents).where(eq(batchEvents.batchId, batchId)).orderBy(batchEvents.at);
  return rows.map((r) => clean<BatchEvent>(r as Record<string, unknown>));
}
/** Active (not cancelled) print of a lot, if any. */
export async function activePrintOf(batchId: string): Promise<PrintLog | null> {
  const r = await db.select().from(prints).where(and(eq(prints.batchId, batchId), or(isNull(prints.cancelled), eq(prints.cancelled, false)))).limit(1);
  return r[0] ? clean<PrintLog>(r[0]) : null;
}

/** By LOT code, or by the pre-rename BAT id (old QR stickers, old links). */
export async function getBatch(id: string): Promise<Batch | null> {
  const r = await db.select().from(batches).where(or(eq(batches.id, id), eq(batches.legacyId, id))).limit(1);
  return r[0] ? clean<Batch>(r[0]) : null;
}

export async function getBatchesBySupplier(supplierId: string): Promise<Batch[]> {
  const rows = await db.select().from(batches).where(eq(batches.supplierId, supplierId));
  return rows.map((r) => clean<Batch>(r));
}

export async function addBatch(input: BatchInput): Promise<Batch> {
  const supplier = await getSupplier(input.supplierId);
  if (!supplier) throw new Error(`ไม่พบฟาร์ม: ${input.supplierId}`);
  if (supplier.status === "suspended") throw new Error("ฟาร์มนี้ถูกระงับการใช้งาน");

  const now = new Date();
  const entryDate = now.toISOString().slice(0, 10);
  const [last] = await db.select({ id: batches.id }).from(batches).where(sql`${batches.id} like 'LOT-%'`).orderBy(sql`substring(${batches.id} from 10)::int desc`).limit(1);
  const lotNo = codeNumber(last?.id) + 1;

  const row = {
    id: formatLot(lotNo, now),
    supplierId: input.supplierId,
    flowerCount: input.flowerCount,
    variety: input.variety,
    cutDate: input.cutDate,
    distanceKm: input.distanceKm,
    destination: input.destination,
    destinationAddress: input.destinationAddress,
    destLat: input.destLat,
    destLng: input.destLng,
    innerMaterials: input.innerMaterials?.length ? input.innerMaterials : null,
    carrier: input.carrier,
    provider: input.provider,
    postalCode: input.postalCode,
    branch: input.branch,
    boxMaterial: input.boxMaterial,
    weightKg: input.weightKg,
    basketIds: (input.basketIds ?? []).filter(Boolean),
    packagingItems: input.packagingItems ?? null,
    shippedWeightKg: input.shippedWeightKg,
    vehicleKey: input.vehicleKey,
    fuelKey: input.fuelKey,
    isReeferUsed: input.isReeferUsed,
    // Produce extension — a legacy flower entry lands as flower / stem / quantity = flowerCount.
    productCategory: input.productCategory ?? "flower",
    productType: input.productType,
    quantity: input.quantity ?? input.flowerCount,
    unit: input.unit ?? (input.productCategory && input.productCategory !== "flower" ? "kg" : "stem"),
    plantingDate: input.plantingDate,
    ripenessAtHarvest: input.ripenessAtHarvest,
    grade: input.grade,
    ethyleneUsed: input.ethyleneUsed,
    ethyleneNote: input.ethyleneNote,
    entryDate,
    co2ePerFlower: 0,
    ageDays: flowerAgeDays(input.cutDate, entryDate),
    expectedAgeDays: input.expectedAgeDays,
    status: input.status ?? ("submitted" as const),
    shipmentStatus: "cutting" as const,
    createdAt: now.toISOString(),
  };
  // a lot code freed by deleted test data must not inherit that lot's history
  await db.delete(batchEvents).where(eq(batchEvents.batchId, row.id));
  const [inserted] = await db.insert(batches).values(row).returning();
  return clean<Batch>(inserted);
}

// opts.advanceShipment: a KYN/carrier compute moves a "cutting" round to "in_transit"; the
// automatic compute-on-submit leaves the shipment status alone (the parcel hasn't left the farm).
export async function computeBatch(id: string, opts: { advanceShipment?: boolean } = {}): Promise<Batch | null> {
  const advanceShipment = opts.advanceShipment ?? true;
  const b = await getBatch(id);
  if (!b) return null;
  const supplier = await getSupplier(b.supplierId);
  if (!supplier) return null;

  const siblings = await getBatchesBySupplier(b.supplierId);
  const reuse = basketReuseCounts(siblings);
  const ageDays = flowerAgeDays(b.cutDate, b.entryDate);

  // KYN full-spec engine runs whenever the shipment declares its packaging.
  // The parcel weight the engine needs is either weighed (shippedWeightKg) or, when the
  // SUP form doesn't collect a scale weight, derived from the farm's own stem weight
  // (monthly yield ÷ monthly count) with a sensible fallback. Batches with no packaging
  // at all (older / quick entries) still use the legacy engine.
  // Produce (ผัก/ผลไม้) is weight-based, so it always uses the KYN engine — with or without
  // packaging lines — and its CO₂e is reported per kg; flowers keep per-stem.
  const weightBased = isWeightBased(b);
  const hasKynData = weightBased || (Array.isArray(b.packagingItems) && b.packagingItems.length > 0);
  const units = unitsOf(b);

  let co2ePerFlower: number;
  let breakdown: CarbonBreakdownRecord;

  if (hasKynData) {
    // Prefer a dedicated monthly record; otherwise use the farm's profile resource fields.
    const factors = await getFactors();
    const stored = await getLatestFarmMonthly(b.supplierId);
    // A stored monthly record still uses the farm's declared fuel/fertilizer/chemical types;
    // everything else falls back to the KYN-edited generic factors.
    const approved = await approvedCustomEfs(["fuel", "fertilizer", "chemical"]);
    const base = stored
      ? { ...stored, ...farmEfs(supplier, factors.farm, approved) }
      : supplierToMonthly(supplier, factors.farm, approved);
    const monthly = base ? { ...base, base: factors.farm } : null;
    const derivedRaw = b.vehicleKey && b.fuelKey ? deriveTransportEF(b.vehicleKey, b.fuelKey) : null;
    const tkmOverride = b.vehicleKey && b.fuelKey ? factors.vehicleTkm[`${b.vehicleKey}|${b.fuelKey}`] : undefined;
    const derived = tkmOverride ? { ...(derivedRaw ?? { efVkm: 0, sourced: false, basis: "" }), efTkm: tkmOverride } : derivedRaw;
    const inner = innerMaterialsTotals(b.innerMaterials);
    // ประเภทการใช้งาน: a reusable item carries 1/designLife of its manufacturing carbon per trip,
    // a single-use one all of it. Older rounds (no usage) keep the old rule: baskets reusable
    // (100 trips), boxes/film single-use. Weight always rides along in full.
    const all = b.packagingItems ?? [];
    const assetLife = new Map((await getPackagingAssetsByIds([...new Set(all.map((p) => p.assetId).filter((x): x is string => !!x))])).map((x) => [x.id, x.designLife]));
    // New rounds: KYN catalog rows (standard weight × material EF, ÷ lifetime when reused) — §4.9
    const v2 = all.filter((p) => p.v === 2) as unknown as PackRow[];
    const packEfs = v2.length ? await approvedCustomEfs(["packaging", "inner"]) : null;
    const v2Totals = v2.length
      ? rowsCarbon(v2, await getCatalog(), (id) => (id ? assetLife.get(id) : undefined), (field, name) => packEfs?.get(field)?.get(name.toLowerCase()))
      : { weightKg: 0, carbon: 0, estimate: false };
    const lines = all.filter((p) => p.v !== 2);
    const cyclesOf = (p: (typeof lines)[number]) =>
      p.usage === "single" ? 1
        : p.usage === "reusable" ? (p.assetId && assetLife.get(p.assetId)) || (factors.reuseLife as Record<string, number>)[p.kind] || 1
          : p.kind === "basket" ? BASKET_SPEC.defaultCycles : 1;
    const packItems = lines
      .filter((p): p is typeof p & { kind: "corrugated_box" | "plastic_film" } => p.kind === "corrugated_box" || p.kind === "plastic_film")
      .map((p) => ({ type: p.kind, width: p.width ?? 0, length: p.length ?? 0, height: p.height ?? 0, quantity: p.quantity || 0, reuseCycles: cyclesOf(p) }));
    const basketLines = lines.filter((p) => p.kind === "basket");
    const basketWeight = basketLines.reduce((sum, p) => sum + (p.quantity || 0) * BASKET_SPEC.weightKg, 0);
    const basketCarbon = basketLines.reduce((sum, p) => sum + (p.quantity || 0) * basketCarbonPerUse(cyclesOf(p)), 0);
    const extraPack = { weightKg: inner.weightKg + basketWeight + v2Totals.weightKg, carbon: inner.carbon + basketCarbon + v2Totals.carbon };

    // Derive the gross parcel weight when it wasn't weighed on a scale:
    //   flower weight  = flowerCount × stem weight (farm's own yield÷count, else AVG_STEM_KG)
    //   parcel weight  = flower weight + packaging weight
    // so netFlowerWeight() recovers the flower weight after the engine subtracts packaging.
    let shippedWeightKg = b.shippedWeightKg ?? 0;
    if (shippedWeightKg <= 0 && weightBased) {
      // Produce: the declared quantity IS the product weight; add packaging on top.
      shippedWeightKg = units + packagingTotals(packItems).weightKg + extraPack.weightKg;
    } else if (shippedWeightKg <= 0) {
      const stemKg =
        monthly?.totalFlowerYieldKg && supplier.flowersPerMonth
          ? monthly.totalFlowerYieldKg / supplier.flowersPerMonth
          : AVG_STEM_KG;
      const packWeight = packagingTotals(packItems).weightKg + extraPack.weightKg;
      shippedWeightKg = b.flowerCount * stemKg + packWeight;
    }
    // International: the road leg (farm → origin airport, distanceKm) plus the air-freight leg.
    const air = b.shipType === "international" ? airFreightCarbon(shippedWeightKg, b.flightDistanceKm ?? 0, factors) : 0;

    const r = computeOrderCarbon({
      packagingItems: packItems,
      basketCount: 0, // baskets are in extraPackaging (per-line design life)
      shippedWeightKg,
      flowerCount: units, // denominator: stems for flowers, kg for produce
      farmMonthly: monthly ?? undefined,
      extraPackaging: extraPack,
      extraTransportCarbon: air,
      transport: derived
        ? {
            method: "tkm",
            distanceKm: b.distanceKm,
            grossWeightKg: shippedWeightKg,
            efTkm: derived.efTkm,
            isReeferUsed: b.isReeferUsed,
          }
        : { method: "vkm", distanceKm: b.distanceKm, efVkm: FACTORS.TRANSPORT, isReeferUsed: b.isReeferUsed },
    });
    co2ePerFlower = r.perStem;
    breakdown = { engine: "kyn", farm: r.farm, packaging: r.packaging, transport: r.transport, total: r.total, perStem: r.perStem, flowerEF: r.flowerEF, netFlowerWeightKg: r.netFlowerWeightKg, packagingWeightKg: r.packagingWeightKg, air, innerPackaging: inner.carbon, ...(v2Totals.estimate ? { packagingEstimate: true } : {}) };
  } else {
    const legacy = enrichBatch(b, supplier, (bid) => reuse.get(bid) ?? 0);
    co2ePerFlower = legacy.co2ePerFlower;
    breakdown = {
      engine: "legacy",
      farm: legacy.breakdown.plantingCarbon,
      packaging: legacy.breakdown.basketCarbonPerCycle,
      transport: legacy.breakdown.transportCarbon,
      total: legacy.co2ePerFlower * units,
      perStem: legacy.co2ePerFlower,
      flowerEF: 0,
      netFlowerWeightKg: 0,
      packagingWeightKg: 0,
    };
  }

  const [updated] = await db
    .update(batches)
    .set({
      co2ePerFlower,
      ageDays,
      carbonBreakdown: breakdown,
      status: "computed",
      shipmentStatus: advanceShipment && b.shipmentStatus === "cutting" ? "in_transit" : b.shipmentStatus,
    })
    .where(eq(batches.id, id))
    .returning();
  return updated ? clean<Batch>(updated) : null;
}

export async function updateBatch(
  id: string,
  patch: Partial<Omit<Batch, "id" | "supplierId" | "createdAt">>,
): Promise<Batch | null> {
  const [updated] = await db.update(batches).set(patch).where(eq(batches.id, id)).returning();
  return updated ? clean<Batch>(updated) : null;
}

// --- Users ----------------------------------------------------------------

export async function getUsers(): Promise<User[]> {
  const rows = await db.select().from(users);
  return rows.map((r) => clean<User>(r));
}

// Match by username OR email, case-insensitive.
export async function getUserByLogin(login: string): Promise<User | null> {
  const q = login.trim().toLowerCase();
  const r = await db
    .select()
    .from(users)
    .where(sql`lower(${users.username}) = ${q} or lower(${users.email}) = ${q}`)
    .limit(1);
  return r[0] ? clean<User>(r[0]) : null;
}

export async function addUser(input: Omit<User, "id" | "createdAt">): Promise<User> {
  const ids = await db.select({ id: users.id }).from(users);
  const maxN = ids.reduce((mx, r) => Math.max(mx, trailingNum(r.id)), 0);
  const orgCode = input.role === "logistic" && !input.orgCode ? formatCid(await nextCidNumber()) : input.orgCode;
  const row = { ...input, orgCode, id: nextUserId(maxN), createdAt: new Date().toISOString() };
  const [inserted] = await db.insert(users).values(row).returning();
  return clean<User>(inserted);
}

export async function updateUser(
  id: string,
  patch: Partial<Omit<User, "id" | "createdAt">>,
): Promise<User | null> {
  const [updated] = await db.update(users).set(patch).where(eq(users.id, id)).returning();
  return updated ? clean<User>(updated) : null;
}

// --- Notifications --------------------------------------------------------

export async function getNotifications(supplierId?: string): Promise<Notification[]> {
  const rows = await db
    .select()
    .from(notifications)
    .where(supplierId ? or(isNull(notifications.supplierId), eq(notifications.supplierId, supplierId)) : undefined)
    .orderBy(desc(notifications.createdAt));
  return rows.map((r) => clean<Notification>(r));
}

// Event-driven notifications (compute done, shipment status, invites, plan/status changes).
export async function addNotification(input: Omit<Notification, "id" | "createdAt" | "read">): Promise<Notification> {
  const ids = await db.select({ id: notifications.id }).from(notifications);
  const maxN = ids.reduce((mx, r) => Math.max(mx, trailingNum(r.id)), 0);
  const row = { ...input, id: nextNotificationId(maxN), createdAt: new Date().toISOString(), read: false };
  const [inserted] = await db.insert(notifications).values(row).returning();
  return clean<Notification>(inserted);
}

export async function markNotificationsRead(supplierId: string): Promise<void> {
  await db.update(notifications).set({ read: true }).where(eq(notifications.supplierId, supplierId));
}

// Account self-deletion (PDPA). Removes the login + its team rows; the farm profile is
// anonymised (contact details wiped, suspended) only when no other login remains, and batches
// are kept as non-personal operational history.
export async function deleteUserAccount(userId: string): Promise<void> {
  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!u) return;
  await db.delete(members).where(sql`lower(${members.email}) = ${u.email.toLowerCase()}`);
  await db.delete(otp).where(sql`lower(${otp.email}) = ${u.email.toLowerCase()}`);
  await db.delete(users).where(eq(users.id, userId));
  if (u.supplierId) {
    const rest = await db.select({ id: users.id }).from(users).where(eq(users.supplierId, u.supplierId));
    if (rest.length === 0) {
      await db.update(suppliers).set({
        contactName: null, phone: null, lineId: null, contact: "—", gpsLat: 0, gpsLng: 0, status: "suspended",
      }).where(eq(suppliers.id, u.supplierId));
    }
  }
}

// --- Team members + invites (จัดการระบบ) ----------------------------------

export async function getMembers(supplierId?: string): Promise<Member[]> {
  const rows = await db
    .select()
    .from(members)
    .where(supplierId ? eq(members.supplierId, supplierId) : undefined);
  return rows.map((r) => clean<Member>(r));
}

export async function addMember(input: Omit<Member, "id" | "createdAt">): Promise<Member> {
  const ids = await db.select({ id: members.id }).from(members);
  const maxN = ids.reduce((mx, r) => Math.max(mx, trailingNum(r.id)), 0);
  const row = { ...input, id: nextMemberId(maxN), createdAt: new Date().toISOString() };
  const [inserted] = await db.insert(members).values(row).returning();
  return clean<Member>(inserted);
}

export async function updateMember(
  id: string,
  patch: Partial<Pick<Member, "role" | "name" | "email">>,
): Promise<Member | null> {
  const [updated] = await db.update(members).set(patch).where(eq(members.id, id)).returning();
  return updated ? clean<Member>(updated) : null;
}

export async function removeMember(id: string): Promise<boolean> {
  const deleted = await db.delete(members).where(eq(members.id, id)).returning({ id: members.id });
  return deleted.length > 0;
}

export async function getInvites(supplierId?: string): Promise<Invite[]> {
  const rows = await db
    .select()
    .from(invites)
    .where(supplierId ? eq(invites.supplierId, supplierId) : undefined);
  return rows.map((r) => clean<Invite>(r));
}

export async function addInvite(supplierId: string, email: string, role: MemberRole): Promise<Invite> {
  const ids = await db.select({ id: invites.id }).from(invites);
  const maxN = ids.reduce((mx, r) => Math.max(mx, trailingNum(r.id)), 0);
  const row = {
    id: nextInviteId(maxN),
    supplierId,
    email,
    role,
    invitedAt: new Date().toISOString(),
    status: "pending" as const,
    token: randomBytes(24).toString("base64url"),
  };
  const [inserted] = await db.insert(invites).values(row).returning();
  return clean<Invite>(inserted);
}

export async function getInviteByToken(token: string): Promise<Invite | null> {
  if (!token) return null;
  const [row] = await db.select().from(invites).where(eq(invites.token, token)).limit(1);
  return row ? clean<Invite>(row) : null;
}

export async function updateInvite(id: string, status: Invite["status"]): Promise<Invite | null> {
  const [updated] = await db.update(invites).set({ status }).where(eq(invites.id, id)).returning();
  return updated ? clean<Invite>(updated) : null;
}

// --- Farm monthly resource inputs (KYN Dynamic_Flower_EF) -----------------

export async function getFarmMonthlyInputs(supplierId: string): Promise<FarmMonthlyInput[]> {
  const rows = await db
    .select()
    .from(farmMonthlyInputs)
    .where(eq(farmMonthlyInputs.supplierId, supplierId))
    .orderBy(desc(farmMonthlyInputs.reportingMonth));
  return rows.map((r) => clean<FarmMonthlyInput>(r));
}

/** The farm's most recent monthly record — what Dynamic_Flower_EF is derived from. */
export async function getLatestFarmMonthly(supplierId: string): Promise<FarmMonthlyInput | null> {
  const rows = await getFarmMonthlyInputs(supplierId);
  return rows[0] ?? null;
}

/** One record per farm per month — re-submitting a month overwrites it. */
export async function upsertFarmMonthly(
  supplierId: string,
  reportingMonth: string,
  values: Partial<Omit<FarmMonthlyInput, "id" | "supplierId" | "reportingMonth" | "createdAt">>,
): Promise<FarmMonthlyInput> {
  const existing = await db
    .select()
    .from(farmMonthlyInputs)
    .where(and(eq(farmMonthlyInputs.supplierId, supplierId), eq(farmMonthlyInputs.reportingMonth, reportingMonth)))
    .limit(1);

  if (existing[0]) {
    const [updated] = await db
      .update(farmMonthlyInputs)
      .set(values)
      .where(eq(farmMonthlyInputs.id, existing[0].id))
      .returning();
    return clean<FarmMonthlyInput>(updated);
  }

  const ids = await db.select({ id: farmMonthlyInputs.id }).from(farmMonthlyInputs);
  const maxN = ids.reduce((mx, r) => Math.max(mx, trailingNum(r.id)), 0);
  const [inserted] = await db
    .insert(farmMonthlyInputs)
    .values({
      ...values,
      id: `FMI-${String(maxN + 1).padStart(4, "0")}`,
      supplierId,
      reportingMonth,
      createdAt: new Date().toISOString(),
    })
    .returning();
  return clean<FarmMonthlyInput>(inserted);
}

// --- OTP (password reset) — email stubbed; code surfaced in the API for the demo. --------

export async function setOtp(email: string, code: string, ttlMs = 10 * 60 * 1000): Promise<void> {
  await db
    .insert(otp)
    .values({ email, code, expiresAt: Date.now() + ttlMs })
    .onConflictDoUpdate({ target: otp.email, set: { code, expiresAt: Date.now() + ttlMs } });
}

export async function checkOtp(email: string, code: string): Promise<boolean> {
  const r = await db
    .select()
    .from(otp)
    .where(sql`lower(${otp.email}) = ${email.toLowerCase()} and ${otp.code} = ${code} and ${otp.expiresAt} > ${Date.now()}`)
    .limit(1);
  return r.length > 0;
}

export async function clearOtp(email: string): Promise<void> {
  await db.delete(otp).where(sql`lower(${otp.email}) = ${email.toLowerCase()}`);
}

// --- Print logs (Thai Post → KYN Shipment/QR log) -------------------------

export async function getPrints(): Promise<PrintLog[]> {
  const [rows, farms] = await Promise.all([db.select().from(prints), db.select({ id: suppliers.id, code: suppliers.code }).from(suppliers)]);
  const code = new Map(farms.map((f) => [f.id, f.code ?? f.id]));
  return rows.map((r) => ({ ...clean<PrintLog>(r), supplierCode: code.get(r.supplierId) ?? r.supplierId }));
}

export async function addPrint(
  input: Omit<PrintLog, "id" | "printedAt"> & { printedAt?: string },
): Promise<PrintLog> {
  const ids = await db.select({ id: prints.id }).from(prints);
  const maxN = ids.reduce((mx, r) => Math.max(mx, trailingNum(r.id)), 0);
  const row = {
    ...input,
    id: nextPrintId(maxN),
    printedAt: input.printedAt ?? new Date().toISOString(),
  };
  const [inserted] = await db.insert(prints).values(row).returning();
  return clean<PrintLog>(inserted);
}

export async function updatePrint(
  id: string,
  patch: Partial<Omit<PrintLog, "id">>,
): Promise<PrintLog | null> {
  const [updated] = await db.update(prints).set(patch).where(eq(prints.id, id)).returning();
  return updated ? clean<PrintLog>(updated) : null;
}
