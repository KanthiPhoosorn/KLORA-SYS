// Which of a farm's certificates belong to a lot (13 Oct 2026: a certificate names its ขอบเขตการรับรอง —
// product categories and, optionally, the exact product types it covers, e.g. GAP for มะม่วง + ลำไย only).
import type { Certification, ProductCategory } from "./types";

/** A certificate shows on a lot when it covers the lot's category, its product type (if it lists types)
 *  and has not expired. */
export function certAppliesTo(c: Certification, category: ProductCategory, productType?: string, today = new Date().toISOString().slice(0, 10)): boolean {
  if (!c.appliesTo.includes(category)) return false;
  if (c.expiresAt && c.expiresAt < today) return false;
  if (c.productTypes?.length && !(productType && c.productTypes.includes(productType))) return false;
  return true;
}

/** "GAP" / "Organic Thailand" / the typed name of an อื่นๆ certificate */
export const certTitle = (c: Pick<Certification, "kind" | "name">) => (c.kind === "other" ? c.name || "ใบรับรอง" : c.kind);
