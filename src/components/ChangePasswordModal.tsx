"use client";

import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import Modal from "@/components/Modal";

const inputCls = "w-full rounded-[8px] border border-gray-300 bg-white px-[14px] py-[10px] text-[13px] outline-none focus:border-brand-pink";

// Figma p37: launched from the profile "รหัสผ่าน" row → modal with the 15-char / 8-char+digit rule.
export default function ChangePasswordModal() {
  const [open, setOpen] = useState(false);
  const [old, setOld] = useState("");
  const [nw, setNw] = useState("");
  const [cf, setCf] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() { setOld(""); setNw(""); setCf(""); setError(null); setOk(false); }

  async function submit() {
    setError(null);
    if (nw !== cf) return setError("รหัสผ่านใหม่และการยืนยันไม่ตรงกัน");
    if (nw.length < 8) return setError("รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword: old, newPassword: nw }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "เปลี่ยนรหัสผ่านไม่สำเร็จ");
      setOk(true); reset(); setTimeout(() => { setOk(true); }, 0);
      setTimeout(() => setOpen(false), 900);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <>
      <button onClick={() => { reset(); setOpen(true); }} className="rounded-[8px] border border-gray-300 px-5 py-2.5 text-[14px] font-medium text-slate-700 hover:bg-gray-100">
        เปลี่ยนรหัสผ่าน
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="เปลี่ยนรหัสผ่าน">
        <div className="space-y-4">
          <p className="text-[13px] leading-relaxed text-slate-500">
            ใช้รหัสผ่านที่มีความยาวอย่างน้อย 15 ตัวอักษร หรืออย่างน้อย 8 ตัวอักษรโดยมีทั้งตัวอักษรและตัวเลขประกอบกัน
          </p>
          <label className="block space-y-1.5">
            <span className="text-[13px] text-slate-600">ป้อนรหัสผ่านปัจจุบันของคุณ</span>
            <div className="flex items-center rounded-[8px] border border-gray-300 px-[14px]">
              <input value={old} onChange={(e) => setOld(e.target.value)} type={show ? "text" : "password"} placeholder="รหัสผ่านปัจจุบัน" className="w-full bg-transparent py-[10px] text-[13px] outline-none" />
              <button type="button" onClick={() => setShow((v) => !v)} className="text-gray-400">{show ? <Eye size={17} /> : <EyeOff size={17} />}</button>
            </div>
          </label>
          <label className="block space-y-1.5"><span className="text-[13px] text-slate-600">ป้อนรหัสผ่านใหม่</span><input value={nw} onChange={(e) => setNw(e.target.value)} type={show ? "text" : "password"} placeholder="รหัสผ่านใหม่" className={inputCls} /></label>
          <label className="block space-y-1.5"><span className="text-[13px] text-slate-600">ยืนยันรหัสผ่านใหม่</span><input value={cf} onChange={(e) => setCf(e.target.value)} type={show ? "text" : "password"} placeholder="ยืนยันรหัสผ่านใหม่" className={inputCls} /></label>
          {error ? <p className="rounded-[8px] bg-brand-pink-light px-3 py-2 text-[13px] text-[#c1006e]">{error}</p> : null}
          {ok ? <p className="rounded-[8px] bg-brand-green-light px-3 py-2 text-[13px] text-brand-green-dark">เปลี่ยนรหัสผ่านสำเร็จ</p> : null}
          <div className="flex justify-end gap-3 pt-1">
            <button onClick={() => setOpen(false)} className="h-[38px] rounded-[8px] border border-gray-300 px-6 text-[14px] font-medium text-slate-700 hover:bg-gray-100">ยกเลิก</button>
            <button onClick={submit} disabled={busy} className="inline-flex h-[38px] items-center gap-2 rounded-[8px] bg-brand-pink px-6 text-[14px] font-medium text-white hover:opacity-90 disabled:opacity-60">
              {busy ? <Loader2 size={16} className="animate-spin" /> : null} เปลี่ยนรหัสผ่าน
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
