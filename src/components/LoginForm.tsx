"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2 } from "lucide-react";

type Accent = "pink" | "blue" | "purple";
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
  purple: {
    input: "focus:border-brand-purple",
    btn: "bg-brand-purple",
    check: "accent-brand-purple",
    link: "text-brand-purple",
    err: "bg-brand-purple-light text-[#7c24c6]",
    borderFocus: "focus-within:border-brand-purple",
  },
};

function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" className="size-[18px]" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export default function LoginForm({
  accent = "pink",
  registerHref = "/register",
  showGoogle = false,
  size = "sm",
}: {
  accent?: Accent;
  registerHref?: string;
  showGoogle?: boolean;
  size?: "sm" | "lg";
} = {}) {
  const router = useRouter();
  const ac = ACCENT[accent];
  const lg = size === "lg";
  // KYN login (Figma #109) uses a larger, more spacious form than the compact pink/blue variants.
  const S = {
    card: lg ? "max-w-[440px]" : "max-w-[425px]",
    stack: lg ? "space-y-8" : "space-y-[30px]",
    heading: lg ? "text-[34px] leading-[42px]" : "text-[32px] leading-[38px]",
    sub: lg ? "text-[14px] leading-[22px]" : "text-[12px] leading-[16px]",
    formGap: lg ? "space-y-6" : "space-y-[24px]",
    label: lg ? "text-[14px]" : "text-[12px]",
    field: lg ? "rounded-[8px] px-4 py-3 text-[14px]" : "rounded-[5px] px-[15px] py-[10px] text-[12px]",
    fieldWrap: lg ? "rounded-[8px] px-4" : "rounded-[5px] px-[15px]",
    fieldInner: lg ? "py-3 text-[14px]" : "py-[10px] text-[12px]",
    meta: lg ? "text-[13px]" : "text-[10px]",
    btn: lg ? "h-[48px] rounded-[8px] text-[15px]" : "h-[35px] rounded-[5px] text-[14px]",
    gbtn: lg ? "h-[48px] rounded-[8px] text-[14px]" : "h-[38px] rounded-[5px] text-[13px]",
  };
  const inputCls = `w-full border border-gray-300 bg-white text-black outline-none placeholder:text-gray-500 ${S.field} ${ac.input}`;
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
    <div className={`w-full ${S.card}`}>
      <div className={S.stack}>
        <div className="space-y-2">
          <h1 className={`font-semibold text-black ${S.heading}`}>เข้าสู่ระบบ</h1>
          <p className={`text-black ${S.sub}`}>
            สวัสดี!
            <br />
            กรุณาป้อนข้อมูลของคุณเพื่อเข้าสู่ระบบบัญชีของคุณ
          </p>
        </div>

        <form onSubmit={onSubmit} className={S.formGap}>
          <label className="block space-y-[5px]">
            <span className={`font-medium text-black ${S.label}`}>
              อีเมล <span className="text-[#ee443f]">*</span>
            </span>
            <input name="login" required autoComplete="username" placeholder="กรอกชื่อผู้ใช้ของคุณ" className={inputCls} />
          </label>

          <label className="block space-y-[5px]">
            <span className={`font-medium text-black ${S.label}`}>
              รหัสผ่าน <span className="text-[#ee443f]">*</span>
            </span>
            <div className={`flex items-center border border-gray-300 bg-white ${S.fieldWrap}`}>
              <input
                name="password"
                type={showPw ? "text" : "password"}
                required
                autoComplete="current-password"
                placeholder="กรอกรหัสผ่านของคุณ"
                className={`w-full bg-transparent text-[#616161] outline-none ${S.fieldInner}`}
              />
              <button type="button" onClick={() => setShowPw((v) => !v)} className="text-gray-500" tabIndex={-1}>
                {showPw ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
            </div>
          </label>

          <div className="flex items-center justify-between">
            <label className={`flex items-center gap-2 font-semibold text-black ${S.meta}`}>
              <input type="checkbox" name="remember" className={`size-[17px] rounded-[3px] border-gray-600 ${ac.check}`} />
              จดจำฉันไว้
            </label>
            <Link href="/forgot" className={`text-black underline ${S.meta}`}>ลืมรหัสผ่าน?</Link>
          </div>

          {error ? <p className={`rounded-[5px] px-3 py-2 text-[12px] ${ac.err}`}>{error}</p> : null}

          <button
            type="submit"
            disabled={busy}
            className={`flex w-full items-center justify-center gap-2 ${S.btn} ${ac.btn} font-medium text-white transition hover:opacity-90 disabled:opacity-60`}
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : null}
            เข้าสู่ระบบ
          </button>

          {showGoogle ? (
            <>
              <div className={`flex items-center gap-3 text-gray-400 ${S.meta}`}>
                <span className="h-px flex-1 bg-gray-200" /> หรือดำเนินการต่อด้วย <span className="h-px flex-1 bg-gray-200" />
              </div>
              <button
                type="button"
                onClick={() => setError("การเข้าสู่ระบบด้วย Google ยังไม่เปิดให้บริการ")}
                className={`flex w-full items-center justify-center gap-2.5 border border-gray-300 bg-white font-medium text-slate-700 transition hover:bg-gray-50 ${S.gbtn}`}
              >
                <GoogleG /> ดำเนินการต่อด้วย Google
              </button>
            </>
          ) : null}

          <p className={`text-center text-black ${S.meta}`}>
            ยังไม่มีบัญชี?{" "}
            <Link href={registerHref} className={`${ac.link} underline`}>สมัครสมาชิก</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
