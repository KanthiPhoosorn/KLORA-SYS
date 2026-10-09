"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, PlusCircle, RefreshCw, RotateCcw, Save, Trash2 } from "lucide-react";
import { DEFAULT_CATALOG, PACK_UNITS, INNER_UNITS, type PackCatalog, type MaterialId } from "@/lib/packaging-catalog";

const cell = "w-full rounded-[6px] border border-gray-300 bg-white px-2 py-1.5 text-[13px] text-black outline-none focus:border-brand-purple";
const th = "px-3 py-2 text-left font-medium";
const PRODUCTS = [["flower", "ดอกไม้"], ["fruit", "ผลไม้"], ["vegetable", "ผัก"]] as const;

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-[16px] font-semibold text-slate-900">{title}</h2>
      {sub ? <p className="mt-0.5 text-[12px] text-slate-400">{sub}</p> : null}
      <div className="mt-4 overflow-x-auto">{children}</div>
    </section>
  );
}

// KYN central packaging table editor. Numbers are edited in place; sizes can be added/removed.
export default function CatalogEditor({ initial }: { initial: PackCatalog }) {
  const router = useRouter();
  const [c, setC] = useState<PackCatalog>(initial);
  const [busy, setBusy] = useState<"save" | "recompute" | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const num = (v: string) => (v === "" ? 0 : Number(v));

  const setMat = (i: number, patch: Partial<PackCatalog["materials"][number]>) => setC((x) => ({ ...x, materials: x.materials.map((m, j) => (j === i ? { ...m, ...patch } : m)) }));
  const setPack = (i: number, patch: Partial<PackCatalog["packs"][number]>) => setC((x) => ({ ...x, packs: x.packs.map((m, j) => (j === i ? { ...m, ...patch } : m)) }));
  const setInner = (i: number, patch: Partial<PackCatalog["inners"][number]>) => setC((x) => ({ ...x, inners: x.inners.map((m, j) => (j === i ? { ...m, ...patch } : m)) }));

  async function save() {
    setBusy("save"); setMsg(null);
    try {
      const res = await fetch("/api/packaging-catalog", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(c) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      setC(data);
      setMsg({ ok: true, text: "บันทึกตารางแล้ว — รอบใหม่ใช้ค่านี้ทันที กด “คำนวณใหม่ทั้งหมด” เพื่อปรับรอบเดิม" });
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
    <div className="max-w-5xl space-y-5">
      <Section title="วัสดุ · ค่า EF ต่อน้ำหนัก" sub="kg CO₂e ต่อ กก. วัสดุ · ค่าเริ่มต้นจากฐานข้อมูล EF (CFP) ของ อบก. — Thai National LCI Database เม.ย. 2569">
        <table className="w-full min-w-[760px] text-[13px]">
          <thead><tr className="bg-brand-purple-head text-white"><th className={th}>วัสดุ</th><th className={`${th} w-32`}>EF</th><th className={`${th} w-32`}>น้ำหนักเฉลี่ย/ชิ้น (กก.)</th><th className={th}>แหล่งที่มา</th></tr></thead>
          <tbody>
            {c.materials.map((m, i) => (
              <tr key={m.id} className="border-b border-slate-100 last:border-0">
                <td className="px-3 py-2"><p className="font-medium text-slate-800">{m.name}</p><p className="text-[11px] text-slate-400">{m.examples}</p></td>
                <td className="px-3 py-2"><input type="number" min="0" step="any" value={m.ef} onChange={(e) => setMat(i, { ef: num(e.target.value) })} className={cell} /></td>
                <td className="px-3 py-2"><input type="number" min="0" step="any" value={m.avgUnitKg} onChange={(e) => setMat(i, { avgUnitKg: num(e.target.value) })} className={cell} /></td>
                <td className="px-3 py-2"><input value={m.source} onChange={(e) => setMat(i, { source: e.target.value })} className={`${cell} text-[12px]`} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="บรรจุภัณฑ์ · ขนาด · น้ำหนักมาตรฐาน" sub="ระบบตั้งค่าการใช้งาน หน่วย และขนาดตามตารางนี้เมื่อผู้ใช้เลือกบรรจุภัณฑ์ (ผู้ใช้แก้ได้) · หมุนเวียน = คาร์บอนจากการผลิต ÷ จำนวนรอบตลอดอายุ">
        <div className="space-y-3">
          {c.packs.map((k, i) => (
            <div key={k.id} className="rounded-xl border border-slate-200 p-4">
              <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr_1fr_0.7fr_0.7fr]">
                <label className="text-[12px] text-slate-500">ชื่อ<input value={k.name} onChange={(e) => setPack(i, { name: e.target.value })} className={`${cell} mt-1`} /></label>
                <label className="text-[12px] text-slate-500">วัสดุหลัก
                  <select value={k.material} onChange={(e) => setPack(i, { material: e.target.value as MaterialId })} className={`${cell} mt-1`}>{c.materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
                </label>
                <label className="text-[12px] text-slate-500">การใช้งานเริ่มต้น
                  <select value={k.usage} onChange={(e) => setPack(i, { usage: e.target.value as "single" | "reusable" })} className={`${cell} mt-1`}><option value="single">ใช้ครั้งเดียว</option><option value="reusable">หมุนเวียน</option></select>
                </label>
                <label className="text-[12px] text-slate-500">หน่วย
                  <select value={k.unit} onChange={(e) => setPack(i, { unit: e.target.value })} className={`${cell} mt-1`}>{PACK_UNITS.map((u) => <option key={u}>{u}</option>)}</select>
                </label>
                <label className="text-[12px] text-slate-500">รอบตลอดอายุ<input type="number" min="1" step="1" value={k.lifetime} onChange={(e) => setPack(i, { lifetime: Math.max(1, num(e.target.value)) })} className={`${cell} mt-1`} /></label>
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-[12px] text-slate-500">
                ใช้กับ:
                {PRODUCTS.map(([p, l]) => (
                  <label key={p} className="inline-flex items-center gap-1"><input type="checkbox" checked={k.products.includes(p)} onChange={(e) => setPack(i, { products: e.target.checked ? [...k.products, p] : k.products.filter((x) => x !== p) })} className="accent-brand-purple" /> {l}</label>
                ))}
              </div>
              <table className="mt-3 w-full text-[13px]">
                <thead><tr className="text-left text-[12px] text-slate-500"><th className="py-1 pr-2 font-medium">ขนาด</th><th className="py-1 pr-2 font-medium">ใส่ได้ / คำอธิบาย</th><th className="w-32 py-1 pr-2 font-medium">น้ำหนัก (กก./{k.unit})</th><th className="w-10" /></tr></thead>
                <tbody>
                  {k.sizes.map((z, j) => (
                    <tr key={j}>
                      <td className="py-1 pr-2"><input value={z.label} onChange={(e) => setPack(i, { sizes: k.sizes.map((x, l) => (l === j ? { ...x, label: e.target.value, id: x.id || e.target.value } : x)) })} className={cell} /></td>
                      <td className="py-1 pr-2"><input value={z.capacity} onChange={(e) => setPack(i, { sizes: k.sizes.map((x, l) => (l === j ? { ...x, capacity: e.target.value } : x)) })} className={cell} /></td>
                      <td className="py-1 pr-2"><input type="number" min="0" step="any" value={z.weightKg} onChange={(e) => setPack(i, { sizes: k.sizes.map((x, l) => (l === j ? { ...x, weightKg: num(e.target.value) } : x)) })} className={cell} /></td>
                      <td className="py-1">{k.sizes.length > 1 ? <button type="button" aria-label="ลบขนาด" onClick={() => setPack(i, { sizes: k.sizes.filter((_, l) => l !== j) })} className="grid size-8 place-items-center text-red-500 hover:text-red-600"><Trash2 size={14} /></button> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button type="button" onClick={() => setPack(i, { sizes: [...k.sizes, { id: `Z${k.sizes.length + 1}`, label: "", capacity: "", weightKg: 0 }] })} className="mt-1 inline-flex items-center gap-1 text-[12px] font-medium text-brand-purple hover:underline"><PlusCircle size={14} /> เพิ่มขนาด</button>
            </div>
          ))}
        </div>
      </Section>

      <Section title="วัสดุภายใน · น้ำหนักต่อหน่วย" sub="วัสดุภายใน = จำนวนบรรจุภัณฑ์ × จำนวนต่อหน่วย × น้ำหนัก × EF · ช่อง EF เฉพาะ ใช้เมื่อตาราง KYN ให้ค่าต่อชิ้นของสินค้านั้นเอง">
        <table className="w-full min-w-[760px] text-[13px]">
          <thead><tr className="bg-brand-purple-head text-white"><th className={th}>วัสดุภายใน</th><th className={`${th} w-28`}>หน่วย</th><th className={`${th} w-44`}>ทำจาก</th><th className={`${th} w-32`}>น้ำหนัก/หน่วย (กก.)</th><th className={`${th} w-32`}>EF เฉพาะ</th></tr></thead>
          <tbody>
            {c.inners.map((m, i) => (
              <tr key={m.id} className="border-b border-slate-100 last:border-0">
                <td className="px-3 py-2"><input value={m.name} onChange={(e) => setInner(i, { name: e.target.value })} className={cell} />{m.note ? <p className="mt-0.5 text-[11px] text-slate-400">{m.note}</p> : null}</td>
                <td className="px-3 py-2"><select value={m.unit} onChange={(e) => setInner(i, { unit: e.target.value })} className={cell}>{INNER_UNITS.map((u) => <option key={u}>{u}</option>)}</select></td>
                <td className="px-3 py-2"><select value={m.material} onChange={(e) => setInner(i, { material: e.target.value as MaterialId })} className={cell}>{c.materials.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></td>
                <td className="px-3 py-2"><input type="number" min="0" step="any" value={m.weightKg} onChange={(e) => setInner(i, { weightKg: num(e.target.value) })} className={cell} /></td>
                <td className="px-3 py-2"><input type="number" min="0" step="any" value={m.efOverride ?? ""} placeholder="ใช้ EF วัสดุ" onChange={(e) => setInner(i, { efOverride: e.target.value === "" ? undefined : num(e.target.value) })} className={cell} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {msg ? (
        <p className={`flex items-start gap-2 rounded-[8px] px-3 py-2 text-[13px] ${msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>{msg.ok ? <CheckCircle2 size={15} className="mt-0.5 shrink-0" /> : null}{msg.text}</p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-3">
        <button type="button" onClick={() => { setC(DEFAULT_CATALOG); setMsg({ ok: true, text: "คืนค่าเริ่มต้นในแบบฟอร์มแล้ว — กดบันทึกเพื่อใช้งาน" }); }} disabled={!!busy} className="inline-flex h-[40px] items-center gap-2 rounded-[8px] border border-gray-300 px-5 text-[14px] font-medium text-slate-700 hover:bg-gray-100 disabled:opacity-60"><RotateCcw size={15} /> ค่าเริ่มต้น</button>
        <button type="button" onClick={recompute} disabled={!!busy} className="inline-flex h-[40px] items-center gap-2 rounded-[8px] border border-brand-purple px-5 text-[14px] font-medium text-brand-purple hover:bg-brand-purple-light disabled:opacity-60">{busy === "recompute" ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} คำนวณใหม่ทั้งหมด</button>
        <button type="button" onClick={save} disabled={!!busy} className="inline-flex h-[40px] items-center gap-2 rounded-[8px] bg-brand-purple px-8 text-[14px] font-medium text-white hover:opacity-90 disabled:opacity-60">{busy === "save" ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} บันทึก</button>
      </div>
    </div>
  );
}
