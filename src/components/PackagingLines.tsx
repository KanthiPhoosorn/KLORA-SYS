"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import type { PackagingAsset, PackagingLine, ProductCategory } from "@/lib/types";
import {
  OTHER, NO_PACK, NO_INNER, PACK_UNITS, INNER_UNITS, packsFor, innersFor, rowCarbon, rowText,
  type PackCatalog, type PackRow, type MaterialId,
} from "@/lib/packaging-catalog";

// บรรจุภัณฑ์ที่ใช้ในการจัดส่ง — Thai Post doc 9 Oct 2026 §4 (mockup "ฟอร์มบรรจุภัณฑ์"). Shared by the
// farm round form and the logistic export form. Every row shows the same fields; a field that
// does not apply says "ไม่มี" in grey instead of disappearing.
//   บรรจุภัณฑ์ * | การใช้งาน * | หมายเลขบรรจุภัณฑ์ | ขนาด * | จำนวน * + หน่วย
//   วัสดุภายใน (ต่อ 1 หน่วยบรรจุภัณฑ์) | จำนวน + หน่วย   — several per package
export interface InnerState { kind: string; qty: string; unit: string; otherName: string; otherMaterial: MaterialId }
export interface PackRowState {
  kind: string; usage: "single" | "reusable"; code: string; // "" | PKG-… | "new"
  size: string; dimW: string; dimL: string; dimH: string; dimUnit: "cm" | "in";
  qty: string; unit: string;
  otherName: string; otherMaterial: MaterialId; otherWeight: string; otherWeighed: string; otherWeighedUnit: "กรัม" | "กก.";
  priorUses: string;
  inners: InnerState[];
}
const noInner = (): InnerState => ({ kind: NO_INNER, qty: "", unit: "ใบ", otherName: "", otherMaterial: "mixed" });

/** A row preset from the catalog: the kind's default usage, unit and middle size (§4.3). */
export function rowFor(cat: PackCatalog, kind: string, prev?: PackRowState): PackRowState {
  const k = cat.packs.find((p) => p.id === kind);
  const base: PackRowState = prev ?? {
    kind, usage: "single", code: "", size: "", dimW: "", dimL: "", dimH: "", dimUnit: "cm", qty: "", unit: "ใบ",
    otherName: "", otherMaterial: "mixed", otherWeight: "mid", otherWeighed: "", otherWeighedUnit: "กรัม", priorUses: "", inners: [noInner()],
  };
  if (kind === NO_PACK) return { ...base, kind, usage: "single", code: "", size: "none", qty: "", inners: [noInner()] };
  if (kind === OTHER) return { ...base, kind, usage: "single", code: "", size: "custom", unit: "ใบ" };
  return {
    ...base, kind,
    usage: k?.usage ?? "single",
    code: "",
    unit: k?.unit ?? "ใบ",
    size: k?.sizes[Math.floor(((k?.sizes.length ?? 1) - 1) / 2)]?.id ?? "unknown",
  };
}
export const firstRow = (cat: PackCatalog, product: ProductCategory) => rowFor(cat, packsFor(cat, product)[0]?.id ?? "carton");

const n = (v: string) => (Number(v) > 0 ? Number(v) : 0);

/** State → stored row (batches.packaging_items, v: 2). */
export function toPackRow(r: PackRowState): PackRow {
  return {
    v: 2,
    kind: r.kind,
    usage: r.kind === NO_PACK ? "single" : r.usage,
    assetId: r.usage === "reusable" && r.code && r.code !== "new" ? r.code : undefined,
    size: r.kind === NO_PACK ? "none" : r.size,
    dims: r.size === "custom" && n(r.dimW) && n(r.dimL) ? { w: n(r.dimW), l: n(r.dimL), h: n(r.dimH), unit: r.dimUnit } : undefined,
    quantity: r.kind === NO_PACK ? 0 : n(r.qty),
    unit: r.unit,
    other: r.kind === OTHER ? {
      name: r.otherName.trim(), material: r.otherMaterial, weightClass: r.otherWeight,
      weighedKg: r.otherWeight === "weighed" ? (r.otherWeighedUnit === "กรัม" ? n(r.otherWeighed) / 1000 : n(r.otherWeighed)) : undefined,
    } : undefined,
    inners: r.kind === NO_PACK ? [] : r.inners
      .filter((i) => i.kind === NO_INNER || n(i.qty) > 0)
      .map((i) => ({ kind: i.kind, qty: n(i.qty), unit: i.unit, ...(i.kind === OTHER ? { other: { name: i.otherName.trim() || "อื่นๆ", material: i.otherMaterial } } : {}) })),
  };
}

