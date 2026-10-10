// รูปแบบการจัดส่ง (KYN spec §1.2). A signup link "/register?via=<key>" restricts a farm to that
// carrier — the spec's "filter ตาม link ที่ได้รับ".
import type { CarrierKey } from "./types";

export const CARRIERS: { key: CarrierKey; label: string }[] = [
  { key: "thaipost", label: "ไปรษณีย์ไทย" },
  { key: "cold_chain", label: "ขนส่งควบคุมอุณหภูมิ" },
  { key: "private", label: "ขนส่งเอกชน" },
  { key: "sorting_center", label: "ศูนย์คัดแยกสินค้า" },
  { key: "exporter", label: "ผู้ส่งออก" },
];
/** Private parcel providers offered when the carrier is not Thai Post (+ "อื่นๆ (ระบุ)"). */
export const PROVIDERS = ["Nim Express", "Kerry Express", "Flash Express", "J&T Express", "SCG Express", "DHL Express"];

export const asCarrierKey = (v: unknown): CarrierKey | undefined =>
  CARRIERS.some((c) => c.key === v) ? (v as CarrierKey) : undefined;
export const carrierLabel = (k?: string | null) => CARRIERS.find((c) => c.key === k)?.label ?? "";

/** The carrier a farm is bound to through a carrier's sign-up link (null = free to choose). The type
 *  (signupVia) alone is the older KYN type-only link; the org fields come with /c/<token> links. */
export function boundCarrier(s: { signupVia?: CarrierKey | null; carrierOrg?: string | null; carrierCompany?: string | null; carrierBranch?: string | null }) {
  if (!s.signupVia) return null;
  return { key: s.signupVia, label: carrierLabel(s.signupVia), org: s.carrierOrg ?? undefined, company: s.carrierCompany ?? undefined, branch: s.carrierBranch ?? undefined };
}
/** A carrier org's likely type from its company name (pre-selects the link form). */
export const carrierKeyFromCompany = (company?: string | null): CarrierKey =>
  /ไปรษณีย์|ไทยโพสต์|thai ?post/i.test(company ?? "") ? "thaipost" : "private";
