import { thaiDateTime } from "@/lib/format";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PrintLog } from "@/lib/types";

const th = "px-5 py-3.5 text-center text-[13px] font-semibold text-white";

export default function KynQrLogSection({ prints }: { prints: PrintLog[] }) {
  const rows = [...prints].sort((a, b) => b.printedAt.localeCompare(a.printedAt));
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-slate-900">Shipment</h1>

      <div className="flex items-center justify-between">
        <span className="text-[13px] text-slate-500">Result {rows.length} รายการ</span>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span>1 - {Math.min(50, rows.length)} of {rows.length}</span>
          <div className="flex gap-1">
            <button className="grid size-7 place-items-center rounded-md bg-brand-purple text-white"><ChevronLeft size={14} /></button>
            <button className="grid size-7 place-items-center rounded-md bg-brand-purple text-white"><ChevronRight size={14} /></button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="bg-brand-purple-head">
              <th className={th}>SUP ID</th>
              <th className={th}>พิมพ์ QR โดย</th>
              <th className={th}>เวลาบันทึก</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={3} className="px-5 py-10 text-center text-slate-400">ยังไม่มีการพิมพ์ QR</td></tr>
            ) : rows.map((p) => (
              <tr key={p.id} className={`border-b border-slate-50 text-center last:border-0 ${p.cancelled ? "opacity-50" : ""}`}>
                <td className="px-5 py-3.5 font-mono text-xs text-slate-600">{p.supplierId}</td>
                <td className="px-5 py-3.5 text-slate-700">{p.printedBy}{p.sortingPoint ? ` - ${p.sortingPoint}` : ""}</td>
                <td className="px-5 py-3.5 text-slate-600">{thaiDateTime(p.printedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
