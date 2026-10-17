"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2, ChevronLeft } from "lucide-react";
import AddressFields, { EMPTY_ADDRESS, type AddressValue } from "@/components/AddressFields";
import { CARRIERS } from "@/lib/carriers";
import { PASSWORD_RULE, passwordOk, phoneOk, emailOk } from "@/lib/signup-rules";
import { parseLatLng } from "@/lib/latlng";
import { useCooldown, retryAfterOf } from "@/lib/use-cooldown";

// The two logistic sign-up forms (doc tab "Logistic", 17 Oct 2026), in two steps because they are long:
//   company — แบบที่ 1 การลงทะเบียนบริษัท (from the sign-up page, or KYN's invite link → `invite`)
//   branch  — แบบที่ 2 การลงทะเบียนสาขา (from the head office's link → `token`; the company is fixed)
type Mode = "company" | "branch";
type Errs = Record<string, string | undefined>;

const inputCls = (bad: boolean) =>
  `w-full rounded-[8px] border bg-white px-4 py-[11px] text-[14px] text-black outline-none placeholder:text-gray-400 ${bad ? "border-[#ee443f]" : "border-gray-300 focus:border-blue-600"}`;
const labelCls = "mb-1.5 block text-[14px] font-medium text-slate-800";
const req = <span className="text-[#ee443f]"> *</span>;
const STEP1 = ["company", "providerType", "phone", "taxId", "branchName", "address", "province", "district", "subdistrict", "gps"];

