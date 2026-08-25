"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2 } from "lucide-react";

type Accent = "pink" | "blue";
const ACCENT: Record<Accent, { input: string; btn: string; check: string; link: string; err: string; borderFocus: string }> = {
  pink: {
    input: "focus:border-brand-pink",
    btn: "bg-brand-pink",
    check: "accent-brand-pink",
    link: "text-brand-pink",
    err: "bg-brand-pink-light text-[#c1006e]",
    borderFocus: "focus-within:border-brand-pink",
  },
  blue: {
    input: "focus:border-brand-blue",
    btn: "bg-brand-blue",
    check: "accent-brand-blue",
    link: "text-brand-blue",
    err: "bg-red-50 text-red-600",
    borderFocus: "focus-within:border-brand-blue",
  },
};

export default function LoginForm({
  accent = "pink",
  registerHref = "/register",
}: {
  accent?: Accent;
  registerHref?: string;
} = {}) {
  const router = useRouter();
  const ac = ACCENT[accent];
  const inputCls = `w-full rounded-[5px] border border-gray-300 bg-white px-[15px] py-[10px] text-[12px] text-black outline-none placeholder:text-gray-500 ${ac.input}`;
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: fd.get("login"), password: fd.get("password") }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "เข้าสู่ระบบไม่สำเร็จ");
      router.push(data.redirect || "/app");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-[425px]">
      <div className="space-y-[30px]">
        <div className="space-y-2">
          <h1 className="text-[32px] font-semibold leading-[38px] text-black">เข้าสู่ระบบ</h1>
          <p className="text-[12px] leading-[16px] text-black">
            สวัสดี!
            <br />
            กรุณาป้อนข้อมูลของคุณเพื่อเข้าสู่ระบบบัญชีของคุณ
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-[24px]">
          <label className="block space-y-[5px]">
            <span className="text-[12px] font-medium text-black">
              อีเมล <span className="text-[#ee443f]">*</span>
            </span>
            <input name="login" required autoComplete="username" placeholder="กรอกชื่อผู้ใช้ของคุณ" className={inputCls} />
          </label>

          <label className="block space-y-[5px]">
            <span className="text-[12px] font-medium text-black">
              รหัสผ่าน <span className="text-[#ee443f]">*</span>
            </span>
            <div className="flex items-center rounded-[5px] border border-gray-300 bg-white px-[15px]">
              <input
                name="password"
                type={showPw ? "text" : "password"}
                required
                autoComplete="current-password"
                placeholder="กรอกรหัสผ่านของคุณ"
                className="w-full bg-transparent py-[10px] text-[12px] text-[#616161] outline-none"
              />
              <button type="button" onClick={() => setShowPw((v) => !v)} className="text-gray-500" tabIndex={-1}>
                {showPw ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
            </div>
          </label>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-[10px] font-semibold text-black">
              <input type="checkbox" name="remember" className={`size-[17px] rounded-[3px] border-gray-600 ${ac.check}`} />
              จดจำฉันไว้
            </label>
            <Link href="/forgot" className="text-[10px] text-black underline">ลืมรหัสผ่าน?</Link>
          </div>

          {error ? <p className={`rounded-[5px] px-3 py-2 text-[12px] ${ac.err}`}>{error}</p> : null}

          <button
            type="submit"
            disabled={busy}
            className={`flex h-[35px] w-full items-center justify-center gap-2 rounded-[5px] ${ac.btn} text-[14px] font-medium text-white transition hover:opacity-90 disabled:opacity-60`}
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : null}
            เข้าสู่ระบบ
          </button>

          <p className="text-center text-[10px] text-black">
            ยังไม่มีบัญชี?{" "}
            <Link href={registerHref} className={`${ac.link} underline`}>สมัครสมาชิก</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
