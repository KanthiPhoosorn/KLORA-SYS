// KYN ภาพรวม / รายงานสรุป filters (doc "Logistic", 19 Oct 2026: the ฟาร์ม and ช่วงเวลา pickers did nothing;
// add ทั้งหมด / ดอกไม้ / ผลไม้ / ผัก). Read from the URL (?cat=&farm=&period=) and applied on the server before
// any figure is worked out. The period counts back from today by harvest date, like the trend charts.
import type { Batch, ProductCategory } from "./types";
import { categoryOf } from "./produce";
import { bangkokDay } from "./format";

export type KynCat = ProductCategory | "all";
export interface KynFilter { cat: KynCat; farm: string; period: string }
export const PERIODS: { value: string; label: string }[] = [
  { value: "", label: "ทุกช่วงเวลา" },
  { value: "30", label: "30 วันล่าสุด" },
  { value: "90", label: "3 เดือนล่าสุด" },
  { value: "180", label: "6 เดือนล่าสุด" },
  { value: "365", label: "12 เดือนล่าสุด" },
];

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
export function parseKynFilter(sp: Record<string, string | string[] | undefined>): KynFilter {
  const c = one(sp.cat);
  const period = one(sp.period);
  return {
    cat: c === "flower" || c === "fruit" || c === "vegetable" ? c : "all",
    farm: one(sp.farm).slice(0, 40),
    period: PERIODS.some((p) => p.value === period) ? period : "",
  };
}

export function applyKynFilter<T extends Batch>(lots: T[], f: KynFilter, now = Date.now()): T[] {
  const from = f.period ? bangkokDay(new Date(now - Number(f.period) * 86400000).toISOString()) : "";
  return lots.filter((b) =>
    (!f.farm || b.supplierId === f.farm) &&
    (f.cat === "all" || categoryOf(b) === f.cat) &&
    (!from || (b.cutDate ?? "") >= from));
}
