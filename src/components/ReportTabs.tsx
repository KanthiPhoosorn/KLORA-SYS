"use client";

import { useState } from "react";
import { Bar } from "@/components/ui";

export interface ReportData {
  province: { province: string; rounds: number; flowers: number; km: number; perFlower: number }[];
  types: { type: string; flowers: number; avg: number; pct: number }[];
  freshness: { label: string; count: number; pct: number }[];
  ranking: { name: string; rounds: number; avg: number }[];
}

const TABS = [
  { key: "province", label: "สถิติจังหวัดปลายทาง" },
  { key: "types", label: "สัดส่วนประเภทดอกไม้" },
  { key: "freshness", label: "การกระจายความสด" },
  { key: "ranking", label: "อันดับฟาร์มที่ปล่อยคาร์บอนต่ำสุด" },
] as const;

export default function ReportTabs({ data }: { data: ReportData }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("province");
  const maxProv = Math.max(1, ...data.province.map((p) => p.flowers));
  const maxType = Math.max(1, ...data.types.map((t) => t.flowers));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
        <span className="mr-2 hidden text-sm font-semibold text-slate-800 sm:inline">ภาพรวมข้อมูลเชิงลึก</span>
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-medium ${tab === t.key ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5">
        {tab === "province" && (
          <div className="space-y-4">
            <div className="space-y-2.5">
              {data.province.map((p) => (
                <div key={p.province} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 truncate text-sm text-slate-600">{p.province}</span>
                  <div className="flex-1"><Bar value={p.flowers} max={maxProv} /></div>
                  <span className="w-10 text-right text-sm tabular font-medium text-slate-800">{Math.round((p.flowers / maxProv) * 100)}%</span>
                </div>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead><tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-3 py-2 font-medium">จังหวัด</th><th className="px-3 py-2 text-right font-medium">รอบ</th><th className="px-3 py-2 text-right font-medium">ดอกไม้</th><th className="px-3 py-2 text-right font-medium">กม.เฉลี่ย</th><th className="px-3 py-2 text-right font-medium">CO2e/ดอก</th>
                </tr></thead>
                <tbody>{data.province.map((p) => (
                  <tr key={p.province} className="border-b border-slate-50 last:border-0">
                    <td className="px-3 py-2 text-slate-700">{p.province}</td><td className="px-3 py-2 text-right tabular">{p.rounds}</td><td className="px-3 py-2 text-right tabular">{p.flowers.toLocaleString()}</td><td className="px-3 py-2 text-right tabular">{Math.round(p.km)}</td><td className="px-3 py-2 text-right tabular">{p.perFlower.toFixed(3)}</td>
                  </tr>))}</tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "types" && (
          <div className="space-y-3">
            {data.types.map((t) => (
              <div key={t.type} className="space-y-1.5">
                <div className="flex justify-between text-sm"><span className="text-slate-600">{t.type}</span><span className="tabular text-slate-500">{t.flowers.toLocaleString()} · {t.avg.toFixed(3)} กก./ดอก</span></div>
                <Bar value={t.flowers} max={maxType} />
              </div>
            ))}
          </div>
        )}

        {tab === "freshness" && (
          <div className="space-y-3">
            {data.freshness.map((f) => (
              <div key={f.label} className="space-y-1.5">
                <div className="flex justify-between text-sm"><span className="text-slate-600">{f.label}</span><span className="font-semibold tabular text-slate-800">{f.pct}%</span></div>
                <Bar value={f.count} max={Math.max(1, ...data.freshness.map((x) => x.count))} className="bg-emerald-500" />
              </div>
            ))}
          </div>
        )}

        {tab === "ranking" && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[380px] text-sm">
              <thead><tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400"><th className="px-3 py-2 font-medium">#</th><th className="px-3 py-2 font-medium">ฟาร์ม</th><th className="px-3 py-2 text-right font-medium">รอบ</th><th className="px-3 py-2 text-right font-medium">CO2e/ดอก</th></tr></thead>
              <tbody>{data.ranking.map((r, i) => (
                <tr key={r.name} className="border-b border-slate-50 last:border-0"><td className="px-3 py-2 tabular text-slate-500">{i + 1}</td><td className="px-3 py-2 text-slate-700">{r.name}</td><td className="px-3 py-2 text-right tabular">{r.rounds}</td><td className="px-3 py-2 text-right font-semibold tabular text-emerald-600">{r.avg.toFixed(3)}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
