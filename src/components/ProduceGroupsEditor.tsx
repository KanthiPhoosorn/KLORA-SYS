"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, CloudUpload, FileText, Info, Loader2, Plus, Trash2, X } from "lucide-react";
import DateField from "@/components/DateField";
import { PRODUCT_CATEGORIES, typesFor, variantsFor, categoryOfType } from "@/lib/master-data";
import type { Certification, ProductCategory } from "@/lib/types";

// "ผลผลิตและพันธุ์ที่ปลูก" — one group per ชนิด: ประเภทสินค้า (ดอกไม้/ผลไม้/ผัก) → ชนิด → พันธุ์ (many),
// with "อื่นๆ (ระบุเอง)" on both ชนิด and พันธุ์. Shared by register + farm settings.
export interface ProduceGroup { category: ProductCategory; type: string; varieties: string[] }
export const emptyGroup = (): ProduceGroup => ({ category: "flower", type: "", varieties: [] });

const OTHER = "__other__";
const CAT_UNIT: Record<ProductCategory, string> = { flower: "ดอกไม้", fruit: "ผลไม้", vegetable: "ผัก" };
// Tailwind needs literal class names — one map per accent.
const ACCENT = {
  pink: { active: "border-brand-pink bg-brand-pink font-medium text-white", link: "text-brand-pink", check: "accent-brand-pink", chip: "bg-brand-pink-light text-[#a51f58]", boxOn: "border-brand-pink bg-brand-pink-light text-[#a51f58]", outline: "border-brand-pink text-brand-pink hover:bg-brand-pink-light", ring: "focus-within:border-brand-pink" },
  blue: { active: "border-brand-blue bg-brand-blue font-medium text-white", link: "text-brand-blue", check: "accent-brand-blue", chip: "bg-blue-50 text-blue-700", boxOn: "border-brand-blue bg-blue-50 text-brand-blue", outline: "border-brand-blue text-brand-blue hover:bg-blue-50", ring: "focus-within:border-brand-blue" },
  green: { active: "border-brand-green bg-brand-green font-medium text-white", link: "text-brand-green", check: "accent-brand-green", chip: "bg-emerald-50 text-emerald-700", boxOn: "border-brand-green bg-emerald-50 text-emerald-700", outline: "border-brand-green text-brand-green hover:bg-emerald-50", ring: "focus-within:border-brand-green" },
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

// ---- ใบรับรองมาตรฐานสินค้าเกษตร (meeting 11-09-2026 mockup; Thai Post doc §17) ----
const CERT_KINDS: Certification["kind"][] = ["GAP", "GlobalGAP", "Organic Thailand", "other"];
const ISSUERS = ["กรมวิชาการเกษตร", "สำนักงานมาตรฐานสินค้าเกษตรและอาหารแห่งชาติ (มกอช.)", "กรมพัฒนาที่ดิน", "Control Union", "SGS", "Bureau Veritas"];
const FILE_TYPES = ["application/pdf", "image/jpeg", "image/png"];
/** A certificate being edited; at sign-up the picked file waits here until the account exists. */
export type CertDraft = Certification & { _file?: File };
export const emptyCert = (): CertDraft => ({ kind: "GAP", appliesTo: [] });
/** Per-certificate problems (index → message): type name for อื่นๆ, product types, expiry date. */
export function certErrors(certs: Certification[]): Record<number, string> {
  const e: Record<number, string> = {};
  certs.forEach((c, i) => {
    if (c.kind === "other" && !c.name?.trim()) e[i] = "กรุณาระบุชื่อใบรับรอง";
    else if (!c.appliesTo.length) e[i] = "กรุณาเลือกประเภทสินค้าที่ใช้ใบรับรองนี้";
    else if (!c.expiresAt) e[i] = "กรุณาระบุวันหมดอายุ";
  });
  return e;
}
/** Strip what must not be sent as JSON (the waiting file). */
export const certPayload = (certs: CertDraft[]): Certification[] => certs.map(({ _file, ...rest }) => { void _file; return rest; });

export function CertificationsEditor({
  certs, onChange, inputCls, accent = "blue", mode = "settings", skip, onSkip, errors = {}, supplierId, farmTypes = [],
}: {
  certs: CertDraft[]; onChange: (c: CertDraft[]) => void; inputCls: string; accent?: EditorAccent;
  /** "register": the file uploads after the account is made · "settings": it uploads at once */
  mode?: "register" | "settings";
  skip?: boolean; onSkip?: (v: boolean) => void;
  errors?: Record<number, string>;
  /** set when KYN edits a farm: uploads go to that farm */
  supplierId?: string;
  /** the farm's own products (first in the ชนิดสินค้า suggestions) */
  farmTypes?: { type: string; category: ProductCategory }[];
}) {
  const ac = ACCENT[accent];
  const [busy, setBusy] = useState<number | null>(null);
  const [fileErr, setFileErr] = useState<Record<number, string>>({});
  const update = (i: number, patch: Partial<CertDraft>) => onChange(certs.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const toggle = (i: number, cat: ProductCategory) => {
    const cur = certs[i].appliesTo;
    const off = cur.includes(cat);
    const catOf = (t: string) => farmTypes.find((f) => f.type === t)?.category ?? categoryOfType(t);
    update(i, {
      appliesTo: off ? cur.filter((x) => x !== cat) : [...cur, cat],
      productTypes: off ? (certs[i].productTypes ?? []).filter((t) => catOf(t) !== cat) : certs[i].productTypes,
    });
  };
  async function pick(i: number, f?: File | null) {
    setFileErr((x) => ({ ...x, [i]: "" }));
    if (!f) return;
    if (!FILE_TYPES.includes(f.type)) { setFileErr((x) => ({ ...x, [i]: "รองรับเฉพาะไฟล์ PDF, JPG หรือ PNG" })); return; }
    if (f.size > 2 * 1024 * 1024) { setFileErr((x) => ({ ...x, [i]: "ไฟล์ต้องไม่เกิน 2 MB" })); return; }
    if (mode === "register") { update(i, { _file: f, fileId: undefined, fileName: f.name }); return; }
    setBusy(i);
    const fd = new FormData(); fd.append("file", f);
    if (supplierId) fd.append("supplierId", supplierId);
    const r = await fetch("/api/cert-files", { method: "POST", body: fd });
    const d = await r.json().catch(() => ({}));
    if (r.ok) update(i, { fileId: d.id, fileName: d.name }); else setFileErr((x) => ({ ...x, [i]: d.error || "อัปโหลดไม่สำเร็จ" }));
    setBusy(null);
  }
  const lbl = "block text-[13px] font-medium text-slate-700";
  const req = <span className="text-[#ee443f]"> *</span>;
  const typeOptions = (sel: ProductCategory[]) => [...new Set([
    ...farmTypes.filter((f) => sel.includes(f.category)).map((f) => f.type),
    ...sel.flatMap((c) => typesFor(c)),
  ])];
  return (
    <div className="space-y-[14px]">
      <p className="text-[18px] font-semibold text-black">ใบรับรองมาตรฐาน <span className="text-[13px] font-normal text-slate-500">(ไม่บังคับ)</span></p>
      {!skip ? (
        <>
          <p className="flex items-center gap-2.5 rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] text-slate-700">
            <Info size={18} className="shrink-0 fill-amber-400 text-white" /> ระบุขอบเขตสินค้าให้ตรงตามใบรับรอง เพื่อแสดงมาตรฐานกับสินค้าที่ได้รับการรับรองเท่านั้น
          </p>
          <datalist id="cert-issuers">{ISSUERS.map((x) => <option key={x} value={x} />)}</datalist>
          {certs.map((c, i) => (
            <div key={i} className={`space-y-[14px] rounded-[12px] border p-[16px] ${errors[i] ? "border-[#ee443f]" : "border-gray-200"}`}>
              <div className="flex items-center justify-between">
                <p className="text-[14px] font-semibold text-slate-800">ใบรับรองที่ {i + 1}</p>
                <button type="button" onClick={() => onChange(certs.filter((_, j) => j !== i))} className="inline-flex items-center gap-1.5 text-[13px] text-slate-500 hover:text-[#ee443f]">
                  <Trash2 size={15} /> ลบใบรับรองนี้
                </button>
              </div>
              <div className="grid gap-[12px] sm:grid-cols-2">
                <label className="block space-y-[6px]">
                  <span className={lbl}>ประเภทใบรับรอง{req}</span>
                  <select value={c.kind} onChange={(e) => update(i, { kind: e.target.value as Certification["kind"] })} className={inputCls}>
                    {CERT_KINDS.map((k) => <option key={k} value={k}>{k === "other" ? "อื่นๆ (ระบุ)" : k}</option>)}
                  </select>
                  {c.kind === "other" ? <input value={c.name ?? ""} onChange={(e) => update(i, { name: e.target.value })} placeholder="ชื่อใบรับรอง เช่น PGS, Q Mark" className={inputCls} /> : null}
                </label>
                <label className="block space-y-[6px]">
                  <span className={lbl}>เลขที่ใบรับรอง</span>
                  <input value={c.certNo ?? ""} onChange={(e) => update(i, { certNo: e.target.value })} placeholder="กรอกเลขที่ใบรับรอง" className={inputCls} />
                </label>
                <label className="block space-y-[6px]">
                  <span className={lbl}>หน่วยงานที่ออก</span>
                  <input list="cert-issuers" value={c.issuer ?? ""} onChange={(e) => update(i, { issuer: e.target.value })} placeholder="เช่น กรมวิชาการเกษตร" className={inputCls} />
                </label>
                <div className="space-y-[6px]">
                  <span className={lbl}>วันหมดอายุ{req}</span>
                  <DateField value={c.expiresAt ?? ""} onChange={(v) => update(i, { expiresAt: v })} className={inputCls} />
                </div>
              </div>
              <div className="space-y-[8px]">
                <div>
                  <span className={lbl}>ขอบเขตการรับรอง{req}</span>
                  <span className="block text-[12px] text-slate-500">เลือกประเภทและชนิดสินค้าที่ระบุในใบรับรอง</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {PRODUCT_CATEGORIES.map((cat) => {
                    const on = c.appliesTo.includes(cat.key);
                    return (
                      <label key={cat.key} className={`flex cursor-pointer items-center justify-center gap-2 rounded-[10px] border px-3 py-3 text-[14px] transition ${on ? `${ac.boxOn} font-medium` : "border-gray-300 text-slate-700 hover:border-slate-400"}`}>
                        <input type="checkbox" checked={on} onChange={() => toggle(i, cat.key)} className={`size-4 ${ac.check}`} /> {cat.label}
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-[6px]">
                <span className={lbl}>ชนิดสินค้า</span>
                <ChipsInput value={c.productTypes ?? []} onChange={(v) => update(i, { productTypes: v })} options={typeOptions(c.appliesTo)}
                  placeholder={c.appliesTo.length ? "เลือกชนิดสินค้าที่ได้รับการรับรอง" : "เลือกขอบเขตการรับรองก่อน"} disabled={!c.appliesTo.length} chipCls={ac.chip} ringCls={ac.ring} />
                <span className="block text-[11px] text-slate-400">ไม่ระบุชนิด = ใช้กับทุกชนิดในประเภทที่เลือก</span>
              </div>
              <div className="space-y-[6px]">
                <span className={lbl}>แนบไฟล์ใบรับรอง <span className="font-normal text-slate-500">(ไม่บังคับ)</span></span>
                <div className="flex flex-wrap items-center gap-3 rounded-[10px] border border-dashed border-gray-300 px-3 py-3">
                  <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] border bg-white px-3 py-1.5 text-[13px] font-medium ${ac.outline}`}>
                    {busy === i ? <Loader2 size={15} className="animate-spin" /> : <CloudUpload size={16} />} {c.fileName ? "เปลี่ยนไฟล์" : "เลือกไฟล์"}
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="hidden" onChange={(e) => { pick(i, e.target.files?.[0]); e.target.value = ""; }} />
                  </label>
                  {c.fileName ? (
                    <span className="flex min-w-0 items-center gap-2 text-[13px] text-slate-700">
                      <FileText size={15} className="shrink-0 text-slate-400" />
                      {c.fileId ? <a href={`/api/cert-files/${c.fileId}`} target="_blank" rel="noreferrer" className={`truncate underline ${ac.link}`}>{c.fileName}</a> : <span className="truncate">{c.fileName}</span>}
                      {c._file ? <span className="shrink-0 text-slate-400">· อัปโหลดหลังสมัครเสร็จ</span> : null}
                      <button type="button" onClick={() => update(i, { fileId: undefined, fileName: undefined, _file: undefined })} className="shrink-0 text-[#ee443f] underline">ลบไฟล์</button>
                    </span>
                  ) : <span className="text-[13px] text-slate-400">ยังไม่ได้แนบไฟล์</span>}
                </div>
                {fileErr[i] ? <p className="text-[12px] text-[#ee443f]">{fileErr[i]}</p> : null}
                <p className="flex items-center gap-1.5 text-[12px] text-slate-500"><Bell size={14} className="fill-amber-400 text-amber-500" /> ระบบจะแจ้งเตือนก่อนใบรับรองหมดอายุ 30 วัน</p>
              </div>
              {errors[i] ? <p className="text-[12px] text-[#ee443f]">{errors[i]}</p> : null}
            </div>
          ))}
          <button type="button" onClick={() => onChange([...certs, emptyCert()])} className={`inline-flex items-center gap-1.5 text-[14px] font-medium hover:underline ${ac.link}`}>
            <Plus size={17} /> เพิ่มใบรับรอง
          </button>
        </>
      ) : null}
      {onSkip ? (
        <label className="flex items-center gap-2 text-[13px] text-slate-700">
          <input type="checkbox" checked={!!skip} onChange={(e) => onSkip(e.target.checked)} className={ac.check} /> ยังไม่มีใบรับรองมาตรฐาน — ข้ามขั้นตอนนี้ไปก่อน
        </label>
      ) : null}
    </div>
  );
}

/** ชนิดสินค้า: chips + type-to-filter suggestions; Enter adds the first match (or what was typed), Backspace
 *  removes the last chip. */
function ChipsInput({ value, onChange, options, placeholder, disabled, chipCls, ringCls }: {
  value: string[]; onChange: (v: string[]) => void; options: string[]; placeholder: string; disabled?: boolean; chipCls: string; ringCls: string;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", off);
    return () => document.removeEventListener("mousedown", off);
  }, [open]);
  const needle = q.trim().toLowerCase();
  const hits = options.filter((o) => !value.includes(o) && (!needle || o.toLowerCase().includes(needle)));
  const add = (t: string) => { const v = t.trim(); if (v && !value.includes(v)) onChange([...value, v]); setQ(""); input.current?.focus(); };
  const typedNew = q.trim() && !options.some((o) => o.toLowerCase() === needle) && !value.includes(q.trim());
  return (
    <div ref={wrap} className="relative">
      <div onClick={() => { if (!disabled) { input.current?.focus(); setOpen(true); } }}
        className={`flex min-h-[44px] flex-wrap items-center gap-1.5 rounded-[8px] border border-gray-300 px-2 py-1.5 ${disabled ? "cursor-not-allowed bg-slate-50" : `cursor-text bg-white ${ringCls}`}`}>
        {value.map((t) => (
          <span key={t} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-medium ${chipCls}`}>
            {t}
            <button type="button" aria-label={`ลบ ${t}`} onClick={(e) => { e.stopPropagation(); onChange(value.filter((x) => x !== t)); }} className="opacity-70 hover:opacity-100"><X size={13} /></button>
          </span>
        ))}
        <input ref={input} value={q} disabled={disabled} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); if (hits[0] && (needle || !typedNew)) add(hits[0]); else if (typedNew) add(q); }
            else if (e.key === "Backspace" && !q && value.length) onChange(value.slice(0, -1));
            else if (e.key === "Escape") setOpen(false);
          }}
          placeholder={value.length ? "" : placeholder} className="min-w-[180px] flex-1 border-0 bg-transparent px-1 py-1 text-[13px] text-black outline-none placeholder:text-slate-400 disabled:cursor-not-allowed" />
      </div>
      {open && !disabled && (hits.length || typedNew) ? (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-[8px] border border-slate-200 bg-white py-1 shadow-lg">
          {hits.slice(0, 60).map((o) => (
            <li key={o}><button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => add(o)} className="block w-full px-3 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50">{o}</button></li>
          ))}
          {typedNew ? <li><button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => add(q)} className="block w-full border-t border-slate-100 px-3 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50">อื่นๆ (ระบุ): “{q.trim()}”</button></li> : null}
        </ul>
      ) : null}
    </div>
  );
}
