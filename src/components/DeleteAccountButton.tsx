"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import Modal from "@/components/Modal";

// PDPA self-service deletion: confirm with the current password, then DELETE /api/profile.
export default function DeleteAccountButton({ isFarmOwner = false, loginHref = "/login" }: { isFarmOwner?: boolean; loginHref?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/profile", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ลบบัญชีไม่สำเร็จ");
      router.push(loginHref);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-[8px] border border-rose-200 px-4 py-2 text-[13px] font-medium text-rose-600 hover:bg-rose-50">
        <Trash2 size={15} /> ลบบัญชี
      </button>
      <Modal open={open} onClose={() => !busy && setOpen(false)} title="ลบบัญชีถาวร">
        <div className="space-y-4 text-[14px] text-slate-700">
          <p>การลบบัญชีจะลบข้อมูลเข้าสู่ระบบ อีเมล เบอร์โทร และการเป็นสมาชิกทีมของคุณทันที และไม่สามารถกู้คืนได้</p>
          {isFarmOwner ? (
            <p className="rounded-[8px] bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
              หากคุณเป็นบัญชีสุดท้ายของฟาร์ม ข้อมูลติดต่อและพิกัดของฟาร์มจะถูกลบและฟาร์มถูกระงับ ส่วนประวัติรอบส่งออกและผลคำนวณคาร์บอนจะถูกเก็บไว้แบบไม่ระบุตัวบุคคลเพื่อการตรวจสอบย้อนหลัง
            </p>
          ) : null}
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-slate-600">ยืนยันด้วยรหัสผ่านปัจจุบัน</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className="w-full rounded-[8px] border border-slate-200 px-4 py-2.5 text-[14px] outline-none focus:border-rose-400" />
          </label>
          {error ? <p className="rounded-[6px] bg-rose-50 px-3 py-2 text-[13px] text-rose-700">{error}</p> : null}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" disabled={busy} onClick={() => setOpen(false)} className="rounded-[8px] border border-slate-200 px-4 py-2 text-[13px] text-slate-600 hover:bg-slate-50">ยกเลิก</button>
            <button type="button" disabled={busy || password.length === 0} onClick={confirm} className="flex items-center gap-2 rounded-[8px] bg-rose-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-rose-700 disabled:opacity-50">
              {busy ? <Loader2 size={14} className="animate-spin" /> : null} ลบบัญชีของฉัน
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
