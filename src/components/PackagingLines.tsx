"use client";

import { PlusCircle, Trash2 } from "lucide-react";
import { INNER_MATERIALS, innerMaterial } from "@/lib/inner-materials";
import type { PackageSize } from "@/lib/factors";
import type { InnerMaterialLine } from "@/lib/types";

// Packaging lines shared by the supplier round form and the logistic export form.
// KYN spec: staff enter each package's real W × L × H (cm) + quantity; boxes also declare their
// inner material (from the KYN packaging master) and how much of it goes into each box.
export const PACK_KINDS = [
  { key: "basket", label: "ตะกร้า" },
  { key: "corrugated_box", label: "กล่องลูกฟูก" },
  { key: "plastic_film", label: "แผ่นพลาสติก / ซองห่อช่อ" },
] as const;

export interface PackLine {
  kind: string;
  w: string; l: string; h: string; // cm
  qty: string;
  basketNo: string;
  boxMaterial: string; // INNER_MATERIALS[].name
  innerQty: string;    // per box, in the material's own unit
}
export const emptyPackLine = (): PackLine => ({ kind: "", w: "", l: "", h: "", qty: "", basketNo: "", boxMaterial: "", innerQty: "" });

const QTY_OPTIONS = Array.from({ length: 50 }, (_, i) => i + 1);
const num = (v: string) => (Number(v) > 0 ? Number(v) : 0);

export const packKindLabel = (k: string) => PACK_KINDS.find((x) => x.key === k)?.label ?? k;
export function packSizeText(p: PackLine): string {
  if (p.kind === "basket") return "ตะกร้ามาตรฐาน";
  if (!num(p.w) || !num(p.l)) return "";
  return p.kind === "plastic_film" ? `${p.w} × ${p.l} ซม.` : `${p.w} × ${p.l} × ${p.h || 0} ซม.`;
}
export function packInnerText(p: PackLine): string {
  const m = innerMaterial(p.boxMaterial);
  if (!m) return p.boxMaterial;
  return `${m.name} · ${p.innerQty || m.defaultPerBox} ${m.countUnit}/กล่อง`;
}

export function validatePackLines(lines: PackLine[]): Record<string, string> {
  const e: Record<string, string> = {};
  lines.forEach((p, i) => {
    if (!p.kind) e[`pack.${i}.kind`] = "กรุณาเลือกบรรจุภัณฑ์";
    if (p.kind === "basket" && !p.basketNo.trim()) e[`pack.${i}.basketNo`] = "กรุณาระบุหมายเลขตะกร้า";
    if (p.kind === "corrugated_box" && !p.boxMaterial) e[`pack.${i}.boxMaterial`] = "กรุณาระบุวัสดุภายในกล่อง";
    if (p.kind && p.kind !== "basket" && (!num(p.w) || !num(p.l))) e[`pack.${i}.size`] = "กรุณาระบุกว้างและยาว";
    if (p.kind === "corrugated_box" && !num(p.h)) e[`pack.${i}.size`] = "กรุณาระบุกว้าง ยาว และสูง";
    if (!p.qty || Number(p.qty) <= 0) e[`pack.${i}.qty`] = "กรุณาระบุจำนวน";
  });
  return e;
}

/** API payload pieces derived from the lines. */
export function packLinesToPayload(lines: PackLine[]) {
  const used = lines.filter((p) => p.kind);
  const packagingItems = used.map((p) => ({
    kind: p.kind,
    width: p.kind === "basket" ? undefined : num(p.w) || undefined,
    length: p.kind === "basket" ? undefined : num(p.l) || undefined,
    height: p.kind === "corrugated_box" ? num(p.h) || undefined : undefined,
    quantity: Number(p.qty) || (p.basketNo.trim() ? 1 : 0),
    basketNo: p.basketNo.trim() || undefined,
    boxMaterial: p.boxMaterial || undefined,
  }));
  const innerMaterials: InnerMaterialLine[] = used
    .filter((p) => p.kind === "corrugated_box" && p.boxMaterial)
    .map((p) => {
      const m = innerMaterial(p.boxMaterial);
      const perBox = num(p.innerQty) || m?.defaultPerBox || 1;
      return { material: p.boxMaterial, qty: perBox * (Number(p.qty) || 1) };
    });
  return {
    packagingItems,
    innerMaterials,
    basketIds: used.filter((p) => p.kind === "basket" && p.basketNo.trim()).map((p) => p.basketNo.trim()),
    boxMaterial: used.find((p) => p.kind === "corrugated_box")?.boxMaterial,
  };
}

