"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2, MapPin, CheckCircle2, Package } from "lucide-react";
import Modal from "@/components/Modal";
import DateField, { formatThaiDate } from "@/components/DateField";
import { VEHICLE_FUELS } from "@/lib/master-data";
import type { Supplier, Batch } from "@/lib/types";

const inputCls =
  "w-full rounded-[8px] border border-gray-300 bg-white px-[14px] py-[10px] text-[13px] text-black outline-none placeholder:text-[#bdbdbd] focus:border-blue-500";
const labelCls = "mb-1.5 block text-[13px] font-medium text-slate-700";
const req = <span className="text-[#ee443f]"> *</span>;

const PACK_KINDS = [
  { key: "basket", label: "ตะกร้า" },
  { key: "corrugated_box", label: "กล่องลูกฟูก" },
  { key: "plastic_film", label: "แผ่นพลาสติก / ซองห่อช่อ" },
] as const;
const BOX_MATERIALS = ["กระดาษฝอย", "โฟมกันกระแทก", "พลาสติกกันกระแทก", "ฟองน้ำชุบน้ำ", "เจลรักษาความชื้น"];
const SIZE_PRESETS = [
  { label: "20 × 30 × 15 ซม.", w: 20, l: 30, h: 15 },
  { label: "30 × 40 × 20 ซม.", w: 30, l: 40, h: 20 },
  { label: "40 × 60 × 30 ซม.", w: 40, l: 60, h: 30 },
  { label: "50 × 70 × 40 ซม.", w: 50, l: 70, h: 40 },
  { label: "60 × 80 × 50 ซม.", w: 60, l: 80, h: 50 },
];
const presetFor = (label: string) => SIZE_PRESETS.find((s) => s.label === label);
// distinct vehicle classes for the "ประเภทรถที่ใช้" dropdown
const VEHICLES = [...new Map(VEHICLE_FUELS.map((v) => [v.vehicle, v])).values()];
const fuelsFor = (veh: string) => VEHICLE_FUELS.filter((v) => v.vehicle === veh);

interface Pack { kind: string; size: string; qty: string; basketNo: string; boxMaterial: string; }
const emptyPack = (): Pack => ({ kind: "", size: "", qty: "", basketNo: "", boxMaterial: "" });

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-[16px] font-semibold text-slate-900">{title}</h2>
      {sub ? <p className="mt-0.5 text-[12px] text-slate-400">{sub}</p> : null}
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}
const Err = ({ msg }: { msg?: string }) => (msg ? <p className="mt-1 text-[12px] text-[#ee443f]">{msg}</p> : null);

type Errors = Record<string, string>;

