"use client";

import { useEffect, useId, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import SearchSelect from "@/components/SearchSelect";
import { INNER_MATERIALS, innerMaterial } from "@/lib/inner-materials";
import type { PackageSize } from "@/lib/factors";
import type { InnerMaterialLine, PackagingAsset, PackagingLine } from "@/lib/types";

// Packaging lines shared by the supplier round form and the logistic export form (Thai Post doc,
// tab "ข้อมูลบรรจุภัณฑ์"): each line is บรรจุภัณฑ์ + ขนาด (กว้าง/ยาว/สูง) + ประเภทการใช้งาน —
//   1) หมุนเวียน · เลือกจากที่มีอยู่แล้ว  → pick a registered code (trips used / design life / owner)
//   2) หมุนเวียน · ลงทะเบียนใหม่        → the system issues the code, then it is used here
//   3) ใช้ครั้งเดียว                    → quantity
// Boxes also declare their inner material (KYN packaging master) and how much goes into each box.
export const PACK_KINDS = [
  { key: "basket", label: "ตะกร้า" },
  { key: "corrugated_box", label: "กล่องลูกฟูก" },
  { key: "plastic_film", label: "แผ่นพลาสติก / ซองห่อช่อ" },
] as const;

export interface PackLine {
  kind: string;
  usage: "" | "reusable" | "single";
  source: "existing" | "new";
  assetId: string;
  priorUses: string; // ลงทะเบียนใหม่: trips already made before registering
  w: string; l: string; h: string; // cm
  qty: string; // single-use only (a registered item is one piece)
  boxMaterial: string; // INNER_MATERIALS[].name
  innerQty: string; // per box, in the material's own unit
}
export const emptyPackLine = (): PackLine => ({ kind: "", usage: "", source: "existing", assetId: "", priorUses: "", w: "", l: "", h: "", qty: "", boxMaterial: "", innerQty: "" });

const num = (v: string) => (Number(v) > 0 ? Number(v) : 0);
const hasH = (kind: string) => kind !== "plastic_film";

export const packKindLabel = (k: string) => PACK_KINDS.find((x) => x.key === k)?.label ?? k;
export function packSizeText(p: Pick<PackLine, "kind" | "w" | "l" | "h">): string {
  if (!num(p.w) || !num(p.l)) return p.kind === "basket" ? "ตะกร้ามาตรฐาน" : "";
  return hasH(p.kind) && num(p.h) ? `${p.w} × ${p.l} × ${p.h} ซม.` : `${p.w} × ${p.l} ซม.`;
}
export function packUsageText(p: PackLine): string {
  if (p.usage === "reusable") return `หมุนเวียน${p.assetId ? ` · ${p.assetId}` : ""}`;
  return p.usage === "single" ? "ใช้ครั้งเดียว" : "";
}
export function packInnerText(p: PackLine): string {
  const m = innerMaterial(p.boxMaterial);
  if (!m) return p.boxMaterial;
  return `${m.name} · ${p.innerQty || m.defaultPerBox} ${m.countUnit}/กล่อง`;
}
/** Quantity shown in reviews: a registered reusable item is one piece. */
export const packQty = (p: PackLine) => (p.usage === "reusable" ? 1 : Number(p.qty) || 0);

function sizeMissing(p: PackLine) {
  return !num(p.w) || !num(p.l) || (hasH(p.kind) && !num(p.h));
}

export function validatePackLines(lines: PackLine[]): Record<string, string> {
  const e: Record<string, string> = {};
  const seen = new Map<string, number>();
  lines.forEach((p, i) => {
    if (!p.kind) { e[`pack.${i}.kind`] = "กรุณาเลือกบรรจุภัณฑ์"; return; }
    if (!p.usage) e[`pack.${i}.usage`] = "กรุณาเลือกประเภทการใช้งาน";
    if (p.usage === "reusable") {
      if (!p.assetId) e[`pack.${i}.asset`] = p.source === "new" ? "กรุณากด “ลงทะเบียนและใช้งาน” ก่อน" : "กรุณาเลือกรหัสบรรจุภัณฑ์";
      else if (seen.has(p.assetId)) e[`pack.${i}.asset`] = `รหัสนี้เลือกไว้แล้วในรายการที่ ${seen.get(p.assetId)! + 1}`;
      else seen.set(p.assetId, i);
      if (p.source === "new" && !p.assetId && sizeMissing(p)) e[`pack.${i}.size`] = "กรุณาระบุขนาดก่อนลงทะเบียน";
    }
    if (p.usage === "single") {
      if (sizeMissing(p)) e[`pack.${i}.size`] = hasH(p.kind) ? "กรุณาระบุกว้าง ยาว และสูง" : "กรุณาระบุกว้างและยาว";
      if (!(Number(p.qty) > 0)) e[`pack.${i}.qty`] = "กรุณาระบุจำนวน";
    }
    if (p.kind === "corrugated_box" && !p.boxMaterial) e[`pack.${i}.boxMaterial`] = "กรุณาระบุวัสดุภายในกล่อง";
  });
  return e;
}

/** API payload pieces derived from the lines. */
export function packLinesToPayload(lines: PackLine[]) {
  const used = lines.filter((p) => p.kind);
  const packagingItems: PackagingLine[] = used.map((p) => {
    const reusable = p.usage === "reusable";
    return {
      kind: p.kind as PackagingLine["kind"],
      usage: p.usage || undefined,
      assetId: reusable ? p.assetId || undefined : undefined,
      width: num(p.w) || undefined,
      length: num(p.l) || undefined,
      height: hasH(p.kind) ? num(p.h) || undefined : undefined,
      quantity: packQty(p),
      basketNo: p.kind === "basket" && reusable ? p.assetId || undefined : undefined,
      boxMaterial: p.boxMaterial || undefined,
    };
  });
  const innerMaterials: InnerMaterialLine[] = used
    .filter((p) => p.kind === "corrugated_box" && p.boxMaterial)
    .map((p) => {
      const m = innerMaterial(p.boxMaterial);
      const perBox = num(p.innerQty) || m?.defaultPerBox || 1;
      return { material: p.boxMaterial, qty: perBox * (packQty(p) || 1) };
    });
  return {
    packagingItems,
    innerMaterials,
    basketIds: [...new Set(used.filter((p) => p.kind === "basket" && p.usage === "reusable" && p.assetId).map((p) => p.assetId))],
    boxMaterial: used.find((p) => p.kind === "corrugated_box")?.boxMaterial,
  };
}

/** Rebuild lines from a stored batch (logistic form prefill). Older rounds: baskets = reusable. */
export function packLinesFromBatch(items: PackagingLine[] | undefined, inner?: InnerMaterialLine[]): PackLine[] {
  const pool = [...(inner ?? [])]; // each saved inner line belongs to one box line, in order
  return (items ?? []).map((p) => {
    const at = p.kind === "corrugated_box" ? pool.findIndex((m) => m.material === p.boxMaterial) : -1;
    const inn = at >= 0 ? pool.splice(at, 1)[0] : undefined;
    const perBox = inn && p.quantity ? inn.qty / p.quantity : undefined;
    const usage = p.usage ?? (p.kind === "basket" && p.basketNo ? "reusable" : "single");
    return {
      kind: p.kind, usage, source: "existing" as const,
      assetId: usage === "reusable" ? p.assetId ?? p.basketNo ?? "" : "",
      priorUses: "",
      w: p.width ? String(p.width) : "", l: p.length ? String(p.length) : "", h: p.height ? String(p.height) : "",
      qty: usage === "single" && p.quantity ? String(p.quantity) : "",
      boxMaterial: p.boxMaterial ?? "", innerQty: perBox ? String(Math.round(perBox * 100) / 100) : "",
    };
  });
}

export default function PackagingLines({
  lines, onChange, errs, clearErr, inputCls, labelCls, sizePresets,
  ringCls = "accent-blue-600", outlineBtnCls = "border border-blue-600 text-blue-600 hover:bg-blue-50",
}: {
  lines: PackLine[];
  onChange: (l: PackLine[]) => void;
  errs: Record<string, string>;
  clearErr: (key: string) => void;
  inputCls: string;
  labelCls: string;
  sizePresets: PackageSize[];
  /** radio accent class, e.g. "accent-brand-pink" */
  ringCls?: string;
  outlineBtnCls?: string;
}) {
  const uid = useId();
  const [assets, setAssets] = useState<PackagingAsset[]>([]);
  const [regBusy, setRegBusy] = useState<number | null>(null);
  const [regMsg, setRegMsg] = useState<Record<number, { ok: boolean; text: string }>>({});
  useEffect(() => {
    let live = true;
    fetch("/api/packaging-assets").then((r) => (r.ok ? r.json() : [])).then((a) => { if (live && Array.isArray(a)) setAssets(a); }).catch(() => {});
    return () => { live = false; };
  }, []);

  const req = <span className="text-[#ee443f]"> *</span>;
  const Err = ({ k }: { k: string }) => (errs[k] ? <p className="mt-1 text-[12px] text-[#ee443f]">{errs[k]}</p> : null);
  const set = (i: number, patch: Partial<PackLine>) => onChange(lines.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const bad = (k: string) => (errs[k] ? "border-[#ee443f]" : "");

  function pickAsset(i: number, id: string) {
    const a = assets.find((x) => x.id === id);
    set(i, { assetId: id, ...(a?.width ? { w: String(a.width), l: String(a.length ?? ""), h: a.height ? String(a.height) : "" } : {}) });
    clearErr(`pack.${i}.asset`); clearErr(`pack.${i}.size`);
  }

  async function register(i: number) {
    const p = lines[i];
    if (sizeMissing(p)) { setRegMsg((m) => ({ ...m, [i]: { ok: false, text: "กรุณาระบุขนาด (กว้าง ยาว" + (hasH(p.kind) ? " สูง" : "") + ") ก่อนลงทะเบียน" } })); return; }
    setRegBusy(i); setRegMsg((m) => ({ ...m, [i]: undefined as never }));
    try {
      const res = await fetch("/api/packaging-assets", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: p.kind, width: num(p.w), length: num(p.l), height: hasH(p.kind) ? num(p.h) : undefined, priorUses: Number(p.priorUses) || 0 }),
      });
      const a = await res.json();
      if (!res.ok) throw new Error(a.error || "ลงทะเบียนไม่สำเร็จ");
      setAssets((x) => [a, ...x]);
      set(i, { assetId: a.id, source: "existing" });
      clearErr(`pack.${i}.asset`); clearErr(`pack.${i}.size`);
      setRegMsg((m) => ({ ...m, [i]: { ok: true, text: `ลงทะเบียนแล้ว — รหัส ${a.id}` } }));
    } catch (e) {
      setRegMsg((m) => ({ ...m, [i]: { ok: false, text: (e as Error).message } }));
    }
    setRegBusy(null);
  }

  return (
    <>
      {lines.map((p, i) => {
        const m = innerMaterial(p.boxMaterial);
        const presets = sizePresets.filter((s) => (p.kind === "plastic_film" ? true : s.h > 0));
        const reusable = p.usage === "reusable";
        const asset = reusable && p.assetId ? assets.find((a) => a.id === p.assetId) : undefined;
        // size comes from the registry once a registered item is picked
        const sizeLocked = reusable && p.source === "existing" && !!asset?.width;
        const assetOptions = assets.filter((a) => a.kind === p.kind).map((a) => ({
          value: a.id, label: `${a.id} · ${packSizeText({ kind: a.kind, w: String(a.width ?? ""), l: String(a.length ?? ""), h: String(a.height ?? "") })}`, group: a.ownerLabel || "ไม่ระบุเจ้าของ",
        }));
        const used = asset ? asset.priorUses + (asset.uses ?? 0) : 0;
        const msg = regMsg[i];
        return (
          <div key={i} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls}>บรรจุภัณฑ์{req}</label>
                <select value={p.kind} onChange={(e) => {
                  const kind = e.target.value;
                  set(i, { kind, usage: p.usage || (kind === "basket" ? "reusable" : kind ? "single" : ""), assetId: "", source: "existing", h: hasH(kind) ? p.h : "" });
                  clearErr(`pack.${i}.kind`); clearErr(`pack.${i}.usage`);
                }} className={`${inputCls} ${bad(`pack.${i}.kind`)}`}>
                  <option value="">เลือกบรรจุภัณฑ์</option>
                  {PACK_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
                </select>
                <Err k={`pack.${i}.kind`} />
              </div>
              <div>
                <label className={labelCls}>ขนาด{req}</label>
                <select value="" disabled={!p.kind || sizeLocked} onChange={(e) => { const s = presets.find((x) => x.label === e.target.value); if (s) { set(i, { w: String(s.w), l: String(s.l), h: hasH(p.kind) && s.h ? String(s.h) : "" }); clearErr(`pack.${i}.size`); } }} className={`${inputCls} disabled:bg-slate-50`}>
                  <option value="">{sizeLocked ? "ตามทะเบียนบรรจุภัณฑ์" : "เลือกขนาดมาตรฐาน หรือกรอกด้านล่าง"}</option>
                  {presets.map((s) => <option key={s.label} value={s.label}>{s.label}</option>)}
                </select>
              </div>
            </div>

            {p.kind ? (
              <div className={`grid gap-3 ${hasH(p.kind) ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-3"}`}>
                {(["w", "l", "h"] as const).filter((k) => k !== "h" || hasH(p.kind)).map((k) => (
                  <div key={k}>
                    <label className={labelCls}>{k === "w" ? "กว้าง" : k === "l" ? "ยาว" : "สูง"} (ซม.)</label>
                    <input type="number" min="0" step="any" value={p[k]} readOnly={sizeLocked} onChange={(e) => { set(i, { [k]: e.target.value } as Partial<PackLine>); clearErr(`pack.${i}.size`); }} placeholder="0" className={`${inputCls} ${bad(`pack.${i}.size`)} ${sizeLocked ? "bg-slate-50 text-slate-500" : ""}`} />
                  </div>
                ))}
                <div className="col-span-full -mt-2"><Err k={`pack.${i}.size`} /></div>
              </div>
            ) : null}

            {p.kind ? (
              <div>
                <label className={labelCls}>ประเภทการใช้งาน{req}</label>
                <div className="flex gap-6">
                  {([["reusable", "หมุนเวียน"], ["single", "ใช้ครั้งเดียว"]] as const).map(([k, label]) => (
                    <label key={k} className="flex cursor-pointer items-center gap-2 text-[13px] text-slate-700">
                      <input type="radio" name={`${uid}-usage-${i}`} checked={p.usage === k} onChange={() => { set(i, { usage: k }); clearErr(`pack.${i}.usage`); clearErr(`pack.${i}.asset`); clearErr(`pack.${i}.qty`); }} className={`size-4 ${ringCls}`} /> {label}
                    </label>
                  ))}
                </div>
                <Err k={`pack.${i}.usage`} />
              </div>
            ) : null}

            {reusable ? (
              <div>
                <label className={labelCls}>แหล่งที่มา{req}</label>
                <div className="flex gap-6">
                  {([["existing", "เลือกจากที่มีอยู่แล้ว"], ["new", "ลงทะเบียนใหม่"]] as const).map(([k, label]) => (
                    <label key={k} className="flex cursor-pointer items-center gap-2 text-[13px] text-slate-700">
                      <input type="radio" name={`${uid}-src-${i}`} checked={p.source === k} onChange={() => { set(i, { source: k, ...(k === "new" ? { assetId: "" } : {}) }); clearErr(`pack.${i}.asset`); }} className={`size-4 ${ringCls}`} /> {label}
                    </label>
                  ))}
                </div>

                <div className="mt-3 rounded-[10px] bg-slate-50 p-4">
                  {p.source === "existing" ? (
                    <>
                      <label className={labelCls}>รหัสบรรจุภัณฑ์{req}</label>
                      <div className="sm:w-1/2">
                        <SearchSelect value={p.assetId} onChange={(v) => pickAsset(i, v)} options={assetOptions} placeholder="ค้นหา / เลือกรหัส เช่น BSK-2026-00001" invalid={!!errs[`pack.${i}.asset`]} />
                      </div>
                      <Err k={`pack.${i}.asset`} />
                      {asset ? (
                        <div className="mt-3 space-y-1 text-[12px] text-slate-600">
                          <p>ประเภท: {packKindLabel(asset.kind)}, ขนาด {packSizeText({ kind: asset.kind, w: String(asset.width ?? ""), l: String(asset.length ?? ""), h: String(asset.height ?? "") }) || "—"}</p>
                          <p>ใช้แล้ว: <b>{used.toLocaleString("th-TH")} รอบ</b> จาก {asset.designLife.toLocaleString("th-TH")} รอบ (design life){used >= asset.designLife ? <span className="ml-1.5 font-medium text-[#ee443f]">· ครบอายุการใช้งานแล้ว</span> : null}</p>
                          <p>เจ้าของ: {asset.ownerLabel || "—"}</p>
                        </div>
                      ) : p.assetId ? (
                        <p className="mt-3 text-[12px] text-slate-500">รหัส {p.assetId} ยังไม่อยู่ในทะเบียน (ข้อมูลรอบเดิม) — คิดคาร์บอนแบบตะกร้ามาตรฐาน ใช้ได้ 100 รอบ</p>
                      ) : assetOptions.length === 0 ? (
                        <p className="mt-3 text-[12px] text-slate-500">ยังไม่มี{packKindLabel(p.kind)}ที่ลงทะเบียนไว้ — เลือก “ลงทะเบียนใหม่”</p>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <p className="mb-3 text-[12px] text-slate-500">ระบบจะสร้างรหัสบรรจุภัณฑ์ให้อัตโนมัติหลังลงทะเบียน</p>
                      <label className={labelCls}>จำนวนรอบที่เคยใช้มาแล้ว</label>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <input type="number" min="0" step="1" value={p.priorUses} onChange={(e) => set(i, { priorUses: e.target.value })} placeholder="0 = ของใหม่เอี่ยม" className={inputCls} />
                        <button type="button" onClick={() => register(i)} disabled={regBusy === i} className="inline-flex h-[42px] items-center justify-center gap-2 rounded-[8px] border border-gray-300 bg-white text-[13px] font-medium text-slate-700 hover:bg-gray-50 disabled:opacity-60">
                          {regBusy === i ? <Loader2 size={14} className="animate-spin" /> : null} ลงทะเบียนและใช้งาน
                        </button>
                      </div>
                      <Err k={`pack.${i}.asset`} />
                    </>
                  )}
                  {msg ? <p className={`mt-2 text-[12px] ${msg.ok ? "text-emerald-600" : "text-[#ee443f]"}`}>{msg.text}</p> : null}
                </div>
              </div>
            ) : null}

            {p.usage === "single" ? (
              <div className="sm:w-1/2">
                <label className={labelCls}>จำนวน{req}</label>
                <input type="number" min="1" step="1" value={p.qty} onChange={(e) => { set(i, { qty: e.target.value }); clearErr(`pack.${i}.qty`); }} placeholder="ระบุจำนวนบรรจุภัณฑ์" className={`${inputCls} ${bad(`pack.${i}.qty`)}`} />
                <Err k={`pack.${i}.qty`} />
              </div>
            ) : null}

            {p.kind === "corrugated_box" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>วัสดุภายในกล่อง{req}</label>
                  <select value={p.boxMaterial} onChange={(e) => { set(i, { boxMaterial: e.target.value, innerQty: "" }); clearErr(`pack.${i}.boxMaterial`); }} className={`${inputCls} ${bad(`pack.${i}.boxMaterial`)}`}>
                    <option value="">ระบุวัสดุภายในกล่อง</option>
                    {INNER_MATERIALS.map((x) => <option key={x.name} value={x.name}>{x.name}</option>)}
                  </select>
                  <Err k={`pack.${i}.boxMaterial`} />
                </div>
                {m ? (
                  <div>
                    <label className={labelCls}>ปริมาณวัสดุต่อกล่อง ({m.countUnit})</label>
                    <input type="number" min="0" step="any" value={p.innerQty} onChange={(e) => set(i, { innerQty: e.target.value })} placeholder={String(m.defaultPerBox)} className={inputCls} />
                    <p className="mt-1 text-[11px] text-slate-400">EF {m.ef} kg CO₂e/{m.perKg ? "kg" : m.countUnit} · น้ำหนักมาตรฐาน {m.weightPerUnitKg} kg/{m.countUnit} (ตาราง KYN)</p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {lines.length > 1 ? (
              <div className="flex justify-end">
                <button type="button" onClick={() => onChange(lines.filter((_, j) => j !== i))} className="inline-flex items-center gap-1.5 rounded-[8px] border border-gray-300 px-3 py-1.5 text-[12px] text-slate-700 hover:bg-gray-50">
                  <Trash2 size={13} /> ลบบรรจุภัณฑ์
                </button>
              </div>
            ) : null}
          </div>
        );
      })}
      <div>
        <button type="button" onClick={() => onChange([...lines, emptyPackLine()])} className={`inline-flex items-center gap-1.5 rounded-[8px] px-4 py-2 text-[13px] font-medium ${outlineBtnCls}`}>
          <Plus size={15} /> เพิ่มรายการอื่น
        </button>
      </div>
    </>
  );
}
