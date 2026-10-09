// Request-body parsing for packaging lines (POST /api/batches, PATCH /api/batches/[id]).
import type { PackagingLine } from "./types";
import { DEFAULT_CATALOG, OTHER, NO_PACK, NO_INNER, PACK_UNITS, INNER_UNITS, type MaterialId } from "./packaging-catalog";

const KINDS_V1 = ["basket", "corrugated_box", "plastic_film"];
const MATERIALS = new Set<string>(DEFAULT_CATALOG.materials.map((m) => m.id));
const pos = (x: unknown) => (x != null && x !== "" && Number.isFinite(Number(x)) && Number(x) > 0 ? Number(x) : undefined);
const str = (x: unknown, max: number) => (x ? String(x).trim().slice(0, max) || undefined : undefined);
const mat = (x: unknown): MaterialId => (MATERIALS.has(String(x)) ? (String(x) as MaterialId) : "mixed");

function parseV2(p: Record<string, unknown>): PackagingLine | null {
  const kind = str(p.kind, 40);
  if (!kind) return null;
  const usage: PackagingLine["usage"] = kind === NO_PACK ? "single" : p.usage === "reusable" ? "reusable" : "single";
  const o = (p.other ?? {}) as Record<string, unknown>;
  const d = (p.dims ?? null) as Record<string, unknown> | null;
  const inners = Array.isArray(p.inners)
    ? (p.inners as Record<string, unknown>[]).slice(0, 12).map((i) => ({
        kind: str(i.kind, 40) ?? NO_INNER,
        qty: pos(i.qty) ?? 0,
        unit: INNER_UNITS.includes(String(i.unit)) ? String(i.unit) : "ชิ้น",
        ...(i.kind === OTHER ? { other: { name: str((i.other as Record<string, unknown>)?.name, 80) ?? "อื่นๆ", material: mat((i.other as Record<string, unknown>)?.material) } } : {}),
      })).filter((i) => i.kind === NO_INNER || i.qty > 0)
    : [];
  return {
    v: 2,
    kind,
    usage,
    assetId: usage === "reusable" ? str(p.assetId, 40) : undefined,
    size: kind === NO_PACK ? "none" : str(p.size, 20) ?? "unknown",
    dims: d && pos(d.w) && pos(d.l) ? { w: pos(d.w)!, l: pos(d.l)!, h: pos(d.h) ?? 0, unit: d.unit === "in" ? "in" : "cm" } : undefined,
    quantity: kind === NO_PACK ? 0 : Math.max(0, Number(p.quantity) || 0),
    unit: PACK_UNITS.includes(String(p.unit)) ? String(p.unit) : "ใบ",
    other: kind === OTHER ? { name: str(o.name, 80) ?? "อื่นๆ", material: mat(o.material), weightClass: str(o.weightClass, 20) ?? "unknown", weighedKg: pos(o.weighedKg) } : undefined,
    inners: kind === NO_PACK ? [] : inners,
    basketNo: kind === "basket" && usage === "reusable" ? str(p.assetId, 40) : undefined,
  };
}

export function parsePackagingItems(v: unknown): PackagingLine[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: PackagingLine[] = [];
  for (const p of (v as Record<string, unknown>[]).slice(0, 30)) {
    if (!p || typeof p !== "object") continue;
    if (p.v === 2) { const r = parseV2(p); if (r) out.push(r); continue; }
    const kind = String(p.kind);
    if (!KINDS_V1.includes(kind)) continue;
    const usage: PackagingLine["usage"] = p.usage === "reusable" || p.usage === "single" ? p.usage : undefined;
    const assetId = str(p.assetId, 40);
    out.push({
      kind, width: pos(p.width), length: pos(p.length), height: pos(p.height),
      // a registered reusable item is one physical piece (old form)
      quantity: usage === "reusable" && assetId ? 1 : Math.max(0, Number(p.quantity) || 0),
      usage, assetId, basketNo: str(p.basketNo, 40), boxMaterial: str(p.boxMaterial, 120),
    });
  }
  return out;
}

/** basketIds kept in step with the lines: reusable items' codes (or a legacy basket number). */
export function basketIdsOf(items: PackagingLine[]): string[] {
  return [...new Set(items.filter((p) => p.usage === "reusable" || (p.kind === "basket" && p.usage !== "single")).map((p) => p.assetId || p.basketNo).filter((x): x is string => !!x))];
}
