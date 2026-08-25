"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2, MapPin, Plus, Trash2, Check } from "lucide-react";
import { FLOWER_TYPES, variantsForType } from "@/lib/master-data";

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
  // ดอกไม้และพันธุ์ที่ปลูก — one group per flower type, each holding many varieties.
  const [groups, setGroups] = useState<{ type: string; varieties: string[] }[]>([
    { type: "", varieties: [] },
  ]);
  const setGroupType = (gi: number, type: string) =>
    setGroups((gs) => gs.map((g, i) => (i === gi ? { type, varieties: [] } : g)));
  const setVarietyAt = (gi: number, vi: number, value: string) =>
    setGroups((gs) =>
      gs.map((g, i) => {
        if (i !== gi) return g;
        const vs = [...g.varieties];
        if (vi >= vs.length) {
          if (value) vs.push(value); // picking the trailing empty select adds a row
        } else if (value) vs[vi] = value;
        else vs.splice(vi, 1);
        return { ...g, varieties: vs };
      }),
    );
  const removeVariety = (gi: number, vi: number) =>
    setGroups((gs) => gs.map((g, i) => (i === gi ? { ...g, varieties: g.varieties.filter((_, j) => j !== vi) } : g)));
  const clearGroup = (gi: number) =>
    setGroups((gs) => (gs.length > 1 ? gs.filter((_, i) => i !== gi) : [{ type: "", varieties: [] }]));
  // flattened for the API (Supplier keeps a primary flowerType + a flat variety list)
  const varieties = Array.from(new Set(groups.flatMap((g) => g.varieties).filter(Boolean)));
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
      if (!groups.some((g) => g.type.trim())) e.flowerType = "กรุณาเลือกชนิดดอกไม้อย่างน้อย 1 ชนิด";
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
        body: JSON.stringify({ ...f, flowerType: groups.find((g) => g.type)?.type ?? f.flowerType, varieties, flowerTypes: groups.filter((g) => g.type) }),
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
            <div className="space-y-[14px]">
              <p className="text-[14px] font-semibold text-black">ดอกไม้และพันธุ์ที่ปลูก</p>
              {errs.flowerType ? <p className="text-[11px] text-[#ee443f]">{errs.flowerType}</p> : null}

              {groups.map((g, gi) => (
                <div key={gi} className="space-y-[10px] border-t border-gray-200 pt-[14px]">
                  <div className="grid grid-cols-2 gap-[20px]">
                    {/* ชนิดดอกไม้ */}
                    <Field label={<>ชนิดดอกไม้{req}</>}>
                      <select
                        value={g.type}
                        onChange={(e) => setGroupType(gi, e.target.value)}
                        className={`${gi === 0 && errs.flowerType ? ic("flowerType") : inputCls} ${g.type ? "text-black" : "text-[#bdbdbd]"}`}
                      >
                        <option value="">เลือกประเภทดอกไม้</option>
                        {FLOWER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </Field>

                    {/* พันธุ์ดอกไม้ — one select per chosen variety, plus a trailing empty one */}
                    <Field label={<>พันธุ์ดอกไม้{req}</>}>
                      <div className="space-y-[10px]">
                        {[...g.varieties, ""].map((v, vi) => (
                          <div key={vi} className="flex items-center gap-2">
                            <select
                              value={v}
                              onChange={(e) => setVarietyAt(gi, vi, e.target.value)}
                              className={`${inputCls} ${v ? "text-black" : "text-[#bdbdbd]"}`}
                            >
                              <option value="">เลือกพันธุ์ดอกไม้</option>
                              {variantsForType(g.type)
                                .filter((opt) => opt === v || !g.varieties.includes(opt))
                                .map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                            <button
                              type="button"
                              onClick={() => removeVariety(gi, vi)}
                              aria-label="ลบพันธุ์"
                              className="shrink-0 text-slate-400 hover:text-[#ee443f]"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </Field>
                  </div>
                  <div className="text-right">
                    <button type="button" onClick={() => clearGroup(gi)} className="text-[12px] text-[#ee443f] underline">
                      ลบทั้งหมด
                    </button>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={() => setGroups((gs) => [...gs, { type: "", varieties: [] }])}
                className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-blue hover:underline"
              >
                <Plus size={15} /> เพิ่มชนิดดอกไม้
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-[20px]">
            <div className="space-y-2 text-center">
              <h1 className="text-[32px] font-semibold leading-[38px] text-black">ข้อมูลการใช้ทรัพยากร</h1>
              <p className="text-[12px] text-black">กรอกข้อมูลการใช้ทรัพยากรภายในพื้นที่ผลิตของคุณ</p>
            </div>
            <div className="space-y-[10px]">
              <p className="text-[14px] font-semibold text-black">ข้อมูลการใช้ทรัพยากร</p>
              <hr className="border-gray-200" />
            </div>
            <div className="grid grid-cols-2 gap-[22px]">
              <Field label="ปริมาณเชื้อเพลิง (ลิตร/เดือน)"><input value={f.fuelLitres} onChange={set("fuelLitres")} type="number" placeholder="18" className={inputCls} /></Field>
              <Field label="ปริมาณไฟฟ้า (กิโลวัตต์/เดือน)"><input value={f.electricityKwh} onChange={set("electricityKwh")} type="number" placeholder="120" className={inputCls} /></Field>
              <Field label="ปริมาณปุ๋ย (กิโลกรัม/เดือน)"><input value={f.fertilizerKg} onChange={set("fertilizerKg")} type="number" placeholder="18" className={inputCls} /></Field>
              <Field label="ปริมาณสารเคมีทางการเกษตร (กิโลกรัม/เดือน)"><input value={f.agriChemicalsKg} onChange={set("agriChemicalsKg")} type="number" placeholder="120" className={inputCls} /></Field>
              <Field label="ปริมาณน้ำ (ลูกบาศก์เมตร/เดือน)"><input value={f.waterM3} onChange={set("waterM3")} type="number" placeholder="18" className={inputCls} /></Field>
              <Field label="ปริมาณของเสีย (กิโลกรัม/เดือน)"><input value={f.wasteKg} onChange={set("wasteKg")} type="number" placeholder="120" className={inputCls} /></Field>
              <Field label="จำนวนดอกไม้ที่ปลูกทั้งหมด (ดอก/เดือน)"><input value={f.flowersPerMonth} onChange={set("flowersPerMonth")} type="number" placeholder="200" className={inputCls} /></Field>
            </div>
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
