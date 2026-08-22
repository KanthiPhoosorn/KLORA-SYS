"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2 } from "lucide-react";

const inputCls =
  "w-full rounded-[5px] border border-gray-300 bg-white px-[15px] py-[10px] text-[12px] text-black outline-none placeholder:text-gray-500 focus:border-brand-pink";

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" />
    </svg>
  );
}

export default function LoginForm() {
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
            <input name="login" required autoComplete="username" placeholder="ABC@gmail.com" className={inputCls} />
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
                placeholder="●●●●●●●●"
                className="w-full bg-transparent py-[10px] text-[12px] text-[#616161] outline-none"
              />
              <button type="button" onClick={() => setShowPw((v) => !v)} className="text-gray-500" tabIndex={-1}>
                {showPw ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
            </div>
          </label>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-[10px] font-semibold text-black">
              <input type="checkbox" name="remember" className="size-[17px] rounded-[3px] border-gray-600 accent-brand-pink" />
              จดจำฉันไว้
            </label>
            <Link href="/forgot" className="text-[10px] text-black underline">ลืมรหัสผ่าน?</Link>
          </div>

          {error ? <p className="rounded-[5px] bg-brand-pink-light px-3 py-2 text-[12px] text-[#c1006e]">{error}</p> : null}

          <button
            type="submit"
            disabled={busy}
            className="flex h-[35px] w-full items-center justify-center gap-2 rounded-[5px] bg-brand-pink text-[14px] font-medium text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : null}
            เข้าสู่ระบบ
          </button>

          <div className="flex items-center gap-[5px]">
            <span className="h-px flex-1 bg-gray-300" />
            <span className="text-[10px] text-gray-600">หรือดำเนินการต่อด้วย</span>
            <span className="h-px flex-1 bg-gray-300" />
          </div>

          <button type="button" className="flex h-[35px] w-full items-center justify-center gap-[12px] rounded-[5px] border border-gray-300 bg-white text-[12px] text-black hover:bg-gray-100">
            <GoogleMark /> ดำเนินการต่อด้วย Google
          </button>

          <p className="text-center text-[10px] text-black">
            ยังไม่มีบัญชี?{" "}
            <Link href="/register" className="text-brand-pink underline">ลงทะเบียน</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