export default function LogisticSignupForm({ mode, company: lockedCompany, token, invite }: { mode: Mode; company?: string; token?: string; invite?: string }) {
  const router = useRouter();
  const branch = mode === "branch";
  const [step, setStep] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errs, setErrs] = useState<Errs>({});
  const [show, setShow] = useState({ pw: false, pw2: false });
  const wait = useCooldown();
  const [f, setF] = useState({ company: "", providerType: "", phone: "", taxId: "", branchName: "", username: "", email: "", password: "", confirmPassword: "", accept: false });
  const [addr, setAddr] = useState<AddressValue>(EMPTY_ADDRESS);
  const clearErr = (k: string) => setErrs((e) => ({ ...e, [k]: undefined }));
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const v = e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value;
    setF((s) => ({ ...s, [k]: v }));
    clearErr(k);
  };

  function checkStep1(): Errs {
    const e: Errs = {};
    if (!branch) {
      if (!f.company.trim()) e.company = "กรุณากรอกชื่อบริษัท";
      if (!f.providerType) e.providerType = "กรุณาเลือกประเภทผู้ให้บริการขนส่ง";
      if (f.taxId.trim() && !/^\d{13}$/.test(f.taxId.replace(/[\s-]/g, ""))) e.taxId = "เลขประจำตัวผู้เสียภาษีอากรต้องมี 13 หลัก";
    } else if (!f.branchName.trim()) e.branchName = "กรุณากรอกชื่อสาขา";
    if (!f.phone.trim()) e.phone = "กรุณากรอกหมายเลขโทรศัพท์";
    else if (!phoneOk(f.phone)) e.phone = "หมายเลขโทรศัพท์ต้องขึ้นต้นด้วย 0 และมี 9–10 หลัก";
    if (!addr.address.trim()) e.address = "กรุณากรอกที่อยู่";
    if (!addr.province) e.province = "กรุณาเลือกจังหวัด";
    if (!addr.district) e.district = "กรุณาเลือกอำเภอ/เขต";
    if (!addr.subdistrict) e.subdistrict = "กรุณาเลือกตำบล/แขวง";
    if (!addr.gps.trim()) e.gps = "กรุณาระบุพิกัดที่ตั้ง";
    else if (!parseLatLng(addr.gps)) e.gps = "รูปแบบพิกัดไม่ถูกต้อง (ละติจูด, ลองจิจูด)";
    return e;
  }
  function checkStep2(): Errs {
    const e: Errs = {};
    if (!f.username.trim()) e.username = "กรุณากรอกชื่อผู้ใช้งาน";
    if (!f.email.trim()) e.email = "กรุณากรอกอีเมล";
    else if (!emailOk(f.email.trim())) e.email = "รูปแบบอีเมลไม่ถูกต้อง";
    if (!f.password) e.password = "กรุณากำหนดรหัสผ่าน";
    else if (!passwordOk(f.password)) e.password = PASSWORD_RULE;
    if (!f.confirmPassword) e.confirmPassword = "กรุณายืนยันรหัสผ่าน";
    else if (f.password !== f.confirmPassword) e.confirmPassword = "รหัสผ่านไม่ตรงกัน";
    if (!f.accept) e.accept = "กรุณายอมรับข้อกำหนดและนโยบายคุ้มครองข้อมูลส่วนบุคคล";
    return e;
  }

  function next() {
    const e = checkStep1();
    setErrs(e);
    if (Object.keys(e).length) return;
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (step === 1) return next();
    setError(null);
    const e1 = checkStep1(), e2 = checkStep2();
    if (Object.keys(e1).length) { setErrs(e1); setStep(1); return; }
    if (Object.keys(e2).length) { setErrs(e2); return; }
    setBusy(true);
    try {
      const res = await fetch(branch ? "/api/auth/register-branch" : "/api/auth/register-logistic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, ...addr, token, invite }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 429) wait.start(retryAfterOf(res, data));
      if (!res.ok) {
        const fe: Errs = data.errors ?? {};
        setErrs(fe);
        if (Object.keys(fe).some((k) => STEP1.includes(k))) setStep(1);
        throw new Error(data.error || "ลงทะเบียนไม่สำเร็จ");
      }
      router.push(data.redirect || "/logistic");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const pw = (k: "password" | "confirmPassword", label: string, placeholder: string, showKey: "pw" | "pw2", hint?: string) => (
    <div>
      <label className={labelCls}>{label}{req}</label>
      <div className="relative">
        <input name={k} type={show[showKey] ? "text" : "password"} value={f[k]} onChange={set(k)} placeholder={placeholder} autoComplete="new-password" className={`${inputCls(!!errs[k])} pr-11`} />
        <button type="button" tabIndex={-1} aria-label={show[showKey] ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"} onClick={() => setShow((s) => ({ ...s, [showKey]: !s[showKey] }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
          {show[showKey] ? <Eye size={17} /> : <EyeOff size={17} />}
        </button>
      </div>
      {hint ? <p className="mt-1 text-[11px] text-slate-500">{hint}</p> : null}
      <E msg={errs[k]} />
    </div>
  );

  return (
    <form onSubmit={submit} noValidate className="w-full max-w-[560px] space-y-5 rounded-2xl bg-white p-6 sm:p-10 sm:shadow-[0_8px_30px_rgba(15,23,42,0.08)] sm:ring-1 sm:ring-slate-100">
      <div className="space-y-2">
        <h1 className="text-[34px] font-bold leading-tight text-slate-900">{branch ? "ลงทะเบียนสาขา" : "ลงทะเบียน"}</h1>
        <p className="text-[14px] text-slate-700">สวัสดี!<br />{branch ? "กรุณากรอกข้อมูลสาขาเพื่อลงทะเบียนใช้งาน" : "กรุณากรอกข้อมูลบริษัทเพื่อลงทะเบียนใช้งาน"}</p>
      </div>
      {branch ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-[13.5px] text-slate-800">
          <b className="font-semibold">{lockedCompany}</b> ได้เชิญท่านเข้าร่วมใช้งานในฐานะสาขา
        </div>
      ) : null}

      <ol className="flex items-center gap-2 text-[12.5px]" aria-label="ขั้นตอน">
        {[branch ? "ข้อมูลสาขา" : "ข้อมูลบริษัท", branch ? "ข้อมูลผู้ดูแลสาขา" : "ข้อมูลผู้ดูแลบัญชี"].map((t, i) => (
          <li key={t} className="flex items-center gap-2">
            {i ? <span className="h-px w-6 bg-slate-300" aria-hidden /> : null}
            <span className={`grid size-6 place-items-center rounded-full text-[12px] font-semibold ${step === i + 1 ? "bg-blue-600 text-white" : step > i + 1 ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"}`}>{i + 1}</span>
            <span className={step === i + 1 ? "font-semibold text-slate-900" : "text-slate-500"}>{t}</span>
          </li>
        ))}
      </ol>

      {step === 1 ? (
        <div className="space-y-4">
          <p className="text-[14px] font-semibold text-blue-700">{branch ? "ข้อมูลสาขา" : "ข้อมูลบริษัท"}</p>
          {branch ? (
            <>
              <div>
                <label className={labelCls}>บริษัท</label>
                <input value={lockedCompany ?? ""} readOnly tabIndex={-1} className={`${inputCls(false)} cursor-default bg-slate-100 text-slate-700`} />
              </div>
              <div>
                <label className={labelCls}>ชื่อสาขา{req}</label>
                <input name="branchName" value={f.branchName} onChange={set("branchName")} placeholder="เช่น สาขาเชียงราย" className={inputCls(!!errs.branchName)} />
                <E msg={errs.branchName} />
              </div>
              <div>
                <label className={labelCls}>หมายเลขโทรศัพท์{req}</label>
                <input name="phone" value={f.phone} onChange={set("phone")} inputMode="tel" placeholder="0XXXXXXXXX" className={inputCls(!!errs.phone)} />
                <E msg={errs.phone} />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className={labelCls}>ชื่อบริษัท{req}</label>
                <input name="company" value={f.company} onChange={set("company")} placeholder="กรุณากรอกชื่อบริษัท" className={inputCls(!!errs.company)} />
                <E msg={errs.company} />
              </div>
              <div>
                <label className={labelCls}>ประเภทผู้ให้บริการขนส่ง{req}</label>
                <select name="providerType" value={f.providerType} onChange={set("providerType")} className={`${inputCls(!!errs.providerType)} appearance-auto`}>
                  <option value="">กรุณาเลือกประเภทผู้ให้บริการขนส่ง</option>
                  {CARRIERS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
                <E msg={errs.providerType} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>หมายเลขโทรศัพท์{req}</label>
                  <input name="phone" value={f.phone} onChange={set("phone")} inputMode="tel" placeholder="0XXXXXXXXX" className={inputCls(!!errs.phone)} />
                  <E msg={errs.phone} />
                </div>
                <div>
                  <label className={labelCls}>เลขประจำตัวผู้เสียภาษีอากร</label>
                  <input name="taxId" value={f.taxId} onChange={set("taxId")} inputMode="numeric" maxLength={17} placeholder="13 หลัก" className={inputCls(!!errs.taxId)} />
                  <E msg={errs.taxId} />
                </div>
              </div>
            </>
          )}
          <AddressFields
            value={addr}
            onChange={setAddr}
            errs={errs}
            clearErr={clearErr}
            addressLabel={branch ? "ที่อยู่สาขา" : "ที่อยู่สำนักงานใหญ่"}
            gpsPlaceholder={branch ? "เช่น 19.9105, 99.8406" : "เช่น 13.7367, 100.5602"}
            gpsHint={branch ? "ใช้สำหรับคำนวณระยะทางการขนส่งของสาขา · กรอกละติจูดและลองจิจูด หรือกดปุ่มเพื่อเลือกตำแหน่งจากแผนที่" : "กรอกละติจูดและลองจิจูด หรือกดปุ่มเพื่อเลือกตำแหน่งจากแผนที่"}
            inputCls={inputCls}
            labelCls={labelCls}
            req={req}
          />
          <button type="submit" className="flex h-[48px] w-full items-center justify-center rounded-[10px] bg-blue-600 text-[15px] font-medium text-white hover:bg-blue-700">ถัดไป</button>
        </div>
      ) : (
        <div className="space-y-4">
          <button type="button" onClick={() => setStep(1)} className="inline-flex items-center gap-1 text-[13px] text-slate-500 hover:text-slate-800"><ChevronLeft size={16} /> กลับไปแก้{branch ? "ข้อมูลสาขา" : "ข้อมูลบริษัท"}</button>
          <p className="text-[14px] font-semibold text-blue-700">{branch ? "ข้อมูลผู้ดูแลสาขา" : "ข้อมูลผู้ดูแลบัญชี"}</p>
          <div>
            <label className={labelCls}>ชื่อผู้ใช้งาน{req}</label>
            <input name="username" value={f.username} onChange={set("username")} autoComplete="username" placeholder="กรุณากรอกชื่อผู้ใช้งาน" className={inputCls(!!errs.username)} />
            <E msg={errs.username} />
          </div>
          <div>
            <label className={labelCls}>อีเมล{req}</label>
            <input name="email" value={f.email} onChange={set("email")} type="email" autoComplete="email" placeholder="example@gmail.com" className={inputCls(!!errs.email)} />
            <E msg={errs.email} />
          </div>
          {pw("password", "รหัสผ่าน", "กรุณากำหนดรหัสผ่าน", "pw", PASSWORD_RULE)}
          {pw("confirmPassword", "ยืนยันรหัสผ่าน", "กรุณากรอกรหัสผ่านอีกครั้ง", "pw2")}

          <div className="space-y-1.5 rounded-xl bg-blue-50 px-4 py-3 text-[13px] leading-relaxed text-slate-700">
            {branch ? (
              <p>สาขาจะเริ่มใช้งานได้หลังจากสำนักงานใหญ่อนุมัติ ระหว่างรออนุมัติ ท่านเข้าสู่ระบบได้ แต่ยังบันทึกข้อมูลหรือสร้างลิงก์เชิญผู้ผลิตไม่ได้</p>
            ) : (
              <>
                <p>เมื่อลงทะเบียนเรียบร้อยแล้ว ระบบจะสร้างสาขาสำนักงานใหญ่ให้โดยอัตโนมัติ ท่านสามารถเพิ่มสาขาอื่นได้ที่เมนูจัดการระบบ แท็บสาขา</p>
                {invite ? null : <p>กรณีลงทะเบียนด้วยตนเอง บัญชีจะเริ่มใช้งานได้หลังจากผ่านการตรวจสอบจากผู้ดูแลระบบ</p>}
              </>
            )}
          </div>

          <label className="flex items-start gap-3 text-[13.5px] text-slate-700">
            <input type="checkbox" name="accept" checked={f.accept} onChange={set("accept")} className="mt-0.5 size-[18px] shrink-0 accent-blue-600" />
            <span>ข้าพเจ้ายอมรับ <Link href="/privacy" target="_blank" className="text-blue-600 hover:underline">ข้อกำหนดและเงื่อนไขการใช้บริการ</Link> และ <Link href="/privacy" target="_blank" className="text-blue-600 hover:underline">นโยบายคุ้มครองข้อมูลส่วนบุคคล</Link></span>
          </label>
          <E msg={errs.accept} />

          {error ? (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">
              {error}
              {wait.left > 0 ? <span className="mt-1 block font-semibold">ลองใหม่ได้ในอีก <span className="tabular-nums">{wait.label}</span> นาที</span> : null}
            </p>
          ) : null}
          <button type="submit" disabled={busy || wait.left > 0} className="flex h-[48px] w-full items-center justify-center gap-2 rounded-[10px] bg-blue-600 text-[15px] font-medium text-white hover:bg-blue-700 disabled:opacity-60">
            {busy ? <Loader2 size={17} className="animate-spin" /> : null}
            {branch ? "ลงทะเบียนสาขา" : "ลงทะเบียน"}
          </button>
        </div>
      )}
      <p className="text-center text-[13.5px] text-slate-700">มีบัญชีอยู่แล้ว? <Link href="/logistic/login" className="text-blue-600 hover:underline">เข้าสู่ระบบ</Link></p>
    </form>
  );
}

function E({ msg }: { msg?: string }) {
  return msg ? <p className="mt-1 text-[12px] text-[#ee443f]">{msg}</p> : null;
}
