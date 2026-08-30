"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2, Lock, CheckCircle2, Calendar } from "lucide-react";
import Modal from "@/components/Modal";
import { DESTINATIONS, estimateDistanceKm } from "@/lib/geo";
import { FLOWER_TYPES, variantsForType } from "@/lib/master-data";
import { BRANCHES } from "@/lib/branches";
import type { Supplier } from "@/lib/types";

const inputCls =
  "w-full rounded-[8px] border border-gray-300 bg-white px-[14px] py-[10px] text-[13px] text-black outline-none placeholder:text-[#bdbdbd] focus:border-brand-pink";
const labelCls = "mb-1.5 block text-[13px] font-medium text-slate-700";
const req = <span className="text-[#ee443f]"> *</span>;

// รูปแบบการขนส่ง (design: 5 options). `key` is stable; `label` is what we store on the batch.
const CARRIERS = [
  { key: "thaipost", label: "ไปรษณีย์ไทย" },
  { key: "cold_chain", label: "ขนส่งควบคุมอุณหภูมิ" },
  { key: "private", label: "ขนส่งเอกชน" },
  { key: "sorting_center", label: "ศูนย์คัดแยกสินค้า" },
  { key: "exporter", label: "ผู้ส่งออก" },
] as const;
type CarrierKey = (typeof CARRIERS)[number]["key"];

// A carrier implies the transport profile the carbon engine needs (vehicle + fuel + reefer).
const CARRIER_DEFAULTS: Record<CarrierKey, { vehicleKey: string; fuelKey: string; reefer: boolean }> = {
  thaipost: { vehicleKey: "van", fuelKey: "B7", reefer: false },
  cold_chain: { vehicleKey: "6_wheeler", fuelKey: "B7", reefer: true },
  private: { vehicleKey: "van", fuelKey: "B7", reefer: false },
  sorting_center: { vehicleKey: "6_wheeler", fuelKey: "B7", reefer: false },
  exporter: { vehicleKey: "10_wheeler", fuelKey: "B7", reefer: false },
};

// ผู้ให้บริการขนส่ง (แสดงเมื่อเลือก "ไม่ใช่ไปรษณีย์ไทย") — placeholder จนกว่า KYN ส่งรายชื่อจริง
const PROVIDERS = ["Nim Express", "Kerry Express", "Flash Express", "J&T Express", "SCG Express", "DHL Express"];

const PACK_KINDS = [
  { key: "basket", label: "ตะกร้า" },
  { key: "corrugated_box", label: "กล่องลูกฟูก" },
  { key: "plastic_film", label: "แผ่นพลาสติก / ซองห่อช่อ" },
] as const;

const BOX_MATERIALS = ["กระดาษฝอย", "โฟมกันกระแทก", "พลาสติกกันกระแทก", "ฟองน้ำชุบน้ำ", "เจลรักษาความชื้น"];

// ขนาดบรรจุภัณฑ์มาตรฐาน — ค่ามิติ ก×ย×ส (ซม.) ใช้คำนวณพื้นที่ผิวของกล่อง/แผ่นพลาสติก
// ⚠ placeholder จนกว่า KYN จะส่งรายการขนาดจริง
const SIZE_PRESETS = [
  { label: "20 × 30 × 15 ซม.", w: 20, l: 30, h: 15 },
  { label: "30 × 40 × 20 ซม.", w: 30, l: 40, h: 20 },
  { label: "40 × 60 × 30 ซม.", w: 40, l: 60, h: 30 },
  { label: "50 × 70 × 40 ซม.", w: 50, l: 70, h: 40 },
  { label: "60 × 80 × 50 ซม.", w: 60, l: 80, h: 50 },
];
const presetFor = (label: string) => SIZE_PRESETS.find((s) => s.label === label);

const AGE_OPTIONS = Array.from({ length: 30 }, (_, i) => i + 1);

