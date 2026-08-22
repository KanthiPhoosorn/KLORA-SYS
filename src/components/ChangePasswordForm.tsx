"use client";

import { useState } from "react";
import { Eye, EyeOff, Loader2, Check } from "lucide-react";

const inputCls = "w-full rounded-[5px] border border-gray-300 bg-white px-[15px] py-[9px] text-[13px] outline-none focus:border-brand-pink";

export default function ChangePasswordForm() {
  const [old, setOld] = useState("");
  const [nw, setNw] = useState("");
  const [cf, setCf] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setDone(false);
    if (nw !== cf) return setError("รหัสผ่านใหม่และการยืนยันไม่ตรงกัน");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword: old, newPassword: nw }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "เปลี่ยนรหัสผ่านไม่สำเร็จ");
      setDone(true); setOld(""); setNw(""); setCf("");
    } catch (e2) { setError((e2 as Error).message); } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="max-w-md space-y-4">
      <label className="block space-y-1">
        <span className="text-[13px] text-slate-600">รหัสผ่านเดิม</span>
        <div className="flex items-center rounded-[5px] border border-gray-300 px-[15px]">
          <input value={old} onChange={(e) => setOld(e.target.value)} type={show ? "text" : "password"} required className="w-full bg-transparent py-[9px] text-[13px] outline-none" />
          <button type="button" onClick={() => setShow((v) => !v)} className="text-gray-500">{show ? <Eye size={18} /> : <EyeOff size={18} />}</button>
        </div>
      </label>
      <label className="block space-y-1"><span className="text-[13px] text-slate-600">รหัสผ่านใหม่</span><input value={nw} onChange={(e) => setNw(e.target.value)} type={show ? "text" : "password"} required className={inputCls} /></label>
      <label className="block space-y-1"><span className="text-[13px] text-slate-600">ยืนยันรหัสผ่านใหม่</span><input value={cf} onChange={(e) => setCf(e.target.value)} type={show ? "text" : "password"} required className={inputCls} /></label>
      {error ? <p className="rounded-[5px] bg-brand-pink-light px-3 py-2 text-[13px] text-[#c1006e]">{error}</p> : null}
      {done ? <p className="rounded-[5px] bg-brand-green-light px-3 py-2 text-[13px] text-brand-green-dark">เปลี่ยนรหัสผ่านสำเร็จ</p> : null}
      <button type="submit" disabled={busy} className="inline-flex h-[38px] items-center gap-2 rounded-[5px] bg-brand-pink px-6 text-[14px] font-medium text-white hover:opacity-90 disabled:opacity-60">
        {busy ? <Loader2 size={16} className="animate-spin" /> : done ? <Check size={16} /> : null} เปลี่ยนรหัสผ่าน
      </button>
    </form>
  );
}
