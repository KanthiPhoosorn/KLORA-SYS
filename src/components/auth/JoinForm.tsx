"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";

const inputCls =
  "w-full rounded-[5px] border border-gray-300 bg-white px-[15px] py-[10px] text-[12px] text-black outline-none placeholder:text-gray-500 focus:border-brand-pink";

// Accept-invite form (from the invite email). Same compact styling as LoginForm.
export default function JoinForm({
  token, email, orgName, role,
}: {
  token: string; email: string; orgName: string; role: "org_admin" | "member";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/auth/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, username: fd.get("username"), password: fd.get("password"), confirmPassword: fd.get("confirmPassword") }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ตอบรับคำเชิญไม่สำเร็จ");
      router.push(data.redirect || "/app");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-[425px] space-y-[30px]">
      <div className="space-y-2">
        <h1 className="text-[32px] font-semibold leading-[38px] text-black">ตอบรับคำเชิญ</h1>
        <p className="text-[12px] leading-[16px] text-black">
          <b>{orgName}</b> เชิญคุณเข้าร่วมทีมในบทบาท{role === "org_admin" ? "ผู้ดูแลองค์กร" : "สมาชิก"}
          <br />
          ตั้งชื่อผู้ใช้และรหัสผ่านเพื่อเริ่มใช้งาน
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-[24px]">
        <label className="block space-y-[5px]">
          <span className="text-[12px] font-medium text-black">อีเมล</span>
          <input value={email} readOnly className={`${inputCls} bg-gray-50 text-gray-500`} />
        </label>
        <label className="block space-y-[5px]">
          <span className="text-[12px] font-medium text-black">ชื่อผู้ใช้ <span className="text-[#ee443f]">*</span></span>
          <input name="username" required autoComplete="username" placeholder="ตั้งชื่อผู้ใช้ของคุณ" className={inputCls} />
        </label>
        <label className="block space-y-[5px]">
          <span className="text-[12px] font-medium text-black">รหัสผ่าน <span className="text-[#ee443f]">*</span></span>
          <div className="flex items-center rounded-[5px] border border-gray-300 bg-white px-[15px]">
            <input name="password" type={showPw ? "text" : "password"} required minLength={8} autoComplete="new-password" placeholder="อย่างน้อย 8 ตัวอักษร" className="w-full bg-transparent py-[10px] text-[12px] text-[#616161] outline-none" />
            <button type="button" onClick={() => setShowPw((v) => !v)} className="text-gray-500" tabIndex={-1}>
              {showPw ? <Eye size={18} /> : <EyeOff size={18} />}
            </button>
          </div>
        </label>
        <label className="block space-y-[5px]">
          <span className="text-[12px] font-medium text-black">ยืนยันรหัสผ่าน <span className="text-[#ee443f]">*</span></span>
          <input name="confirmPassword" type={showPw ? "text" : "password"} required minLength={8} autoComplete="new-password" placeholder="กรอกรหัสผ่านอีกครั้ง" className={inputCls} />
        </label>

        {error ? <p className="rounded-[5px] bg-brand-pink-light px-3 py-2 text-[12px] text-[#c1006e]">{error}</p> : null}

        <button type="submit" disabled={busy} className="flex h-[35px] w-full items-center justify-center gap-2 rounded-[5px] bg-brand-pink text-[14px] font-medium text-white transition hover:opacity-90 disabled:opacity-60">
          {busy ? <Loader2 size={16} className="animate-spin" /> : null}
          ตอบรับคำเชิญและเข้าสู่ระบบ
        </button>
      </form>
    </div>
  );
}
