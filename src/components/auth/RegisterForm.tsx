"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2, MapPin, Check } from "lucide-react";
import ProduceGroupsEditor, { CertificationsEditor, emptyGroup, type ProduceGroup } from "@/components/ProduceGroupsEditor";
import type { Certification } from "@/lib/types";
import ResourceUsageFields, { emptyResourceState, resourcePayload, yieldTargets, type ResourceState } from "@/components/ResourceUsageFields";

const inputCls =
  "w-full rounded-[5px] border border-gray-300 bg-white px-[15px] py-[10px] text-[12px] text-black outline-none placeholder:text-[#bdbdbd] focus:border-brand-pink";
const labelCls = "text-[14px] text-black";
const req = <span className="text-[#ee443f]"> *</span>;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function StepBar({ step }: { step: number }) {
  return (
    <div className="flex items-center">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-1 items-center last:flex-none">
          <div
            className={`h-[14px] w-[14px] shrink-0 rounded-full ${
              i <= step ? "bg-brand-pink" : "bg-brand-pink-light"
            }`}
          />
          {i < 2 ? (
            <div className={`h-[3px] flex-1 rounded ${i < step ? "bg-brand-pink" : "bg-brand-pink-light"}`} />
          ) : null}
        </div>
      ))}
    </div>
  );
}

function Field({ label, children, note, error }: { label: React.ReactNode; children: React.ReactNode; note?: string; error?: string }) {
  return (
    <label className="block space-y-[5px]">
      <span className={labelCls}>{label}{note ? <span className="text-[#9e9e9e]"> {note}</span> : null}</span>
      {children}
      {error ? <span className="mt-1 block text-[11px] text-[#ee443f]">{error}</span> : null}
    </label>
  );
}

