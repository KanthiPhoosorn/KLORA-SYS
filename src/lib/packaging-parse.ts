// Request-body parsing for packaging lines (POST /api/batches, PATCH /api/batches/[id]).
import type { PackagingLine } from "./types";

const KINDS = ["basket", "corrugated_box", "plastic_film"] as const;
const pos = (x: unknown) => (x != null && x !== "" && Number.isFinite(Number(x)) && Number(x) > 0 ? Number(x) : undefined);
const str = (x: unknown, max: number) => (x ? String(x).trim().slice(0, max) || undefined : undefined);

export function parsePackagingItems(v: unknown): PackagingLine[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return (v as Record<string, unknown>[])
    .map((p) => {
      const usage: PackagingLine["usage"] = p?.usage === "reusable" || p?.usage === "single" ? p.usage : undefined;
      const assetId = str(p?.assetId, 40);
      return {
        kind: String(p?.kind) as PackagingLine["kind"],
        width: pos(p?.width),
        length: pos(p?.length),
        height: pos(p?.height),
        // a registered reusable item is one physical piece
        quantity: usage === "reusable" && assetId ? 1 : Math.max(0, Number(p?.quantity) || 0),
        usage,
        assetId,
        basketNo: str(p?.basketNo, 40),
        boxMaterial: str(p?.boxMaterial, 120),
      };
    })
    .filter((p) => (KINDS as readonly string[]).includes(p.kind));
}

/** basketIds kept in step with the lines: reusable baskets' codes (or a legacy basket number). */
export function basketIdsOf(items: PackagingLine[]): string[] {
  return [...new Set(items.filter((p) => p.kind === "basket" && p.usage !== "single").map((p) => p.assetId || p.basketNo).filter((x): x is string => !!x))];
}
