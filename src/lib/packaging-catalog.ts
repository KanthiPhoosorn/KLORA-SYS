// KYN central packaging table (Thai Post doc 9 Oct 2026, §4) — pure module, safe on client + server.
//
// Each packaging kind × size has a standard weight; each material has an EF in kg CO₂e per kg
// (bound to material weight, as the doc asks — TGO's carbon-label database states packaging EFs per kg):
//   ใช้ครั้งเดียว = จำนวน × น้ำหนัก × EF
//   หมุนเวียน    = จำนวน × (น้ำหนัก × EF ÷ จำนวนรอบตลอดอายุ)
//   วัสดุภายใน   = จำนวนบรรจุภัณฑ์ × จำนวนต่อหน่วย × น้ำหนัก × EF
//   "ไม่มี"      = 0
// Material EFs: TGO Emission Factor (CFP), Thai National LCI Database (TIIS-MTEC-NSTDA),
// update April 2026 — item numbers in `source`. Standard weights are starting values for KYN to
// replace with its own weighings (/kyn/packaging). KYN may override everything; this is the default.
import type { ProductCategory } from "./types";

export type MaterialId = "paper" | "newsprint" | "pe" | "lldpe" | "hdpe" | "pp" | "pet" | "foam" | "wood" | "bamboo" | "metal" | "mixed";
export interface Material {
  id: MaterialId; name: string; examples: string;
  ef: number; // kg CO₂e per kg of material
  /** typical weight of one piece when the user cannot say (อื่นๆ · ไม่ทราบ) */
  avgUnitKg: number;
  source: string;
  /** offered in the "ทำจากอะไร" picker of อื่นๆ (the 9 classes of the mockup) */
  pick?: boolean;
}
export interface PackSize { id: string; label: string; capacity: string; weightKg: number }
export interface PackKind {
  id: string; name: string; products: ProductCategory[];
  usage: "single" | "reusable"; // default ประเภทการใช้งาน (users may change it)
  unit: string; material: MaterialId;
  lifetime: number; // trips over its life when reused
  sizes: PackSize[];
  ref: [number, number, number]; // W×L×H cm of the middle size — scales a "กำหนดเอง" size
}
export interface InnerKind {
  id: string; name: string; products: ProductCategory[]; unit: string; material: MaterialId;
  weightKg: number; // per unit
  /** kg CO₂e per kg when the KYN table prices the item itself (not its base material) */
  efOverride?: number; note?: string;
}
export interface WeightClass { id: string; label: string; kg: number }
export interface PackCatalog { materials: Material[]; packs: PackKind[]; inners: InnerKind[]; weightClasses: WeightClass[] }

const ALL: ProductCategory[] = ["flower", "fruit", "vegetable"];
const TGO = "อบก. EF (CFP) Thai National LCI Database, เม.ย. 2569";

