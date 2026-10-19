"use client";

import { usePathname, useRouter } from "next/navigation";
import { CATEGORY_LABEL } from "@/lib/master-data";
import { PERIODS, type KynFilter } from "@/lib/kyn-filter";

const selectCls = "rounded-[5px] border border-gray-300 bg-white px-3 py-2 text-[13px] text-slate-700 outline-none focus:border-brand-purple";

// ทั้งหมด / ดอกไม้ / ผลไม้ / ผัก · ฟาร์ม · ช่วงเวลา for KYN's ภาพรวม and รายงานสรุป (doc "Logistic", 19 Oct 2026).
// Each change rewrites the URL; the page works the figures out again on the server.
export function KynCategoryChips({ value }: { value: KynFilter }) {
  const go = useGo(value);
  const opts = [{ key: "all", label: "ทั้งหมด" }, { key: "flower", label: CATEGORY_LABEL.flower }, { key: "fruit", label: CATEGORY_LABEL.fruit }, { key: "vegetable", label: CATEGORY_LABEL.vegetable }] as const;
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="ประเภทสินค้า">
      {opts.map((o) => (
        <button key={o.key} type="button" onClick={() => go({ cat: o.key })} aria-pressed={value.cat === o.key}
          className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition ${value.cat === o.key ? "bg-brand-purple text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function KynFarmPeriod({ value, farms }: { value: KynFilter; farms: { id: string; name: string }[] }) {
  const go = useGo(value);
  return (
    <>
      <select aria-label="ฟาร์ม" name="farm" value={value.farm} onChange={(e) => go({ farm: e.target.value })} className={`${selectCls} max-w-[200px]`}>
        <option value="">ทุกฟาร์ม</option>
        {farms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
      </select>
      <select aria-label="ช่วงเวลา" name="period" value={value.period} onChange={(e) => go({ period: e.target.value })} className={selectCls}>
        {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
      </select>
    </>
  );
}

function useGo(value: KynFilter) {
  const router = useRouter();
  const path = usePathname();
  return (patch: Partial<KynFilter>) => {
    const next = { ...value, ...patch };
    const q = new URLSearchParams();
    if (next.cat !== "all") q.set("cat", next.cat);
    if (next.farm) q.set("farm", next.farm);
    if (next.period) q.set("period", next.period);
    router.replace(q.size ? `${path}?${q}` : path, { scroll: false });
  };
}
