import Link from "next/link";
import type { ProductCategory } from "@/lib/types";
import { CATEGORY_LABEL } from "@/lib/master-data";
import { CATEGORY_TAG } from "@/lib/produce";

export type CategoryFilterValue = ProductCategory | "all";
export function parseCat(v: string | string[] | undefined): CategoryFilterValue {
  const s = Array.isArray(v) ? v[0] : v;
  return s === "flower" || s === "fruit" || s === "vegetable" ? s : "all";
}

// ทั้งหมด / ดอกไม้ / ผลไม้ / ผัก — server-rendered chips driven by ?cat= (works without JS).
export default function CategoryFilter({ value, basePath, accent = "pink" }: { value: CategoryFilterValue; basePath: string; accent?: "pink" | "blue" | "purple" }) {
  const active = { pink: "bg-brand-pink text-white", blue: "bg-brand-blue text-white", purple: "bg-brand-purple text-white" }[accent];
  const opts: { key: CategoryFilterValue; label: string }[] = [{ key: "all", label: "ทั้งหมด" }, { key: "flower", label: CATEGORY_LABEL.flower }, { key: "fruit", label: CATEGORY_LABEL.fruit }, { key: "vegetable", label: CATEGORY_LABEL.vegetable }];
  return (
    <div className="flex flex-wrap gap-2">
      {opts.map((o) => (
        <Link key={o.key} href={o.key === "all" ? basePath : `${basePath}?cat=${o.key}`} scroll={false}
          className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition ${value === o.key ? active : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
          {o.label}
        </Link>
      ))}
    </div>
  );
}

/** Small coloured tag: ดอกไม้ (pink) / ผลไม้ (orange) / ผัก (green). */
export function CategoryTag({ category }: { category: ProductCategory }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${CATEGORY_TAG[category]}`}>{CATEGORY_LABEL[category]}</span>;
}