export const DEFAULT_CATALOG: PackCatalog = {
  materials: [
    { id: "paper", name: "กระดาษ / กระดาษลูกฟูก", examples: "กล่อง ถาด กระดาษห่อ", ef: 1.6254, avgUnitKg: 0.4, source: `${TGO} #501–502 กระดาษคราฟท์ทำผิวกล่อง/ทำลอน`, pick: true },
    { id: "newsprint", name: "กระดาษหนังสือพิมพ์ / กระดาษรีไซเคิล", examples: "กระดาษฝอย กระดาษรอง", ef: 1.3589, avgUnitKg: 0.05, source: `${TGO} #500` },
    { id: "pe", name: "พลาสติก PE", examples: "ถุง ฟิล์ม", ef: 2.4345, avgUnitKg: 0.03, source: `${TGO} #7 LDPE`, pick: true },
    { id: "lldpe", name: "พลาสติก LLDPE", examples: "ฟิล์มยืด", ef: 2.3995, avgUnitKg: 0.01, source: `${TGO} #6` },
    { id: "hdpe", name: "พลาสติก HDPE", examples: "ตะกร้า ถัง", ef: 2.4664, avgUnitKg: 1.2, source: `${TGO} #4` },
    { id: "pp", name: "พลาสติก PP", examples: "ตะกร้า ลัง ถุงตาข่าย", ef: 2.0366, avgUnitKg: 1.2, source: `${TGO} #8`, pick: true },
    { id: "pet", name: "พลาสติก PET", examples: "ถาดใส กล่องใส", ef: 2.9389, avgUnitKg: 0.03, source: `${TGO} #27`, pick: true },
    { id: "foam", name: "โฟม EPS / EPE", examples: "ลังโฟม ตาข่ายโฟม", ef: 2.1815, avgUnitKg: 0.25, source: `${TGO} #3 GPPS (เม็ดพลาสติกตั้งต้นของ EPS)`, pick: true },
    { id: "wood", name: "ไม้", examples: "ลัง พาเลท", ef: 0.0804, avgUnitKg: 3, source: `${TGO} #278 พาเลทไม้ยางพารา`, pick: true },
    { id: "bamboo", name: "ไผ่ / หวาย", examples: "เข่ง ตะกร้าสาน", ef: 0.0706, avgUnitKg: 1, source: `ค่าประมาณ — ใช้ ${TGO} #271 ไม้แปรรูป แทน (ไม่มีค่าไผ่ในฐานข้อมูล)`, pick: true },
    { id: "metal", name: "โลหะ", examples: "ถัง กล่องโลหะ", ef: 1.8578, avgUnitKg: 2, source: `${TGO} #533 เหล็กแผ่นรีดร้อน`, pick: true },
    { id: "mixed", name: "วัสดุผสม", examples: "หลายวัสดุรวมกัน", ef: 2.4, avgUnitKg: 0.5, source: "ค่าประมาณ (เฉลี่ยพลาสติก) — รอ KYN กำหนด", pick: true },
  ],
  packs: [
    { id: "carton", name: "กล่องลูกฟูก", products: ALL, usage: "single", unit: "ใบ", material: "paper", lifetime: 5, ref: [40, 30, 20],
      sizes: [{ id: "S", label: "S", capacity: "กล่องผลไม้ 5 กก.", weightKg: 0.35 }, { id: "M", label: "M", capacity: "กล่องผลไม้ 10 กก.", weightKg: 0.55 }, { id: "L", label: "L", capacity: "กล่องผลไม้ 15 กก.", weightKg: 0.8 }] },
    { id: "flowerbox", name: "กล่องดอกไม้ทรงยาว", products: ["flower"], usage: "single", unit: "ใบ", material: "paper", lifetime: 5, ref: [100, 30, 15],
      sizes: [{ id: "S", label: "S", capacity: "25 ก้าน", weightKg: 0.45 }, { id: "M", label: "M", capacity: "50 ก้าน", weightKg: 0.75 }, { id: "L", label: "L", capacity: "100 ก้าน", weightKg: 1.2 }] },
    { id: "basket", name: "ตะกร้าพลาสติก", products: ALL, usage: "reusable", unit: "ใบ", material: "pp", lifetime: 100, ref: [50, 35, 30],
      sizes: [{ id: "S", label: "S", capacity: "ตะกร้า 10 กก.", weightKg: 1.0 }, { id: "M", label: "M", capacity: "ตะกร้า 20 กก.", weightKg: 1.5 }, { id: "L", label: "L", capacity: "ตะกร้า 25 กก.", weightKg: 1.8 }] },
    { id: "bucket", name: "ถังน้ำสำหรับดอกไม้", products: ["flower"], usage: "reusable", unit: "ใบ", material: "pp", lifetime: 100, ref: [30, 30, 40],
      sizes: [{ id: "M", label: "M", capacity: "50 ก้าน", weightKg: 0.6 }, { id: "L", label: "L", capacity: "100 ก้าน", weightKg: 0.9 }] },
    { id: "crate", name: "ลังพลาสติกพับได้", products: ["fruit", "vegetable"], usage: "reusable", unit: "ลัง", material: "pp", lifetime: 100, ref: [53, 35, 25],
      sizes: [{ id: "M", label: "M", capacity: "ลัง 15 กก.", weightKg: 1.6 }, { id: "L", label: "L", capacity: "ลัง 20 กก.", weightKg: 2.0 }] },
    { id: "foam", name: "ลังโฟม", products: ["fruit", "vegetable"], usage: "single", unit: "ลัง", material: "foam", lifetime: 3, ref: [50, 30, 25],
      sizes: [{ id: "S", label: "S", capacity: "ลัง 5 กก.", weightKg: 0.15 }, { id: "M", label: "M", capacity: "ลัง 10 กก.", weightKg: 0.3 }] },
    { id: "wood", name: "ลังไม้", products: ["fruit", "vegetable"], usage: "single", unit: "ลัง", material: "wood", lifetime: 10, ref: [50, 35, 30],
      sizes: [{ id: "M", label: "M", capacity: "ลัง 15 กก.", weightKg: 2.5 }, { id: "L", label: "L", capacity: "ลัง 25 กก.", weightKg: 4.0 }] },
    { id: "bamboo", name: "เข่ง / ตะกร้าไผ่", products: ["fruit", "vegetable"], usage: "single", unit: "ใบ", material: "bamboo", lifetime: 10, ref: [50, 50, 40],
      sizes: [{ id: "M", label: "M", capacity: "15 กก.", weightKg: 0.8 }, { id: "L", label: "L", capacity: "30 กก.", weightKg: 1.5 }] },
    { id: "mesh", name: "ถุงตาข่าย / กระสอบ", products: ["fruit", "vegetable"], usage: "single", unit: "ถุง", material: "pp", lifetime: 3, ref: [60, 40, 0],
      sizes: [{ id: "M", label: "M", capacity: "10 กก.", weightKg: 0.04 }, { id: "L", label: "L", capacity: "25 กก.", weightKg: 0.09 }] },
    { id: "plasticbag", name: "ถุงพลาสติก", products: ["vegetable"], usage: "single", unit: "ถุง", material: "pe", lifetime: 1, ref: [30, 40, 0],
      sizes: [{ id: "S", label: "S", capacity: "1 กก.", weightKg: 0.005 }, { id: "M", label: "M", capacity: "5 กก.", weightKg: 0.02 }] },
    { id: "pallet", name: "พาเลท", products: ALL, usage: "reusable", unit: "ชิ้น", material: "wood", lifetime: 20, ref: [100, 120, 15],
      sizes: [{ id: "STD", label: "มาตรฐาน", capacity: "100 × 120 ซม.", weightKg: 22 }] },
  ],
  inners: [
    { id: "ldpe", name: "ถุงพลาสติก LDPE / ถุงคุมอุณหภูมิ", products: ALL, unit: "ใบ", material: "pe", weightKg: 0.025 },
    { id: "sleeve", name: "ซองพลาสติกห่อช่อดอก", products: ["flower"], unit: "ใบ", material: "pp", weightKg: 0.01 },
    { id: "tube", name: "หลอดน้ำเลี้ยงก้าน", products: ["flower"], unit: "ชิ้น", material: "pp", weightKg: 0.0045 },
    { id: "floralfoam", name: "โฟมปักดอกไม้ / ฟองน้ำ", products: ["flower"], unit: "ชิ้น", material: "mixed", weightKg: 0.045, efOverride: 5.56, note: "ตาราง KYN: 0.25 kg CO₂e ต่อก้อน" },
    { id: "paper", name: "กระดาษห่อ / กระดาษฝอย", products: ALL, unit: "แผ่น", material: "newsprint", weightKg: 0.025 },
    { id: "divider", name: "แผ่นกั้นช่องกระดาษลูกฟูก", products: ["flower", "fruit"], unit: "แผ่น", material: "paper", weightKg: 0.05 },
    { id: "epe", name: "ตาข่ายโฟมหุ้มผลไม้", products: ["fruit"], unit: "ชิ้น", material: "pe", weightKg: 0.003 },
    { id: "pulp", name: "ถาดรองเยื่อกระดาษ", products: ["fruit"], unit: "ชิ้น", material: "newsprint", weightKg: 0.03 },
    { id: "pet", name: "ถาด / กล่องพลาสติกใส (PET)", products: ["fruit", "vegetable"], unit: "ชิ้น", material: "pet", weightKg: 0.02 },
    { id: "film", name: "ฟิล์มยืดพันกล่อง", products: ALL, unit: "เมตร", material: "lldpe", weightKg: 0.008 },
    { id: "bubble", name: "พลาสติกกันกระแทก (Bubble)", products: ["flower", "fruit"], unit: "แผ่น", material: "pe", weightKg: 0.01 },
    { id: "icepack", name: "เจลเย็น / Ice pack", products: ALL, unit: "ชิ้น", material: "pe", weightKg: 0.2, efOverride: 0.15, note: "ค่าประมาณ — ส่วนใหญ่เป็นน้ำ/เจล คิดเฉพาะถุงพลาสติก" },
    { id: "ice", name: "น้ำแข็ง", products: ["fruit", "vegetable"], unit: "กก.", material: "mixed", weightKg: 1, efOverride: 0.03, note: "ค่าประมาณ — พลังงานไฟฟ้าทำน้ำแข็ง ~0.06 kWh/กก." },
  ],
  weightClasses: [
    { id: "xlight", label: "เบามาก · ประมาณถุงพลาสติก 1 ใบ", kg: 0.02 },
    { id: "light", label: "เบา · ประมาณกล่องกระดาษใบเล็ก", kg: 0.3 },
    { id: "mid", label: "ปานกลาง · ประมาณตะกร้าพลาสติก 1 ใบ", kg: 1.5 },
    { id: "heavy", label: "หนัก · ประมาณลังไม้ 1 ใบ", kg: 4 },
  ],
};

