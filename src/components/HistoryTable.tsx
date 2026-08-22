"use client";

import { useMemo, useState } from "react";
import { Badge, type Tone } from "@/components/ui";

export interface HistoryRow {
  id: string;
  shipDate: string;
  cutDate: string;
  flowerCount: number;
  destination: string;
  statusLabel: string;
  statusTone: Tone;
}

const selCls = "rounded-[5px] border border-gray-300 bg-white px-3 py-2 text-[13px] text-slate-700 outline-none focus:border-brand-pink";

export default function HistoryTable({ rows }: { rows: HistoryRow[] }) {
  const [dest, setDest] = useState("all");
  const [status, setStatus] = useState("all");
  const [cut, setCut] = useState("");

  const dests = useMemo(() => Array.from(new Set(rows.map((r) => r.destination).filter(Boolean))), [rows]);
  const statuses = useMemo(() => Array.from(new Set(rows.map((r) => r.statusLabel))), [rows]);

  const filtered = rows.filter(
    (r) =>
      (dest === "all" || r.destination === dest) &&
      (status === "all" || r.statusLabel === status) &&
      (!cut || r.cutDate.includes(cut)),
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1">
          <span className="text-[12px] text-slate-500">วันที่ตัดดอกไม้</span>
          <input value={cut} onChange={(e) => setCut(e.target.value)} placeholder="วว/ดด/ปปปป" className={`${selCls} w-full`} />
        </label>
        <label className="space-y-1">
          <span className="text-[12px] text-slate-500">ปลายทาง</span>
          <select value={dest} onChange={(e) => setDest(e.target.value)} className={`${selCls} w-full`}>
            <option value="all">เลือกจังหวัดปลายทาง</option>
            {dests.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-[12px] text-slate-500">สถานะ</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${selCls} w-full`}>
            <option value="all">ทั้งหมด</option>
            {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <div className="flex items-end text-[12px] text-slate-400">Result {filtered.length} รายการ</div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-5 py-3 font-medium">วันที่ส่ง</th>
              <th className="px-5 py-3 font-medium">วันที่ตัด</th>
              <th className="px-5 py-3 text-right font-medium">จำนวน</th>
              <th className="px-5 py-3 font-medium">ปลายทาง</th>
              <th className="px-5 py-3 font-medium">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400">ไม่พบรายการ</td></tr>
            ) : filtered.map((r) => (
              <tr key={r.id} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-3 text-slate-700">{r.shipDate}</td>
                <td className="px-5 py-3 text-slate-700">{r.cutDate}</td>
                <td className="px-5 py-3 text-right tabular">{r.flowerCount.toLocaleString()}</td>
                <td className="px-5 py-3 text-slate-700">{r.destination || "—"}</td>
                <td className="px-5 py-3"><Badge tone={r.statusTone}>{r.statusLabel}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
