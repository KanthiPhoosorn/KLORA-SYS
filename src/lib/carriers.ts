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
export const asCarrierKey = (v: unknown): CarrierKey | undefined =>
  CARRIERS.some((c) => c.key === v) ? (v as CarrierKey) : undefined;
export const carrierLabel = (k?: string | null) => CARRIERS.find((c) => c.key === k)?.label ?? "";
