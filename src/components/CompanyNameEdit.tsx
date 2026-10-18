"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil } from "lucide-react";
import Modal from "@/components/Modal";

// The head office renames its company (doc "Logistic", 18 Oct 2026). The new name shows in the header, on
// จัดการระบบ, on its producer links and to the farms bound to it.
export default function CompanyNameEdit({ company }: { company: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(company);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true); setErr(null);
    const r = await fetch("/api/logistic/company", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ company: name }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(d.error || "บันทึกไม่สำเร็จ"); return; }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button type="button" onClick={() => { setName(company); setErr(null); setOpen(true); }} className="inline-flex items-center gap-1 text-[13px] font-medium text-blue-700 underline-offset-2 hover:underline">
        <Pencil size={13} /> แก้ไขชื่อบริษัท
      </button>
      <Modal open={open} onClose={() => !busy && setOpen(false)} title="แก้ไขชื่อบริษัท">
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium text-slate-700">ชื่อบริษัท</span>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) save(); }} maxLength={120}
            className="w-full rounded-[8px] border border-gray-300 bg-white px-[14px] py-[10px] text-[14px] text-black outline-none focus:border-blue-500" />
        </label>
        <p className="mt-2 text-[12px] text-slate-500">ชื่อนี้แสดงที่หัวหน้าเว็บ หน้าจัดการระบบ ลิงก์ชวนผู้ผลิต และฟาร์มที่ส่งสินค้ากับบริษัท</p>
        {err ? <p role="alert" className="mt-3 rounded-[8px] bg-red-50 px-3 py-2 text-[13px] text-red-600">{err}</p> : null}
        <div className="mt-5 flex justify-end">
          <button type="button" onClick={save} disabled={busy || !name.trim()} className="inline-flex h-[38px] items-center gap-2 rounded-[8px] bg-blue-600 px-6 text-[14px] font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {busy ? <Loader2 size={15} className="animate-spin" /> : null} บันทึก
          </button>
        </div>
      </Modal>
    </>
  );
}
