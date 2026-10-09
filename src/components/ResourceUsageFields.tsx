"use client";

import { Plus, X } from "lucide-react";
import { RESOURCE_TABLES, OTHER_KIND, linesToLegacy, type ResourceGroup, type ResourceLines } from "@/lib/resource-types";
import type { ProductCategory, YieldLine } from "@/lib/types";

// "ข้อมูลการใช้ทรัพยากร (รวมทั้งฟาร์ม)" + "ผลผลิตและของเสีย (ต่อเดือน)" — KYN mock 21 Sep 2026,
// Thai Post doc 9 Oct 2026: fuel / fertilizer / chemical take several types ("+ เพิ่มรายการ"), each
// dropdown ends with "อื่นๆ (ระบุ)" (typed name goes to KYN for review). Yield is asked per product
// line (ชนิด — พันธุ์), flowers in ดอก and produce in กก.; waste is one farm-wide total.
export interface LineState { kind: string; amount: string; other: string }
export interface ResourceState {
  fuel: LineState[];
  fertilizer: LineState[];
  chemical: LineState[];
  electricityKwh: string;
  waterM3: string;
  wasteKg: string;
  yields: Record<string, string>; // key "type|variety" → amount
}
const line = (kind: string, amount = ""): LineState => ({ kind, amount, other: "" });
export const emptyResourceState = (): ResourceState => ({
  fuel: [line("diesel")], fertilizer: [line("npk")], chemical: [line("none")],
  electricityKwh: "", waterM3: "", wasteKg: "", yields: {},
});
/** Prefill from a farm's stored lines (or its single legacy types). */
export function resourceStateFrom(lines: ResourceLines, rest: { electricityKwh?: number; waterM3?: number; wasteKg?: number; yields: Record<string, string> }): ResourceState {
  const toState = (ls: ResourceLines[ResourceGroup], fallback: string) =>
    ls.length ? ls.map((l) => ({ kind: l.kind, amount: l.amount ? String(l.amount) : "", other: l.other ?? "" })) : [line(fallback)];
  return {
    fuel: toState(lines.fuel, "diesel"), fertilizer: toState(lines.fertilizer, "npk"), chemical: toState(lines.chemical, "none"),
    electricityKwh: rest.electricityKwh?.toString() ?? "", waterM3: rest.waterM3?.toString() ?? "", wasteKg: rest.wasteKg?.toString() ?? "", yields: rest.yields,
  };
}

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
  const toLines = (ls: LineState[]) => ls
    .filter((l) => l.kind && l.kind !== "none" && (l.kind !== OTHER_KIND || l.other.trim()))
    .map((l) => ({ kind: l.kind, amount: Number(l.amount) || 0, ...(l.kind === OTHER_KIND ? { other: l.other.trim() } : {}) }));
  const resourceLines: ResourceLines = { fuel: toLines(s.fuel), fertilizer: toLines(s.fertilizer), chemical: toLines(s.chemical) };
  const legacy = linesToLegacy(resourceLines);
  return {
    resourceLines,
    // single-type fields for older readers (server recomputes them from the lines)
    fuelKind: legacy.fuelKind, fuelLitres: String(legacy.fuelLitres), fertilizerKind: legacy.fertilizerKind, fertilizerKg: String(legacy.fertilizerKg),
    chemicalKind: legacy.chemicalKind, agriChemicalsKg: String(legacy.agriChemicalsKg),
    electricityKwh: s.electricityKwh, waterM3: s.waterM3, wasteKg: s.wasteKg, yieldLines,
  };
}

