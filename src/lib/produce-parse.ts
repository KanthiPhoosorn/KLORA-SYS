// Server-side parsing of produce fields from request bodies (register / farm profile / round).
import type { Certification, FlowerTypeEntry, ProductCategory, QuantityUnit, Ripeness } from "./types";
import { categoryOfType } from "./master-data";

const CATEGORIES: ProductCategory[] = ["flower", "fruit", "vegetable"];
const UNITS: QuantityUnit[] = ["stem", "bunch", "kg", "ton"];
const RIPENESS: Ripeness[] = ["unripe", "turning", "ripe", "overripe"];
const CERT_KINDS: Certification["kind"][] = ["GAP", "GlobalGAP", "Organic Thailand", "other"];

export const asCategory = (v: unknown): ProductCategory | undefined =>
  CATEGORIES.includes(v as ProductCategory) ? (v as ProductCategory) : undefined;
export const asUnit = (v: unknown): QuantityUnit | undefined =>
  UNITS.includes(v as QuantityUnit) ? (v as QuantityUnit) : undefined;
export const asRipeness = (v: unknown): Ripeness | undefined =>
  RIPENESS.includes(v as Ripeness) ? (v as Ripeness) : undefined;

/** ชนิด + พันธุ์ groups; category defaults from the master list, else flower (legacy shape). */
export function parseProduceGroups(raw: unknown): FlowerTypeEntry[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return (raw as { type?: unknown; varieties?: unknown; category?: unknown }[])
    .map((g) => {
      const type = String(g.type ?? "").trim();
      return {
        category: asCategory(g.category) ?? categoryOfType(type) ?? "flower",
        type,
        varieties: Array.isArray(g.varieties) ? g.varieties.map((v) => String(v).trim()).filter(Boolean) : [],
      };
    })
    .filter((g) => g.type);
}

export function categoriesOf(groups: FlowerTypeEntry[] | undefined): ProductCategory[] {
  const set = new Set<ProductCategory>((groups ?? []).map((g) => g.category ?? "flower"));
  return set.size ? CATEGORIES.filter((c) => set.has(c)) : ["flower"];
}

export function parseCertifications(raw: unknown): Certification[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return (raw as Record<string, unknown>[])
    .map((c) => {
      const kind = CERT_KINDS.includes(c.kind as Certification["kind"]) ? (c.kind as Certification["kind"]) : "other";
      const name = String(c.name ?? "").trim();
      const appliesTo = Array.isArray(c.appliesTo) ? (c.appliesTo.map(asCategory).filter(Boolean) as ProductCategory[]) : [];
      return {
        kind,
        name: name || undefined,
        appliesTo: appliesTo.length ? appliesTo : (["flower", "fruit", "vegetable"] as ProductCategory[]),
        certNo: String(c.certNo ?? "").trim() || undefined,
        expiresAt: String(c.expiresAt ?? "").trim() || undefined,
      };
    })
    .filter((c) => c.kind !== "other" || c.name);
}