// Logistic / Exporter data-export (Figma "Logistic → data export"): pick a received Batch,
// then enrich it with the export transport spec (vehicle, fuel, weight, reefer, domestic/intl).
export default function LogisticExportForm({ suppliers, batches }: { suppliers: Supplier[]; batches: Batch[] }) {
  const router = useRouter();
  const supById = useMemo(() => new Map(suppliers.map((s) => [s.id, s])), [suppliers]);

  const [step, setStep] = useState<"form" | "review">("form");
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toast, setToast] = useState(false);
  const [errs, setErrs] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);

  // Batch + flower (prefilled from the chosen batch)
  const [batchId, setBatchId] = useState("");
  const [flowerType, setFlowerType] = useState("");
  const [variety, setVariety] = useState("");
  const [flowerCount, setFlowerCount] = useState("");
  const [ageDays, setAgeDays] = useState("");
  const [exportBunches, setExportBunches] = useState("");
  const [packs, setPacks] = useState<Pack[]>([emptyPack()]);
  // Transport
  const [shipType, setShipType] = useState<"domestic" | "international">("domestic");
  const [destination, setDestination] = useState("");
  const [distanceKm, setDistanceKm] = useState("");
  const [shipDate, setShipDate] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [fuelKey, setFuelKey] = useState("");
  const [isReefer, setIsReefer] = useState(false);
  const [airline, setAirline] = useState("");
  const [flightNo, setFlightNo] = useState("");

  const selectedBatch = batches.find((b) => b.id === batchId) ?? null;
  const vehicleKey = VEHICLES.find((v) => v.vehicle === vehicle)?.vehicleKey ?? "";

  function onPickBatch(id: string) {
    setBatchId(id);
    setErrs((e) => ({ ...e, batchId: "" }));
    const b = batches.find((x) => x.id === id);
    if (!b) return;
    const s = supById.get(b.supplierId);
    setFlowerType(s?.flowerType ?? "");
    setVariety(b.variety ?? "");
    setFlowerCount(String(b.flowerCount));
    setAgeDays(String(b.ageDays));
    setDestination(b.destination ?? "");
    setDistanceKm(String(b.distanceKm ?? ""));
    // prefill packaging from the batch
    if (Array.isArray(b.packagingItems) && b.packagingItems.length) {
      setPacks(
        b.packagingItems.map((p) => ({
          kind: p.kind,
          size: SIZE_PRESETS.find((s) => s.w === p.width && s.l === p.length && s.h === p.height)?.label ?? "",
          qty: String(p.quantity ?? ""),
          basketNo: p.basketNo ?? "",
          boxMaterial: p.boxMaterial ?? "",
        })),
      );
    } else {
      setPacks([emptyPack()]);
    }
  }
  const setPack = (i: number, k: keyof Pack, v: string) => setPacks((p) => p.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  function validate(): Errors {
    const e: Errors = {};
    if (!batchId) e.batchId = "กรุณาเลือก Batch";
    if (!weightKg || Number(weightKg) <= 0) e.weightKg = "กรุณาระบุน้ำหนักรวมบรรจุภัณฑ์";
    if (!vehicle) e.vehicle = "กรุณาเลือกประเภทรถ";
    if (!fuelKey) e.fuelKey = "กรุณาเลือกระบบเชื้อเพลิง";
    if (!shipDate) e.shipDate = "กรุณาระบุวันที่จัดส่ง";
    if (!destination) e.destination = "กรุณาระบุปลายทาง";
    if (shipType === "international" && !airline) e.airline = "กรุณาระบุสายการบิน";
    return e;
  }
  function goReview() {
    const e = validate();
    setErrs(e);
    if (Object.keys(e).length === 0) { window.scrollTo({ top: 0, behavior: "smooth" }); setStep("review"); }
  }

  async function save() {
    if (!selectedBatch) return;
    setServerError(null);
    setBusy(true);
    try {
      const packagingItems = packs.filter((p) => p.kind).map((p) => {
        const dim = p.kind === "basket" ? undefined : presetFor(p.size);
        return { kind: p.kind, width: dim?.w, length: dim?.l, height: dim?.h, quantity: Number(p.qty) || (p.basketNo.trim() ? 1 : 0), basketNo: p.basketNo.trim() || undefined, boxMaterial: p.boxMaterial || undefined };
      });
      const res = await fetch(`/api/batches/${batchId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shippedWeightKg: weightKg, vehicleKey, fuelKey, isReeferUsed: isReefer, destination, distanceKm, packagingItems }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      setConfirmOpen(false);
      setToast(true);
      setTimeout(() => { router.push("/logistic/status"); router.refresh(); }, 1400);
    } catch (err) { setServerError((err as Error).message); setBusy(false); }
  }

  const Toast = () => toast ? (
    <div className="fixed right-6 top-6 z-50 flex items-start gap-3 rounded-xl border border-emerald-100 bg-white px-4 py-3 shadow-lg">
      <CheckCircle2 size={20} className="mt-0.5 text-emerald-500" />
      <div><p className="text-[13px] font-semibold text-slate-800">บันทึกข้อมูลสำเร็จ</p><p className="text-[12px] text-slate-400">ข้อมูลการจัดส่งถูกบันทึกเรียบร้อยแล้ว</p></div>
    </div>
  ) : null;

  // ---------- REVIEW ----------
  if (step === "review") {
    const s = selectedBatch ? supById.get(selectedBatch.supplierId) : null;
    const F = ({ label, value }: { label: string; value: string }) => (
      <div><p className="text-[13px] font-semibold text-slate-800">{label}</p><p className="text-[13px] text-slate-500">{value || "—"}</p></div>
    );
    return (
      <div className="max-w-4xl space-y-5">
        <Toast />
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-4"><h2 className="text-[16px] font-semibold text-slate-900">ตรวจสอบและยืนยันข้อมูล</h2></div>
          <div className="grid grid-cols-1 md:grid-cols-3">
            <div className="space-y-4 border-slate-100 p-6 md:border-r">
              <div className="rounded-lg bg-blue-600 px-3 py-2 text-center text-[13px] font-semibold text-white">ข้อมูลดอกไม้</div>
              <F label="Batch ID" value={batchId} />
              <F label="ชนิดดอกไม้" value={flowerType} />
              <F label="พันธุ์ดอกไม้" value={variety} />
              <F label="จำนวนดอกไม้" value={flowerCount ? `${Number(flowerCount).toLocaleString()} ดอก` : ""} />
              <F label="จำนวนส่งออก" value={exportBunches ? `${exportBunches} ช่อ` : "—"} />
            </div>
            <div className="space-y-4 border-slate-100 p-6 md:border-r">
              <div className="rounded-lg bg-blue-600 px-3 py-2 text-center text-[13px] font-semibold text-white">บรรจุภัณฑ์</div>
              {packs.filter((p) => p.kind).map((p, i) => (
                <div key={i} className="space-y-2 border-b border-slate-100 pb-3 last:border-0">
                  <p className="text-[12px] font-semibold text-slate-400">รายการที่ {i + 1}</p>
                  <F label="บรรจุภัณฑ์" value={PACK_KINDS.find((k) => k.key === p.kind)?.label ?? p.kind} />
                  {p.kind === "basket" ? <F label="หมายเลขตะกร้า" value={p.basketNo} /> : null}
                  {p.kind === "corrugated_box" ? <F label="วัสดุภายใน" value={p.boxMaterial} /> : null}
                  <F label="ขนาด" value={p.size} />
                  <F label="จำนวน" value={p.qty} />
                </div>
              ))}
            </div>
            <div className="space-y-4 p-6">
              <div className="rounded-lg bg-blue-600 px-3 py-2 text-center text-[13px] font-semibold text-white">ข้อมูลการขนส่ง</div>
              <F label="ประเภทการจัดส่ง" value={shipType === "domestic" ? "ส่งภายในประเทศ" : "ส่งต่างประเทศ"} />
              <F label="วันที่จัดส่ง" value={formatThaiDate(shipDate)} />
              <F label="ปลายทาง" value={destination} />
              <F label="น้ำหนักรวมบรรจุภัณฑ์" value={weightKg ? `${weightKg} กก.` : ""} />
              <F label="ประเภทรถ" value={vehicle} />
              <F label="ระบบเชื้อเพลิง" value={fuelsFor(vehicle).find((f) => f.fuelKey === fuelKey)?.fuel ?? fuelKey} />
              <F label="ตู้แช่เย็น/ห้องเย็น" value={isReefer ? "ใช้" : "ไม่ใช้"} />
              {shipType === "international" ? <F label="สายการบิน / เที่ยวบิน" value={`${airline}${flightNo ? " · " + flightNo : ""}`} /> : null}
            </div>
          </div>
        </div>
        {serverError ? <p className="rounded-[8px] bg-red-50 px-3 py-2 text-[13px] text-red-600">{serverError}</p> : null}
        <div className="flex justify-end gap-3">
          <button onClick={() => setStep("form")} className="h-[40px] rounded-[8px] border border-blue-600 px-8 text-[14px] font-medium text-blue-600 hover:bg-blue-50">แก้ไข</button>
          <button onClick={() => setConfirmOpen(true)} className="h-[40px] rounded-[8px] bg-blue-600 px-10 text-[14px] font-medium text-white hover:bg-blue-700">บันทึก</button>
        </div>
        <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="ยืนยันการจัดส่ง?">
          <p className="text-[13px] text-slate-500">หากข้อมูลไม่ถูกต้อง สามารถยกเลิกได้ที่เมนู “สถานะพัสดุ”</p>
          <div className="mt-5 flex justify-end gap-3">
            <button onClick={() => setConfirmOpen(false)} disabled={busy} className="h-[38px] rounded-[8px] border border-gray-300 px-6 text-[14px] font-medium text-slate-700 hover:bg-gray-100">ยกเลิก</button>
            <button onClick={save} disabled={busy} className="inline-flex h-[38px] items-center gap-2 rounded-[8px] bg-blue-600 px-8 text-[14px] font-medium text-white hover:bg-blue-700 disabled:opacity-60">{busy ? <Loader2 size={16} className="animate-spin" /> : null} ยืนยัน</button>
          </div>
        </Modal>
      </div>
    );
  }

  // ---------- FORM ----------
  return (
    <div className="max-w-3xl space-y-5">
      <Toast />

      <Section title="ข้อมูลดอกไม้" sub="เลือก Batch ที่รับเข้ามาเพื่อบันทึกการจัดส่ง">
        <div>
          <label className={labelCls}>Batch ที่ต้องการจัดส่ง{req}</label>
          <select value={batchId} onChange={(e) => onPickBatch(e.target.value)} className={`${inputCls} ${errs.batchId ? "border-[#ee443f]" : ""}`}>
            <option value="">เลือก Batch</option>
            {batches.map((b) => <option key={b.id} value={b.id}>{b.id} · {supById.get(b.supplierId)?.farmName ?? b.supplierId}</option>)}
          </select>
          <Err msg={errs.batchId} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className={labelCls}>ชนิดดอกไม้</label><input value={flowerType} onChange={(e) => setFlowerType(e.target.value)} placeholder="เลือกประเภทดอกไม้" className={inputCls} /></div>
          <div><label className={labelCls}>พันธุ์ดอกไม้</label><input value={variety} onChange={(e) => setVariety(e.target.value)} placeholder="พันธุ์ดอกไม้" className={inputCls} /></div>
          <div><label className={labelCls}>จำนวนดอกไม้ (ดอก)</label><input type="number" value={flowerCount} onChange={(e) => setFlowerCount(e.target.value)} placeholder="ระบุจำนวนดอกไม้" className={inputCls} /></div>
          <div><label className={labelCls}>อายุดอกไม้หลังตัด (วัน)</label><input type="number" value={ageDays} onChange={(e) => setAgeDays(e.target.value)} placeholder="ระบุอายุดอกไม้" className={inputCls} /></div>
          <div><label className={labelCls}>จำนวนส่งออกดอกไม้ (ช่อ)</label><input type="number" value={exportBunches} onChange={(e) => setExportBunches(e.target.value)} placeholder="ระบุจำนวนช่อ" className={inputCls} /></div>
        </div>
      </Section>

      <Section title="บรรจุภัณฑ์ที่ใช้ในการจัดส่ง" sub="เลือกวัสดุที่ใช้จริง พร้อมระบุขนาดและจำนวน">
        {packs.map((p, i) => {
          const cols = p.kind === "basket" || p.kind === "corrugated_box" ? "sm:grid-cols-4" : "sm:grid-cols-3";
          return (
            <div key={i} className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
              <div className={`grid gap-3 ${cols}`}>
                <div><label className={labelCls}>บรรจุภัณฑ์{req}</label>
                  <select value={p.kind} onChange={(e) => setPack(i, "kind", e.target.value)} className={inputCls}><option value="">เลือกบรรจุภัณฑ์</option>{PACK_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}</select>
                </div>
                {p.kind === "basket" ? <div><label className={labelCls}>หมายเลขตะกร้า{req}</label><input value={p.basketNo} onChange={(e) => setPack(i, "basketNo", e.target.value)} placeholder="เช่น BSK-014" className={inputCls} /></div> : null}
                {p.kind === "corrugated_box" ? <div><label className={labelCls}>วัสดุภายในกล่อง{req}</label><select value={p.boxMaterial} onChange={(e) => setPack(i, "boxMaterial", e.target.value)} className={inputCls}><option value="">ระบุวัสดุภายในกล่อง</option>{BOX_MATERIALS.map((m) => <option key={m} value={m}>{m}</option>)}</select></div> : null}
                <div><label className={labelCls}>ขนาด{req}</label><select value={p.size} onChange={(e) => setPack(i, "size", e.target.value)} className={inputCls}><option value="">ระบุขนาด</option>{SIZE_PRESETS.map((s) => <option key={s.label} value={s.label}>{s.label}</option>)}</select></div>
                <div><label className={labelCls}>จำนวน{req}</label><input type="number" value={p.qty} onChange={(e) => setPack(i, "qty", e.target.value)} placeholder="ระบุจำนวน" className={inputCls} /></div>
              </div>
              {packs.length > 1 ? <button type="button" onClick={() => setPacks(packs.filter((_, j) => j !== i))} className="mt-3 inline-flex items-center gap-1 text-[12px] text-red-500 hover:underline"><Trash2 size={13} /> ลบบรรจุภัณฑ์</button> : null}
            </div>
          );
        })}
        <div className="flex justify-end"><button type="button" onClick={() => setPacks([...packs, emptyPack()])} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-blue-600 hover:underline"><Plus size={15} /> เพิ่มรายการอื่น</button></div>
      </Section>

      <Section title="ข้อมูลการขนส่ง" sub="ระบุรายละเอียดการขนส่งจริง">
        <div>
          <label className={labelCls}>ประเภทการจัดส่ง</label>
          <div className="flex gap-6">
            {[["domestic", "ส่งภายในประเทศ"], ["international", "ส่งต่างประเทศ"]].map(([k, l]) => (
              <label key={k} className="flex cursor-pointer items-center gap-2 text-[13px] text-slate-700">
                <input type="radio" name="shipType" checked={shipType === k} onChange={() => setShipType(k as "domestic" | "international")} className="size-4 accent-blue-600" /> {l}
              </label>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>ปลายทาง{req}</label>
            <div className="flex gap-2">
              <input value={destination} onChange={(e) => { setDestination(e.target.value); setErrs((x) => ({ ...x, destination: "" })); }} placeholder="12.2222, 13.3333" className={`${inputCls} ${errs.destination ? "border-[#ee443f]" : ""}`} />
              <button type="button" className="inline-flex shrink-0 items-center gap-1 rounded-[8px] border border-gray-300 px-3 text-[12px] text-slate-600 hover:bg-gray-100"><MapPin size={14} /> เลือกจากแผนที่</button>
            </div>
            <Err msg={errs.destination} />
          </div>
          <div><label className={labelCls}>ระยะทางขนส่ง (กิโลเมตร)</label><input type="number" value={distanceKm} onChange={(e) => setDistanceKm(e.target.value)} placeholder="ระบบจะประมาณการอัตโนมัติ" className={`${inputCls} bg-slate-50`} /></div>
          <div><label className={labelCls}>วันที่จัดส่ง{req}</label><DateField value={shipDate} onChange={(v) => { setShipDate(v); setErrs((x) => ({ ...x, shipDate: "" })); }} className={inputCls} invalid={!!errs.shipDate} /><Err msg={errs.shipDate} /></div>
          <div><label className={labelCls}>น้ำหนักรวมบรรจุภัณฑ์ (กก.){req}</label><input type="number" min="0" step="any" value={weightKg} onChange={(e) => { setWeightKg(e.target.value); setErrs((x) => ({ ...x, weightKg: "" })); }} placeholder="ระบุน้ำหนักรวมบรรจุภัณฑ์" className={`${inputCls} ${errs.weightKg ? "border-[#ee443f]" : ""}`} /><Err msg={errs.weightKg} /></div>
          <div>
            <label className={labelCls}>ประเภทรถที่ใช้{req}</label>
            <select value={vehicle} onChange={(e) => { setVehicle(e.target.value); setFuelKey(""); setErrs((x) => ({ ...x, vehicle: "" })); }} className={`${inputCls} ${errs.vehicle ? "border-[#ee443f]" : ""}`}>
              <option value="">เลือกประเภทรถที่ใช้ขนส่ง</option>
              {VEHICLES.map((v) => <option key={v.vehicleKey} value={v.vehicle}>{v.vehicle}</option>)}
            </select>
            <Err msg={errs.vehicle} />
          </div>
          <div>
            <label className={labelCls}>ระบบเชื้อเพลิง{req}</label>
            <select value={fuelKey} onChange={(e) => { setFuelKey(e.target.value); setErrs((x) => ({ ...x, fuelKey: "" })); }} disabled={!vehicle} className={`${inputCls} ${errs.fuelKey ? "border-[#ee443f]" : ""} disabled:bg-slate-50`}>
              <option value="">เลือกระบบเชื้อเพลิงที่ใช้</option>
              {fuelsFor(vehicle).map((f) => <option key={f.fuelKey} value={f.fuelKey}>{f.fuel}</option>)}
            </select>
            <Err msg={errs.fuelKey} />
          </div>
        </div>

        {shipType === "international" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className={labelCls}>สายการบิน{req}</label><input value={airline} onChange={(e) => { setAirline(e.target.value); setErrs((x) => ({ ...x, airline: "" })); }} placeholder="เช่น Thai Airways" className={`${inputCls} ${errs.airline ? "border-[#ee443f]" : ""}`} /><Err msg={errs.airline} /></div>
            <div><label className={labelCls}>หมายเลขเที่ยวบิน</label><input value={flightNo} onChange={(e) => setFlightNo(e.target.value)} placeholder="เช่น TG920" className={inputCls} /></div>
          </div>
        ) : null}

        <label className="flex cursor-pointer items-center justify-between rounded-[8px] border border-gray-200 px-4 py-3">
          <span className="text-[13px] text-slate-700">ใช้ตู้แช่เย็น/ห้องเย็น <span className="text-slate-400">(เพิ่มคาร์บอนขนส่ง 15%)</span></span>
          <input type="checkbox" checked={isReefer} onChange={(e) => setIsReefer(e.target.checked)} className="peer sr-only" />
          <span className="relative h-6 w-11 rounded-full bg-slate-200 transition peer-checked:bg-blue-600 after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5" />
        </label>
      </Section>

      {selectedBatch ? null : <p className="rounded-[8px] bg-blue-50 px-3 py-2 text-[13px] text-blue-700"><Package size={14} className="mr-1 inline" /> เลือก Batch ด้านบนเพื่อดึงข้อมูลดอกไม้และบรรจุภัณฑ์อัตโนมัติ</p>}
      {Object.keys(errs).length > 0 ? <p className="rounded-[8px] bg-red-50 px-3 py-2 text-[13px] text-red-600">กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน</p> : null}

      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => router.push("/logistic")} className="h-[40px] rounded-[8px] border border-gray-300 px-8 text-[14px] font-medium text-slate-700 hover:bg-gray-100">ยกเลิก</button>
        <button type="button" onClick={goReview} className="h-[40px] rounded-[8px] bg-blue-600 px-10 text-[14px] font-medium text-white hover:bg-blue-700">ถัดไป</button>
      </div>
    </div>
  );
}
