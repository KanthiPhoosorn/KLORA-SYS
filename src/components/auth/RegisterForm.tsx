"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2, MapPin, Plus, X, Check } from "lucide-react";

const inputCls =
  "w-full rounded-[5px] border border-gray-300 bg-white px-[15px] py-[10px] text-[12px] text-black outline-none placeholder:text-[#bdbdbd] focus:border-brand-pink";
const labelCls = "text-[14px] text-black";
const req = <span className="text-[#ee443f]"> *</span>;

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

function Field({ label, children, note }: { label: React.ReactNode; children: React.ReactNode; note?: string }) {
  return (
    <label className="block space-y-[5px]">
      <span className={labelCls}>{label}{note ? <span className="text-[#9e9e9e]"> {note}</span> : null}</span>
      {children}
    </label>
  );
}

export default function RegisterForm() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);

  const [f, setF] = useState({
    username: "", email: "", password: "", confirmPassword: "",
    farmName: "", contactName: "", phone: "", lineId: "", address: "", gps: "", details: "",
    flowerType: "",
    fuelLitres: "", electricityKwh: "", fertilizerKg: "", agriChemicalsKg: "", waterM3: "", wasteKg: "", flowersPerMonth: "",
  });
  const [varieties, setVarieties] = useState<string[]>([]);
  const [varietyDraft, setVarietyDraft] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: e.target.value });

  const pwMatch = f.password.length > 0 && f.password === f.confirmPassword;

  function useLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((p) =>
      setF((s) => ({ ...s, gps: `${p.coords.latitude.toFixed(4)}, ${p.coords.longitude.toFixed(4)}` })));
  }
  function addVariety() {
    const v = varietyDraft.trim();
    if (v && !varieties.includes(v)) setVarieties([...varieties, v]);
    setVarietyDraft("");
  }

  function next() {
    setError(null);
    if (step === 0) {
      if (!f.username || !f.email || !f.password) return setError("กรอกชื่อผู้ใช้ อีเมล และรหัสผ่าน");
      if (f.password.length < 8) return setError("รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร");
      if (f.password !== f.confirmPassword) return setError("รหัสผ่านและการยืนยันไม่ตรงกัน");
    }
    if (step === 1) {
      if (!f.farmName || !f.contactName || !f.phone || !f.address || !f.flowerType)
        return setError("กรอกข้อมูลผู้ผลิตให้ครบ");
    }
    setStep((s) => s + 1);
  }

  async function submit() {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, varieties }),
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
            <Field label={<>ชื่อผู้ใช้{req}</>}>
              <input value={f.username} onChange={set("username")} placeholder="กรอกชื่อผู้ใช้ของคุณ" className={inputCls} />
            </Field>
            <Field label={<>อีเมล{req}</>} note="(บริษัท / องค์กร — ไม่บังคับ)">
              <input value={f.email} onChange={set("email")} type="email" placeholder="example@gmail.com" className={inputCls} />
            </Field>
            <Field label={<>รหัสผ่าน{req}</>}>
              <div className="flex items-center rounded-[5px] border border-gray-300 bg-white px-[15px]">
                <input value={f.password} onChange={set("password")} type={showPw ? "text" : "password"} placeholder="สร้างรหัสผ่านของคุณ" className="w-full bg-transparent py-[10px] text-[12px] outline-none" />
                <button type="button" onClick={() => setShowPw((v) => !v)} className="text-gray-500">{showPw ? <Eye size={20} /> : <EyeOff size={20} />}</button>
              </div>
            </Field>
            <Field label={<>ยืนยันรหัสผ่าน{req}</>}>
              <input value={f.confirmPassword} onChange={set("confirmPassword")} type={showPw ? "text" : "password"} placeholder="ยืนยันรหัสผ่านของคุณ" className={inputCls} />
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
            <Field label={<>ชื่อผู้ใช้ (แหล่งผลิต){req}</>}>
              <input value={f.farmName} onChange={set("farmName")} placeholder="เช่น ฟาร์มดอกไม้ท่าสุด" className={inputCls} />
            </Field>
            <div className="grid grid-cols-2 gap-[20px]">
              <Field label={<>ชื่อผู้ติดต่อ{req}</>}>
                <input value={f.contactName} onChange={set("contactName")} placeholder="กรอกชื่อผู้ติดต่อของคุณ" className={inputCls} />
              </Field>
              <Field label={<>เบอร์โทร{req}</>}>
                <input value={f.phone} onChange={set("phone")} placeholder="0xx-xxx-xxxx" className={inputCls} />
              </Field>
              <Field label="Line ID">
                <input value={f.lineId} onChange={set("lineId")} placeholder="0xxxxxxx" className={inputCls} />
              </Field>
              <Field label={<>ที่อยู่{req}</>}>
                <input value={f.address} onChange={set("address")} placeholder="123 ต.ท่าสุด อ.เมือง จ.เชียงราย" className={inputCls} />
              </Field>
            </div>
            <Field label={<>พิกัด GPS{req}</>}>
              <div className="flex gap-2">
                <input value={f.gps} onChange={set("gps")} placeholder="12.2222, 13.3333" className={inputCls} />
                <button type="button" onClick={useLocation} className="inline-flex shrink-0 items-center gap-1.5 rounded-[5px] border border-gray-300 px-3 text-[12px] text-slate-600 hover:bg-gray-100"><MapPin size={15} /> เลือกจากแผนที่</button>
              </div>
            </Field>
            <Field label={<>รายละเอียดเพิ่มเติม{req}</>}>
              <textarea value={f.details} onChange={set("details")} rows={2} placeholder="จุดเด่น : ผลผลิตดี ดอกสวยงาม" className={inputCls} />
            </Field>
            <div className="space-y-[10px] rounded-[8px] border border-gray-200 p-4">
              <p className="text-[14px] font-semibold text-black">ดอกไม้และพันธุ์ที่ปลูก</p>
              <Field label={<>ชนิดดอกไม้{req}</>}>
                <input value={f.flowerType} onChange={set("flowerType")} placeholder="กุหลาบ" className={inputCls} />
              </Field>
              <Field label="พันธุ์ดอกไม้">
                <div className="flex gap-2">
                  <input value={varietyDraft} onChange={(e) => setVarietyDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addVariety(); } }} placeholder="เลือกพันธุ์ดอกไม้ เช่น Angel Face" className={inputCls} />
                  <button type="button" onClick={addVariety} className="inline-flex shrink-0 items-center gap-1 rounded-[5px] border border-gray-300 px-3 text-[12px] text-slate-600 hover:bg-gray-100"><Plus size={15} /> เพิ่ม</button>
                </div>
              </Field>
              {varieties.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {varieties.map((v) => (
                    <span key={v} className="inline-flex items-center gap-1 rounded-full bg-brand-pink-light px-2.5 py-1 text-[12px] text-brand-pink">
                      {v}<button type="button" onClick={() => setVarieties(varieties.filter((x) => x !== v))}><X size={12} /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-[20px]">
            <div className="space-y-2 text-center">
              <h1 className="text-[32px] font-semibold leading-[38px] text-black">ข้อมูลการใช้ทรัพยากร</h1>
              <p className="text-[12px] text-black">กรอกข้อมูลการใช้ทรัพยากรภายในพื้นที่ผลิตของคุณ</p>
            </div>
            <div className="grid grid-cols-2 gap-[22px]">
              <Field label="ปริมาณเชื้อเพลิง (ลิตร/เดือน)"><input value={f.fuelLitres} onChange={set("fuelLitres")} type="number" placeholder="18" className={inputCls} /></Field>
              <Field label="ปริมาณไฟฟ้า (กิโลวัตต์/เดือน)"><input value={f.electricityKwh} onChange={set("electricityKwh")} type="number" placeholder="120" className={inputCls} /></Field>
              <Field label="ปริมาณปุ๋ย (กิโลกรัม/เดือน)"><input value={f.fertilizerKg} onChange={set("fertilizerKg")} type="number" placeholder="18" className={inputCls} /></Field>
              <Field label="ปริมาณสารเคมีทางการเกษตร (กก./เดือน)"><input value={f.agriChemicalsKg} onChange={set("agriChemicalsKg")} type="number" placeholder="120" className={inputCls} /></Field>
              <Field label="ปริมาณน้ำ (ลบ.ม./เดือน)"><input value={f.waterM3} onChange={set("waterM3")} type="number" placeholder="18" className={inputCls} /></Field>
              <Field label="ปริมาณของเสีย (กิโลกรัม/เดือน)"><input value={f.wasteKg} onChange={set("wasteKg")} type="number" placeholder="120" className={inputCls} /></Field>
              <Field label="จำนวนดอกที่ปลูกต่อเดือน (ดอก)"><input value={f.flowersPerMonth} onChange={set("flowersPerMonth")} type="number" placeholder="200" className={inputCls} /></Field>
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
