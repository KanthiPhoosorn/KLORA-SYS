"use client";

import { Plus, Trash2 } from "lucide-react";
import { PRODUCT_CATEGORIES, typesFor, variantsFor } from "@/lib/master-data";
import type { Certification, ProductCategory } from "@/lib/types";

// "ผลผลิตและพันธุ์ที่ปลูก" — one group per ชนิด: ประเภทสินค้า (ดอกไม้/ผลไม้/ผัก) → ชนิด → พันธุ์ (many),
// with "อื่นๆ (ระบุเอง)" on both ชนิด and พันธุ์. Shared by register + farm settings.
export interface ProduceGroup { category: ProductCategory; type: string; varieties: string[] }
export const emptyGroup = (): ProduceGroup => ({ category: "flower", type: "", varieties: [] });

const OTHER = "__other__";
const CAT_UNIT: Record<ProductCategory, string> = { flower: "ดอกไม้", fruit: "ผลไม้", vegetable: "ผัก" };
// Tailwind needs literal class names — one map per accent.
const ACCENT = {
  pink: { active: "border-brand-pink bg-brand-pink font-medium text-white", link: "text-brand-pink", check: "accent-brand-pink" },
  blue: { active: "border-brand-blue bg-brand-blue font-medium text-white", link: "text-brand-blue", check: "accent-brand-blue" },
  green: { active: "border-brand-green bg-brand-green font-medium text-white", link: "text-brand-green", check: "accent-brand-green" },
};
export type EditorAccent = keyof typeof ACCENT;

/** A select whose last option is "อื่นๆ (ระบุเอง)"; a custom value shows a text input beneath. */
export function OtherableSelect({
  value, options, onChange, placeholder, className, textClassName,
}: {
  value: string; options: string[]; onChange: (v: string) => void; placeholder: string; className: string; textClassName?: string;
}) {
  const custom = value !== "" && !options.includes(value);
  return (
    <div className="space-y-[6px]">
      <select
        value={custom ? OTHER : value}
        onChange={(e) => onChange(e.target.value === OTHER ? " " : e.target.value)}
        className={`${className} ${value ? "text-black" : "text-[#bdbdbd]"}`}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
        <option value={OTHER}>อื่นๆ (ระบุเอง)</option>
      </select>
      {custom ? (
        <input
          autoFocus
          value={value.trim() === "" ? "" : value}
          onChange={(e) => onChange(e.target.value || " ")}
          placeholder="พิมพ์ชื่อที่ต้องการ"
          className={textClassName ?? className}
        />
      ) : null}
    </div>
  );
}