export const PACK_UNITS = ["ใบ", "กล่อง", "ลัง", "ตะกร้า", "ถุง", "ชิ้น"];
export const INNER_UNITS = ["ใบ", "ชิ้น", "แผ่น", "เมตร", "กรัม", "กก."];
export const OTHER = "other";
export const NO_PACK = "nopack";
export const NO_INNER = "none";

// ---- KYN overrides (app_settings "packaging_catalog") ----------------------------------------
const num = (v: unknown, min = 0) => { const x = Number(v); return Number.isFinite(x) && x >= min ? x : undefined; };
/** Merge a stored document over the defaults: KYN may change numbers/names, add sizes or items. */
export function mergeCatalog(stored: unknown): PackCatalog {
  const s = (stored && typeof stored === "object" ? stored : {}) as Partial<Record<keyof PackCatalog, unknown>>;
  const byId = <T extends { id: string }>(def: T[], over: unknown, fix: (d: T | undefined, o: Record<string, unknown>) => T | null): T[] => {
    if (!Array.isArray(over)) return def;
    const out: T[] = [];
    for (const o of over as Record<string, unknown>[]) {
      const d = def.find((x) => x.id === o?.id);
      const v = fix(d, o ?? {});
      if (v) out.push(v);
    }
    return out.length ? out : def;
  };
  const materials = byId(DEFAULT_CATALOG.materials, s.materials, (d, o) => {
    const base = d ?? (o.id && o.name ? ({ id: String(o.id) as MaterialId, name: String(o.name), examples: "", ef: 0, avgUnitKg: 0.5, source: "KYN" } as Material) : null);
    if (!base) return null;
    return { ...base, name: o.name ? String(o.name) : base.name, ef: num(o.ef) ?? base.ef, avgUnitKg: num(o.avgUnitKg) ?? base.avgUnitKg, source: o.source ? String(o.source) : base.source };
  });
  const packs = byId(DEFAULT_CATALOG.packs, s.packs, (d, o) => {
    const base = d ?? (o.id && o.name ? ({ id: String(o.id), name: String(o.name), products: ALL, usage: "single", unit: "ใบ", material: "mixed", lifetime: 1, sizes: [], ref: [40, 30, 20] } as PackKind) : null);
    if (!base) return null;
    const sizes = Array.isArray(o.sizes)
      ? (o.sizes as Record<string, unknown>[]).map((z) => ({ id: String(z.id ?? z.label ?? ""), label: String(z.label ?? z.id ?? ""), capacity: String(z.capacity ?? ""), weightKg: num(z.weightKg) ?? 0 })).filter((z) => z.id && z.weightKg > 0)
      : base.sizes;
    return {
      ...base, name: o.name ? String(o.name) : base.name,
      usage: o.usage === "reusable" || o.usage === "single" ? o.usage : base.usage,
      material: materials.some((m) => m.id === o.material) ? (o.material as MaterialId) : base.material,
      lifetime: Math.max(1, Math.round(num(o.lifetime, 1) ?? base.lifetime)),
      unit: o.unit ? String(o.unit) : base.unit,
      sizes: sizes.length ? sizes : base.sizes,
    };
  });
  const inners = byId(DEFAULT_CATALOG.inners, s.inners, (d, o) => {
    const base = d ?? (o.id && o.name ? ({ id: String(o.id), name: String(o.name), products: ALL, unit: "ชิ้น", material: "mixed", weightKg: 0.02 } as InnerKind) : null);
    if (!base) return null;
    return { ...base, name: o.name ? String(o.name) : base.name, weightKg: num(o.weightKg) ?? base.weightKg, material: materials.some((m) => m.id === o.material) ? (o.material as MaterialId) : base.material, efOverride: o.efOverride === null ? undefined : num(o.efOverride) ?? base.efOverride };
  });
  return { materials, packs, inners, weightClasses: DEFAULT_CATALOG.weightClasses };
}