interface Pack {
  kind: string; // one of PACK_KINDS[].key
  size: string; // one of SIZE_PRESETS[].label
  qty: string;
  basketNo: string;
  boxMaterial: string;
}
const emptyPack = (): Pack => ({ kind: "", size: "", qty: "", basketNo: "", boxMaterial: "" });

type Errors = Record<string, string>;

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-[16px] font-semibold text-slate-900">{title}</h2>
      {sub ? <p className="mt-0.5 text-[12px] text-slate-400">{sub}</p> : null}
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

function Err({ msg }: { msg?: string }) {
  return msg ? <p className="mt-1 text-[12px] text-[#ee443f]">{msg}</p> : null;
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
  const [step, setStep] = useState<"form" | "review">("form");
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toast, setToast] = useState(false);
  const [distEdited, setDistEdited] = useState(false);
  const [errs, setErrs] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);

  // Flowers
  const [flowerType, setFlowerType] = useState(supplier.flowerType || "");
  const [variety, setVariety] = useState("");
  const [flowerCount, setFlowerCount] = useState("");
  const [cutDate, setCutDate] = useState("");
  const [ageDays, setAgeDays] = useState("");
  // Packaging
  const [packs, setPacks] = useState<Pack[]>([emptyPack()]);
  // Shipping
  const [shipDate, setShipDate] = useState("");
  const [destination, setDestination] = useState("");
  const [distanceKm, setDistanceKm] = useState("");
  const [carrier, setCarrier] = useState<CarrierKey>("thaipost");
  const [postalCode, setPostalCode] = useState("");
  const [provider, setProvider] = useState("");
  const [branch, setBranch] = useState("");

  const isThaipost = carrier === "thaipost";
  const varieties = Array.from(
    new Set([...variantsForType(flowerType), ...varietyOptions, ...(supplier.varieties ?? [])]),
  );

  function onCut(v: string) {
    setCutDate(v);
    setErrs((e) => ({ ...e, cutDate: "" }));
    if (v) {
      const days = Math.max(0, Math.round((Date.now() - new Date(v + "T00:00:00").getTime()) / 86400000));
      setAgeDays(String(Math.min(30, days || 1)));
    }
  }
  function onDest(v: string) {
    setDestination(v);
    setErrs((e) => ({ ...e, destination: "" }));
    if (!distEdited) {
      const est = estimateDistanceKm(v, { lat: supplier.gpsLat, lng: supplier.gpsLng });
      if (est != null) setDistanceKm(String(est));
    }
  }
  const setPack = (i: number, k: keyof Pack, v: string) =>
    setPacks((p) => p.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  const carrierLabel = CARRIERS.find((c) => c.key === carrier)!.label;
  const branchName = (id: string) => BRANCHES.find((b) => b.id === id)?.name ?? id;

  // ---- validation (drives the inline-error state) ----
  function validate(): Errors {
    const e: Errors = {};
    if (!flowerType) e.flowerType = "กรุณาเลือกชนิดดอกไม้";
    if (!variety) e.variety = "กรุณาเลือกพันธุ์ดอกไม้";
    if (!flowerCount || Number(flowerCount) <= 0) e.flowerCount = "กรุณาระบุจำนวนดอกไม้";
    if (!cutDate) e.cutDate = "กรุณาเลือกวันที่ตัดดอกไม้";
    if (!ageDays) e.ageDays = "กรุณาระบุอายุดอกไม้";
    packs.forEach((p, i) => {
      if (!p.kind) e[`pack.${i}.kind`] = "กรุณาเลือกบรรจุภัณฑ์";
      if (p.kind === "basket" && !p.basketNo.trim()) e[`pack.${i}.basketNo`] = "กรุณาระบุหมายเลขตะกร้า";
      if (p.kind === "corrugated_box" && !p.boxMaterial) e[`pack.${i}.boxMaterial`] = "กรุณาระบุวัสดุภายในกล่อง";
      if (!p.size) e[`pack.${i}.size`] = "กรุณาระบุขนาด";
      if (!p.qty || Number(p.qty) <= 0) e[`pack.${i}.qty`] = "กรุณาระบุจำนวน";
    });
    if (!shipDate) e.shipDate = "กรุณาระบุวันที่จัดส่ง";
    if (!destination) e.destination = "กรุณาเลือกจังหวัดปลายทาง";
    if (isThaipost) {
      if (!postalCode.trim()) e.postalCode = "กรุณาระบุรหัสไปรษณีย์";
    } else if (!provider) {
      e.provider = "กรุณาเลือกผู้ให้บริการ";
    }
    if (!branch) e.branch = "กรุณาเลือกสาขาที่นำส่ง";
    return e;
  }

  // "บันทึก" บนฟอร์ม → ตรวจสอบ → ไปหน้ายืนยัน
  function goReview() {
    const e = validate();
    setErrs(e);
    if (Object.keys(e).length === 0) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      setStep("review");
    }
  }

  async function save() {
    setServerError(null);
    setBusy(true);
    try {
      const cd = CARRIER_DEFAULTS[carrier];
      const packagingItems = packs
        .filter((p) => p.kind)
        .map((p) => {
          const dim = p.kind === "basket" ? undefined : presetFor(p.size);
          return {
            kind: p.kind,
            width: dim?.w,
            length: dim?.l,
            height: dim?.h,
            quantity: Number(p.qty) || (p.basketNo.trim() ? 1 : 0),
            basketNo: p.basketNo.trim() || undefined,
            boxMaterial: p.boxMaterial || undefined,
          };
        });
      const res = await fetch("/api/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flowerCount: Number(flowerCount) || 0,
          variety: variety || flowerType,
          cutDate,
          destination,
          distanceKm: Number(distanceKm) || 0,
          carrier: carrierLabel,
          provider: isThaipost ? undefined : provider,
          postalCode: isThaipost ? postalCode.trim() : undefined,
          branch: branchName(branch),
          boxMaterial: packs.find((p) => p.kind === "corrugated_box")?.boxMaterial,
          basketIds: packs.filter((p) => p.kind === "basket" && p.basketNo.trim()).map((p) => p.basketNo.trim()),
          packagingItems,
          vehicleKey: cd.vehicleKey,
          fuelKey: cd.fuelKey,
          isReeferUsed: cd.reefer,
          status: "submitted",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      setConfirmOpen(false);
      setToast(true);
      setTimeout(() => {
        router.push("/app/history");
        router.refresh();
      }, 1400);
    } catch (err) {
      setServerError((err as Error).message);
      setBusy(false);
    }
  }

  // ============================ REVIEW STEP ============================
  if (step === "review") {
    const packRows = packs.filter((p) => p.kind);
    const kindLabel = (k: string) => PACK_KINDS.find((x) => x.key === k)?.label ?? k;
    const F = ({ label, value }: { label: string; value: string }) => (
      <div>
        <p className="text-[13px] font-semibold text-slate-800">{label}</p>
        <p className="text-[13px] text-slate-500">{value || "—"}</p>
      </div>
    );
    return (
      <div className="max-w-4xl space-y-5">
        <Toast show={toast} />
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="text-[16px] font-semibold text-slate-900">ตรวจสอบและยืนยันข้อมูล</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3">
            {/* Col 1 — flowers */}
            <div className="space-y-4 border-slate-100 p-6 md:border-r">
              <div className="rounded-lg bg-emerald-500 px-3 py-2 text-center text-[13px] font-semibold text-white">ข้อมูลดอกไม้</div>
              <F label="ชนิดดอกไม้" value={flowerType} />
              <F label="พันธุ์ดอกไม้" value={variety} />
              <F label="จำนวนดอกไม้" value={flowerCount ? `${Number(flowerCount).toLocaleString()} ดอก` : ""} />
              <F label="วันที่ตัดดอกไม้" value={cutDate} />
              <F label="อายุดอกไม้" value={ageDays ? `${ageDays} วัน` : ""} />
            </div>
            {/* Col 2 — packaging */}
            <div className="space-y-4 border-slate-100 p-6 md:border-r">
              <div className="rounded-lg bg-emerald-500 px-3 py-2 text-center text-[13px] font-semibold text-white">บรรจุภัณฑ์</div>
              {packRows.map((p, i) => (
                <div key={i} className="space-y-3 border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                  <p className="text-[12px] font-semibold text-slate-400">รายการที่ {i + 1}</p>
                  <F label="บรรจุภัณฑ์" value={kindLabel(p.kind)} />
                  {p.kind === "basket" ? <F label="หมายเลขตะกร้า" value={p.basketNo} /> : null}
                  {p.kind === "corrugated_box" ? <F label="วัสดุภายใน" value={p.boxMaterial} /> : null}
                  <F label="ขนาด" value={p.size} />
                  <F label="จำนวน" value={p.qty ? `${p.qty} ${p.kind === "basket" ? "ใบ" : "กล่อง"}` : ""} />
                </div>
              ))}
            </div>
            {/* Col 3 — transport */}
            <div className="space-y-4 p-6">
              <div className="rounded-lg bg-emerald-500 px-3 py-2 text-center text-[13px] font-semibold text-white">ข้อมูลการขนส่ง</div>
              <F label="วันที่จัดส่ง" value={shipDate} />
              <F label="ปลายทาง" value={destination} />
              <F label="รูปแบบการขนส่ง" value={carrierLabel} />
              {isThaipost ? (
                <>
                  <F label="รหัสไปรษณีย์" value={postalCode} />
                </>
              ) : (
                <F label="ผู้ให้บริการ" value={provider} />
              )}
              <F label="สาขาที่นำส่ง" value={branchName(branch)} />
            </div>
          </div>
        </div>

        {serverError ? <p className="rounded-[5px] bg-brand-pink-light px-3 py-2 text-[13px] text-[#c1006e]">{serverError}</p> : null}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => setStep("form")} className="h-[40px] rounded-[8px] border border-brand-pink px-8 text-[14px] font-medium text-brand-pink hover:bg-brand-pink-light">แก้ไข</button>
          <button type="button" onClick={() => setConfirmOpen(true)} className="h-[40px] rounded-[8px] bg-brand-pink px-10 text-[14px] font-medium text-white hover:opacity-90">บันทึก</button>
        </div>

        <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="ยืนยันการจัดส่ง?">
          <p className="text-[13px] text-slate-500">หากข้อมูลไม่ถูกต้อง สามารถยกเลิกได้ที่เมนู “สถานะพัสดุ”</p>
          <div className="mt-5 flex justify-end gap-3">
            <button onClick={() => setConfirmOpen(false)} disabled={busy} className="h-[38px] rounded-[8px] border border-gray-300 px-6 text-[14px] font-medium text-slate-700 hover:bg-gray-100">ยกเลิก</button>
            <button onClick={save} disabled={busy} className="inline-flex h-[38px] items-center justify-center gap-2 rounded-[8px] bg-brand-pink px-8 text-[14px] font-medium text-white hover:opacity-90 disabled:opacity-60">
              {busy ? <Loader2 size={16} className="animate-spin" /> : null} ยืนยัน
            </button>
          </div>
        </Modal>
      </div>
    );
  }

  // ============================ FORM STEP ============================
  return (
    <div className="max-w-3xl space-y-5">
      <Toast show={toast} />

      {/* Flowers */}
      <Section title="ข้อมูลดอกไม้" sub="ระบุรายละเอียดดอกไม้ในรอบการจัดส่งนี้">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>ชนิดดอกไม้{req}</label>
            <select value={flowerType} onChange={(e) => { setFlowerType(e.target.value); setVariety(""); setErrs((x) => ({ ...x, flowerType: "" })); }} className={`${inputCls} ${errs.flowerType ? "border-[#ee443f]" : ""}`}>
              <option value="">เลือกประเภทดอกไม้</option>
              {FLOWER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <Err msg={errs.flowerType} />
          </div>
          <div>
            <label className={labelCls}>พันธุ์ดอกไม้{req}</label>
            <input list="fvars" value={variety} onChange={(e) => { setVariety(e.target.value); setErrs((x) => ({ ...x, variety: "" })); }} placeholder="พันธุ์ดอกไม้" className={`${inputCls} ${errs.variety ? "border-[#ee443f]" : ""}`} />
            <datalist id="fvars">{varieties.map((v) => <option key={v} value={v} />)}</datalist>
            <Err msg={errs.variety} />
          </div>
          <div>
            <label className={labelCls}>จำนวนดอกไม้ (ดอก){req}</label>
            <input type="number" min="0" value={flowerCount} onChange={(e) => { setFlowerCount(e.target.value); setErrs((x) => ({ ...x, flowerCount: "" })); }} placeholder="ระบุจำนวนดอกไม้" className={`${inputCls} ${errs.flowerCount ? "border-[#ee443f]" : ""}`} />
            <Err msg={errs.flowerCount} />
          </div>
          <div>
            <label className={labelCls}>วันที่ตัดดอกไม้{req}</label>
            <input type="date" value={cutDate} onChange={(e) => onCut(e.target.value)} className={`${inputCls} ${errs.cutDate ? "border-[#ee443f]" : ""}`} />
            <Err msg={errs.cutDate} />
          </div>
          <div>
            <label className={labelCls}>อายุดอกไม้ (วัน){req}</label>
            <select value={ageDays} onChange={(e) => { setAgeDays(e.target.value); setErrs((x) => ({ ...x, ageDays: "" })); }} className={`${inputCls} ${errs.ageDays ? "border-[#ee443f]" : ""}`}>
              <option value="">ระบุอายุดอกไม้</option>
              {AGE_OPTIONS.map((d) => <option key={d} value={d}>{d} วัน</option>)}
            </select>
            <Err msg={errs.ageDays} />
          </div>
        </div>
      </Section>

      {/* Packaging */}
      <Section title="บรรจุภัณฑ์ที่ใช้ในการจัดส่ง" sub="เลือกวัสดุที่ใช้จริง พร้อมระบุขนาดและจำนวน">
        {packs.map((p, i) => {
          const cols = p.kind === "basket" || p.kind === "corrugated_box" ? "sm:grid-cols-4" : "sm:grid-cols-3";
          return (
            <div key={i} className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
              <div className={`grid gap-3 ${cols}`}>
                <div>
                  <label className={labelCls}>บรรจุภัณฑ์{req}</label>
                  <select value={p.kind} onChange={(e) => { setPack(i, "kind", e.target.value); setErrs((x) => ({ ...x, [`pack.${i}.kind`]: "" })); }} className={`${inputCls} ${errs[`pack.${i}.kind`] ? "border-[#ee443f]" : ""}`}>
                    <option value="">เลือกบรรจุภัณฑ์</option>
                    {PACK_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
                  </select>
                  <Err msg={errs[`pack.${i}.kind`]} />
                </div>
                {p.kind === "basket" ? (
                  <div>
                    <label className={labelCls}>หมายเลขตะกร้า{req}</label>
                    <input list="baskets" value={p.basketNo} onChange={(e) => { setPack(i, "basketNo", e.target.value); setErrs((x) => ({ ...x, [`pack.${i}.basketNo`]: "" })); }} placeholder="เช่น BSK-014" className={`${inputCls} ${errs[`pack.${i}.basketNo`] ? "border-[#ee443f]" : ""}`} />
                    <datalist id="baskets">{basketOptions.map((b) => <option key={b} value={b} />)}</datalist>
                    <Err msg={errs[`pack.${i}.basketNo`]} />
                  </div>
                ) : null}
                {p.kind === "corrugated_box" ? (
                  <div>
                    <label className={labelCls}>วัสดุภายในกล่อง{req}</label>
                    <select value={p.boxMaterial} onChange={(e) => { setPack(i, "boxMaterial", e.target.value); setErrs((x) => ({ ...x, [`pack.${i}.boxMaterial`]: "" })); }} className={`${inputCls} ${errs[`pack.${i}.boxMaterial`] ? "border-[#ee443f]" : ""}`}>
                      <option value="">ระบุวัสดุภายในกล่อง</option>
                      {BOX_MATERIALS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <Err msg={errs[`pack.${i}.boxMaterial`]} />
                  </div>
                ) : null}
                <div>
                  <label className={labelCls}>ขนาด{req}</label>
                  <select value={p.size} onChange={(e) => { setPack(i, "size", e.target.value); setErrs((x) => ({ ...x, [`pack.${i}.size`]: "" })); }} className={`${inputCls} ${errs[`pack.${i}.size`] ? "border-[#ee443f]" : ""}`}>
                    <option value="">ระบุขนาด</option>
                    {SIZE_PRESETS.map((s) => <option key={s.label} value={s.label}>{s.label}</option>)}
                  </select>
                  <Err msg={errs[`pack.${i}.size`]} />
                </div>
                <div>
                  <label className={labelCls}>จำนวน{req}</label>
                  <input type="number" min="0" value={p.qty} onChange={(e) => { setPack(i, "qty", e.target.value); setErrs((x) => ({ ...x, [`pack.${i}.qty`]: "" })); }} placeholder="ระบุจำนวน" className={`${inputCls} ${errs[`pack.${i}.qty`] ? "border-[#ee443f]" : ""}`} />
                  <Err msg={errs[`pack.${i}.qty`]} />
                </div>
              </div>
              {packs.length > 1 ? (
                <button type="button" onClick={() => setPacks(packs.filter((_, j) => j !== i))} className="mt-3 inline-flex items-center gap-1 text-[12px] text-red-500 hover:underline">
                  <Trash2 size={13} /> ลบบรรจุภัณฑ์
                </button>
              ) : null}
            </div>
          );
        })}
        <div className="flex justify-end">
          <button type="button" onClick={() => setPacks([...packs, emptyPack()])} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-pink hover:underline">
            <Plus size={15} /> เพิ่มรายการอื่น
          </button>
        </div>
      </Section>

      {/* Shipping */}
      <Section title="ข้อมูลการขนส่ง" sub="ระบุรายละเอียดการขนส่ง">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={labelCls}>วันที่จัดส่ง{req}</label>
            <div className="relative">
              <input type="date" value={shipDate} onChange={(e) => { setShipDate(e.target.value); setErrs((x) => ({ ...x, shipDate: "" })); }} className={`${inputCls} ${errs.shipDate ? "border-[#ee443f]" : ""}`} />
              <Calendar size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-300" />
            </div>
            <Err msg={errs.shipDate} />
          </div>
          <div>
            <label className={labelCls}>ปลายทาง{req}</label>
            <select value={destination} onChange={(e) => onDest(e.target.value)} className={`${inputCls} ${errs.destination ? "border-[#ee443f]" : ""}`}>
              <option value="">เลือกจังหวัดปลายทาง</option>
              {DESTINATIONS.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
            </select>
            <Err msg={errs.destination} />
          </div>
          <div>
            <label className={labelCls}>ระยะทางขนส่ง (กิโลเมตร)</label>
            <input type="number" value={distanceKm} onChange={(e) => { setDistanceKm(e.target.value); setDistEdited(true); }} placeholder="ระบบจะประมาณการอัตโนมัติ" className={`${inputCls} bg-slate-50`} />
          </div>
        </div>

        <div>
          <label className={labelCls}>รูปแบบการขนส่ง</label>
          <div className="grid gap-2.5 sm:grid-cols-3">
            {CARRIERS.map((c) => (
              <label key={c.key} className={`flex cursor-pointer items-center gap-2.5 rounded-[10px] border px-4 py-3 text-[13px] transition ${carrier === c.key ? "border-brand-pink bg-brand-pink-light font-medium text-brand-pink" : "border-gray-300 text-slate-600 hover:border-gray-400"}`}>
                <input type="radio" name="carrier" checked={carrier === c.key} onChange={() => setCarrier(c.key)} className="size-4 accent-brand-pink" />
                {c.label}
              </label>
            ))}
          </div>
        </div>

        {/* Pro upsell banner */}
        <div className="flex items-start gap-3 rounded-[10px] border border-indigo-100 bg-indigo-50/70 px-4 py-3.5">
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-500"><Lock size={14} /></span>
          <div className="text-[12.5px] leading-relaxed">
            <p className="font-medium text-slate-700">ต้องการจัดส่งกับผู้ให้บริการอื่น?</p>
            <p className="text-slate-400">อัปเกรดระบบเพื่อเข้าถึงผู้ให้บริการจัดส่งที่หลากหลาย <span className="cursor-pointer font-medium text-brand-pink hover:underline">อัปเกรดแพ็กเกจ</span></p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {isThaipost ? (
            <div>
              <label className={labelCls}>รหัสไปรษณีย์{req}</label>
              <input value={postalCode} onChange={(e) => { setPostalCode(e.target.value); setErrs((x) => ({ ...x, postalCode: "" })); }} placeholder="เลือกรหัสไปรษณีย์" className={`${inputCls} ${errs.postalCode ? "border-[#ee443f]" : ""}`} />
              <Err msg={errs.postalCode} />
            </div>
          ) : (
            <div>
              <label className={labelCls}>เลือกผู้ให้บริการ{req}</label>
              <select value={provider} onChange={(e) => { setProvider(e.target.value); setErrs((x) => ({ ...x, provider: "" })); }} className={`${inputCls} ${errs.provider ? "border-[#ee443f]" : ""}`}>
                <option value="">เลือกผู้ให้บริการ</option>
                {PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <Err msg={errs.provider} />
            </div>
          )}
          <div>
            <label className={labelCls}>สาขาที่นำส่ง{req}</label>
            <select value={branch} onChange={(e) => { setBranch(e.target.value); setErrs((x) => ({ ...x, branch: "" })); }} className={`${inputCls} ${errs.branch ? "border-[#ee443f]" : ""}`}>
              <option value="">เลือกสาขาที่นำส่ง</option>
              {BRANCHES.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <Err msg={errs.branch} />
          </div>
        </div>
      </Section>

      {Object.keys(errs).length > 0 ? (
        <p className="rounded-[8px] bg-brand-pink-light px-3 py-2 text-[13px] text-[#c1006e]">กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน</p>
      ) : null}

      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => router.push("/app")} className="h-[40px] rounded-[8px] border border-gray-300 px-8 text-[14px] font-medium text-slate-700 hover:bg-gray-100">ยกเลิก</button>
        <button type="button" onClick={goReview} className="h-[40px] rounded-[8px] bg-brand-pink px-10 text-[14px] font-medium text-white hover:opacity-90">บันทึก</button>
      </div>
    </div>
  );
}

// Top-right success toast (design: "บันทึกข้อมูลสำเร็จ").
function Toast({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="fixed right-6 top-6 z-50 flex items-start gap-3 rounded-xl border border-emerald-100 bg-white px-4 py-3 shadow-lg">
      <CheckCircle2 size={20} className="mt-0.5 text-emerald-500" />
      <div>
        <p className="text-[13px] font-semibold text-slate-800">บันทึกข้อมูลสำเร็จ</p>
        <p className="text-[12px] text-slate-400">ข้อมูลของคุณถูกบันทึกเรียบร้อยแล้ว</p>
      </div>
    </div>
  );
}
