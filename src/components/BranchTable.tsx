"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface BranchRow {
  province: string;
  branch: string;
  rounds: number;
  flowers: number;
  transportCo2e: number;
  avgPerStem: number;
  trend: number | null; // % change vs previous period (null = ยังไม่มีฐานเปรียบเทียบ)
}

// "ข้อมูลรายสาขา" — head-office view: compare every branch, filter by สาขา / จังหวัด.
export default function BranchTable({ rows }: { rows: BranchRow[] }) {
  const [branch, setBranch] = useState("");
  const [province, setProvince] = useState("");

  const provinces = useMemo(() => Array.from(new Set(rows.map((r) => r.province).filter((p) => p && p !== "—"))), [rows]);
  const branches = useMemo(() => Array.from(new Set(rows.map((r) => r.branch))), [rows]);

  const filtered = rows.filter((r) => (!branch || r.branch === branch) && (!province || r.province === province));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:max-w-2xl">
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-slate-700">สาขา</label>
          <select value={branch} onChange={(e) => setBranch(e.target.value)} className="w-full rounded-[8px] border border-gray-300 bg-white px-[14px] py-[10px] text-[13px] text-black outline-none focus:border-blue-500">
            <option value="">เลือกสาขา</option>
            {branches.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-slate-700">จังหวัด</label>
          <select value={province} onChange={(e) => setProvince(e.target.value)} className="w-full rounded-[8px] border border-gray-300 bg-white px-[14px] py-[10px] text-[13px] text-black outline-none focus:border-blue-500">
            <option value="">เลือกจังหวัด</option>
            {provinces.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between px-5 py-4">
          <h3 className="text-base font-semibold text-slate-800">ข้อมูลรายสาขา</h3>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span>Result {filtered.length} รายการ</span>
            <div className="flex gap-1">
              <button className="grid size-6 place-items-center rounded-md bg-blue-600 text-white"><ChevronLeft size={13} /></button>
              <button className="grid size-6 place-items-center rounded-md bg-blue-600 text-white"><ChevronRight size={13} /></button>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="bg-blue-50 text-left text-slate-600">
                <th className="px-5 py-3 font-semibold">จังหวัด</th>
                <th className="px-5 py-3 font-semibold">สาขา</th>
                <th className="px-5 py-3 text-right font-semibold">จำนวนรอบการจัดส่ง</th>
                <th className="px-5 py-3 text-right font-semibold">ดอกไม้รวม</th>
                <th className="px-5 py-3 text-right font-semibold">การปล่อย CO₂e ขนส่ง</th>
                <th className="px-5 py-3 text-right font-semibold">CO₂e ขนส่งเฉลี่ย/ดอก</th>
                <th className="px-5 py-3 text-right font-semibold">แนวโน้ม</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-400">ยังไม่มีข้อมูลรายสาขา</td></tr>
              ) : (
                filtered.map((r, i) => (
                  <tr key={i} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                    <td className="px-5 py-3 text-slate-700">{r.province}</td>
                    <td className="px-5 py-3 text-slate-700">{r.branch}</td>
                    <td className="px-5 py-3 text-right tabular">{r.rounds.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right tabular">{r.flowers.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right tabular">{r.transportCo2e.toFixed(1)}</td>
                    <td className="px-5 py-3 text-right tabular">{r.avgPerStem.toFixed(4)}</td>
                    <td className="px-5 py-3 text-right tabular">
                      {r.trend == null ? (
                        <span className="text-slate-300">—</span>
                      ) : (
                        <span className={r.trend <= 0 ? "text-emerald-600" : "text-red-500"}>
                          {r.trend > 0 ? "+" : ""}{r.trend}%
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