// ---- one packaging row (stored in batches.packaging_items, v: 2) -----------------------------
export interface InnerRow { kind: string; qty: number; unit: string; other?: { name: string; material: MaterialId } }
export interface PackRow {
  v: 2;
  kind: string; // PackKind.id | "other" | "nopack"
  usage: "single" | "reusable";
  assetId?: string; // หมายเลขบรรจุภัณฑ์ (PKG-…) — reusable only
  size: string; // PackSize.id | "custom" | "unknown" | "none"
  dims?: { w: number; l: number; h: number; unit: "cm" | "in" };
  quantity: number;
  unit: string;
  other?: { name: string; material: MaterialId; weightClass: string; weighedKg?: number };
  inners: InnerRow[];
}

const areaM2 = (w: number, l: number, h: number) => (h > 0 ? 2 * (w * l + w * h + l * h) : w * l) / 10_000;

/** Standard weight (kg) of one unit of a row + whether it is an estimate (ค่าประมาณ). */
export function unitWeight(r: PackRow, cat: PackCatalog): { kg: number; estimate: boolean } {
  if (r.kind === NO_PACK) return { kg: 0, estimate: false };
  if (r.kind === OTHER) {
    const o = r.other;
    if (o?.weightClass === "weighed" && o.weighedKg && o.weighedKg > 0) return { kg: o.weighedKg, estimate: false };
    const wc = cat.weightClasses.find((w) => w.id === o?.weightClass);
    const mat = cat.materials.find((m) => m.id === o?.material);
    return { kg: wc?.kg ?? mat?.avgUnitKg ?? 0.5, estimate: true };
  }
  const k = cat.packs.find((p) => p.id === r.kind);
  if (!k) return { kg: 0, estimate: true };
  const avg = k.sizes.reduce((s, z) => s + z.weightKg, 0) / Math.max(1, k.sizes.length);
  if (r.size === "unknown") return { kg: avg, estimate: true };
  if (r.size === "custom") {
    const f = r.dims?.unit === "in" ? 2.54 : 1;
    const [rw, rl, rh] = k.ref;
    const a = r.dims ? areaM2(r.dims.w * f, r.dims.l * f, r.dims.h * f) : 0;
    const ref = areaM2(rw, rl, rh);
    // scale the middle size's weight by surface area (material ∝ area)
    const mid = k.sizes[Math.floor((k.sizes.length - 1) / 2)]?.weightKg ?? avg;
    return { kg: a > 0 && ref > 0 ? (mid * a) / ref : avg, estimate: true };
  }
  return { kg: k.sizes.find((z) => z.id === r.size)?.weightKg ?? avg, estimate: !k.sizes.some((z) => z.id === r.size) };
}

