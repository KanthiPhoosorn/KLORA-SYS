"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2, CheckCircle2 } from "lucide-react";

const inputCls =
  "w-full rounded-[5px] border border-gray-300 bg-white px-[15px] py-[10px] text-[12px] text-black outline-none placeholder:text-gray-500 focus:border-brand-blue";

export default function LogisticRegisterForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const match = pw.length > 0 && pw === pw2;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/auth/register-logistic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: fd.get("username"),
          email: fd.get("email"),
          company: fd.get("company"),
          branch: fd.get("branch"),
          password: fd.get("password"),
          confirmPassword: fd.get("confirmPassword"),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ลงทะเบียนไม่สำเร็จ");
      router.push(data.redirect || "/logistic");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-[425px]">
      <div className="space-y-[24px]">
        <div className="space-y-2">
          <h1 className="text-[32px] font-semibold leading-[38px] text-black">ลงทะเบียน</h1>
          <p className="text-[12px] leading-[16px] text-black">
            สวัสดี!
            <br />
            กรอกข้อมูลของคุณเพื่อลงทะเบียน
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-[18px]">
          <label className="block space-y-[5px]">
            <span className="text-[12px] font-medium text-black">ชื่อผู้ใช้ <span className="text-[#ee443f]">*</span></span>
            <input name="username" required autoComplete="username" placeholder="กรอกชื่อผู้ใช้ของคุณ" className={inputCls} />
          </label>

          <label className="block space-y-[5px]">
            <span className="text-[12px] font-medium text-black">อีเมล <span className="text-[#ee443f]">*</span></span>
            <input name="email" type="email" required autoComplete="email" placeholder="example@gmail.com" className={inputCls} />
          </label>

          <label className="block space-y-[5px]">
            <span className="text-[12px] font-medium text-black">ชื่อบริษัท <span className="text-[#ee443f]">*</span></span>
            <input name="company" required placeholder="กรอกชื่อบริษัทของคุณ" className={inputCls} />
          </label>

          <label className="block space-y-[5px]">
            <span className="text-[12px] font-medium text-black">สาขา <span className="text-[#ee443f]">*</span></span>
            <input name="branch" required placeholder="กรอกสาขาของคุณ" className={inputCls} />
          </label>

          <label className="block space-y-[5px]">
            <span className="text-[12px] font-medium text-black">รหัสผ่าน <span className="text-[#ee443f]">*</span></span>
            <div className="flex items-center rounded-[5px] border border-gray-300 bg-white px-[15px] focus-within:border-brand-blue">
              <input
                name="password"
                type={showPw ? "text" : "password"}
                required
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                autoComplete="new-password"
                placeholder="●●●●●●●●"
                className="w-full bg-transparent py-[10px] text-[12px] text-[#616161] outline-none"
              />
              <button type="button" onClick={() => setShowPw((v) => !v)} className="text-gray-500" tabIndex={-1}>
                {showPw ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
            </div>
          </label>

          <label className="block space-y-[5px]">
            <span className="text-[12px] font-medium text-black">ยืนยันรหัสผ่าน <span className="text-[#ee443f]">*</span></span>
            <div className="flex items-center rounded-[5px] border border-gray-300 bg-white px-[15px] focus-within:border-brand-blue">
              <input
                name="confirmPassword"
                type={showPw2 ? "text" : "password"}
                required
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                autoComplete="new-password"
                placeholder="●●●●●●●●"
                className="w-full bg-transparent py-[10px] text-[12px] text-[#616161] outline-none"
              />
              <button type="button" onClick={() => setShowPw2((v) => !v)} className="text-gray-500" tabIndex={-1}>
                {showPw2 ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
            </div>
          </label>

          {match ? (
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-brand-green">
              <CheckCircle2 size={14} /> รหัสผ่านตรงกัน!
            </p>
          ) : null}

          {error ? <p className="rounded-[5px] bg-red-50 px-3 py-2 text-[12px] text-red-600">{error}</p> : null}

          <button
            type="submit"
            disabled={busy}
            className="flex h-[35px] w-full items-center justify-center gap-2 rounded-[5px] bg-brand-blue text-[14px] font-medium text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : null}
            ลงทะเบียน
          </button>

          <p className="text-center text-[11px] text-black">
            Already have an account?{" "}
            <Link href="/logistic/login" className="text-brand-blue underline">Login</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
