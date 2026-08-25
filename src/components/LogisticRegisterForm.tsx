"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2, CheckCircle2 } from "lucide-react";
import { BRANCHES } from "@/lib/branches";

const base =
  "w-full rounded-[5px] border bg-white px-[15px] py-[10px] text-[12px] text-black outline-none placeholder:text-gray-500";
const okCls = `${base} border-gray-300 focus:border-brand-blue`;
const errCls = `${base} border-[#ee443f] focus:border-[#ee443f]`;

type FieldKey = "username" | "email" | "company" | "branch" | "password" | "confirmPassword";

export default function LogisticRegisterForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [errs, setErrs] = useState<Partial<Record<FieldKey, string>>>({});

  const [f, setF] = useState<Record<FieldKey, string>>({
    username: "",
    email: "",
    company: "",
    branch: "",
    password: "",
    confirmPassword: "",
  });
  const set = (k: FieldKey) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setF((s) => ({ ...s, [k]: e.target.value }));
    setErrs((s) => ({ ...s, [k]: undefined })); // clear this field's error as the user types
  };

  const match = f.password.length > 0 && f.password === f.confirmPassword;

  /** Per-field validation — mirrors the Figma "Inline Error Message" state. */
  function validate(): boolean {
    const next: Partial<Record<FieldKey, string>> = {};
    if (!f.username.trim()) next.username = "กรุณากรอกชื่อผู้ใช้";
    if (!f.email.trim()) next.email = "กรุณากรอกอีเมล";
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) next.email = "รูปแบบอีเมลไม่ถูกต้อง";
    if (!f.company.trim()) next.company = "กรุณากรอกชื่อบริษัท";
    if (!f.branch) next.branch = "กรุณาเลือกสาขา";
    if (!f.password) next.password = "กรุณากรอกรหัสผ่าน";
    else if (f.password.length < 8) next.password = "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร";
    if (!f.confirmPassword) next.confirmPassword = "กรุณายืนยันรหัสผ่าน";
    else if (f.password !== f.confirmPassword) next.confirmPassword = "รหัสผ่านไม่ตรงกัน";
    setErrs(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!validate()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/auth/register-logistic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(f),
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

  const Err = ({ k }: { k: FieldKey }) =>
    errs[k] ? <p className="mt-1 text-[11px] text-[#ee443f]">{errs[k]}</p> : null;

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

        <form onSubmit={onSubmit} noValidate className="space-y-[18px]">
          <label className="block space-y-[5px]">
            <span className="text-[12px] font-medium text-black">ชื่อผู้ใช้ <span className="text-[#ee443f]">*</span></span>
            <input name="username" value={f.username} onChange={set("username")} autoComplete="username" placeholder="กรอกชื่อผู้ใช้ของคุณ" className={errs.username ? errCls : okCls} />
            <Err k="username" />
          </label>

          <label className="block space-y-[5px]">
            <span className="text-[12px] font-medium text-black">อีเมล <span className="text-[#ee443f]">*</span></span>
            <input name="email" type="email" value={f.email} onChange={set("email")} autoComplete="email" placeholder="example@gmail.com" className={errs.email ? errCls : okCls} />
            <Err k="email" />
          </label>

          <label className="block space-y-[5px]">
            <span className="text-[12px] font-medium text-black">ชื่อบริษัท <span className="text-[#ee443f]">*</span></span>
            <input name="company" value={f.company} onChange={set("company")} placeholder="กรอกชื่อบริษัทของคุณ" className={errs.company ? errCls : okCls} />
            <Err k="company" />
          </label>

          <label className="block space-y-[5px]">
            <span className="text-[12px] font-medium text-black">สาขา <span className="text-[#ee443f]">*</span></span>
            <select
              name="branch"
              value={f.branch}
              onChange={set("branch")}
              className={`${errs.branch ? errCls : okCls} ${f.branch ? "text-black" : "text-gray-500"}`}
            >
              <option value="">ระบุสาขา</option>
              {BRANCHES.map((b) => (
                <option key={b.id} value={b.name}>{b.name}</option>
              ))}
            </select>
            <Err k="branch" />
          </label>

          <label className="block space-y-[5px]">
            <span className="text-[12px] font-medium text-black">รหัสผ่าน <span className="text-[#ee443f]">*</span></span>
            <div className={`flex items-center rounded-[5px] border bg-white px-[15px] ${errs.password ? "border-[#ee443f]" : "border-gray-300 focus-within:border-brand-blue"}`}>
              <input name="password" type={showPw ? "text" : "password"} value={f.password} onChange={set("password")} autoComplete="new-password" placeholder="กรอกรหัสผ่านของคุณ" className="w-full bg-transparent py-[10px] text-[12px] text-[#616161] outline-none" />
              <button type="button" onClick={() => setShowPw((v) => !v)} className="text-gray-500" tabIndex={-1}>
                {showPw ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
            </div>
            <Err k="password" />
          </label>

          <label className="block space-y-[5px]">
            <span className="text-[12px] font-medium text-black">ยืนยันรหัสผ่าน <span className="text-[#ee443f]">*</span></span>
            <div className={`flex items-center rounded-[5px] border bg-white px-[15px] ${errs.confirmPassword ? "border-[#ee443f]" : "border-gray-300 focus-within:border-brand-blue"}`}>
              <input name="confirmPassword" type={showPw2 ? "text" : "password"} value={f.confirmPassword} onChange={set("confirmPassword")} autoComplete="new-password" placeholder="ยืนยันรหัสผ่านของคุณ" className="w-full bg-transparent py-[10px] text-[12px] text-[#616161] outline-none" />
              <button type="button" onClick={() => setShowPw2((v) => !v)} className="text-gray-500" tabIndex={-1}>
                {showPw2 ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
            </div>
            <Err k="confirmPassword" />
          </label>

          {match && !errs.confirmPassword ? (
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
            มีบัญชีอยู่แล้ว?{" "}
            <Link href="/logistic/login" className="text-brand-blue underline">เข้าสู่ระบบ</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