function materialEf(id: MaterialId | undefined, cat: PackCatalog) {
  return cat.materials.find((m) => m.id === id)?.ef ?? cat.materials.find((m) => m.id === "mixed")?.ef ?? 2.4;
}

/** Weight (kg) of one inner line for ONE package (qty per package in its unit). */
type CustomEf = (field: "packaging" | "inner", name: string) => number | undefined;
function innerPerPackage(i: InnerRow, cat: PackCatalog, customEf?: CustomEf): { kg: number; ef: number; estimate: boolean } {
  if (i.kind === NO_INNER) return { kg: 0, ef: 0, estimate: false };
  const it = cat.inners.find((x) => x.id === i.kind);
  const qty = i.qty > 0 ? i.qty : 0;
  if (i.kind === OTHER || !it) {
    const mat = i.other?.material ?? "mixed";
    const kg = i.unit === "กก." ? qty : i.unit === "กรัม" ? qty / 1000 : qty * 0.02;
    const confirmed = customEf?.("inner", i.other?.name ?? "");
    return { kg, ef: confirmed ?? materialEf(mat, cat), estimate: confirmed == null };
  }
  const kg = i.unit === "กก." ? qty : i.unit === "กรัม" ? qty / 1000 : qty * it.weightKg;
  return { kg, ef: it.efOverride ?? materialEf(it.material, cat), estimate: false };
}

