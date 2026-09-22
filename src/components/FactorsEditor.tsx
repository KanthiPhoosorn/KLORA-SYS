"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PlusCircle, Trash2, RotateCcw, RefreshCw, Save, CheckCircle2 } from "lucide-react";
import { DEFAULT_FACTORS, AIR_EF_SOURCE, SHORT_HAUL_MAX_KM, type Factors } from "@/lib/factors";
import { VEHICLE_FUELS } from "@/lib/master-data";
import { deriveTransportEF } from "@/lib/transport-ef";

const inputCls =
  "w-full rounded-[8px] border border-gray-300 bg-white px-3 py-2 text-[13px] text-black outline-none placeholder:text-[#bdbdbd] focus:border-brand-purple";

const FARM_ROWS: { key: keyof Factors["farm"]; label: string; unit: string; note?: string }[] = [
  { key: "DIESEL", label: "น้ำมันเชื้อเพลิง (ค่ากลาง)", unit: "kg CO₂e / ลิตร", note: "ถ้าฟาร์มเลือกชนิดน้ำมัน จะใช้ค่าตามชนิดนั้นก่อน" },
  { key: "ELECTRICITY", label: "ไฟฟ้า", unit: "kg CO₂e / kWh", note: "TGO ก.พ. 2569 · เอกสาร KYN ใช้ 0.4999 (ค่าชุดเก่า 2559–2561)" },
  { key: "FERTILIZER", label: "ปุ๋ย (ค่ากลาง)", unit: "kg CO₂e / kg", note: "ถ้าฟาร์มเลือกชนิดปุ๋ย จะใช้ค่าตามชนิดนั้นก่อน" },
  { key: "AGROCHEMICAL", label: "สารเคมีเกษตร (ค่ากลาง)", unit: "kg CO₂e / kg", note: "ถ้าฟาร์มเลือกชนิดสารเคมี จะใช้ค่าตามชนิดนั้นก่อน" },
  { key: "WATER", label: "น้ำ", unit: "kg CO₂e / m³" },
  { key: "ORGANIC_WASTE", label: "ขยะอินทรีย์", unit: "kg CO₂e / kg" },
];

type Str<T> = { [K in keyof T]: string };
interface Draft {
  farm: Str<Factors["farm"]>;
  air: Str<Factors["air"]>;
  vehicleTkm: Record<string, string>;
  packageSizes: { label: string; w: string; l: string; h: string }[];
  reuseLife: Str<Factors["reuseLife"]>;
}
const toDraft = (f: Factors): Draft => ({
  farm: Object.fromEntries(Object.entries(f.farm).map(([k, v]) => [k, String(v)])) as Draft["farm"],
  air: { shortHaul: String(f.air.shortHaul), longHaul: String(f.air.longHaul) },
  vehicleTkm: Object.fromEntries(Object.entries(f.vehicleTkm).map(([k, v]) => [k, String(v)])),
  packageSizes: f.packageSizes.map((p) => ({ label: p.label, w: String(p.w), l: String(p.l), h: p.h ? String(p.h) : "" })),
  reuseLife: { basket: String(f.reuseLife.basket), corrugated_box: String(f.reuseLife.corrugated_box), plastic_film: String(f.reuseLife.plastic_film) },
});
const fromDraft = (d: Draft) => ({
  farm: Object.fromEntries(Object.entries(d.farm).map(([k, v]) => [k, Number(v)])),
  air: { shortHaul: Number(d.air.shortHaul), longHaul: Number(d.air.longHaul) },
  vehicleTkm: Object.fromEntries(Object.entries(d.vehicleTkm).filter(([, v]) => v.trim() !== "").map(([k, v]) => [k, Number(v)])),
  packageSizes: d.packageSizes.map((p) => ({ label: p.label.trim(), w: Number(p.w), l: Number(p.l), h: Number(p.h) || 0 })),
  reuseLife: { basket: Number(d.reuseLife.basket), corrugated_box: Number(d.reuseLife.corrugated_box), plastic_film: Number(d.reuseLife.plastic_film) },
});

