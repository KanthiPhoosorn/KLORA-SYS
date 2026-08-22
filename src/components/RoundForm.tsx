"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2, Lock } from "lucide-react";
import { DESTINATIONS, estimateDistanceKm } from "@/lib/geo";
import type { Supplier } from "@/lib/types";

const inputCls =
  "w-full rounded-[5px] border border-gray-300 bg-white px-[15px] py-[9px] text-[13px] text-black outline-none placeholder:text-[#bdbdbd] focus:border-brand-pink";
const labelCls = "mb-1 block text-[14px] text-black";
const req = <span className="text-[#ee443f]"> *</span>;

const CARRIERS = ["ไปรษณีย์", "Cold Chain", "โรงคัดแยก", "Exporter"];
const PACK_KINDS = ["ตะกร้า", "กล่องลูกฟูก", "อื่นๆ"];
const COMMON_TYPES = ["กุหลาบ", "เบญจมาศ", "ลิลลี่", "คาร์เนชั่น", "ทานตะวัน"];

interface Pack {
  kind: string;
  size: string;
  qty: string;
  basketNo: string;
  boxMaterial: string;
}

function Section({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-[16px] font-semibold text-slate-900">{title}</h2>
      <p className="mt-0.5 text-[12px] text-slate-400">{sub}</p>
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

export default function RoundForm({
  supplier,
  varietyOptions = [],
  basketOptions = [],
}: {
  supplier: Supplier;
  varietyOptions?: string[];
  basketOptions?: string[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [distEdited, setDistEdited] = useState(false);

  const [flowerType, setFlowerType] = useState(supplier.flowerType || "");
  const [variety, setVariety] = useState("");
  const [flowerCount, setFlowerCount] = useState("");
  const [cutDate, setCutDate] = useState("");
  const [ageDays, setAgeDays] = useState("");
  const [packs, setPacks] = useState<Pack[]>([{ kind: "ตะกร้า", size: "", qty: "", basketNo: "", boxMaterial: "" }]);
  const [shipDate, setShipDate] = useState("");
  const [destination, setDestination] = useState("");
  const [distanceKm, setDistanceKm] = useState("");
  const [carrier, setCarrier] = useState("ไปรษณีย์");
  const [postalCode, setPostalCode] = useState("");
  const [branch, setBranch] = useState("");

  const varieties = Array.from(new Set([...varietyOptions, ...(supplier.varieties ?? [])]));

  function onCut(v: string) {
    setCutDate(v);
    if (v) {
      const days = Math.max(0, Math.round((Date.now() - new Date(v + "T00:00:00").getTime()) / 86400000));
      if (!ageDays) setAgeDays(String(days));
    }
  }
  function onDest(v: string) {
    setDestination(v);
    if (!distEdited) {
      const est = estimateDistanceKm(v, { lat: supplier.gpsLat, lng: supplier.gpsLng });
      if (est != null) setDistanceKm(String(est));
    }
  }
  const setPack = (i: number, k: keyof Pack, v: string) =>
    setPacks((p) => p.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  async function save() {
    setError(null);
    if (!flowerCount || !cutDate) return setError("กรอกจำนวนดอกไม้และวันที่ตัด");
    const basketIds = packs.filter((p) => p.kind === "ตะกร้า" && p.basketNo.trim()).map((p) => p.basketNo.trim());
    if (basketIds.length === 0) return setError("ระบุหมายเลขตะกร้าอย่างน้อย 1 ใบ");
    setBusy(true);
    try {
      const res = await fetch("/api/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flowerCount: Number(flowerCount) || 0,
          variety: variety || flowerType,
          cutDate,
          destination,
          distanceKm: Number(distanceKm) || 0,
          carrier,
          postalCode,
          branch,
          boxMaterial: packs.find((p) => p.kind === "กล่องลูกฟูก")?.boxMaterial,
          basketIds,
          status: "submitted",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      router.push("/app/history");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-5">
      {/* Flower info */}
      <Section title="ข้อมูลดอกไม้" sub="ระบุรายละเอียดดอกไม้ในรอบการจัดส่งนี้">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>ชนิดดอกไม้{req}</label>
            <input list="ftypes" value={flowerType} onChange={(e) => setFlowerType(e.target.value)} placeholder="เลือกประเภทดอกไม้" className={inputCls} />
            <datalist id="ftypes">{COMMON_TYPES.map((t) => <option key={t} value={t} />)}</datalist>
          </div>
          <div>
            <label className={labelCls}>พันธุ์ดอกไม้{req}</label>
            <input list="fvars" value={variety} onChange={(e) => setVariety(e.target.value)} placeholder="พันธุ์ดอกไม้" className={inputCls} />
            <datalist id="fvars">{varieties.map((v) => <option key={v} value={v} />)}</datalist>
          </div>
          <div>
            <label className={labelCls}>จำนวนดอกไม้ (ดอก){req}</label>
            <input type="number" value={flowerCount} onChange={(e) => setFlowerCount(e.target.value)} placeholder="ระบุจำนวนดอกไม้" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>วันที่ตัดดอกไม้{req}</label>
            <input type="date" value={cutDate} onChange={(e) => onCut(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>อายุดอกไม้ (วัน){req}</label>
            <input type="number" value={ageDays} onChange={(e) => setAgeDays(e.target.value)} placeholder="ระบุอายุดอกไม้" className={inputCls} />
          </div>
        </div>
      </Section>

      {/* Packaging */}
      <Section title="บรรจุภัณฑ์ที่ใช้ในการจัดส่ง" sub="เลือกวัสดุที่ใช้จริง พร้อมระบุขนาดและจำนวน">
        {packs.map((p, i) => (
          <div key={i} className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className={labelCls}>บรรจุภัณฑ์{req}</label>
                <select value={p.kind} onChange={(e) => setPack(i, "kind", e.target.value)} className={inputCls}>
                  {PACK_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>ขนาด{req}</label>
                <input value={p.size} onChange={(e) => setPack(i, "size", e.target.value)} placeholder="ระบุขนาด" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>จำนวน{req}</label>
                <input type="number" value={p.qty} onChange={(e) => setPack(i, "qty", e.target.value)} placeholder="ระบุจำนวน" className={inputCls} />
              </div>
            </div>
            {p.kind === "ตะกร้า" && (
              <div>
                <label className={labelCls}>หมายเลขตะกร้า{req}</label>
                <input list="baskets" value={p.basketNo} onChange={(e) => setPack(i, "basketNo", e.target.value)} placeholder="ระบุหมายเลขตะกร้า เช่น BSK-014" className={inputCls} />
                <datalist id="baskets">{basketOptions.map((b) => <option key={b} value={b} />)}</datalist>
              </div>
            )}
            {p.kind === "กล่องลูกฟูก" && (
              <div>
                <label className={labelCls}>วัสดุภายในกล่อง{req}</label>
                <input value={p.boxMaterial} onChange={(e) => setPack(i, "boxMaterial", e.target.value)} placeholder="ระบุวัสดุภายในกล่อง" className={inputCls} />
              </div>
            )}
            {packs.length > 1 && (
              <button type="button" onClick={() => setPacks(packs.filter((_, j) => j !== i))} className="inline-flex items-center gap-1 text-[12px] text-red-500 hover:underline">
                <Trash2 size={13} /> ลบบรรจุภัณฑ์
              </button>
            )}
          </div>
        ))}
        <button type="button" onClick={() => setPacks([...packs, { kind: "กล่องลูกฟูก", size: "", qty: "", basketNo: "", boxMaterial: "" }])} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-pink hover:underline">
          <Plus size={15} /> เพิ่มรายการอื่น
        </button>
      </Section>

      {/* Shipping */}
      <Section title="ข้อมูลการขนส่ง" sub="ระบุรายละเอียดการขนส่ง">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>วันที่จัดส่ง{req}</label>
            <input type="date" value={shipDate} onChange={(e) => setShipDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>ปลายทาง{req}</label>
            <input list="dests" value={destination} onChange={(e) => onDest(e.target.value)} placeholder="เลือกจังหวัดปลายทาง" className={inputCls} />
            <datalist id="dests">{DESTINATIONS.map((d) => <option key={d.name} value={d.name} />)}</datalist>
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>ระยะทางขนส่ง (กิโลเมตร)</label>
            <input type="number" value={distanceKm} onChange={(e) => { setDistanceKm(e.target.value); setDistEdited(true); }} placeholder="ระบบจะประมาณการอัตโนมัติ" className={inputCls} />
          </div>
        </div>

        <div>
          <label className={labelCls}>รูปแบบการขนส่ง</label>
          <div className="grid gap-2 sm:grid-cols-2">
            {CARRIERS.map((c) => (
              <label key={c} className={`flex cursor-pointer items-center gap-2.5 rounded-[8px] border px-3.5 py-2.5 text-[13px] ${carrier === c ? "border-brand-pink bg-brand-pink-light text-brand-pink" : "border-gray-300 text-slate-700"}`}>
                <input type="radio" name="carrier" checked={carrier === c} onChange={() => setCarrier(c)} className="accent-brand-pink" />
                {c}
              </label>
            ))}
            <div className="flex items-center gap-2.5 rounded-[8px] border border-dashed border-gray-300 bg-gray-100 px-3.5 py-2.5 text-[13px] text-slate-400 sm:col-span-2">
              <Lock size={14} /> บริษัทอื่นๆ — <span className="text-brand-pink">อัปเกรดระบบ</span> เพื่อเข้าถึงผู้ให้บริการจัดส่งที่หลากหลาย
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>รหัสไปรษณีย์{req}</label>
            <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="เลือกรหัสไปรษณีย์" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>สาขาที่นำส่ง{req}</label>
            <input value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="เลือกสาขาที่นำส่ง" className={inputCls} />
          </div>
        </div>
      </Section>

      {error ? <p className="rounded-[5px] bg-brand-pink-light px-3 py-2 text-[13px] text-[#c1006e]">{error}</p> : null}

      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => router.push("/app")} className="h-[38px] rounded-[5px] border border-gray-300 px-6 text-[14px] font-medium text-slate-700 hover:bg-gray-100">ยกเลิก</button>
        <button type="button" onClick={save} disabled={busy} className="inline-flex h-[38px] items-center gap-2 rounded-[5px] bg-brand-pink px-8 text-[14px] font-medium text-white hover:opacity-90 disabled:opacity-60">
          {busy ? <Loader2 size={16} className="animate-spin" /> : null} บันทึก
        </button>
      </div>
    </div>
  );
}
