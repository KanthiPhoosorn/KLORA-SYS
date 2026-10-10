"use client";

import { useState } from "react";
import { Bell, FileText, Loader2, Plus, Trash2 } from "lucide-react";
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
  certs, onChange, inputCls, accent = "blue", mode = "settings", skip, onSkip, errors = {}, supplierId,
}: {
  certs: CertDraft[]; onChange: (c: CertDraft[]) => void; inputCls: string; accent?: EditorAccent;
  /** "register": the file uploads after the account is made · "settings": it uploads at once */
  mode?: "register" | "settings";
  skip?: boolean; onSkip?: (v: boolean) => void;
  errors?: Record<number, string>;
  /** set when KYN edits a farm: uploads go to that farm */
  supplierId?: string;
}) {
  const ac = ACCENT[accent];
  const [busy, setBusy] = useState<number | null>(null);
  const [fileErr, setFileErr] = useState<Record<number, string>>({});
  const update = (i: number, patch: Partial<CertDraft>) => onChange(certs.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const toggle = (i: number, cat: ProductCategory) => {
    const cur = certs[i].appliesTo;
    update(i, { appliesTo: cur.includes(cat) ? cur.filter((x) => x !== cat) : [...cur, cat] });
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
  const lbl = "block text-[12px] text-black";
  const req = <span className="text-[#ee443f]"> *</span>;
  return (
    <div className="space-y-[14px]">
      <div className="border-b border-gray-200 pb-2">
        <p className="text-[16px] font-semibold text-black">ใบรับรองมาตรฐาน <span className="text-[12px] font-normal text-slate-500">(ไม่บังคับ)</span></p>
      </div>
      {!skip ? (
        <>
          <p className="rounded-[8px] border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
            ระบุเลขที่ใบรับรองไว้ก่อนได้ — แนบไฟล์ทีหลังได้ที่หน้า &quot;ข้อมูลฟาร์ม&quot; และระบบจะแจ้งเตือนล่วงหน้าก่อนใบรับรองหมดอายุให้อัตโนมัติ
          </p>
          <datalist id="cert-issuers">{ISSUERS.map((x) => <option key={x} value={x} />)}</datalist>
          {certs.map((c, i) => (
            <div key={i} className={`space-y-[12px] rounded-[10px] border p-[14px] ${errors[i] ? "border-[#ee443f]" : "border-gray-200"}`}>
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-medium text-slate-500">ใบรับรองที่ {i + 1}</p>
                <button type="button" onClick={() => onChange(certs.filter((_, j) => j !== i))} className="inline-flex items-center gap-1 text-[12px] text-slate-500 hover:text-[#ee443f]">
                  <Trash2 size={13} /> ลบใบรับรองนี้
                </button>
              </div>
              <div className="grid gap-[12px] sm:grid-cols-2">
                <label className="block space-y-[5px]">
                  <span className={lbl}>ประเภทใบรับรอง{req}</span>
                  <select value={c.kind} onChange={(e) => update(i, { kind: e.target.value as Certification["kind"] })} className={inputCls}>
                    {CERT_KINDS.map((k) => <option key={k} value={k}>{k === "other" ? "อื่นๆ (ระบุ)" : k}</option>)}
                  </select>
                  {c.kind === "other" ? <input value={c.name ?? ""} onChange={(e) => update(i, { name: e.target.value })} placeholder="ชื่อใบรับรอง เช่น PGS, Q Mark" className={inputCls} /> : null}
                </label>
                <label className="block space-y-[5px]">
                  <span className={lbl}>เลขที่ใบรับรอง</span>
                  <input value={c.certNo ?? ""} onChange={(e) => update(i, { certNo: e.target.value })} placeholder="ถ้ามี" className={inputCls} />
                </label>
              </div>
              <div className="space-y-[5px]">
                <span className={lbl}>ใช้กับประเภทสินค้า{req}</span>
                <div className="flex flex-wrap gap-2">
                  {PRODUCT_CATEGORIES.map((cat) => (
                    <label key={cat.key} className="flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-[12px] text-slate-700">
                      <input type="checkbox" checked={c.appliesTo.includes(cat.key)} onChange={() => toggle(i, cat.key)} className={ac.check} /> {cat.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid gap-[12px] sm:grid-cols-2">
                <label className="block space-y-[5px]">
                  <span className={lbl}>หน่วยงานที่ออก</span>
                  <input list="cert-issuers" value={c.issuer ?? ""} onChange={(e) => update(i, { issuer: e.target.value })} placeholder="เช่น กรมวิชาการเกษตร" className={inputCls} />
                </label>
                <label className="block space-y-[5px]">
                  <span className={lbl}>วันหมดอายุ{req}</span>
                  <input type="date" value={c.expiresAt ?? ""} onChange={(e) => update(i, { expiresAt: e.target.value })} className={inputCls} />
                </label>
              </div>
              <div className="space-y-[5px]">
                <span className={lbl}>แนบไฟล์ <span className="text-slate-500">(ไม่บังคับตอนนี้)</span></span>
                <div className="flex flex-wrap items-center gap-3 rounded-[8px] border border-dashed border-gray-300 px-3 py-2.5">
                  <label className="cursor-pointer rounded-[6px] border border-gray-300 bg-white px-3 py-1.5 text-[12px] text-slate-700 hover:bg-gray-50">
                    {busy === i ? <Loader2 size={13} className="inline animate-spin" /> : c.fileName ? "เปลี่ยนไฟล์" : "เลือกไฟล์"}
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="hidden" onChange={(e) => { pick(i, e.target.files?.[0]); e.target.value = ""; }} />
                  </label>
                  {c.fileName ? (
                    <span className="flex min-w-0 items-center gap-2 text-[12px] text-slate-700">
                      <FileText size={14} className="shrink-0 text-slate-400" />
                      {c.fileId ? <a href={`/api/cert-files/${c.fileId}`} target="_blank" rel="noreferrer" className={`truncate underline ${ac.link}`}>{c.fileName}</a> : <span className="truncate">{c.fileName}</span>}
                      {c._file ? <span className="shrink-0 text-slate-400">· อัปโหลดหลังสมัครเสร็จ</span> : null}
                      <button type="button" onClick={() => update(i, { fileId: undefined, fileName: undefined, _file: undefined })} className="shrink-0 text-[#ee443f] underline">ลบไฟล์</button>
                    </span>
                  ) : <span className="text-[12px] text-slate-400">ยังไม่ได้แนบไฟล์ — แนบทีหลังได้</span>}
                </div>
                {fileErr[i] ? <p className="text-[12px] text-[#ee443f]">{fileErr[i]}</p> : null}
                <p className="flex items-center gap-1.5 text-[11px] text-slate-500"><Bell size={12} className="text-amber-500" /> ระบบจะแจ้งเตือนอัตโนมัติล่วงหน้า 30 วันก่อนใบรับรองนี้หมดอายุ</p>
              </div>
              {errors[i] ? <p className="text-[12px] text-[#ee443f]">{errors[i]}</p> : null}
            </div>
          ))}
          <button type="button" onClick={() => onChange([...certs, emptyCert()])} className={`inline-flex items-center gap-1.5 text-[13px] font-medium hover:underline ${ac.link}`}>
            <Plus size={15} /> เพิ่มใบรับรอง
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
