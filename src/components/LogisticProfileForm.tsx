"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { User, Loader2, CheckCircle2, Eye, EyeOff } from "lucide-react";
import Modal from "@/components/Modal";

const inputCls =
  "w-full rounded-[8px] border border-slate-200 bg-slate-50 px-4 py-2.5 text-[14px] text-slate-800 outline-none focus:border-blue-500 focus:bg-white";
const labelCls = "mb-1.5 block text-[13px] font-medium text-slate-600";

export default function LogisticProfileForm({
  initial,
}: {
  initial: { username: string; email: string; phone: string };
}) {
  const router = useRouter();
  const [username, setUsername] = useState(initial.username);
  const [phone, setPhone] = useState(initial.phone);
  const [email, setEmail] = useState(initial.email);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileErr, setProfileErr] = useState<string | null>(null);
  const [toast, setToast] = useState<{ title: string; sub?: string } | null>(null);

  // change-password modal
  const [pwOpen, setPwOpen] = useState(false);
  const [old, setOld] = useState("");
  const [nw, setNw] = useState("");
  const [cf, setCf] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);
  const [pwErr, setPwErr] = useState<string | null>(null);

  function showToast(title: string, sub?: string) {
    setToast({ title, sub });
    setTimeout(() => setToast(null), 3000);
  }

  function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 1024 * 1024) { setProfileErr("รูปโปรไฟล์ต้องมีขนาดไม่เกิน 1MB"); return; }
    setProfileErr(null);
    const reader = new FileReader();
    reader.onload = () => setAvatar(String(reader.result));
    reader.readAsDataURL(f);
  }

  async function saveProfile() {
    setProfileErr(null);
    setSavingProfile(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      showToast("บันทึกโปรไฟล์สำเร็จ", "ข้อมูลของคุณถูกอัปเดตแล้ว");
      router.refresh();
    } catch (e) {
      setProfileErr((e as Error).message);
    } finally {
      setSavingProfile(false);
    }
  }

  function resetProfile() {
    setUsername(initial.username);
    setPhone(initial.phone);
    setEmail(initial.email);
    setAvatar(null);
    setProfileErr(null);
  }

  async function changePw() {
    setPwErr(null);
    if (nw !== cf) return setPwErr("รหัสผ่านใหม่และการยืนยันไม่ตรงกัน");
    if (nw.length < 8) return setPwErr("รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัวอักษร");
    setPwBusy(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword: old, newPassword: nw }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "เปลี่ยนรหัสผ่านไม่สำเร็จ");
      setPwOpen(false);
      setOld(""); setNw(""); setCf("");
      showToast("เปลี่ยนรหัสผ่านสำเร็จ", "รหัสผ่านใหม่ของคุณพร้อมใช้งานแล้ว");
    } catch (e) {
      setPwErr((e as Error).message);
    } finally {
      setPwBusy(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      {toast ? (
        <div className="fixed right-6 top-6 z-50 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-lg">
          <CheckCircle2 size={20} className="mt-0.5 text-emerald-500" />
          <div>
            <p className="text-[13px] font-semibold text-emerald-800">{toast.title}</p>
            {toast.sub ? <p className="text-[12px] text-emerald-600">{toast.sub}</p> : null}
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">โปรไฟล์ผู้ใช้</h1>
        <hr className="my-5 border-slate-100" />

        {/* avatar */}
        <div className="flex items-center gap-5">
          <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full bg-blue-600 text-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {avatar ? <img src={avatar} alt="" className="size-full object-cover" /> : <User size={30} />}
          </span>
          <div>
            <label className="inline-flex cursor-pointer items-center rounded-[8px] border border-slate-300 px-4 py-1.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50">
              เลือก
              <input type="file" accept="image/png,image/jpeg" onChange={onPickAvatar} className="hidden" />
            </label>
            <p className="mt-1 text-[12px] text-slate-400">JPG or PNG. 1MB Max</p>
          </div>
        </div>

        {/* fields */}
        <div className="mt-6 space-y-4">
          <div><label className={labelCls}>ชื่อผู้ใช้</label><input value={username} onChange={(e) => setUsername(e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>เบอร์โทร</label><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="099-999-9999" className={inputCls} /></div>
          <div><label className={labelCls}>Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} /></div>

          <div className="flex items-end justify-between gap-4 pt-1">
            <div>
              <label className={labelCls}>รหัสผ่าน</label>
              <p className="text-[12px] text-slate-400">เปลี่ยนรหัสผ่านสำหรับการเข้าสู่ระบบ</p>
            </div>
            <button onClick={() => setPwOpen(true)} className="shrink-0 rounded-[8px] border border-slate-300 px-4 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50">
              เปลี่ยนรหัสผ่าน
            </button>
          </div>
        </div>

        {profileErr ? <p className="mt-4 rounded-[8px] bg-red-50 px-3 py-2 text-[13px] text-red-600">{profileErr}</p> : null}

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={resetProfile} className="rounded-[8px] border border-slate-300 px-8 py-2 text-[14px] font-medium text-slate-700 hover:bg-slate-50">ยกเลิก</button>
          <button onClick={saveProfile} disabled={savingProfile} className="inline-flex items-center gap-2 rounded-[8px] bg-blue-600 px-10 py-2 text-[14px] font-medium text-white hover:bg-blue-700 disabled:opacity-60">
            {savingProfile ? <Loader2 size={16} className="animate-spin" /> : null} บันทึก
          </button>
        </div>
      </div>

      <Modal open={pwOpen} onClose={() => setPwOpen(false)} title="เปลี่ยนรหัสผ่าน">
        <p className="text-[13px] text-slate-500">
          ใช้รหัสผ่านที่มีความยาวอย่างน้อย 15 ตัวอักษร หรืออย่างน้อย 8 ตัวอักษรโดยมีทั้งตัวอักษรและตัวเลขประกอบกัน
        </p>
        <div className="mt-4 space-y-4">
          <div>
            <label className={labelCls}>ป้อนรหัสผ่านปัจจุบันของคุณ</label>
            <div className="flex items-center rounded-[8px] border border-slate-200 bg-slate-50 px-4 focus-within:border-blue-500">
              <input type={showPw ? "text" : "password"} value={old} onChange={(e) => setOld(e.target.value)} placeholder="รหัสผ่านปัจจุบัน" className="w-full bg-transparent py-2.5 text-[14px] text-slate-800 outline-none placeholder:text-[#bdbdbd]" />
              <button type="button" onClick={() => setShowPw((v) => !v)} className="text-slate-400">{showPw ? <Eye size={18} /> : <EyeOff size={18} />}</button>
            </div>
          </div>
          <div><label className={labelCls}>ป้อนรหัสผ่านใหม่</label><input type={showPw ? "text" : "password"} value={nw} onChange={(e) => setNw(e.target.value)} placeholder="รหัสผ่านใหม่" className={inputCls} /></div>
          <div><label className={labelCls}>ยืนยันรหัสผ่านใหม่</label><input type={showPw ? "text" : "password"} value={cf} onChange={(e) => setCf(e.target.value)} placeholder="ยืนยันรหัสผ่านใหม่" className={inputCls} /></div>
          {pwErr ? <p className="rounded-[8px] bg-red-50 px-3 py-2 text-[13px] text-red-600">{pwErr}</p> : null}
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <button onClick={() => setPwOpen(false)} disabled={pwBusy} className="rounded-[8px] border border-slate-300 px-6 py-2 text-[14px] font-medium text-slate-700 hover:bg-slate-50">ยกเลิก</button>
          <button onClick={changePw} disabled={pwBusy} className="inline-flex items-center gap-2 rounded-[8px] bg-blue-600 px-6 py-2 text-[14px] font-medium text-white hover:bg-blue-700 disabled:opacity-60">
            {pwBusy ? <Loader2 size={16} className="animate-spin" /> : null} เปลี่ยนรหัสผ่าน
          </button>
        </div>
      </Modal>
    </div>
  );
}
