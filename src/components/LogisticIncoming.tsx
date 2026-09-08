"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, Ban, Pencil, ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui";
import Modal from "@/components/Modal";

export interface IncomingRow {
  id: string; // batch id
  receivedDate: string; // display วว/ดด/ปปปป
  receivedIso: string; // raw yyyy-mm-dd for the time-range filter
  farmName: string;
  supplierId: string;
  ageDays: number;
  received: number;
  remaining: number;
  printId: string | null;
}

const inputCls = "w-full rounded-[8px] border border-gray-300 bg-white px-[14px] py-[10px] text-[13px] text-slate-700 outline-none focus:border-blue-500";
const labelCls = "mb-1.5 block text-[13px] font-medium text-slate-700";

// Logistic "รายการรับเข้าจากผู้ผลิต" — Figma high-fi: lavender table header, plain คงเหลือ,
// per-row pencil that opens a cancel-confirm.
export default function LogisticIncoming({ rows }: { rows: IncomingRow[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [range, setRange] = useState("all");
  const [target, setTarget] = useState<IncomingRow | null>(null);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const now = Date.now();
    const days = range === "7" ? 7 : range === "30" ? 30 : range === "90" ? 90 : null;
    return rows.filter((r) => {
      if (q && !r.supplierId.toLowerCase().includes(q.toLowerCase()) && !r.farmName.toLowerCase().includes(q.toLowerCase())) return false;
      if (status === "instock" && r.remaining === 0) return false;
      if (status === "dispatched" && r.remaining > 0) return false;
      if (days && r.receivedIso) {
        const t = new Date(r.receivedIso + "T00:00:00").getTime();
        if (Number.isFinite(t) && (now - t) / 86400000 > days) return false;
      }
      return true;
    });
  }, [rows, q, status, range]);

  async function confirmCancel() {
    if (!target) return;
    setBusy(true);
    if (target.printId) {
      await fetch(`/api/prints/${target.printId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cancelled: true }) });
    }
    setBusy(false);
    setTarget(null);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {/* Filters */}
      <Card className="p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={labelCls}>ค้นหา SUP ID หรือชื่อแหล่งผลิต</label>
            <div className="flex items-center gap-2 rounded-[8px] border border-gray-300 bg-white px-3">
              <Search size={16} className="text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="กรอก SUP ID ที่ต้องการค้นหา" className="w-full bg-transparent py-2.5 text-[13px] outline-none" />
            </div>
          </div>
          <div>
            <label className={labelCls}>สถานะ</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
              <option value="all">ทุกสถานะ</option>
              <option value="instock">ในคลัง</option>
              <option value="dispatched">จัดส่งแล้ว</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>ช่วงเวลา</label>
            <select value={range} onChange={(e) => setRange(e.target.value)} className={inputCls}>
              <option value="all">ทั้งหมด</option>
              <option value="7">ช่วงเวลา 7 วัน</option>
              <option value="30">ช่วงเวลา 30 วัน</option>
              <option value="90">ช่วงเวลา 90 วัน</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="p-6">
        <h2 className="text-xl font-bold text-slate-900">รายการรับเข้าจากผู้ผลิต</h2>
        <div className="mt-4 flex items-center justify-between">
          <span className="text-[13px] text-slate-500">Result {filtered.length} รายการ</span>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span>1 - {Math.min(50, filtered.length)} of {filtered.length}</span>
            <div className="flex gap-1">
              <button className="grid size-8 place-items-center rounded-lg bg-blue-600 text-white"><ChevronLeft size={15} /></button>
              <button className="grid size-8 place-items-center rounded-lg bg-blue-600 text-white"><ChevronRight size={15} /></button>
            </div>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="bg-[#e9ebf8] text-center font-semibold text-slate-700">
                <th className="rounded-l-lg px-5 py-3.5">วันที่รับข้อมูล</th>
                <th className="px-5 py-3.5">Batch ID</th>
                <th className="px-5 py-3.5">แหล่งผลิต</th>
                <th className="px-5 py-3.5">อายุดอกไม้หลังตัด (วัน)</th>
                <th className="px-5 py-3.5">จำนวนดอกไม้รับเข้า</th>
                <th className="px-5 py-3.5">จำนวนดอกไม้คงเหลือ</th>
                <th className="rounded-r-lg px-5 py-3.5">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-400">ไม่พบรายการรับเข้า</td></tr>
              ) : filtered.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 text-center last:border-0">
                  <td className="px-5 py-4 text-slate-700">{r.receivedDate}</td>
                  <td className="px-5 py-4 text-slate-700">{r.id}</td>
                  <td className="px-5 py-4 text-slate-700">{r.farmName}</td>
                  <td className="px-5 py-4 tabular text-slate-700">{r.ageDays}</td>
                  <td className="px-5 py-4 tabular text-slate-700">{r.received.toLocaleString()}</td>
                  <td className="px-5 py-4 tabular text-slate-700">{r.remaining.toLocaleString()}</td>
                  <td className="px-5 py-4">
                    <button onClick={() => setTarget(r)} className="inline-grid size-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-blue-600" title="จัดการรายการ">
                      <Pencil size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={!!target} onClose={() => setTarget(null)} title="ยกเลิกรายการนี้หรือไม่">
        <p className="text-[13px] text-slate-500">
          รายการ <b>{target?.id}</b> จะถูกยกเลิก และจะไม่สามารถใช้ QR เดิมได้อีก
          {target && !target.printId ? <span className="mt-1 block text-slate-400">(รายการนี้ยังไม่ได้พิมพ์ QR)</span> : null}
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <button onClick={() => setTarget(null)} className="h-[38px] rounded-[8px] border border-gray-300 px-6 text-[14px] font-medium text-slate-700 hover:bg-gray-100">ยกเลิก</button>
          <button onClick={confirmCancel} disabled={busy} className="inline-flex h-[38px] items-center gap-2 rounded-[8px] bg-blue-600 px-8 text-[14px] font-medium text-white hover:bg-blue-700 disabled:opacity-60">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Ban size={15} />} ยืนยัน
          </button>
        </div>
      </Modal>
    </div>
  );
}
