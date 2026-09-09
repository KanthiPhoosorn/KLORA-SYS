"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, RotateCcw, Loader2, PackageX } from "lucide-react";
import { Badge, type Tone } from "@/components/ui";
import Modal from "@/components/Modal";
import { thaiDateTime, thaiDateShort } from "@/lib/format";
import { SHIP_STATUS } from "@/lib/status";
import type { Supplier, Batch, PrintLog } from "@/lib/types";

export default function StatusConsole({
  suppliers,
  batches,
  prints,
}: {
  suppliers: Supplier[];
  batches: Batch[];
  prints: PrintLog[];
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState("all");
  const [cancelBusy, setCancelBusy] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<PrintLog | null>(null);
  const supName = (id: string) => suppliers.find((s) => s.id === id)?.farmName ?? id;

  // Discard entry (Figma report #99): record ส่งต่อ / คัดทิ้ง per computed round.
  const [discardTarget, setDiscardTarget] = useState<Batch | null>(null);
  const [fwd, setFwd] = useState("");
  const [dsc, setDsc] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  function openDiscard(b: Batch) {
    setDiscardTarget(b);
    setFwd(String(b.forwardedCount ?? b.flowerCount));
    setDsc(String(b.discardedCount ?? 0));
    setSaveErr(null);
  }
  const remaining = discardTarget ? discardTarget.flowerCount - (Number(fwd) || 0) - (Number(dsc) || 0) : 0;
  async function saveDiscard() {
    if (!discardTarget) return;
    setSaveBusy(true);
    setSaveErr(null);
    const res = await fetch(`/api/batches/${discardTarget.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ forwardedCount: Number(fwd) || 0, discardedCount: Number(dsc) || 0 }),
    });
    setSaveBusy(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); setSaveErr(d.error || "บันทึกไม่สำเร็จ"); return; }
    setDiscardTarget(null);
    router.refresh();
  }

  async function cancel(id: string) {
    setCancelBusy(id);
    await fetch(`/api/prints/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cancelled: true }),
    });
    setCancelBusy(null);
    router.refresh();
  }

  const printRows = [...prints]
    .filter((p) => !q || p.supplierId.toLowerCase().includes(q.toLowerCase()) || (p.batchId ?? "").toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.printedAt.localeCompare(a.printedAt));

  const shipRows = [...batches]
    .filter((b) => b.status === "computed")
    .filter((b) => statusF === "all" || b.shipmentStatus === statusF)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">สถานะพัสดุ</h1>
        <p className="mt-0.5 text-[13px] text-slate-400">ติดตามการพิมพ์ QR และสถานะการจัดส่ง</p>
      </div>

      {/* Print records */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 rounded-[5px] border border-gray-300 bg-white px-3 sm:max-w-sm">
          <Search size={16} className="text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหา SUP ID / Batch" className="w-full bg-transparent py-2 text-[13px] outline-none" />
        </div>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="bg-blue-600 text-left font-semibold text-white">
                <th className="px-5 py-3">เวลาพิมพ์</th>
                <th className="px-5 py-3">SUP ID</th>
                <th className="px-5 py-3">Batch ID</th>
                <th className="px-5 py-3">ปลายทาง</th>
                <th className="px-5 py-3 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {printRows.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400">ยังไม่มีการพิมพ์</td></tr>
              ) : printRows.map((p) => (
                <tr key={p.id} className={`border-b border-slate-50 last:border-0 ${p.cancelled ? "opacity-50" : ""}`}>
                  <td className="px-5 py-3 text-slate-600">{thaiDateTime(p.printedAt)}</td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-600">{p.supplierId}</td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-500">{p.batchId ?? "—"}</td>
                  <td className="px-5 py-3 text-slate-700">{p.destination ?? "—"}</td>
                  <td className="px-5 py-3 text-right">
                    {p.cancelled ? <span className="text-xs text-slate-400">ยกเลิกแล้ว</span> : (
                      <button onClick={() => setCancelTarget(p)} disabled={cancelBusy === p.id} className="inline-flex items-center gap-1 text-xs font-medium text-red-500 hover:underline disabled:opacity-50">
                        {cancelBusy === p.id ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />} ยกเลิก
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Shipping history */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800">ประวัติการจัดส่ง</h2>
          <select value={statusF} onChange={(e) => setStatusF(e.target.value)} className="rounded-[5px] border border-gray-300 bg-white px-3 py-2 text-[13px] text-slate-700 outline-none">
            <option value="all">ทุกสถานะ</option>
            <option value="cutting">ตัดดอก</option>
            <option value="in_transit">กำลังขนส่ง</option>
            <option value="delivered">ถึงแล้ว</option>
          </select>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="bg-blue-600 text-left font-semibold text-white">
                <th className="px-5 py-3">วันที่จัดส่ง</th>
                <th className="px-5 py-3">วันที่ตัด</th>
                <th className="px-5 py-3">ฟาร์ม</th>
                <th className="px-5 py-3 text-right">จำนวนดอกไม้</th>
                <th className="px-5 py-3">ปลายทาง</th>
                <th className="px-5 py-3">สถานะ</th>
                <th className="px-5 py-3 text-right">คัดทิ้ง (ดอก)</th>
                <th className="px-5 py-3 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {shipRows.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-8 text-center text-slate-400">ไม่พบรายการ</td></tr>
              ) : shipRows.map((b) => (
                <tr key={b.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-3 text-slate-700">{thaiDateShort(b.entryDate)}</td>
                  <td className="px-5 py-3 text-slate-700">{thaiDateShort(b.cutDate)}</td>
                  <td className="px-5 py-3 text-slate-600">{supName(b.supplierId)}</td>
                  <td className="px-5 py-3 text-right tabular">{b.flowerCount.toLocaleString()}</td>
                  <td className="px-5 py-3 text-slate-700">{b.destination ?? "—"}</td>
                  <td className="px-5 py-3"><Badge tone={SHIP_STATUS[b.shipmentStatus].tone as Tone}>{SHIP_STATUS[b.shipmentStatus].label}</Badge></td>
                  <td className="px-5 py-3 text-right tabular">{b.discardedCount != null ? b.discardedCount.toLocaleString() : "—"}</td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => openDiscard(b)} className="inline-flex items-center gap-1 text-xs font-medium text-brand-blue hover:underline">
                      <PackageX size={13} /> บันทึกคัดทิ้ง
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Cancel-print confirm (Figma "ยกเลิกรายการนี้หรือไม่") */}
      <Modal open={!!cancelTarget} onClose={() => setCancelTarget(null)} title="ยกเลิกรายการนี้หรือไม่">
        <p className="text-[13px] text-slate-500">รายการนี้จะถูกยกเลิก และจะไม่สามารถใช้ QR เดิมได้อีก</p>
        <div className="mt-5 flex justify-end gap-3">
          <button onClick={() => setCancelTarget(null)} className="h-[38px] rounded-[8px] border border-gray-300 px-6 text-[14px] font-medium text-slate-700 hover:bg-gray-100">ยกเลิก</button>
          <button
            onClick={() => { const t = cancelTarget; setCancelTarget(null); if (t) cancel(t.id); }}
            className="inline-flex h-[38px] items-center gap-2 rounded-[8px] bg-blue-600 px-8 text-[14px] font-medium text-white hover:bg-blue-700"
          >
            ยืนยัน
          </button>
        </div>
      </Modal>

      {/* Discard entry (Figma report #99 pipeline) */}
      <Modal open={!!discardTarget} onClose={() => setDiscardTarget(null)} title="บันทึกการส่งต่อ / คัดทิ้ง">
        {discardTarget ? (
          <div className="space-y-4">
            <p className="text-[13px] text-slate-500">{discardTarget.id} · {supName(discardTarget.supplierId)}</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[12px] font-medium text-slate-600">รับเข้า (ดอก)</label>
                <input value={discardTarget.flowerCount} readOnly className="w-full rounded-[8px] border border-gray-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-500" />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-slate-600">คงเหลือ (ดอก)</label>
                <input value={Math.max(0, remaining)} readOnly className={`w-full rounded-[8px] border px-3 py-2 text-[13px] ${remaining < 0 ? "border-red-300 bg-red-50 text-red-600" : "border-gray-200 bg-slate-50 text-slate-500"}`} />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-slate-600">ส่งต่อ (ดอก)</label>
                <input type="number" min="0" value={fwd} onChange={(e) => setFwd(e.target.value)} className="w-full rounded-[8px] border border-gray-300 px-3 py-2 text-[13px] text-black outline-none focus:border-brand-blue" />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-slate-600">คัดทิ้ง (ดอก)</label>
                <input type="number" min="0" value={dsc} onChange={(e) => setDsc(e.target.value)} className="w-full rounded-[8px] border border-gray-300 px-3 py-2 text-[13px] text-black outline-none focus:border-brand-blue" />
              </div>
            </div>
            {saveErr ? <p className="rounded-[8px] bg-red-50 px-3 py-2 text-[13px] text-red-600">{saveErr}</p> : null}
            <div className="flex justify-end gap-3">
              <button onClick={() => setDiscardTarget(null)} className="h-[38px] rounded-[8px] border border-gray-300 px-6 text-[14px] font-medium text-slate-700 hover:bg-gray-100">ยกเลิก</button>
              <button onClick={saveDiscard} disabled={saveBusy || remaining < 0} className="inline-flex h-[38px] items-center gap-2 rounded-[8px] bg-blue-600 px-8 text-[14px] font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {saveBusy ? <Loader2 size={16} className="animate-spin" /> : null} บันทึก
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
