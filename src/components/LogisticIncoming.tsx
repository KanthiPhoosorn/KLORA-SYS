"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, Ban, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge, type Tone } from "@/components/ui";
import Modal from "@/components/Modal";

export interface IncomingRow {
  id: string; // batch id
  receivedDate: string; // ว/ด/ป
  farmName: string;
  supplierId: string;
  ageDays: number;
  received: number; // จำนวนดอกไม้รับเข้า
  remaining: number; // จำนวนดอกไม้คงเหลือ
  dispatched: boolean;
  printId: string | null;
}

const selCls = "rounded-[8px] border border-gray-300 bg-white px-[14px] py-[10px] text-[13px] text-slate-700 outline-none focus:border-blue-500";

// Logistic "รายการรับเข้าจากผู้ผลิต" (Figma green-state): the sorting house's view of batches
// received from farms — received vs remaining stock, with a cancel-confirm on each row.
export default function LogisticIncoming({ rows }: { rows: IncomingRow[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [age, setAge] = useState("all");
  const [cancelTarget, setCancelTarget] = useState<IncomingRow | null>(null);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (q && !r.supplierId.toLowerCase().includes(q.toLowerCase()) && !r.farmName.toLowerCase().includes(q.toLowerCase())) return false;
        if (status === "instock" && r.dispatched) return false;
        if (status === "dispatched" && !r.dispatched) return false;
        if (age === "le3" && r.ageDays > 3) return false;
        if (age === "le7" && r.ageDays > 7) return false;
        if (age === "gt7" && r.ageDays <= 7) return false;
        return true;
      }),
    [rows, q, status, age],
  );

  async function confirmCancel() {
    if (!cancelTarget) return;
    setBusy(true);
    if (cancelTarget.printId) {
      await fetch(`/api/prints/${cancelTarget.printId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cancelled: true }) });
    }
    setBusy(false);
    setCancelTarget(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-3">
        <div className="flex items-center gap-2 rounded-[8px] border border-gray-300 bg-white px-3">
          <Search size={16} className="text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหา SUP ID หรือชื่อผู้ผลิต" className="w-full bg-transparent py-2.5 text-[13px] outline-none" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={selCls}>
          <option value="all">ทุกสถานะ</option>
          <option value="instock">ในคลัง</option>
          <option value="dispatched">จัดส่งแล้ว</option>
        </select>
        <select value={age} onChange={(e) => setAge(e.target.value)} className={selCls}>
          <option value="all">อายุทุกช่วง</option>
          <option value="le3">อายุไม่เกิน 3 วัน</option>
          <option value="le7">อายุไม่เกิน 7 วัน</option>
          <option value="gt7">อายุเกิน 7 วัน</option>
        </select>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[13px] text-slate-500">Result {filtered.length} รายการ</span>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span>1 - {Math.min(50, filtered.length)} of {filtered.length}</span>
          <div className="flex gap-1">
            <button className="grid size-7 place-items-center rounded-md bg-blue-600 text-white"><ChevronLeft size={14} /></button>
            <button className="grid size-7 place-items-center rounded-md bg-blue-600 text-white"><ChevronRight size={14} /></button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="bg-blue-600 text-center font-semibold text-white">
              <th className="px-5 py-3">วันที่รับข้อมูล</th>
              <th className="px-5 py-3">Batch ID</th>
              <th className="px-5 py-3">แหล่งผลิต</th>
              <th className="px-5 py-3">อายุดอกไม้หลังตัด (วัน)</th>
              <th className="px-5 py-3">จำนวนดอกไม้รับเข้า</th>
              <th className="px-5 py-3">จำนวนดอกไม้คงเหลือ</th>
              <th className="px-5 py-3">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-400">ไม่พบรายการรับเข้า</td></tr>
            ) : filtered.map((r) => (
              <tr key={r.id} className="border-b border-slate-50 text-center last:border-0">
                <td className="px-5 py-3 text-slate-600">{r.receivedDate}</td>
                <td className="px-5 py-3 font-mono text-xs text-slate-600">{r.id}</td>
                <td className="px-5 py-3 text-slate-700">{r.farmName}</td>
                <td className="px-5 py-3 tabular">{r.ageDays}</td>
                <td className="px-5 py-3 tabular">{r.received.toLocaleString()}</td>
                <td className="px-5 py-3">
                  <span className="inline-flex items-center gap-1">
                    <Badge tone={(r.remaining === 0 ? "neutral" : r.remaining < r.received ? "amber" : "green") as Tone}>{r.remaining.toLocaleString()}</Badge>
                  </span>
                </td>
                <td className="px-5 py-3">
                  <button onClick={() => setCancelTarget(r)} className="inline-grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-red-500" title="ยกเลิกรายการ">
                    <RotateCcw size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!cancelTarget} onClose={() => setCancelTarget(null)} title="ยกเลิกรายการนี้หรือไม่">
        <p className="text-[13px] text-slate-500">
          รายการ <b>{cancelTarget?.id}</b> จะถูกยกเลิก และจะไม่สามารถใช้ QR เดิมได้อีก
          {cancelTarget && !cancelTarget.printId ? <span className="mt-1 block text-slate-400">(รายการนี้ยังไม่ได้พิมพ์ QR)</span> : null}
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <button onClick={() => setCancelTarget(null)} className="h-[38px] rounded-[8px] border border-gray-300 px-6 text-[14px] font-medium text-slate-700 hover:bg-gray-100">ยกเลิก</button>
          <button onClick={confirmCancel} disabled={busy} className="inline-flex h-[38px] items-center gap-2 rounded-[8px] bg-blue-600 px-8 text-[14px] font-medium text-white hover:bg-blue-700 disabled:opacity-60">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Ban size={15} />} ยืนยัน
          </button>
        </div>
      </Modal>
    </div>
  );
}