export default function RegisterForm() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);

  const [f, setF] = useState({
    username: "", email: "", password: "", confirmPassword: "",
    farmName: "", contactName: "", phone: "", lineId: "", address: "", gps: "", details: "",
    flowerType: "",
    fuelLitres: "", electricityKwh: "", fertilizerKg: "", agriChemicalsKg: "", waterM3: "", wasteKg: "", flowersPerMonth: "",
  });
  // ผลผลิตและพันธุ์ที่ปลูก — one group per ชนิด (ดอกไม้ / ผลไม้ / ผัก), each holding many varieties.
  const [groups, setGroups] = useState<ProduceGroup[]>([emptyGroup()]);
  const [certs, setCerts] = useState<Certification[]>([]);
  const [resUse, setResUse] = useState<ResourceState>(emptyResourceState());
  // flattened for the API (Supplier keeps a primary flowerType + a flat variety list)
  const cleanGroups = groups.map((g) => ({ ...g, type: g.type.trim(), varieties: g.varieties.map((v) => v.trim()).filter(Boolean) })).filter((g) => g.type);
  const varieties = Array.from(new Set(cleanGroups.flatMap((g) => g.varieties)));
  // Per-field inline errors (Figma "Register - Inline Error Message" state)
  const [errs, setErrs] = useState<Partial<Record<keyof typeof f, string>>>({});
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setF({ ...f, [k]: e.target.value });
    setErrs((prev) => ({ ...prev, [k]: undefined }));
  };
  /** input class with a red border when that field failed validation */
  const ic = (k: keyof typeof f) =>
    errs[k] ? inputCls.replace("border-gray-300", "border-[#ee443f]") : inputCls;

  const pwMatch = f.password.length > 0 && f.password === f.confirmPassword;

  function useLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((p) =>
      setF((s) => ({ ...s, gps: `${p.coords.latitude.toFixed(4)}, ${p.coords.longitude.toFixed(4)}` })));
  }
  function next() {
    setError(null);
    const e: Partial<Record<keyof typeof f, string>> = {};
    if (step === 0) {
      if (!f.username.trim()) e.username = "กรุณากรอกชื่อผู้ใช้";
      if (!f.email.trim()) e.email = "กรุณากรอกอีเมล";
      else if (!EMAIL_RE.test(f.email.trim())) e.email = "รูปแบบอีเมลไม่ถูกต้อง";
      if (!f.password) e.password = "กรุณากรอกรหัสผ่าน";
      else if (f.password.length < 8) e.password = "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร";
      if (!f.confirmPassword) e.confirmPassword = "กรุณายืนยันรหัสผ่าน";
      else if (f.password !== f.confirmPassword) e.confirmPassword = "รหัสผ่านไม่ตรงกัน";
    }
    if (step === 1) {
      if (!f.farmName.trim()) e.farmName = "กรุณากรอกชื่อแหล่งผลิต";
      if (!f.contactName.trim()) e.contactName = "กรุณากรอกชื่อผู้ติดต่อ";
      if (!f.phone.trim()) e.phone = "กรุณากรอกเบอร์โทร";
      if (!f.address.trim()) e.address = "กรุณากรอกที่อยู่";
      if (!f.gps.trim()) e.gps = "กรุณาระบุพิกัด GPS";
      if (cleanGroups.length === 0) e.flowerType = "กรุณาเลือกผลผลิตที่ปลูกอย่างน้อย 1 ชนิด";
    }
    setErrs(e);
    if (Object.keys(e).length > 0) return;
    setStep((s) => s + 1);
  }

  async function submit() {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, ...resourcePayload(resUse, yieldTargets(cleanGroups)), flowerType: cleanGroups[0]?.type ?? f.flowerType, varieties, flowerTypes: cleanGroups, certifications: certs }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "สมัครไม่สำเร็จ");
      router.push("/app");
      router.refresh();
    } catch (err) { setError((err as Error).message); setBusy(false); }
  }

  return (
    <div className="w-full max-w-[687px] rounded-[10px] bg-white p-[30px] shadow-xl">
      <div className="mx-auto w-full max-w-[585px] space-y-[30px]">
        <StepBar step={step} />

        {step === 0 && (
          <div className="space-y-[20px]">
            <div className="space-y-2 text-center">
              <h1 className="text-[32px] font-semibold leading-[38px] text-black">สมัครสมาชิก</h1>
              <p className="text-[12px] text-black">สวัสดี! กรอกข้อมูลของคุณเพื่อสมัครสมาชิก</p>
            </div>
            <Field label={<>ชื่อผู้ใช้{req}</>} error={errs.username}>
              <input value={f.username} onChange={set("username")} placeholder="กรอกชื่อผู้ใช้ของคุณ" className={ic("username")} />
            </Field>
            <Field label={<>อีเมล{req}</>} error={errs.email}>
              <input value={f.email} onChange={set("email")} type="email" placeholder="example@gmail.com" className={ic("email")} />
            </Field>
            <Field label={<>รหัสผ่าน{req}</>} error={errs.password}>
              <div className={"flex items-center rounded-[5px] border bg-white px-[15px] " + (errs.password ? "border-[#ee443f]" : "border-gray-300")}>
                <input value={f.password} onChange={set("password")} type={showPw ? "text" : "password"} placeholder="สร้างรหัสผ่านของคุณ" className="w-full bg-transparent py-[10px] text-[12px] outline-none" />
                <button type="button" onClick={() => setShowPw((v) => !v)} className="text-gray-500">{showPw ? <Eye size={20} /> : <EyeOff size={20} />}</button>
              </div>
            </Field>
            <Field label={<>ยืนยันรหัสผ่าน{req}</>} error={errs.confirmPassword}>
              <div className={"flex items-center rounded-[5px] border bg-white px-[15px] " + (errs.confirmPassword ? "border-[#ee443f]" : "border-gray-300")}>
                <input value={f.confirmPassword} onChange={set("confirmPassword")} type={showPw2 ? "text" : "password"} placeholder="ยืนยันรหัสผ่านของคุณ" className="w-full bg-transparent py-[10px] text-[12px] outline-none" />
                <button type="button" onClick={() => setShowPw2((v) => !v)} className="text-gray-500">{showPw2 ? <Eye size={20} /> : <EyeOff size={20} />}</button>
              </div>
              {f.confirmPassword.length > 0 && (
                <span className={`mt-1 flex items-center gap-1 text-[12px] ${pwMatch ? "text-[#40cb44]" : "text-[#9e9e9e]"}`}>
                  <Check size={16} /> {pwMatch ? "รหัสผ่านตรงกัน!" : "รหัสผ่านยังไม่ตรงกัน"}
                </span>
              )}
            </Field>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-[20px]">
            <div className="space-y-2 text-center">
              <h1 className="text-[32px] font-semibold leading-[38px] text-black">ข้อมูลผู้ผลิต</h1>
              <p className="text-[12px] text-black">กรอกข้อมูลแหล่งผลิตของคุณ</p>
            </div>
            <Field label={<>ชื่อผู้ใช้ (แหล่งผลิต){req}</>} error={errs.farmName}>
              <input value={f.farmName} onChange={set("farmName")} placeholder="เช่น ฟาร์มดอกไม้ท่าสุด" className={ic("farmName")} />
            </Field>
            <div className="grid grid-cols-2 gap-[20px]">
              <Field label={<>ชื่อผู้ติดต่อ{req}</>} error={errs.contactName}>
                <input value={f.contactName} onChange={set("contactName")} placeholder="กรอกชื่อผู้ติดต่อของคุณ" className={ic("contactName")} />
              </Field>
              <Field label={<>เบอร์โทร{req}</>} error={errs.phone}>
                <input value={f.phone} onChange={set("phone")} placeholder="0xx-xxx-xxxx" className={ic("phone")} />
              </Field>
              <Field label="Line ID">
                <input value={f.lineId} onChange={set("lineId")} placeholder="0xxxxxxx" className={inputCls} />
              </Field>
              <Field label={<>ที่อยู่{req}</>} error={errs.address}>
                <input value={f.address} onChange={set("address")} placeholder="123 ต.ท่าสุด อ.เมือง จ.เชียงราย" className={ic("address")} />
              </Field>
            </div>
            <Field label={<>พิกัด GPS{req}</>} error={errs.gps}>
              <div className="flex gap-2">
                <input value={f.gps} onChange={set("gps")} placeholder="12.2222, 13.3333" className={ic("gps")} />
                <button type="button" onClick={useLocation} className="inline-flex shrink-0 items-center gap-1.5 rounded-[5px] border border-gray-300 px-3 text-[12px] text-slate-600 hover:bg-gray-100"><MapPin size={15} /> เลือกจากแผนที่</button>
              </div>
            </Field>
            <Field label={<>รายละเอียดเพิ่มเติม{req}</>}>
              <textarea value={f.details} onChange={set("details")} rows={2} placeholder="จุดเด่น : ผลผลิตดี ดอกสวยงาม" className={inputCls} />
            </Field>
            <ProduceGroupsEditor groups={groups} onChange={setGroups} inputCls={inputCls} error={errs.flowerType} accent="pink" />
            <CertificationsEditor certs={certs} onChange={setCerts} inputCls={inputCls} accent="pink" />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-[20px]">
            <div className="space-y-2 text-center">
              <h1 className="text-[32px] font-semibold leading-[38px] text-black">ข้อมูลการใช้ทรัพยากร</h1>
              <p className="text-[12px] text-black">กรอกข้อมูลการใช้ทรัพยากรภายในพื้นที่ผลิตของคุณ</p>
            </div>
            <ResourceUsageFields value={resUse} onChange={setResUse} targets={yieldTargets(cleanGroups)} inputCls={inputCls} labelCls="mb-[5px] block text-[14px] text-black" />
            <p className="text-[10px] text-black">
              By continuing, you agree to our <span className="text-brand-pink underline">Terms</span> and <span className="text-brand-pink underline">Privacy Policy.</span>
            </p>
          </div>
        )}

        {error ? <p className="rounded-[5px] bg-brand-pink-light px-3 py-2 text-[12px] text-[#c1006e]">{error}</p> : null}

        <div className="space-y-[16px]">
          <div className="flex gap-3">
            {step > 0 && (
              <button type="button" onClick={() => { setStep((s) => s - 1); setError(null); }} className="h-[35px] flex-1 rounded-[5px] border border-gray-300 text-[14px] font-medium text-slate-700 hover:bg-gray-100">ย้อนกลับ</button>
            )}
            {step < 2 ? (
              <button type="button" onClick={next} className="flex h-[35px] flex-1 items-center justify-center rounded-[5px] bg-brand-pink text-[14px] font-medium text-white hover:opacity-90">ถัดไป</button>
            ) : (
              <button type="button" onClick={submit} disabled={busy} className="flex h-[35px] flex-1 items-center justify-center gap-2 rounded-[5px] bg-brand-pink text-[14px] font-medium text-white hover:opacity-90 disabled:opacity-60">{busy ? <Loader2 size={16} className="animate-spin" /> : null} สมัครสมาชิก · รับ SUP ID</button>
            )}
          </div>
          <p className="text-center text-[10px] text-black">
            Already have an account? <Link href="/login" className="text-brand-pink underline">Login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
