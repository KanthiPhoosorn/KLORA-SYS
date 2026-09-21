"use client";

import { FUEL_TYPES, FERTILIZER_TYPES, CHEMICAL_TYPES } from "@/lib/resource-types";
import type { ChemicalKind, FertilizerKind, FuelKind, ProductCategory, YieldLine } from "@/lib/types";

// "ข้อมูลการใช้ทรัพยากร (รวมทั้งฟาร์ม)" + "ผลผลิตและของเสีย (ต่อเดือน)" — KYN mock 21 Sep 2026.
// One primary type per input (dropdown + amount); yield is asked per product line the farm
// registered (ชนิด — พันธุ์), flowers in ดอก and produce in กก.; waste is one farm-wide total.
export interface ResourceState {
  fuelKind: FuelKind;
  fuelLitres: string;
  electricityKwh: string;
  fertilizerKind: FertilizerKind;
  fertilizerKg: string;
  chemicalKind: ChemicalKind;
  agriChemicalsKg: string;
  waterM3: string;
  wasteKg: string;
  yields: Record<string, string>; // key "type|variety" → amount
}
export const emptyResourceState = (): ResourceState => ({
  fuelKind: "diesel", fuelLitres: "", electricityKwh: "", fertilizerKind: "npk", fertilizerKg: "",
  chemicalKind: "none", agriChemicalsKg: "", waterM3: "", wasteKg: "", yields: {},
});

export interface YieldTarget { category: ProductCategory; type: string; variety?: string }
export const yieldKey = (t: YieldTarget) => `${t.type}|${t.variety ?? ""}`;
const EMOJI: Record<ProductCategory, string> = { flower: "🌹", fruit: "🥭", vegetable: "🍅" };

/** Product lines → one yield row per (type, variety); a type without varieties gets one row. */
export function yieldTargets(groups: { category?: ProductCategory; type: string; varieties: string[] }[]): YieldTarget[] {
  const out: YieldTarget[] = [];
  for (const g of groups) {
    if (!g.type.trim()) continue;
    const cat = g.category ?? "flower";
    const vs = g.varieties.map((v) => v.trim()).filter(Boolean);
    if (vs.length === 0) out.push({ category: cat, type: g.type.trim() });
    for (const v of vs) out.push({ category: cat, type: g.type.trim(), variety: v });
  }
  return out;
}

/** Build the API payload from the state (+ legacy numeric fields for older readers). */
export function resourcePayload(s: ResourceState, targets: YieldTarget[]) {
  const yieldLines: YieldLine[] = targets.map((t) => ({
    category: t.category, type: t.type, variety: t.variety,
    amount: Number(s.yields[yieldKey(t)]) || 0, unit: t.category === "flower" ? ("stem" as const) : ("kg" as const),
  })).filter((l) => l.amount > 0);
  return {
    fuelKind: s.fuelKind, fuelLitres: s.fuelLitres, electricityKwh: s.electricityKwh,
    fertilizerKind: s.fertilizerKind, fertilizerKg: s.fertilizerKg,
    chemicalKind: s.chemicalKind, agriChemicalsKg: s.chemicalKind === "none" ? "0" : s.agriChemicalsKg,
    waterM3: s.waterM3, wasteKg: s.wasteKg, yieldLines,
  };
}

