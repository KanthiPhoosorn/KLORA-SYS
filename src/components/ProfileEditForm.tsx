"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

const ACCENT = {
  pink: { btn: "bg-brand-pink", focus: "focus:border-brand-pink" },
  purple: { btn: "bg-brand-purple", focus: "focus:border-brand-purple" },
  blue: { btn: "bg-brand-blue", focus: "focus:border-brand-blue" },
};

// Editable ชื่อผู้ใช้ / อีเมล / เบอร์โทร (PATCH /api/profile). The email is also what
// "Sign in with Google" matches against, so users must be able to change it themselves.
export default function ProfileEditForm({
  initial, accent = "pink",
}: {
  initial: { username: string; email: string; phone?: string };
  accent?: keyof typeof ACCENT;
}) {
  const router = useRouter();
  const ac = ACCENT[accent];
  const [username, setUsername] = useState(initial.username);
  const [email, setEmail] = useState(initial.email);
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const inputCls = `w-full rounded-[8px] border border-slate-200 bg-slate-50 px-4 py-2.5 text-[14px] text-slate-800 outline-none focus:bg-white ${ac.focus}`;
  const dirty = username !== initial.username || email !== initial.email || phone !== (initial.phone ?? "");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, email, phone }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      setMsg({ ok: true, text: "บันทึกโปรไฟล์แล้ว" });
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium text-slate-600">ชื่อผู้ใช้</span>
          <input value={username} onChange={(e) => setUsername(e.target.value)} required className={inputCls} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium text-slate-600">เบอร์โทร</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08x-xxx-xxxx" className={inputCls} />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-[13px] font-medium text-slate-600">อีเมล <span className="font-normal text-slate-400">(ใช้เข้าสู่ระบบ / รับ OTP / จับคู่กับ Google)</span></span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputCls} />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy || !dirty} className={`flex h-10 items-center gap-2 rounded-[8px] px-5 text-[14px] font-medium text-white transition hover:opacity-90 disabled:opacity-50 ${ac.btn}`}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : null} บันทึก
        </button>
        {msg ? <span className={`text-[13px] ${msg.ok ? "text-emerald-600" : "text-rose-600"}`}>{msg.text}</span> : null}
      </div>
    </form>
  );
}
