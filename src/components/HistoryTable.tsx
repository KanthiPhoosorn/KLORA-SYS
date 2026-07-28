"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Badge, type Tone } from "@/components/ui";

export interface HistoryRow {
  id: string;
  dateLabel: string;
  flowerCount: number;
  destination: string;
  calcLabel: string;
  calcTone: Tone;
  shipLabel: string;
  shipTone: Tone;
}

export default function HistoryTable({ rows }: { rows: HistoryRow[] }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");

  const statuses = useMemo(
    () => Array.from(new Set(rows.map((r) => r.calcLabel))),
    [rows],
  );

  const filtered = rows.filter((r) => {
    const matchQ =
      !q ||
      r.destination.includes(q) ||
      r.dateLabel.includes(q) ||
      r.id.toLowerCase().includes(q.toLowerCase());
    const matchS = status === "all" || r.calcLabel === status;
    return matchQ && matchS;
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
          <Search size={16} className="text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหาวันที่ / ปลายทาง"
            className="w-full bg-transparent py-2 text-sm outline-none"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
        >
          <option value="all">ทุกสถานะ</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-5 py-2.5 font-medium">วันที่ตัด</th>
              <th className="px-5 py-2.5 text-right font-medium">จำนวน</th>
              <th className="px-5 py-2.5 font-medium">ปลายทาง</th>
              <th className="px-5 py-2.5 font-medium">สถานะคำนวณ</th>
              <th className="px-5 py-2.5 font-medium">สถานะขนส่ง</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                  ไม่พบรายการ
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-2.5 text-slate-700">{r.dateLabel}</td>
                  <td className="px-5 py-2.5 text-right tabular">
                    {r.flowerCount.toLocaleString()}
                  </td>
                  <td className="px-5 py-2.5 text-slate-700">{r.destination || "—"}</td>
                  <td className="px-5 py-2.5">
                    <Badge tone={r.calcTone}>{r.calcLabel}</Badge>
                  </td>
                  <td className="px-5 py-2.5">
                    <Badge tone={r.shipTone}>{r.shipLabel}</Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