export default function ProduceGroupsEditor({
  groups, onChange, inputCls, error, accent = "blue",
}: {
  groups: ProduceGroup[]; onChange: (g: ProduceGroup[]) => void; inputCls: string; error?: string; accent?: EditorAccent;
}) {
  const ac = ACCENT[accent];
  const update = (gi: number, patch: Partial<ProduceGroup>) => onChange(groups.map((g, i) => (i === gi ? { ...g, ...patch } : g)));
  // value "" = cleared; " " = "อื่นๆ" chosen but not typed yet (trimmed away on submit).
  const setVarietyAt = (gi: number, vi: number, value: string) => {
    const vs = [...groups[gi].varieties];
    if (vi >= vs.length) { if (value !== "") vs.push(value); }
    else if (value === "") vs.splice(vi, 1);
    else vs[vi] = value;
    update(gi, { varieties: vs });
  };
  const removeVariety = (gi: number, vi: number) => update(gi, { varieties: groups[gi].varieties.filter((_, j) => j !== vi) });
  const clearGroup = (gi: number) => onChange(groups.length > 1 ? groups.filter((_, i) => i !== gi) : [emptyGroup()]);
  const req = <span className="text-[#ee443f]"> *</span>;
  const Label = ({ children }: { children: React.ReactNode }) => <span className="block text-[14px] text-black">{children}</span>;

  return (
    <div className="space-y-[14px]">
      <p className="text-[14px] font-semibold text-black">ผลผลิตและพันธุ์ที่ปลูก</p>
      {error ? <p className="text-[11px] text-[#ee443f]">{error}</p> : null}

      {groups.map((g, gi) => (
        <div key={gi} className="space-y-[10px] border-t border-gray-200 pt-[14px]">
          <div className="block space-y-[5px]">
            <Label>ประเภทสินค้า{req}</Label>
            <div className="flex gap-2">
              {PRODUCT_CATEGORIES.map((c) => (
                <button
                  key={c.key} type="button"
                  onClick={() => update(gi, { category: c.key, type: "", varieties: [] })}
                  className={`flex-1 rounded-[5px] border px-3 py-[9px] text-[12px] transition ${g.category === c.key ? ac.active : "border-gray-300 bg-white text-slate-600 hover:bg-gray-50"}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-[20px]">
            <div className="block space-y-[5px]">
              <Label>ชนิด{CAT_UNIT[g.category]}{req}</Label>
              <OtherableSelect value={g.type} options={typesFor(g.category)} onChange={(v) => update(gi, { type: v, varieties: [] })} placeholder={`เลือกชนิด${CAT_UNIT[g.category]}`} className={inputCls} />
            </div>
            <div className="block space-y-[5px]">
              <Label>พันธุ์{req}</Label>
              <div className="space-y-[10px]">
                {[...g.varieties, ""].map((v, vi) => (
                  <div key={vi} className="flex items-start gap-2">
                    <div className="flex-1">
                      <OtherableSelect
                        value={v}
                        options={variantsFor(g.category, g.type.trim()).filter((opt) => opt === v || !g.varieties.includes(opt))}
                        onChange={(nv) => setVarietyAt(gi, vi, nv)}
                        placeholder="เลือกพันธุ์"
                        className={inputCls}
                      />
                    </div>
                    {vi < g.varieties.length ? (
                      <button type="button" onClick={() => removeVariety(gi, vi)} aria-label="ลบพันธุ์" className="mt-[10px] shrink-0 text-slate-400 hover:text-[#ee443f]"><Trash2 size={16} /></button>
                    ) : <span className="w-4 shrink-0" />}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="text-right">
            <button type="button" onClick={() => clearGroup(gi)} className="text-[12px] text-[#ee443f] underline">ลบทั้งหมด</button>
          </div>
        </div>
      ))}

      <button type="button" onClick={() => onChange([...groups, emptyGroup()])} className={`inline-flex items-center gap-1.5 text-[13px] font-medium hover:underline ${ac.link}`}>
        <Plus size={15} /> เพิ่มรายการผลผลิต (ดอกไม้ / ผลไม้ / ผัก)
      </button>
    </div>
  );
}

// ---- ใบรับรองมาตรฐานสินค้าเกษตร ----
const CERT_KINDS: Certification["kind"][] = ["GAP", "GlobalGAP", "Organic Thailand", "other"];
export const emptyCert = (): Certification => ({ kind: "GAP", appliesTo: ["fruit", "vegetable"] });

export function CertificationsEditor({
  certs, onChange, inputCls, accent = "blue",
}: {
  certs: Certification[]; onChange: (c: Certification[]) => void; inputCls: string; accent?: EditorAccent;
}) {
  const ac = ACCENT[accent];
  const update = (i: number, patch: Partial<Certification>) => onChange(certs.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const toggle = (i: number, cat: ProductCategory) => {
    const cur = certs[i].appliesTo;
    update(i, { appliesTo: cur.includes(cat) ? cur.filter((x) => x !== cat) : [...cur, cat] });
  };
  return (
    <div className="space-y-[14px]">
      <div>
        <p className="text-[14px] font-semibold text-black">ใบรับรองมาตรฐาน</p>
        <p className="text-[11px] text-slate-500">GAP / GlobalGAP / Organic — แสดงเป็นป้ายรับรองบนหน้าตรวจสอบสินค้าของผู้บริโภค (ไม่บังคับ)</p>
      </div>
      {certs.map((c, i) => (
        <div key={i} className="space-y-[10px] rounded-[8px] border border-gray-200 p-[12px]">
          <div className="grid grid-cols-2 gap-[12px]">
            <label className="block space-y-[5px]">
              <span className="block text-[12px] text-black">ประเภทใบรับรอง</span>
              <select value={c.kind} onChange={(e) => update(i, { kind: e.target.value as Certification["kind"] })} className={inputCls}>
                {CERT_KINDS.map((k) => <option key={k} value={k}>{k === "other" ? "อื่นๆ ระบุ" : k}</option>)}
              </select>
            </label>
            {c.kind === "other" ? (
              <label className="block space-y-[5px]">
                <span className="block text-[12px] text-black">ชื่อใบรับรอง</span>
                <input value={c.name ?? ""} onChange={(e) => update(i, { name: e.target.value })} placeholder="เช่น PGS, Q Mark" className={inputCls} />
              </label>
            ) : (
              <label className="block space-y-[5px]">
                <span className="block text-[12px] text-black">เลขที่ใบรับรอง</span>
                <input value={c.certNo ?? ""} onChange={(e) => update(i, { certNo: e.target.value })} placeholder="เช่น GAP-XXXX-XXXX" className={inputCls} />
              </label>
            )}
            <label className="block space-y-[5px]">
              <span className="block text-[12px] text-black">วันหมดอายุ</span>
              <input type="date" value={c.expiresAt ?? ""} onChange={(e) => update(i, { expiresAt: e.target.value })} className={inputCls} />
            </label>
            <div className="space-y-[5px]">
              <span className="block text-[12px] text-black">ใช้กับประเภทสินค้า</span>
              <div className="flex gap-3 pt-[6px]">
                {PRODUCT_CATEGORIES.map((cat) => (
                  <label key={cat.key} className="flex items-center gap-1.5 text-[12px] text-slate-700">
                    <input type="checkbox" checked={c.appliesTo.includes(cat.key)} onChange={() => toggle(i, cat.key)} className={ac.check} /> {cat.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="text-right">
            <button type="button" onClick={() => onChange(certs.filter((_, j) => j !== i))} className="text-[12px] text-[#ee443f] underline">ลบใบรับรอง</button>
          </div>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...certs, emptyCert()])} className={`inline-flex items-center gap-1.5 text-[13px] font-medium hover:underline ${ac.link}`}>
        <Plus size={15} /> เพิ่มใบรับรอง
      </button>
    </div>
  );
}