/** Rebuild lines from a stored batch (logistic form "same as before"). */
export function packLinesFromBatch(items: { kind: string; width?: number; length?: number; height?: number; quantity: number; basketNo?: string; boxMaterial?: string }[] | undefined, inner?: InnerMaterialLine[]): PackLine[] {
  const pool = [...(inner ?? [])]; // each saved inner line belongs to one box line, in order
  return (items ?? []).map((p) => {
    const at = p.kind === "corrugated_box" ? pool.findIndex((m) => m.material === p.boxMaterial) : -1;
    const inn = at >= 0 ? pool.splice(at, 1)[0] : undefined;
    const perBox = inn && p.quantity ? inn.qty / p.quantity : undefined;
    return {
      kind: p.kind, w: p.width ? String(p.width) : "", l: p.length ? String(p.length) : "", h: p.height ? String(p.height) : "",
      qty: p.quantity ? String(p.quantity) : "", basketNo: p.basketNo ?? "", boxMaterial: p.boxMaterial ?? "", innerQty: perBox ? String(Math.round(perBox * 100) / 100) : "",
    };
  });
}

export default function PackagingLines({
  lines, onChange, errs, clearErr, inputCls, labelCls, basketOptions = [], sizePresets, linkCls = "text-blue-600",
}: {
  lines: PackLine[];
  onChange: (l: PackLine[]) => void;
  errs: Record<string, string>;
  clearErr: (key: string) => void;
  inputCls: string;
  labelCls: string;
  basketOptions?: string[];
  sizePresets: PackageSize[];
  linkCls?: string;
}) {
  const req = <span className="text-[#ee443f]"> *</span>;
  const Err = ({ k }: { k: string }) => (errs[k] ? <p className="mt-1 text-[12px] text-[#ee443f]">{errs[k]}</p> : null);
  const set = (i: number, patch: Partial<PackLine>) => onChange(lines.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const bad = (k: string) => (errs[k] ? "border-[#ee443f]" : "");

  return (
    <>
      {lines.map((p, i) => {
        const m = innerMaterial(p.boxMaterial);
        const presets = sizePresets.filter((s) => (p.kind === "plastic_film" ? true : s.h > 0));
        return (
          <div key={i} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className={labelCls}>บรรจุภัณฑ์{req}</label>
                <select value={p.kind} onChange={(e) => { set(i, { kind: e.target.value }); clearErr(`pack.${i}.kind`); }} className={`${inputCls} ${bad(`pack.${i}.kind`)}`}>
                  <option value="">เลือกบรรจุภัณฑ์</option>
                  {PACK_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
                </select>
                <Err k={`pack.${i}.kind`} />
              </div>
              {p.kind === "basket" ? (
                <div>
                  <label className={labelCls}>หมายเลขตะกร้า{req}</label>
                  <input list={`baskets-${i}`} value={p.basketNo} onChange={(e) => { set(i, { basketNo: e.target.value }); clearErr(`pack.${i}.basketNo`); }} placeholder="เช่น BSK-014" className={`${inputCls} ${bad(`pack.${i}.basketNo`)}`} />
                  <datalist id={`baskets-${i}`}>{basketOptions.map((b) => <option key={b} value={b} />)}</datalist>
                  <Err k={`pack.${i}.basketNo`} />
                </div>
              ) : null}
              {p.kind === "corrugated_box" ? (
                <div>
                  <label className={labelCls}>วัสดุภายในกล่อง{req}</label>
                  <select value={p.boxMaterial} onChange={(e) => { set(i, { boxMaterial: e.target.value, innerQty: "" }); clearErr(`pack.${i}.boxMaterial`); }} className={`${inputCls} ${bad(`pack.${i}.boxMaterial`)}`}>
                    <option value="">ระบุวัสดุภายในกล่อง</option>
                    {INNER_MATERIALS.map((x) => <option key={x.name} value={x.name}>{x.name}</option>)}
                  </select>
                  <Err k={`pack.${i}.boxMaterial`} />
                </div>
              ) : null}
              <div>
                <label className={labelCls}>จำนวน{req}</label>
                <select value={p.qty} onChange={(e) => { set(i, { qty: e.target.value }); clearErr(`pack.${i}.qty`); }} className={`${inputCls} ${bad(`pack.${i}.qty`)}`}>
                  <option value="">ระบุจำนวน</option>
                  {QTY_OPTIONS.map((q) => <option key={q} value={q}>{q}</option>)}
                </select>
                <Err k={`pack.${i}.qty`} />
              </div>
            </div>

            {p.kind && p.kind !== "basket" ? (
              <div className="grid gap-3 sm:grid-cols-4">
                <div>
                  <label className={labelCls}>ขนาดสำเร็จรูป</label>
                  <select value="" onChange={(e) => { const s = presets.find((x) => x.label === e.target.value); if (s) { set(i, { w: String(s.w), l: String(s.l), h: s.h ? String(s.h) : "" }); clearErr(`pack.${i}.size`); } }} className={inputCls}>
                    <option value="">เลือกขนาด</option>
                    {presets.map((s) => <option key={s.label} value={s.label}>{s.label}</option>)}
                  </select>
                </div>
                {(["w", "l", "h"] as const).filter((k) => k !== "h" || p.kind === "corrugated_box").map((k) => (
                  <div key={k}>
                    <label className={labelCls}>{k === "w" ? "กว้าง" : k === "l" ? "ยาว" : "สูง"} (ซม.){req}</label>
                    <input type="number" min="0" step="any" value={p[k]} onChange={(e) => { set(i, { [k]: e.target.value } as Partial<PackLine>); clearErr(`pack.${i}.size`); }} placeholder="0" className={`${inputCls} ${bad(`pack.${i}.size`)}`} />
                  </div>
                ))}
                <div className="sm:col-span-4"><Err k={`pack.${i}.size`} /></div>
              </div>
            ) : null}

            {p.kind === "corrugated_box" && m ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className={labelCls}>ปริมาณวัสดุต่อกล่อง ({m.countUnit})</label>
                  <input type="number" min="0" step="any" value={p.innerQty} onChange={(e) => set(i, { innerQty: e.target.value })} placeholder={String(m.defaultPerBox)} className={inputCls} />
                </div>
                <p className="self-end pb-2 text-[11px] text-slate-400 sm:col-span-2">EF {m.ef} kg CO₂e/{m.perKg ? "kg" : m.countUnit} · น้ำหนักมาตรฐาน {m.weightPerUnitKg} kg/{m.countUnit} (ตาราง KYN)</p>
              </div>
            ) : null}

            {lines.length > 1 ? (
              <button type="button" onClick={() => onChange(lines.filter((_, j) => j !== i))} className="inline-flex items-center gap-1 text-[12px] text-red-500 hover:underline">
                <Trash2 size={13} /> ลบบรรจุภัณฑ์
              </button>
            ) : null}
          </div>
        );
      })}
      <div className="flex justify-end">
        <button type="button" onClick={() => onChange([...lines, emptyPackLine()])} className={`inline-flex items-center gap-1.5 text-[13px] font-medium hover:underline ${linkCls}`}>
          <PlusCircle size={16} /> เพิ่มรายการอื่น
        </button>
      </div>
    </>
  );
}