export interface RowResult { weightKg: number; carbon: number; estimate: boolean; unitKg: number }
/** Weight + CO₂e of one row (the doc's §4.9 formulas). `life` = the registered item's design life. */
export function rowCarbon(r: PackRow, cat: PackCatalog, life?: number, customEf?: CustomEf): RowResult {
  if (r.kind === NO_PACK) return { weightKg: 0, carbon: 0, estimate: false, unitKg: 0 };
  const qty = r.quantity > 0 ? r.quantity : 0;
  const { kg, estimate } = unitWeight(r, cat);
  const k = cat.packs.find((p) => p.id === r.kind);
  const ef = r.kind === OTHER ? customEf?.("packaging", r.other?.name ?? "") ?? materialEf(r.other?.material, cat) : materialEf(k?.material, cat);
  const cycles = r.usage === "reusable" ? Math.max(1, life ?? k?.lifetime ?? 1) : 1;
  let weight = qty * kg;
  let carbon = (qty * kg * ef) / cycles;
  let est = estimate;
  for (const i of r.inners ?? []) {
    const x = innerPerPackage(i, cat, customEf);
    weight += qty * x.kg;
    carbon += qty * x.kg * x.ef;
    est = est || x.estimate;
  }
  return { weightKg: weight, carbon, estimate: est, unitKg: kg };
}

export function rowsCarbon(rows: PackRow[], cat: PackCatalog, lifeOf: (assetId?: string) => number | undefined = () => undefined, customEf?: CustomEf) {
  return rows.reduce(
    (acc, r) => { const x = rowCarbon(r, cat, lifeOf(r.assetId), customEf); return { weightKg: acc.weightKg + x.weightKg, carbon: acc.carbon + x.carbon, estimate: acc.estimate || x.estimate }; },
    { weightKg: 0, carbon: 0, estimate: false },
  );
}

/** Lists for one product category (§4.7). */
export const packsFor = (cat: PackCatalog, p: ProductCategory) => cat.packs.filter((k) => k.products.includes(p));
export const innersFor = (cat: PackCatalog, p: ProductCategory) => cat.inners.filter((k) => k.products.includes(p));

/** Human text for reviews / detail pages. */
export function rowText(r: PackRow, cat: PackCatalog) {
  const k = cat.packs.find((p) => p.id === r.kind);
  const name = r.kind === NO_PACK ? "ไม่มีบรรจุภัณฑ์ (ขนแบบเทกอง)" : r.kind === OTHER ? r.other?.name || "อื่นๆ" : k?.name ?? r.kind;
  const usage = r.kind === NO_PACK ? "" : r.usage === "reusable" ? "หมุนเวียน" : "ใช้ครั้งเดียว";
  const size = r.size === "custom" && r.dims ? `${r.dims.w} × ${r.dims.l} × ${r.dims.h} ${r.dims.unit === "in" ? "นิ้ว" : "ซม."}`
    : r.size === "unknown" ? "ไม่ทราบขนาด (ค่าเฉลี่ย)" : r.size === "none" ? "—"
    : (() => { const z = k?.sizes.find((x) => x.id === r.size); return z ? `${z.label} · ${z.capacity}` : r.size; })();
  const inner = (r.inners ?? []).filter((i) => i.kind !== NO_INNER).map((i) => {
    const it = cat.inners.find((x) => x.id === i.kind);
    return `${i.kind === OTHER ? i.other?.name || "อื่นๆ" : it?.name ?? i.kind} ${i.qty} ${i.unit}/${r.unit}`;
  }).join(" · ") || "ไม่มีวัสดุภายใน";
  return { name, usage, size, qty: r.kind === NO_PACK ? "—" : `${r.quantity} ${r.unit}`, inner, code: r.usage === "reusable" ? r.assetId ?? "" : "" };
}
