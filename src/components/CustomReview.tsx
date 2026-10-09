"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X, RotateCcw } from "lucide-react";
import type { CustomEntry } from "@/lib/types";
import { thaiDateTime } from "@/lib/format";

// รายการ "อื่นๆ (ระบุ)" — values farms / carriers typed outside the master lists. KYN confirms them
// (and gives an EF for the ones that feed the CO₂e calculation) or rejects them.
export const FIELD_LABEL: Record<string, string> = {
  fuel: "เชื้อเพลิง (ฟาร์ม)", fertilizer: "ปุ๋ย", chemical: "สารเคมีทางการเกษตร",
  packaging: "บรรจุภัณฑ์", inner: "วัสดุภายใน", grade: "เกรดคุณภาพ", destination: "จังหวัดปลายทาง",
  provider: "ผู้ให้บริการขนส่ง", branch: "สาขาต้นทาง", vehicle: "ประเภทรถ", vehicle_fuel: "เชื้อเพลิงรถขนส่ง",
  airline: "สายการบิน", airport: "ท่าอากาศยานปลายทาง", product_type: "ชนิดสินค้า",
};
/** Fields whose confirmed value is priced in CO₂e — and the EF unit KYN enters. */
const EF_UNIT: Record<string, string> = {
  fuel: "kg CO₂e / ลิตร (หรือ กก.)", fertilizer: "kg CO₂e / กก.", chemical: "kg CO₂e / กก.",
  packaging: "kg CO₂e / กก. วัสดุ", inner: "kg CO₂e / กก. วัสดุ",
};
const STATUS = { pending: ["รอตรวจสอบ", "bg-amber-50 text-amber-700"], approved: ["ยืนยันแล้ว", "bg-emerald-50 text-emerald-700"], rejected: ["ไม่ใช้", "bg-slate-100 text-slate-500"] } as const;

export default function CustomReview({ entries, farmName }: { entries: CustomEntry[]; farmName: Record<string, string> }) {
  const router = useRouter();
  const [tab, setTab] = useState<"pending" | "done">("pending");
  const [efs, setEfs] = useState<Record<string, string>>(() => Object.fromEntries(entries.map((e) => [e.id, e.ef != null ? String(e.ef) : ""])));
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const rows = useMemo(() => entries.filter((e) => (tab === "pending" ? e.status === "pending" : e.status !== "pending")), [entries, tab]);
  const pending = entries.filter((e) => e.status === "pending").length;

  async function review(e: CustomEntry, status: "approved" | "rejected" | "pending") {
    setBusy(e.id); setErr(null);
    const res = await fetch(`/api/custom-entries/${e.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, ef: efs[e.id] }) });
    if (!res.ok) setErr((await res.json().catch(() => ({}))).error ?? "บันทึกไม่สำเร็จ");
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-8 border-b border-slate-200">
        {([["pending", `รอตรวจสอบ (${pending})`], ["done", "ตรวจแล้ว"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`-mb-px border-b-2 pb-3 text-[15px] ${tab === k ? "border-brand-purple font-semibold text-brand-purple" : "border-transparent text-slate-500 hover:text-slate-700"}`}>{l}</button>
        ))}
      </div>
      {err ? <p className="rounded-[8px] bg-red-50 px-3 py-2 text-[13px] text-red-600">{err}</p> : null}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[860px] text-[13px]">
          <thead>
            <tr className="bg-brand-purple-head text-left text-white">
              <th className="px-4 py-3 font-medium">ช่อง</th>
              <th className="px-4 py-3 font-medium">ค่าที่กรอก</th>
              <th className="px-4 py-3 font-medium">จาก</th>
              <th className="px-4 py-3 text-right font-medium">ใช้</th>
              <th className="px-4 py-3 font-medium">ค่า EF</th>
              <th className="px-4 py-3 font-medium">สถานะ</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">{tab === "pending" ? "ไม่มีรายการรอตรวจสอบ" : "ยังไม่มีรายการที่ตรวจแล้ว"}</td></tr>
            ) : rows.map((e) => {
              const unit = EF_UNIT[e.field];
              const detail = e.detail ? Object.entries(e.detail).filter(([, v]) => v != null && v !== "").map(([k, v]) => `${k}: ${v}`).join(" · ") : "";
              return (
                <tr key={e.id} className="border-b border-slate-100 align-top last:border-0">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{FIELD_LABEL[e.field] ?? e.field}</td>
                  <td className="px-4 py-3"><p className="font-medium text-slate-800">{e.value}</p>{detail ? <p className="text-[11px] text-slate-400">{detail}</p> : null}</td>
                  <td className="px-4 py-3 text-slate-500"><p className="max-w-[200px] truncate" title={e.supplierId ? farmName[e.supplierId] : e.userId}>{e.supplierId ? farmName[e.supplierId] ?? e.supplierId : e.userId ?? "—"}</p><p className="whitespace-nowrap text-[11px] text-slate-400">{thaiDateTime(e.createdAt)}</p></td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">{e.uses}</td>
                  <td className="px-4 py-3">
                    {unit ? (
                      <div>
                        <input type="number" min="0" step="any" value={efs[e.id] ?? ""} onChange={(ev) => setEfs((x) => ({ ...x, [e.id]: ev.target.value }))} placeholder="เว้นว่าง = ค่าประมาณ" className="w-36 rounded-[8px] border border-gray-300 px-2 py-1.5 text-[13px] outline-none focus:border-brand-purple" />
                        <p className="mt-0.5 text-[11px] text-slate-400">{unit}</p>
                      </div>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-[12px] font-medium ${STATUS[e.status][1]}`}>{STATUS[e.status][0]}</span></td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {busy === e.id ? <Loader2 size={16} className="ml-auto animate-spin text-slate-400" /> : e.status === "pending" ? (
                      <div className="flex justify-end gap-2">
                        <button onClick={() => review(e, "rejected")} className="inline-flex items-center gap-1 rounded-[8px] border border-gray-300 px-3 py-1.5 text-[12px] text-slate-600 hover:bg-gray-50"><X size={13} /> ไม่ใช้</button>
                        <button onClick={() => review(e, "approved")} className="inline-flex items-center gap-1 rounded-[8px] bg-brand-purple px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90"><Check size={13} /> ยืนยัน</button>
                      </div>
                    ) : (
                      <button onClick={() => review(e, "pending")} className="inline-flex items-center gap-1 rounded-[8px] border border-gray-300 px-3 py-1.5 text-[12px] text-slate-600 hover:bg-gray-50"><RotateCcw size={13} /> ตรวจใหม่</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[12px] text-slate-400">ค่าที่ผู้ใช้เลือก “อื่นๆ (ระบุ)” จะถูกคำนวณด้วยค่าประมาณไปก่อน · เมื่อยืนยันพร้อมใส่ค่า EF ระบบจะใช้ค่านั้นตั้งแต่การคำนวณครั้งถัดไป (กด “คำนวณใหม่ทั้งหมด” ที่หน้าค่าสัมประสิทธิ์เพื่อปรับรอบเดิม) · แหล่งอ้างอิง EF: ฐานข้อมูลฉลากคาร์บอน อบก. (thaicarbonlabel.tgo.or.th)</p>
    </div>
  );
}