/** API payload pieces. */
export function rowsToPayload(rows: PackRowState[]) {
  const packagingItems = rows.map(toPackRow) as unknown as PackagingLine[];
  const basketIds = [...new Set(rows.filter((r) => r.usage === "reusable" && r.code && r.code !== "new").map((r) => r.code))];
  return { packagingItems, basketIds };
}

/** Stored lines → form state (edit / prefill). Older W×L×H lines are mapped to the nearest catalog row. */
export function rowsFromBatch(items: PackagingLine[] | undefined, cat: PackCatalog): PackRowState[] {
  return (items ?? []).map((p) => {
    if (p.v === 2) {
      const r = rowFor(cat, p.kind);
      return {
        ...r, usage: p.usage === "reusable" ? "reusable" : "single", code: p.assetId ?? "",
        size: p.size ?? r.size, dimW: p.dims ? String(p.dims.w) : "", dimL: p.dims ? String(p.dims.l) : "", dimH: p.dims ? String(p.dims.h || "") : "", dimUnit: p.dims?.unit ?? "cm",
        qty: p.quantity ? String(p.quantity) : "", unit: p.unit ?? r.unit,
        otherName: p.other?.name ?? "", otherMaterial: p.other?.material ?? "mixed", otherWeight: p.other?.weightClass ?? "mid",
        otherWeighed: p.other?.weighedKg ? String(p.other.weighedKg) : "", otherWeighedUnit: "กก.",
        inners: p.inners?.length ? p.inners.map((i) => ({ kind: i.kind, qty: i.qty ? String(i.qty) : "", unit: i.unit, otherName: i.other?.name ?? "", otherMaterial: i.other?.material ?? "mixed" })) : [noInner()],
      };
    }
    // 22 Sep form: basket → ตะกร้าพลาสติก, corrugated_box → กล่องลูกฟูก (custom size), plastic_film → ซอง (อื่นๆ)
    if (p.kind === "basket") return { ...rowFor(cat, "basket"), usage: p.usage === "single" ? "single" : "reusable", code: p.assetId ?? p.basketNo ?? "", qty: String(p.quantity || 1) };
    if (p.kind === "corrugated_box") return { ...rowFor(cat, "carton"), size: p.width ? "custom" : "unknown", dimW: p.width ? String(p.width) : "", dimL: p.length ? String(p.length) : "", dimH: p.height ? String(p.height) : "", qty: String(p.quantity || 1) };
    return { ...rowFor(cat, OTHER), otherName: "แผ่นพลาสติก / ซองห่อช่อ", otherMaterial: "pe", otherWeight: "xlight", qty: String(p.quantity || 1) };
  });
}

