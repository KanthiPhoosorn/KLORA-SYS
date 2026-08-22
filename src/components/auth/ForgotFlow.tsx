"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Eye, EyeOff, CheckCircle2 } from "lucide-react";

const inputCls =
  "w-full rounded-[5px] border border-gray-300 bg-white px-[15px] py-[10px] text-[12px] text-black outline-none placeholder:text-gray-500 focus:border-brand-pink";
const btnCls =
  "flex h-[35px] w-full items-center justify-center gap-2 rounded-[5px] bg-brand-pink text-[14px] font-medium text-white transition hover:opacity-90 disabled:opacity-60";

type Step = "email" | "otp" | "reset" | "done";

export default function ForgotFlow() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  const code = digits.join("");

  async function sendOtp(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ส่ง OTP ไม่สำเร็จ");
      setDevCode(data.devCode ?? null);
      setStep("otp");
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  function setDigit(i: number, v: string) {
    const d = v.replace(/\D/g, "").slice(-1);
    const next = [...digits]; next[i] = d; setDigits(next);
    if (d && i < 5) boxes.current[i + 1]?.focus();
  }

  async function verifyOtp(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "OTP ไม่ถูกต้อง");
      setStep("reset");
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  async function resetPw(e?: React.FormEvent) {
    e?.preventDefault();
    if (pw !== pw2) return setError("รหัสผ่านและการยืนยันไม่ตรงกัน");
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, password: pw }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ตั้งรหัสผ่านไม่สำเร็จ");
      setStep("done");
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  const Title = ({ h, sub }: { h: string; sub?: string }) => (
    <div className="space-y-[30px]">
      <div className="space-y-2">
        <h1 className="text-[32px] font-semibold leading-[38px] text-black">{h}</h1>
        {sub ? <p className="text-[12px] leading-[16px] text-black">{sub}</p> : null}
      </div>
    </div>
  );
  const Err = () => error ? <p className="rounded-[5px] bg-brand-pink-light px-3 py-2 text-[12px] text-[#c1006e]">{error}</p> : null;

  if (step === "done") {
    return (
      <div className="space-y-6 text-center">
        <CheckCircle2 className="mx-auto text-brand-green" size={56} />
        <h1 className="text-[24px] font-semibold text-black">ตั้งรหัสผ่านใหม่สำเร็จ</h1>
        <p className="text-[12px] text-gray-600">คุณสามารถเข้าสู่ระบบด้วยรหัสผ่านใหม่ได้แล้ว</p>
        <button onClick={() => { router.push("/login"); router.refresh(); }} className={btnCls}>ไปหน้าเข้าสู่ระบบ</button>
      </div>
    );
  }

  return (
    <div className="space-y-[20px]">
      {step === "email" && (
        <form onSubmit={sendOtp} className="space-y-[20px]">
          <Title h="ลืมรหัสผ่าน" sub="สวัสดี! กรุณากรอกอีเมลของคุณเพื่อรับรหัส OTP" />
          <label className="block space-y-[5px]">
            <span className="text-[12px] font-medium text-black">อีเมล <span className="text-[#ee443f]">*</span></span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="ABC@gmail.com" className={inputCls} />
          </label>
          <Err />
          <button type="submit" disabled={busy} className={btnCls}>{busy ? <Loader2 size={16} className="animate-spin" /> : null} Sent OTP</button>
          <p className="text-center text-[10px] text-black">ยังไม่มีบัญชี? <Link href="/register" className="text-brand-pink underline">สมัครสมาชิก</Link></p>
        </form>
      )}

      {step === "otp" && (
        <form onSubmit={verifyOtp} className="space-y-[20px]">
          <Title h="ยืนยันรหัส OTP" sub={`กรอกรหัส 6 หลักที่ส่งไปยัง ${email}`} />
          {devCode ? <p className="rounded-[5px] bg-brand-yellow-light px-3 py-2 text-[12px] text-[#8a6d00]">รหัสทดสอบ (อีเมลถูกจำลอง): <b>{devCode}</b></p> : null}
          <div className="flex justify-between gap-2">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => { boxes.current[i] = el; }}
                value={d}
                onChange={(e) => setDigit(i, e.target.value)}
                onKeyDown={(e) => { if (e.key === "Backspace" && !digits[i] && i > 0) boxes.current[i - 1]?.focus(); }}
                inputMode="numeric"
                className="h-[52px] w-[52px] rounded-[8px] border border-gray-300 bg-white text-center text-[20px] font-semibold text-black outline-none focus:border-brand-pink"
              />
            ))}
          </div>
          <Err />
          <button type="submit" disabled={busy || code.length < 6} className={btnCls}>{busy ? <Loader2 size={16} className="animate-spin" /> : null} ยืนยัน</button>
          <button type="button" onClick={() => sendOtp()} className="w-full text-center text-[10px] text-black underline">ส่งรหัสอีกครั้ง</button>
        </form>
      )}

      {step === "reset" && (
        <form onSubmit={resetPw} className="space-y-[20px]">
          <Title h="ตั้งรหัสผ่านใหม่" sub="กรุณาตั้งรหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)" />
          <label className="block space-y-[5px]">
            <span className="text-[12px] font-medium text-black">รหัสผ่านใหม่ <span className="text-[#ee443f]">*</span></span>
            <div className="flex items-center rounded-[5px] border border-gray-300 bg-white px-[15px]">
              <input value={pw} onChange={(e) => setPw(e.target.value)} type={showPw ? "text" : "password"} required placeholder="●●●●●●●●" className="w-full bg-transparent py-[10px] text-[12px] text-[#616161] outline-none" />
              <button type="button" onClick={() => setShowPw((v) => !v)} className="text-gray-500" tabIndex={-1}>{showPw ? <Eye size={18} /> : <EyeOff size={18} />}</button>
            </div>
          </label>
          <label className="block space-y-[5px]">
            <span className="text-[12px] font-medium text-black">ยืนยันรหัสผ่าน <span className="text-[#ee443f]">*</span></span>
            <input value={pw2} onChange={(e) => setPw2(e.target.value)} type={showPw ? "text" : "password"} required placeholder="●●●●●●●●" className={inputCls} />
          </label>
          <Err />
          <button type="submit" disabled={busy} className={btnCls}>{busy ? <Loader2 size={16} className="animate-spin" /> : null} บันทึกรหัสผ่านใหม่</button>
        </form>
      )}
    </div>
  );
}