export default function ResourceUsageFields({
  value, onChange, targets, inputCls, labelCls,
}: {
  value: ResourceState; onChange: (v: ResourceState) => void; targets: YieldTarget[]; inputCls: string; labelCls: string;
}) {
  const set = <K extends keyof ResourceState>(k: K, v: ResourceState[K]) => onChange({ ...value, [k]: v });
  const fuel = FUEL_TYPES.find((t) => t.key === value.fuelKind)!;
  const fert = FERTILIZER_TYPES.find((t) => t.key === value.fertilizerKind)!;
  const chem = CHEMICAL_TYPES.find((t) => t.key === value.chemicalKind)!;
  // Plain function (not a nested component) so the input keeps focus between keystrokes.
  const amountField = (k: "fuelLitres" | "fertilizerKg" | "agriChemicalsKg", unit: string, disabled?: boolean) => (
    <div className="relative">
      <input type="number" min="0" step="any" value={disabled ? "" : value[k]} disabled={disabled} onChange={(e) => set(k, e.target.value)} placeholder="ระบุปริมาณ" className={`${inputCls} pr-16 disabled:bg-gray-50`} />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">{unit}/ด.</span>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <p className="text-[14px] font-semibold text-black">ข้อมูลการใช้ทรัพยากร (รวมทั้งฟาร์ม)</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelCls}>ประเภทเชื้อเพลิงหลัก</label>
            <div className="grid grid-cols-2 gap-3">
              <select value={value.fuelKind} onChange={(e) => set("fuelKind", e.target.value as FuelKind)} className={inputCls}>
                {FUEL_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
              {amountField("fuelLitres", fuel.unit)}
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>ปริมาณไฟฟ้า (กิโลวัตต์/เดือน)</label>
            <input type="number" min="0" step="any" value={value.electricityKwh} onChange={(e) => set("electricityKwh", e.target.value)} placeholder="ระบุปริมาณไฟฟ้า" className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>ประเภทปุ๋ยหลัก</label>
            <div className="grid grid-cols-2 gap-3">
              <select value={value.fertilizerKind} onChange={(e) => set("fertilizerKind", e.target.value as FertilizerKind)} className={inputCls}>
                {FERTILIZER_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
              {amountField("fertilizerKg", fert.unit)}
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>ประเภทสารเคมีทางการเกษตรหลัก</label>
            <div className="grid grid-cols-2 gap-3">
              <select value={value.chemicalKind} onChange={(e) => set("chemicalKind", e.target.value as ChemicalKind)} className={inputCls}>
                {CHEMICAL_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
              {amountField("agriChemicalsKg", chem.unit, value.chemicalKind === "none")}
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>ปริมาณน้ำ (ลบ.ม./เดือน)</label>
            <input type="number" min="0" step="any" value={value.waterM3} onChange={(e) => set("waterM3", e.target.value)} placeholder="ระบุปริมาณน้ำ" className={inputCls} />
            <p className="mt-1 text-[11px] text-amber-600">หากฟาร์มใช้ปั๊มน้ำไฟฟ้าสูบน้ำเอง และค่าน้ำถูกคิดรวมในบิลค่าไฟไปแล้ว ให้กรอกช่องนี้เป็น 0 (กันการนับคาร์บอนซ้ำ)</p>
          </div>
        </div>
        <p className="text-[11px] text-slate-400">* หากใช้เชื้อเพลิง/ปุ๋ย/สารเคมีมากกว่า 1 ประเภท เลือก “ประเภทหลัก” ที่ใช้มากที่สุดไปก่อน · ค่าสัมประสิทธิ์: {fuel.label} {fuel.ef} · {fert.label} {fert.ef} · {chem.label} {chem.ef} kg CO₂e/หน่วย</p>
      </div>

      <div className="space-y-3 border-t border-gray-200 pt-5">
        <div>
          <p className="text-[14px] font-semibold text-black">ผลผลิตและของเสีย (ต่อเดือน)</p>
          <p className="text-[11px] text-slate-500">ระบุแยกตามแต่ละรายการสินค้าที่เพิ่มไว้ในขั้นตอนก่อนหน้า</p>
        </div>
        {targets.length === 0 ? (
          <p className="rounded-[8px] border border-dashed border-gray-300 px-4 py-4 text-center text-[12px] text-slate-400">ยังไม่มีรายการสินค้า — เพิ่ม “ผลผลิตและพันธุ์ที่ปลูก” ก่อน</p>
        ) : targets.map((t) => {
          const k = yieldKey(t);
          const unit = t.category === "flower" ? "ดอก" : "กก.";
          return (
            <div key={k} className="rounded-[10px] border border-gray-200 p-3">
              <div className="text-[13px] font-semibold text-black">{EMOJI[t.category]} {t.type}{t.variety ? ` — ${t.variety}` : ""}</div>
              <label className="mt-2 block">
                <span className={labelCls}>ผลผลิตทั้งหมด ({unit}/เดือน)</span>
                <input type="number" min="0" step="any" value={value.yields[k] ?? ""} onChange={(e) => set("yields", { ...value.yields, [k]: e.target.value })} placeholder="ระบุจำนวน" className={inputCls} />
              </label>
            </div>
          );
        })}
        <div>
          <label className={labelCls}>ของเสีย/คัดทิ้งรวมทั้งหมด (กก./เดือน)</label>
          <input type="number" min="0" step="any" value={value.wasteKg} onChange={(e) => set("wasteKg", e.target.value)} placeholder="ระบุปริมาณของเสียรวม" className={inputCls} />
        </div>
      </div>
    </div>
  );
}