export function validateRows(rows: PackRowState[]): Record<string, string> {
  const e: Record<string, string> = {};
  const seen = new Map<string, number>();
  rows.forEach((r, i) => {
    if (!r.kind) { e[`pack.${i}.kind`] = "กรุณาเลือกบรรจุภัณฑ์"; return; }
    if (r.kind === NO_PACK) return;
    if (r.usage === "reusable") {
      if (!r.code) e[`pack.${i}.code`] = "บรรจุภัณฑ์หมุนเวียนต้องมีหมายเลข";
      else if (r.code === "new") e[`pack.${i}.code`] = "กด “ลงทะเบียนและใช้งาน” ก่อน";
      else if (seen.has(r.code)) e[`pack.${i}.code`] = `หมายเลขนี้เลือกไว้แล้วในบรรจุภัณฑ์ที่ ${seen.get(r.code)! + 1}`;
      else seen.set(r.code, i);
    }
    if (!r.size) e[`pack.${i}.size`] = "กรุณาเลือกขนาด";
    if (r.size === "custom" && (!n(r.dimW) || !n(r.dimL))) e[`pack.${i}.size`] = "กรุณาระบุ กว้าง × ยาว (× สูง)";
    if (!(n(r.qty) > 0)) e[`pack.${i}.qty`] = "กรุณาระบุจำนวน";
    if (r.kind === OTHER) {
      if (!r.otherName.trim()) e[`pack.${i}.otherName`] = "กรุณาระบุชื่อบรรจุภัณฑ์";
      if (r.otherWeight === "weighed" && !n(r.otherWeighed)) e[`pack.${i}.otherWeighed`] = "กรุณาระบุน้ำหนักที่ชั่งได้";
    }
    r.inners.forEach((m, j) => {
      if (m.kind !== NO_INNER && !(n(m.qty) > 0)) e[`pack.${i}.inner.${j}`] = "กรุณาระบุจำนวนวัสดุ";
      if (m.kind === OTHER && !m.otherName.trim()) e[`pack.${i}.inner.${j}`] = "กรุณาระบุชื่อวัสดุ";
    });
  });
  return e;
}

/** Packaging weight (kg) of all rows — the total packed weight must be larger (§4.8 check). */
export const rowsWeightKg = (rows: PackRowState[], cat: PackCatalog) => rows.reduce((s, r) => s + rowCarbon(toPackRow(r), cat).weightKg, 0);
export const rowSummary = (r: PackRowState, cat: PackCatalog) => rowText(toPackRow(r), cat);
export const rowEstimate = (r: PackRowState, cat: PackCatalog) => rowCarbon(toPackRow(r), cat).estimate;

