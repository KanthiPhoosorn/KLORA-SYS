// The carrier lock (10 Oct 2026): a farm bound through a carrier's sign-up link ships only with that carrier.
// Enforced on the server for the farm's rounds (create + edit) and for the carrier side (print, export).
import type { Batch, Supplier } from "./types";
import type { RoundFields } from "./round-parse";
import { boundCarrier } from "./carriers";

/** Farm side: refuse another carrier; fill the bound provider / branch / org. Mutates `fields`.
 *  `prevCarrier` (edit): a round made before the farm was bound may keep its old carrier. */
export function lockRound(sup: Supplier, fields: RoundFields & { carrierOrg?: string }, prevCarrier?: string): string | null {
  const bound = boundCarrier(sup);
  if (!bound) return null;
  // the form sends the label; API clients may send the key — both mean the bound carrier
  const isBound = (v?: string) => v === bound.label || v === bound.key;
  if (fields.carrier && !isBound(fields.carrier) && fields.carrier !== prevCarrier) {
    return `ฟาร์มนี้ส่งได้กับ ${bound.company ?? bound.label} เท่านั้น`;
  }
  if (!fields.carrier) fields.carrier = bound.label;
  if (isBound(fields.carrier)) {
    if (bound.key !== "thaipost" && bound.company) fields.provider = bound.company;
    if (bound.branch && !fields.branch) fields.branch = bound.branch;
    if (bound.org) fields.carrierOrg = bound.org;
  }
  return null;
}

/** The farm's bound provider / branch are known values — keep them out of KYN's "อื่นๆ" review queue. */
export function withoutBound<T extends { provider?: string; branch?: string }>(sup: Supplier, b: T): T {
  const bound = boundCarrier(sup);
  if (!bound) return b;
  return { ...b, provider: b.provider === bound.company ? undefined : b.provider, branch: b.branch === bound.branch ? undefined : b.branch };
}

/** Carrier side: a lot made for a bound farm belongs to that carrier org only. */
export function carrierRefusal(user: { role: string; orgCode?: string }, lot: Pick<Batch, "carrierOrg"> | null | undefined): string | null {
  if (!lot?.carrierOrg || user.role !== "logistic" || user.orgCode === lot.carrierOrg) return null;
  return "ล็อตนี้เป็นของฟาร์มที่ส่งกับผู้ขนส่งรายอื่น — ดำเนินการไม่ได้";
}