function Section({ title, sub, children }: { title: string; sub?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-[16px] font-semibold text-slate-900">{title}</h2>
      {sub ? <p className="mt-0.5 text-[12px] text-slate-400">{sub}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default function FactorsEditor({ initial }: { initial: Factors }) {
  const router = useRouter();
  const [d, setD] = useState<Draft>(() => toDraft(initial));
  const [busy, setBusy] = useState<"save" | "recompute" | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // one row per vehicle × fuel pair, with the value the engine derives when KYN leaves it blank
  const vehicleRows = useMemo(
    () => VEHICLE_FUELS.map((v) => ({ ...v, key: `${v.vehicleKey}|${v.fuelKey}`, derived: deriveTransportEF(v.vehicleKey, v.fuelKey)?.efTkm ?? 0 })),
    [],
  );
  const setFarm = (k: keyof Factors["farm"], v: string) => setD((x) => ({ ...x, farm: { ...x.farm, [k]: v } }));
  const setSize = (i: number, patch: Partial<Draft["packageSizes"][number]>) =>
    setD((x) => ({ ...x, packageSizes: x.packageSizes.map((p, j) => (j === i ? { ...p, ...patch } : p)) }));

  async function save() {
    setBusy("save"); setMsg(null);
    try {
      const res = await fetch("/api/factors", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fromDraft(d)) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      setD(toDraft(data.factors));
      setMsg({ ok: true, text: "บันทึกค่าสัมประสิทธิ์แล้ว — รอบใหม่จะใช้ค่านี้ทันที กด “คำนวณใหม่ทั้งหมด” เพื่อปรับรอบเดิม" });
      router.refresh();
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    setBusy(null);
  }
  async function recompute() {
    setBusy("recompute"); setMsg(null);
    try {
      const res = await fetch("/api/factors/recompute", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "คำนวณใหม่ไม่สำเร็จ");
      setMsg({ ok: true, text: `คำนวณใหม่แล้ว ${data.recomputed} จาก ${data.total} รอบ` });
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    setBusy(null);
  }

  return (
    <div className="max-w-4xl space-y-5">
      <Section title="ปัจจัยการผลิตในฟาร์ม" sub="ใช้คำนวณ Dynamic Flower EF จากข้อมูลการใช้ทรัพยากรรายเดือนของฟาร์ม">
        <div className="grid gap-4 sm:grid-cols-2">
          {FARM_ROWS.map((r) => (
            <div key={r.key}>
              <label className="mb-1.5 block text-[13px] font-medium text-slate-700">{r.label} <span className="font-normal text-slate-400">({r.unit})</span></label>
              <input type="number" min="0" step="any" value={d.farm[r.key]} onChange={(e) => setFarm(r.key, e.target.value)} className={inputCls} />
              <p className="mt-1 text-[11px] text-slate-400">ค่าเริ่มต้น {DEFAULT_FACTORS.farm[r.key]}{r.note ? ` · ${r.note}` : ""}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="ขนส่งทางอากาศ" sub={<>{AIR_EF_SOURCE} · แยกระยะที่ {SHORT_HAUL_MAX_KM.toLocaleString("th-TH")} กม.</>}>
        <div className="grid gap-4 sm:grid-cols-2">
          {([["shortHaul", `ระยะสั้น (< ${SHORT_HAUL_MAX_KM.toLocaleString("th-TH")} กม.)`], ["longHaul", "ระยะไกล"]] as const).map(([k, label]) => (
            <div key={k}>
              <label className="mb-1.5 block text-[13px] font-medium text-slate-700">{label} <span className="font-normal text-slate-400">(kg CO₂e / ตัน·กม.)</span></label>
              <input type="number" min="0" step="any" value={d.air[k]} onChange={(e) => setD((x) => ({ ...x, air: { ...x.air, [k]: e.target.value } }))} className={inputCls} />
              <p className="mt-1 text-[11px] text-slate-400">ค่าเริ่มต้น DEFRA {DEFAULT_FACTORS.air[k]} (รวม RF และระยะอ้อม 8%)</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="ขนส่งทางถนน — EF ต่อตัน·กม." sub="เว้นว่าง = ใช้ค่าที่ระบบคำนวณจากอัตราสิ้นเปลือง × EF เชื้อเพลิง TGO ÷ น้ำหนักบรรทุก · ใส่ค่าจริงของ KYN เพื่อแทนที่">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-[13px]">
            <thead>
              <tr className="bg-brand-purple-head text-left text-white">
                <th className="px-3 py-2 font-medium">ประเภทรถ</th>
                <th className="px-3 py-2 font-medium">เชื้อเพลิง</th>
                <th className="px-3 py-2 text-right font-medium">ค่าที่ระบบคำนวณ</th>
                <th className="w-40 px-3 py-2 font-medium">ค่า KYN</th>
              </tr>
            </thead>
            <tbody>
              {vehicleRows.map((v) => (
                <tr key={v.key} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-2 text-slate-700">{v.vehicle}</td>
                  <td className="px-3 py-2 text-slate-500">{v.fuel}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-400">{v.derived ? v.derived.toFixed(4) : "—"}</td>
                  <td className="px-3 py-1.5">
                    <input type="number" min="0" step="any" value={d.vehicleTkm[v.key] ?? ""} onChange={(e) => setD((x) => ({ ...x, vehicleTkm: { ...x.vehicleTkm, [v.key]: e.target.value } }))} placeholder={v.derived ? v.derived.toFixed(4) : ""} className={`${inputCls} ${d.vehicleTkm[v.key] ? "border-brand-purple" : ""}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="ขนาดบรรจุภัณฑ์มาตรฐาน" sub="ตัวเลือกกรอกอัตโนมัติในแบบฟอร์มรอบส่งออก (ฟาร์มและผู้ขนส่ง) · ซองห่อช่อ/แผ่นพลาสติก ให้เว้นความสูง">
        <div className="space-y-2">
          <div className="hidden grid-cols-[1fr_90px_90px_90px_32px] gap-2 px-1 text-[12px] font-medium text-slate-500 sm:grid">
            <span>ชื่อ</span><span>กว้าง (ซม.)</span><span>ยาว (ซม.)</span><span>สูง (ซม.)</span><span />
          </div>
          {d.packageSizes.map((p, i) => (
            <div key={i} className="grid grid-cols-3 gap-2 sm:grid-cols-[1fr_90px_90px_90px_32px]">
              <input value={p.label} onChange={(e) => setSize(i, { label: e.target.value })} placeholder="เช่น กล่องกลาง 30 × 40 × 20 ซม." className={`${inputCls} col-span-3 sm:col-span-1`} />
              <input type="number" min="0" step="any" value={p.w} onChange={(e) => setSize(i, { w: e.target.value })} placeholder="กว้าง" className={inputCls} />
              <input type="number" min="0" step="any" value={p.l} onChange={(e) => setSize(i, { l: e.target.value })} placeholder="ยาว" className={inputCls} />
              <input type="number" min="0" step="any" value={p.h} onChange={(e) => setSize(i, { h: e.target.value })} placeholder="สูง" className={inputCls} />
              <button type="button" onClick={() => setD((x) => ({ ...x, packageSizes: x.packageSizes.filter((_, j) => j !== i) }))} title="ลบ" className="grid h-[38px] place-items-center text-red-500 hover:text-red-600"><Trash2 size={15} /></button>
            </div>
          ))}
          <button type="button" onClick={() => setD((x) => ({ ...x, packageSizes: [...x.packageSizes, { label: "", w: "", l: "", h: "" }] }))} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-purple hover:underline">
            <PlusCircle size={16} /> เพิ่มขนาด
          </button>
        </div>
      </Section>

      <Section title="อายุการใช้งานบรรจุภัณฑ์หมุนเวียน" sub="จำนวนรอบ (design life) ที่ให้กับบรรจุภัณฑ์ที่ลงทะเบียนใหม่ — คาร์บอนจากการผลิตถูกเฉลี่ยตามจำนวนรอบนี้ · บรรจุภัณฑ์ใช้ครั้งเดียวคิดเต็มจำนวน">
        <div className="grid gap-4 sm:grid-cols-3">
          {([["basket", "ตะกร้า", "ตาราง KYN: 50–100 รอบ"], ["corrugated_box", "กล่องลูกฟูก", "ค่าประมาณ — รอ KYN ยืนยัน"], ["plastic_film", "แผ่นพลาสติก / ซองห่อช่อ", "ค่าประมาณ — รอ KYN ยืนยัน"]] as const).map(([k, label, note]) => (
            <div key={k}>
              <label className="mb-1.5 block text-[13px] font-medium text-slate-700">{label} <span className="font-normal text-slate-400">(รอบ)</span></label>
              <input type="number" min="1" step="1" value={d.reuseLife[k]} onChange={(e) => setD((x) => ({ ...x, reuseLife: { ...x.reuseLife, [k]: e.target.value } }))} className={inputCls} />
              <p className="mt-1 text-[11px] text-slate-400">ค่าเริ่มต้น {DEFAULT_FACTORS.reuseLife[k]} · {note}</p>
            </div>
          ))}
        </div>
      </Section>

      {msg ? (
        <p className={`flex items-start gap-2 rounded-[8px] px-3 py-2 text-[13px] ${msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
          {msg.ok ? <CheckCircle2 size={15} className="mt-0.5 shrink-0" /> : null}{msg.text}
        </p>
      ) : null}

      <div className="flex flex-wrap justify-end gap-3">
        <button type="button" onClick={() => { setD(toDraft(DEFAULT_FACTORS)); setMsg({ ok: true, text: "คืนค่าเริ่มต้นในแบบฟอร์มแล้ว — กดบันทึกเพื่อใช้งาน" }); }} disabled={!!busy} className="inline-flex h-[40px] items-center gap-2 rounded-[8px] border border-gray-300 px-5 text-[14px] font-medium text-slate-700 hover:bg-gray-100 disabled:opacity-60">
          <RotateCcw size={15} /> ค่าเริ่มต้น
        </button>
        <button type="button" onClick={recompute} disabled={!!busy} className="inline-flex h-[40px] items-center gap-2 rounded-[8px] border border-brand-purple px-5 text-[14px] font-medium text-brand-purple hover:bg-brand-purple-light disabled:opacity-60">
          {busy === "recompute" ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} คำนวณใหม่ทั้งหมด
        </button>
        <button type="button" onClick={save} disabled={!!busy} className="inline-flex h-[40px] items-center gap-2 rounded-[8px] bg-brand-purple px-8 text-[14px] font-medium text-white hover:opacity-90 disabled:opacity-60">
          {busy === "save" ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} บันทึก
        </button>
      </div>
    </div>
  );
}