export default function ResourceUsageFields({
  value, onChange, targets, inputCls, labelCls,
}: {
  value: ResourceState; onChange: (v: ResourceState) => void; targets: YieldTarget[]; inputCls: string; labelCls: string;
}) {
  const set = <K extends keyof ResourceState>(k: K, v: ResourceState[K]) => onChange({ ...value, [k]: v });
  const GROUPS: { key: ResourceGroup; label: string; addLabel: string }[] = [
    { key: "fuel", label: "ประเภทเชื้อเพลิง", addLabel: "เพิ่มรายการเชื้อเพลิง" },
    { key: "fertilizer", label: "ประเภทปุ๋ย", addLabel: "เพิ่มรายการปุ๋ย" },
    { key: "chemical", label: "ประเภทสารเคมีทางการเกษตร", addLabel: "เพิ่มรายการสารเคมี" },
  ];
  const setLine = (g: ResourceGroup, i: number, patch: Partial<LineState>) =>
    set(g, value[g].map((l, j) => (j === i ? { ...l, ...patch } : l)));
  // Plain function (not a nested component) so inputs keep focus between keystrokes.
  const group = (g: (typeof GROUPS)[number]) => {
    const table = RESOURCE_TABLES[g.key];
    const lines = value[g.key];
    return (
      <div key={g.key} className="sm:col-span-2">
        <label className={labelCls}>{g.label}</label>
        <div className="space-y-2">
          {lines.map((l, i) => {
            const t = table.find((x) => x.key === l.kind);
            const none = l.kind === "none";
            return (
              <div key={i} className="space-y-2">
                <div className="grid grid-cols-[1fr_1fr_auto] gap-3">
                  <select value={l.kind} onChange={(e) => setLine(g.key, i, { kind: e.target.value, ...(e.target.value === "none" ? { amount: "" } : {}) })} className={inputCls}>
                    {table.filter((x) => x.key !== "none" || lines.length === 1).map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
                    <option value={OTHER_KIND}>อื่นๆ (ระบุ)</option>
                  </select>
                  <div className="relative">
                    <input type="number" min="0" step="any" value={none ? "" : l.amount} disabled={none} onChange={(e) => setLine(g.key, i, { amount: e.target.value })} placeholder="ระบุปริมาณ" className={`${inputCls} pr-16 disabled:bg-gray-50`} />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">{t?.unit ?? (g.key === "fuel" ? "ลิตร" : "กก.")}/ด.</span>
                  </div>
                  {lines.length > 1 ? (
                    <button type="button" onClick={() => set(g.key, lines.filter((_, j) => j !== i))} aria-label="ลบรายการ" className="grid size-[42px] place-items-center rounded-[8px] text-slate-400 hover:bg-gray-100 hover:text-red-500"><X size={16} /></button>
                  ) : <span className="w-[42px]" />}
                </div>
                {l.kind === OTHER_KIND ? (
                  <div>
                    <input value={l.other} onChange={(e) => setLine(g.key, i, { other: e.target.value })} placeholder={`ระบุชื่อ${g.label.replace("ประเภท", "")}`} className={inputCls} />
                    <p className="mt-1 text-[11px] text-amber-600">ระบบใช้ค่าประมาณไปก่อน และส่งให้ทีม KYN ตรวจสอบเพื่อเพิ่มเป็นรายการใหม่</p>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        <button type="button" onClick={() => set(g.key, [...lines.filter((l) => l.kind !== "none"), line(table[0].key)])} className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-[#018e46] hover:underline">
          <Plus size={14} /> {g.addLabel}
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <p className="text-[14px] font-semibold text-black">ข้อมูลการใช้ทรัพยากร (รวมทั้งฟาร์ม)</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {group(GROUPS[0])}
          <div className="sm:col-span-2">
            <label className={labelCls}>ปริมาณไฟฟ้า (กิโลวัตต์/เดือน)</label>
            <input type="number" min="0" step="any" value={value.electricityKwh} onChange={(e) => set("electricityKwh", e.target.value)} placeholder="ระบุปริมาณไฟฟ้า" className={inputCls} />
          </div>
          {group(GROUPS[1])}
          {group(GROUPS[2])}
          <div className="sm:col-span-2">
            <label className={labelCls}>ปริมาณน้ำ (ลบ.ม./เดือน)</label>
            <input type="number" min="0" step="any" value={value.waterM3} onChange={(e) => set("waterM3", e.target.value)} placeholder="ระบุปริมาณน้ำ" className={inputCls} />
            <p className="mt-1 text-[11px] text-amber-600">หากฟาร์มใช้ปั๊มน้ำไฟฟ้าสูบน้ำเอง และค่าน้ำถูกคิดรวมในบิลค่าไฟไปแล้ว ให้กรอกช่องนี้เป็น 0 (กันการนับคาร์บอนซ้ำ)</p>
          </div>
        </div>
        <p className="text-[11px] text-slate-400">* ใช้มากกว่า 1 ประเภท กด “เพิ่มรายการ” แล้วกรอกปริมาณแยกกัน · ค่าสัมประสิทธิ์ (kg CO₂e/หน่วย) ตามตาราง KYN: {(["fuel", "fertilizer", "chemical"] as const).flatMap((k) => value[k].map((l) => RESOURCE_TABLES[k].find((t) => t.key === l.kind)).filter((t) => t && t.key !== "none").map((t) => `${t!.label} ${t!.ef}`)).join(" · ") || "—"}</p>
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
