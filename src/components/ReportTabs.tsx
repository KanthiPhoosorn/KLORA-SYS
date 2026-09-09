"use client";

import { useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Bar } from "@/components/ui";

export interface DiscardRow {
  provider: string; farm: string; received: number; forwarded: number;
  discarded: number; remaining: number; rate: number; wastedCo2e: number;
}
export interface ReportData {
  province: { province: string; rounds: number; flowers: number; km: number; perFlower: number }[];
  types: { type: string; flowers: number; avg: number; pct: number }[];
  freshness: { label: string; count: number; pct: number }[];
  ranking: { name: string; rounds: number; avg: number }[];
  discard: { rows: DiscardRow[]; totalReceived: number; totalDiscarded: number; totalWasted: number; avgRate: number };
}

const TABS = [
  { key: "province", label: "สถิติจังหวัดปลายทาง" },
  { key: "types", label: "สัดส่วนประเภทดอกไม้" },
  { key: "freshness", label: "การกระจายความสด" },
  { key: "ranking", label: "อันดับฟาร์มที่ปล่อยคาร์บอนต่ำสุด" },
  { key: "discard", label: "ประเภทการจัดส่ง" },
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
            <button key={t.key} onClick={() => setTab(t.key)} className={`shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-medium ${tab === t.key ? "bg-brand-purple text-white" : "text-slate-600 hover:bg-slate-100"}`}>
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
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[520px] text-sm">
                <thead><tr className="bg-brand-purple-head text-left text-xs text-white">
                  <th className="px-3 py-2.5 font-semibold">จังหวัด</th><th className="px-3 py-2.5 text-right font-semibold">รอบ</th><th className="px-3 py-2.5 text-right font-semibold">ดอกไม้</th><th className="px-3 py-2.5 text-right font-semibold">กม.เฉลี่ย</th><th className="px-3 py-2.5 text-right font-semibold">CO2e/ดอก</th>
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {data.freshness.map((f) => (
              <div key={f.label} className="rounded-xl border border-slate-200 bg-white px-5 py-6 text-center">
                <div className="text-3xl font-bold tabular text-brand-purple">{f.pct}%</div>
                <div className="mt-1 text-sm text-slate-600">{f.label}</div>
                <div className="mt-0.5 text-xs text-slate-400">{f.count.toLocaleString()} รอบ</div>
              </div>
            ))}
          </div>
        )}

        {tab === "ranking" && (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[380px] text-sm">
              <thead><tr className="bg-brand-purple-head text-left text-xs text-white"><th className="px-3 py-2.5 font-semibold">#</th><th className="px-3 py-2.5 font-semibold">ฟาร์ม</th><th className="px-3 py-2.5 text-right font-semibold">รอบ</th><th className="px-3 py-2.5 text-right font-semibold">CO2e/ดอก</th></tr></thead>
              <tbody>{data.ranking.map((r, i) => (
                <tr key={r.name} className="border-b border-slate-50 last:border-0"><td className="px-3 py-2 tabular text-slate-500">{i + 1}</td><td className="px-3 py-2 text-slate-700">{r.name}</td><td className="px-3 py-2 text-right tabular">{r.rounds}</td><td className="px-3 py-2 text-right font-semibold tabular text-emerald-600">{r.avg.toFixed(3)}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}

        {tab === "discard" && (
          data.discard.rows.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-[13px] text-slate-400">
              ยังไม่มีข้อมูลการคัดทิ้ง — บันทึกได้ที่พอร์ทัลโลจิสติกส์ (สถานะพัสดุ)
            </p>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 px-5 py-5 text-center">
                  <div className="text-3xl font-bold tabular text-brand-purple">{data.discard.avgRate.toFixed(1)}%</div>
                  <div className="mt-1 text-sm text-slate-600">อัตราคัดทิ้งเฉลี่ย</div>
                </div>
                <div className="rounded-xl border border-slate-200 px-5 py-5 text-center">
                  <div className="text-3xl font-bold tabular text-slate-800">{data.discard.totalDiscarded.toLocaleString()}</div>
                  <div className="mt-1 text-sm text-slate-600">ดอกไม้คัดทิ้ง (ดอก)</div>
                </div>
                <div className="rounded-xl border border-slate-200 px-5 py-5 text-center">
                  <div className="text-3xl font-bold tabular text-slate-800">{data.discard.totalWasted.toFixed(1)}</div>
                  <div className="mt-1 text-sm text-slate-600">CO₂e จากการสูญเสีย (kg)</div>
                </div>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="bg-brand-purple-head text-left text-xs text-white">
                      <th className="px-3 py-2.5 font-semibold">ผู้ให้บริการโลจิสติกส์</th>
                      <th className="px-3 py-2.5 font-semibold">แหล่งผลิต</th>
                      <th className="px-3 py-2.5 text-right font-semibold">รับเข้า</th>
                      <th className="px-3 py-2.5 text-right font-semibold">ส่งต่อ</th>
                      <th className="px-3 py-2.5 text-right font-semibold">คัดทิ้ง</th>
                      <th className="px-3 py-2.5 text-right font-semibold">คงเหลือ</th>
                      <th className="px-3 py-2.5 text-right font-semibold">อัตราคัดทิ้ง</th>
                      <th className="px-3 py-2.5 text-right font-semibold">CO₂e สูญเปล่า</th>
                    </tr>
                  </thead>
                  <tbody>{data.discard.rows.map((r, i) => {
                    const above = r.rate > data.discard.avgRate + 0.05;
                    const below = r.rate < data.discard.avgRate - 0.05;
                    return (
                      <tr key={i} className="border-b border-slate-50 last:border-0">
                        <td className="px-3 py-2.5 text-slate-700">{r.provider}</td>
                        <td className="px-3 py-2.5 text-slate-600">{r.farm}</td>
                        <td className="px-3 py-2.5 text-right tabular">{r.received.toLocaleString()}</td>
                        <td className="px-3 py-2.5 text-right tabular">{r.forwarded.toLocaleString()}</td>
                        <td className="px-3 py-2.5 text-right tabular font-medium text-slate-800">{r.discarded.toLocaleString()}</td>
                        <td className="px-3 py-2.5 text-right tabular text-slate-500">{r.remaining.toLocaleString()}</td>
                        <td className="px-3 py-2.5 text-right">
                          <span className={`inline-flex items-center gap-1 tabular font-medium ${above ? "text-red-500" : below ? "text-emerald-600" : "text-slate-600"}`}>
                            {above ? <TrendingUp size={13} /> : below ? <TrendingDown size={13} /> : null}{r.rate.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular text-slate-700">{r.wastedCo2e.toFixed(2)}</td>
                      </tr>
                    );
                  })}</tbody>
                </table>
              </div>
              <p className="text-[11px] text-slate-400">อัตราคัดทิ้ง = คัดทิ้ง ÷ รับเข้า · ↑/↓ เทียบค่าเฉลี่ยรวม {data.discard.avgRate.toFixed(1)}% · CO₂e สูญเปล่า = ดอกคัดทิ้ง × CO₂e/ดอก (เฉพาะรอบที่คำนวณแล้ว)</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