export default function PackagingLines({
  rows, onChange, errs, clearErr, inputCls, labelCls, catalog, product,
  accentText = "text-blue-600", outlineBtnCls = "border border-blue-600 text-blue-600 hover:bg-blue-50",
}: {
  rows: PackRowState[];
  onChange: (r: PackRowState[]) => void;
  errs: Record<string, string>;
  clearErr: (key: string) => void;
  inputCls: string;
  labelCls: string;
  catalog: PackCatalog;
  product: ProductCategory;
  accentText?: string;
  outlineBtnCls?: string;
}) {
  const [assets, setAssets] = useState<PackagingAsset[]>([]);
  const [regBusy, setRegBusy] = useState<number | null>(null);
  const [regMsg, setRegMsg] = useState<Record<number, { ok: boolean; text: string } | undefined>>({});
  useEffect(() => {
    let live = true;
    fetch("/api/packaging-assets").then((r) => (r.ok ? r.json() : [])).then((a) => { if (live && Array.isArray(a)) setAssets(a); }).catch(() => {});
    return () => { live = false; };
  }, []);

  const req = <span className="text-[#ee443f]"> *</span>;
  const Err = ({ k }: { k: string }) => (errs[k] ? <p className="mt-1 text-[12px] text-[#ee443f]">{errs[k]}</p> : null);
  const bad = (k: string) => (errs[k] ? "border-[#ee443f]" : "");
  const grey = "disabled:border-gray-200 disabled:bg-gray-100 disabled:text-slate-400";
  const set = (i: number, patch: Partial<PackRowState>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const setInner = (i: number, j: number, patch: Partial<InnerState>) =>
    onChange(rows.map((r, k) => (k === i ? { ...r, inners: r.inners.map((m, l) => (l === j ? { ...m, ...patch } : m)) } : r)));

  const packOpts = packsFor(catalog, product);
  const innerOpts = innersFor(catalog, product);
  const pickable = catalog.materials.filter((m) => m.pick);

  async function register(i: number) {
    const r = rows[i];
    setRegBusy(i); setRegMsg((m) => ({ ...m, [i]: undefined }));
    try {
      const res = await fetch("/api/packaging-assets", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: r.kind, priorUses: Number(r.priorUses) || 0 }),
      });
      const a = await res.json();
      if (!res.ok) throw new Error(a.error || "ลงทะเบียนไม่สำเร็จ");
      setAssets((x) => [a, ...x]);
      set(i, { code: a.id });
      clearErr(`pack.${i}.code`);
      setRegMsg((m) => ({ ...m, [i]: { ok: true, text: `ลงทะเบียนแล้ว · ${a.id} · ครั้งหน้าเลือกหมายเลขนี้จากรายการได้เลย` } }));
    } catch (e) {
      setRegMsg((m) => ({ ...m, [i]: { ok: false, text: (e as Error).message } }));
    }
    setRegBusy(null);
  }

  return (
    <>
      {rows.map((r, i) => {
        const k = catalog.packs.find((p) => p.id === r.kind);
        const noPack = r.kind === NO_PACK;
        const once = r.usage === "single";
        const estimate = !noPack && rowEstimate(r, catalog);
        const codes = assets.filter((a) => a.kind === r.kind);
        const sizeOpts = noPack ? [] : r.kind === OTHER ? [] : (k?.sizes ?? []).map((z) => ({ id: z.id, name: `${z.label} · ${z.capacity}` }));
        const msg = regMsg[i];
        const onlyNone = r.inners.length === 1 && r.inners[0].kind === NO_INNER;
        return (
          <div key={i} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[14px] font-semibold text-slate-800">บรรจุภัณฑ์ที่ {i + 1}</p>
              <div className="flex items-center gap-2">
                {estimate ? <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-700">ค่าประมาณ</span> : null}
                {rows.length > 1 ? (
                  <button type="button" onClick={() => onChange(rows.filter((_, j) => j !== i))} className="inline-flex items-center gap-1 rounded-[8px] border border-gray-300 px-3 py-1.5 text-[12px] text-slate-700 hover:bg-gray-50">
                    <Trash2 size={13} /> ลบบรรจุภัณฑ์
                  </button>
                ) : null}
              </div>
            </div>

            {/* บรรทัดบน */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,1.5fr)]">
              <div>
                <label className={labelCls}>บรรจุภัณฑ์{req}</label>
                <select value={r.kind} onChange={(e) => { onChange(rows.map((x, j) => (j === i ? rowFor(catalog, e.target.value, x) : x))); clearErr(`pack.${i}.kind`); clearErr(`pack.${i}.code`); }} className={`${inputCls} ${bad(`pack.${i}.kind`)}`}>
                  {packOpts.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  <option value={OTHER}>อื่นๆ (ระบุ)</option>
                  {product !== "flower" ? <option value={NO_PACK}>ไม่มีบรรจุภัณฑ์ (ขนแบบเทกอง)</option> : null}
                </select>
                <Err k={`pack.${i}.kind`} />
              </div>
              <div>
                <label className={labelCls}>การใช้งาน{req}</label>
                <select value={noPack ? "none" : r.usage} disabled={noPack} onChange={(e) => { set(i, { usage: e.target.value as "single" | "reusable", code: "" }); clearErr(`pack.${i}.code`); }} className={`${inputCls} ${grey}`}>
                  {noPack ? <option value="none">ไม่มี</option> : null}
                  <option value="single">ใช้ครั้งเดียว</option>
                  <option value="reusable">หมุนเวียน</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>หมายเลขบรรจุภัณฑ์</label>
                <select value={once || noPack ? "none" : r.code} disabled={once || noPack} onChange={(e) => { set(i, { code: e.target.value }); clearErr(`pack.${i}.code`); }} className={`${inputCls} ${grey} ${bad(`pack.${i}.code`)}`}>
                  {once || noPack ? <option value="none">ไม่มี · ใช้ครั้งเดียว</option> : (
                    <>
                      <option value="">เลือกหมายเลข</option>
                      {codes.map((a) => <option key={a.id} value={a.id}>{a.id} · ใช้แล้ว {(a.priorUses + (a.uses ?? 0)).toLocaleString("th-TH")} รอบ</option>)}
                      {r.code && r.code !== "new" && !codes.some((a) => a.id === r.code) ? <option value={r.code}>{r.code}</option> : null}
                      <option value="new">+ ลงทะเบียนใหม่</option>
                    </>
                  )}
                </select>
                <Err k={`pack.${i}.code`} />
              </div>
              <div>
                <label className={labelCls}>ขนาด{req}</label>
                <select value={noPack ? "none" : r.size} disabled={noPack} onChange={(e) => { set(i, { size: e.target.value }); clearErr(`pack.${i}.size`); }} className={`${inputCls} ${grey} ${bad(`pack.${i}.size`)}`}>
                  {noPack ? <option value="none">ไม่มี</option> : null}
                  {sizeOpts.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  {!noPack ? <option value="custom">กำหนดเอง (กว้าง × ยาว × สูง)</option> : null}
                  {!noPack ? <option value="unknown">ไม่ทราบขนาด · ใช้ค่าเฉลี่ย</option> : null}
                </select>
                <Err k={`pack.${i}.size`} />
              </div>
              <div>
                <label className={labelCls}>จำนวน{req}</label>
                <div className="grid grid-cols-[minmax(0,1fr)_88px] gap-2">
                  <input inputMode="numeric" type="number" min="0" value={noPack ? "" : r.qty} disabled={noPack} placeholder={noPack ? "ไม่มี" : "0"} onChange={(e) => { set(i, { qty: e.target.value }); clearErr(`pack.${i}.qty`); }} className={`${inputCls} ${grey} ${bad(`pack.${i}.qty`)}`} />
                  <select aria-label="หน่วยจำนวน" value={r.unit} disabled={noPack} onChange={(e) => set(i, { unit: e.target.value })} className={`${inputCls} ${grey}`}>
                    {PACK_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <Err k={`pack.${i}.qty`} />
              </div>
            </div>

            {r.usage === "reusable" && r.code === "new" ? (
              <div className="grid gap-3 rounded-[10px] bg-slate-50 p-4 sm:grid-cols-[1fr_auto] sm:items-end">
                <div>
                  <label className={labelCls}>ลงทะเบียนใหม่ · จำนวนรอบที่เคยใช้มาแล้ว</label>
                  <div className="flex gap-2">
                    <input inputMode="numeric" type="number" min="0" value={r.priorUses} onChange={(e) => set(i, { priorUses: e.target.value })} placeholder="0 = ของใหม่" className={`${inputCls} min-w-0`} />
                    <span className="grid shrink-0 place-items-center rounded-[8px] border border-gray-200 bg-white px-3 text-[13px] text-slate-500">รอบ</span>
                  </div>
                </div>
                <button type="button" onClick={() => register(i)} disabled={regBusy === i} className={`inline-flex h-[42px] items-center justify-center gap-2 rounded-[8px] px-5 text-[13px] font-medium ${outlineBtnCls} disabled:opacity-60`}>
                  {regBusy === i ? <Loader2 size={14} className="animate-spin" /> : null} ลงทะเบียนและใช้งาน
                </button>
                <p className="text-[12px] text-slate-500 sm:col-span-2">ระบบสร้างหมายเลขให้อัตโนมัติ แล้วเลือกให้ในช่องหมายเลขทันที</p>
              </div>
            ) : null}
            {msg ? <p className={`text-[12px] ${msg.ok ? "text-emerald-600" : "text-[#ee443f]"}`}>{msg.text}</p> : null}

            {r.size === "custom" && !noPack ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(["dimW", "dimL", "dimH"] as const).map((f) => (
                  <div key={f}>
                    <label className={labelCls}>{f === "dimW" ? "กว้าง" : f === "dimL" ? "ยาว" : "สูง"}</label>
                    <input inputMode="decimal" type="number" min="0" step="any" value={r[f]} onChange={(e) => { set(i, { [f]: e.target.value } as Partial<PackRowState>); clearErr(`pack.${i}.size`); }} placeholder={f === "dimW" ? "40" : f === "dimL" ? "30" : "25"} className={inputCls} />
                  </div>
                ))}
                <div>
                  <label className={labelCls}>หน่วย</label>
                  <select value={r.dimUnit} onChange={(e) => set(i, { dimUnit: e.target.value as "cm" | "in" })} className={inputCls}><option value="cm">ซม.</option><option value="in">นิ้ว</option></select>
                </div>
                <p className="col-span-full -mt-1 text-[11px] text-slate-400">ระบบประมาณน้ำหนักจากขนาดให้</p>
              </div>
            ) : null}

            {r.kind === OTHER ? (
              <div className="grid gap-3 rounded-[10px] bg-slate-50 p-4 sm:grid-cols-3">
                <div>
                  <label className={labelCls}>ชื่อบรรจุภัณฑ์{req}</label>
                  <input value={r.otherName} onChange={(e) => { set(i, { otherName: e.target.value }); clearErr(`pack.${i}.otherName`); }} placeholder="เช่น ตะกร้าหวาย" className={`${inputCls} ${bad(`pack.${i}.otherName`)}`} />
                  <Err k={`pack.${i}.otherName`} />
                </div>
                <div>
                  <label className={labelCls}>ทำจากอะไร{req}</label>
                  <select value={r.otherMaterial} onChange={(e) => set(i, { otherMaterial: e.target.value as MaterialId })} className={inputCls}>
                    {pickable.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.examples})</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>น้ำหนักต่อหน่วย{req}</label>
                  <select value={r.otherWeight} onChange={(e) => set(i, { otherWeight: e.target.value })} className={inputCls}>
                    {catalog.weightClasses.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}
                    <option value="weighed">ชั่งเองแล้ว · กรอกน้ำหนัก</option>
                    <option value="unknown">ไม่ทราบ · ใช้ค่าเฉลี่ยของวัสดุ</option>
                  </select>
                </div>
                {r.otherWeight === "weighed" ? (
                  <div className="sm:col-span-3 sm:w-1/2">
                    <label className={labelCls}>น้ำหนักที่ชั่งได้</label>
                    <div className="grid grid-cols-[minmax(0,1fr)_88px] gap-2">
                      <input inputMode="decimal" type="number" min="0" step="any" value={r.otherWeighed} onChange={(e) => { set(i, { otherWeighed: e.target.value }); clearErr(`pack.${i}.otherWeighed`); }} placeholder="350" className={`${inputCls} ${bad(`pack.${i}.otherWeighed`)}`} />
                      <select aria-label="หน่วยน้ำหนัก" value={r.otherWeighedUnit} onChange={(e) => set(i, { otherWeighedUnit: e.target.value as "กรัม" | "กก." })} className={inputCls}><option>กรัม</option><option>กก.</option></select>
                    </div>
                    <Err k={`pack.${i}.otherWeighed`} />
                  </div>
                ) : null}
                <p className="text-[11px] text-amber-600 sm:col-span-3">ระบบคำนวณทันทีด้วยค่า EF ของวัสดุที่เลือก (ค่าประมาณ) และแจ้ง KYN ให้ตรวจสอบเพื่อเพิ่มเป็นรายการใหม่</p>
              </div>
            ) : null}

            {/* บรรทัดล่าง — วัสดุภายใน */}
            <div className="space-y-3 border-t border-slate-100 pt-3">
              <p className="text-[13px] font-medium text-slate-700">วัสดุภายใน <span className="font-normal text-slate-400">· ต่อ 1 {r.unit}</span></p>
              {r.inners.map((m, j) => {
                const off = m.kind === NO_INNER || noPack;
                return (
                  <div key={j} className="grid gap-3 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1.3fr)_110px] sm:items-end">
                    <div>
                      <label className={labelCls}>ชนิดวัสดุ{req}</label>
                      <select value={noPack ? NO_INNER : m.kind} disabled={noPack} onChange={(e) => {
                        const v = e.target.value; const it = catalog.inners.find((x) => x.id === v);
                        setInner(i, j, { kind: v, unit: it?.unit ?? m.unit, qty: v === NO_INNER ? "" : m.qty || "1" }); clearErr(`pack.${i}.inner.${j}`);
                      }} className={`${inputCls} ${grey}`}>
                        <option value={NO_INNER}>ไม่มีวัสดุภายใน</option>
                        {innerOpts.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                        <option value={OTHER}>อื่นๆ (ระบุ)</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>จำนวน</label>
                      <div className="grid grid-cols-[minmax(0,1fr)_88px] gap-2">
                        <input inputMode="decimal" type="number" min="0" step="any" value={off ? "" : m.qty} disabled={off} placeholder={off ? "ไม่มี" : "0"} onChange={(e) => { setInner(i, j, { qty: e.target.value }); clearErr(`pack.${i}.inner.${j}`); }} className={`${inputCls} ${grey} ${bad(`pack.${i}.inner.${j}`)}`} />
                        <select aria-label="หน่วยวัสดุ" value={m.unit} disabled={off} onChange={(e) => setInner(i, j, { unit: e.target.value })} className={`${inputCls} ${grey}`}>
                          {INNER_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </div>
                    </div>
                    {r.inners.length > 1 ? (
                      <button type="button" onClick={() => set(i, { inners: r.inners.filter((_, l) => l !== j) })} className="inline-flex h-[42px] items-center gap-1 rounded-[8px] px-2 text-[12px] text-slate-500 hover:bg-gray-100 hover:text-red-500"><X size={14} /> ลบวัสดุนี้</button>
                    ) : <span className="hidden sm:block" />}
                    {m.kind === OTHER ? (
                      <div className="grid gap-3 sm:col-span-3 sm:grid-cols-2">
                        <input value={m.otherName} onChange={(e) => { setInner(i, j, { otherName: e.target.value }); clearErr(`pack.${i}.inner.${j}`); }} placeholder="ระบุชื่อวัสดุ เช่น ใบตอง" className={inputCls} />
                        <select value={m.otherMaterial} onChange={(e) => setInner(i, j, { otherMaterial: e.target.value as MaterialId })} className={inputCls}>
                          {pickable.map((x) => <option key={x.id} value={x.id}>ทำจาก{x.name}</option>)}
                        </select>
                      </div>
                    ) : null}
                    {errs[`pack.${i}.inner.${j}`] ? <p className="text-[12px] text-[#ee443f] sm:col-span-3">{errs[`pack.${i}.inner.${j}`]}</p> : null}
                  </div>
                );
              })}
              {!noPack && !onlyNone ? (
                <button type="button" onClick={() => set(i, { inners: [...r.inners, { ...noInner(), kind: innerOpts[0]?.id ?? OTHER, qty: "1", unit: innerOpts[0]?.unit ?? "ชิ้น" }] })} className={`inline-flex items-center gap-1 text-[13px] font-medium hover:underline ${accentText}`}>
                  <Plus size={14} /> เพิ่มวัสดุภายใน
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => onChange([...rows, firstRow(catalog, product)])} className={`inline-flex items-center gap-1.5 rounded-[8px] px-4 py-2 text-[13px] font-medium ${outlineBtnCls}`}>
          <Plus size={15} /> เพิ่มบรรจุภัณฑ์
        </button>
        <p className="text-[12px] text-slate-400">{rows.length} รายการ · คาร์บอนคำนวณอัตโนมัติหลังกด “ถัดไป”</p>
      </div>
    </>
  );
}
