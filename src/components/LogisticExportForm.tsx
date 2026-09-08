"use client";

import { useState } from "react";
import { Building2 } from "lucide-react";
import RoundForm from "@/components/RoundForm";
import type { Supplier } from "@/lib/types";

// Logistic / Exporter data-export (Figma "Logistic → data export"): the exporter logs an
// export round on behalf of a farm. Pick the farm, then the same RoundForm is used.
export default function LogisticExportForm({ suppliers }: { suppliers: Supplier[] }) {
  const [id, setId] = useState("");
  const selected = suppliers.find((s) => s.id === id) ?? null;

  return (
    <div className="max-w-3xl space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-[16px] font-semibold text-slate-900">เลือกฟาร์มที่ส่งออก</h2>
        <p className="mt-0.5 text-[12px] text-slate-400">ระบุแหล่งผลิตที่คุณกำลังบันทึกรอบส่งออกให้</p>
        <div className="mt-5 flex items-center gap-2 rounded-[8px] border border-gray-300 bg-white px-3">
          <Building2 size={16} className="text-slate-400" />
          <select value={id} onChange={(e) => setId(e.target.value)} className="w-full bg-transparent py-2.5 text-[13px] outline-none">
            <option value="">เลือกฟาร์ม / SUP ID</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.farmName} · {s.id}</option>
            ))}
          </select>
        </div>
      </section>

      {selected ? (
        <RoundForm supplier={selected} postSupplierId={selected.id} accent="blue" />
      ) : (
        <div className="grid place-items-center rounded-2xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-400">
          เลือกฟาร์มด้านบนเพื่อเริ่มกรอกข้อมูลรอบส่งออก
        </div>
      )}
    </div>
  );
}
