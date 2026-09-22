"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MapPin, CheckCircle2, Package, Plane } from "lucide-react";
import Modal from "@/components/Modal";
import DateField, { formatThaiDate } from "@/components/DateField";
import SearchSelect from "@/components/SearchSelect";
import { VEHICLE_FUELS } from "@/lib/master-data";
import { DESTINATIONS, estimateDistanceKm, haversineKm, provinceFromAddress } from "@/lib/geo";
import type { Supplier, Batch } from "@/lib/types";
import PackagingLines, { emptyPackLine, validatePackLines, packLinesToPayload, packLinesFromBatch, packKindLabel, packSizeText, packInnerText, packUsageText, packQty, type PackLine } from "@/components/PackagingLines";
import { DEFAULT_FACTORS, type PackageSize } from "@/lib/factors";
import { ORIGIN_AIRPORTS, DEST_AIRPORTS, airportLabel, findAirport, flightDistanceKm } from "@/lib/airports";

const inputCls =
  "w-full rounded-[8px] border border-gray-300 bg-white px-[14px] py-[10px] text-[13px] text-black outline-none placeholder:text-[#bdbdbd] focus:border-blue-500";
const labelCls = "mb-1.5 block text-[13px] font-medium text-slate-700";
const req = <span className="text-[#ee443f]"> *</span>;

// distinct vehicle classes for the "ประเภทรถที่ใช้" dropdown
const VEHICLES = [...new Map(VEHICLE_FUELS.map((v) => [v.vehicle, v])).values()];
const fuelsFor = (veh: string) => VEHICLE_FUELS.filter((v) => v.vehicle === veh);
// grouped, searchable dropdown options (Figma "dropdown search")
const VEHICLE_OPTIONS = VEHICLES.map((v) => ({ value: v.vehicle, label: v.vehicle, group: v.category }));
function fuelGroup(k: string): string {
  if (["E10", "E20", "E85", "gasoline"].includes(k)) return "เบนซินและแก๊สโซฮอล์";
  if (["B7", "B10", "B20"].includes(k)) return "ดีเซล";
  if (["CNG", "LPG"].includes(k)) return "ก๊าซ";
  if (k === "EV") return "ไฟฟ้า";
  return "อื่นๆ ระบุ";
}
const fuelOptions = (veh: string) => fuelsFor(veh).map((f) => ({ value: f.fuelKey, label: f.fuel, group: fuelGroup(f.fuelKey) }));
const AIRLINE_OPTIONS = [
  "การบินไทย (Thai Airways)", "ไทยสมายล์ (Thai Smile)", "บางกอกแอร์เวย์ส (Bangkok Airways)",
  "ไทยแอร์เอเชีย (Thai AirAsia)", "ไทยไลอ้อนแอร์ (Thai Lion Air)", "นกแอร์ (Nok Air)",
  "ไทยเวียตเจ็ท (Thai VietJet)", "เอมิเรตส์ (Emirates)", "สิงคโปร์แอร์ไลน์ (Singapore Airlines)",
  "คาเธ่ย์แปซิฟิก (Cathay Pacific)", "ควอนตัสคาร์โก้ (Qantas Freight)", "ลุฟท์ฮันซาคาร์โก้ (Lufthansa Cargo)",
].map((a) => ({ value: a, label: a }));
const DEST_AIRPORT_OPTIONS = DEST_AIRPORTS.map((a) => ({ value: a.code, label: airportLabel(a), group: a.country }));

// Figma default: two seeded cards — a basket (→ หมายเลขตะกร้า) + a corrugated box (→ วัสดุภายในกล่อง)
const defaultPacks = (): PackLine[] => [{ ...emptyPackLine(), kind: "basket" }, { ...emptyPackLine(), kind: "corrugated_box" }];
// A seeded card the carrier never filled in is ignored (the farm's own packaging is kept).
const touched = (p: PackLine) => !!(p.kind && (p.usage || p.assetId || p.boxMaterial || p.w || p.l || p.h || p.qty || p.priorUses));

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
export default function LogisticExportForm({
  suppliers, batches, sizePresets = DEFAULT_FACTORS.packageSizes,
}: { suppliers: Supplier[]; batches: Batch[]; sizePresets?: PackageSize[] }) {
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
  const [packs, setPacks] = useState<PackLine[]>(defaultPacks());
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
  const [destCountry, setDestCountry] = useState(""); // ส่งต่างประเทศ: ประเทศ/เมืองปลายทาง
  // Air-freight leg (DEFRA): airports → great-circle distance, overridable.
  const [originAirport, setOriginAirport] = useState("BKK");
  const [destAirport, setDestAirport] = useState("");
  const [flightKm, setFlightKm] = useState("");
  const autoFlightKm = flightDistanceKm(originAirport, destAirport);
  function onDestAirport(code: string) {
    const prev = findAirport(destAirport);
    setDestAirport(code);
    setErrs((x) => ({ ...x, destAirport: "" }));
    const a = findAirport(code);
    if (a && (!destCountry || (prev && destCountry === `${prev.country} (${prev.city})`))) setDestCountry(`${a.country} (${a.city})`);
  }
  const [destAddress, setDestAddress] = useState(""); // ที่อยู่ปลายทาง (ผู้รับ)
  const [destGps, setDestGps] = useState(""); // ส่งในประเทศ: "lat, lng"
  const destGpsParsed = (() => {
    const [a, b] = destGps.split(",").map((x) => Number(x.trim()));
    return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180 && destGps.includes(",") ? { lat: a, lng: b } : null;
  })();
  const [shipDataMode, setShipDataMode] = useState<"new" | "same">("new");

  const selectedBatch = batches.find((b) => b.id === batchId) ?? null;
  const farmOf = (b: Batch | null) => (b ? suppliers.find((x) => x.id === b.supplierId) : undefined);
  // ปลายทาง (province) → distance estimate from the farm, unless a destination GPS is given.
  function onDestProvince(v: string) {
    setDestination(v);
    setErrs((x) => ({ ...x, destination: "" }));
    const farm = farmOf(selectedBatch);
    if (!destGpsParsed && farm) {
      const est = estimateDistanceKm(v, { lat: farm.gpsLat, lng: farm.gpsLng });
      if (est != null) setDistanceKm(String(est));
    }
  }
  function onDestGps(v: string) {
    setDestGps(v);
    const [a, b] = v.split(",").map((x) => Number(x.trim()));
    const farm = farmOf(selectedBatch);
    if (v.includes(",") && Number.isFinite(a) && Number.isFinite(b) && farm?.gpsLat && farm?.gpsLng) {
      setDistanceKm(String(Math.round(haversineKm(farm.gpsLat, farm.gpsLng, a, b) * 1.3)));
    }
  }
  function onDestAddress(v: string) {
    setDestAddress(v);
    if (destination || shipType !== "domestic") return;
    const prov = provinceFromAddress(v);
    const hit = prov ? DESTINATIONS.find((d) => d.province === prov || d.name.includes(prov)) : undefined;
    if (hit) onDestProvince(hit.name);
  }
  function useDestLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => onDestGps(`${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`));
  }
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
    const fromBatch = packLinesFromBatch(b.packagingItems, b.innerMaterials);
    setPacks(fromBatch.length ? fromBatch : defaultPacks());
    if (b.originAirport) setOriginAirport(b.originAirport);
    if (b.destAirport) setDestAirport(b.destAirport);
    setFlightKm("");
  }

  // "เลือกข้อมูลการขนส่ง": reuse the transport spec already stored on the picked batch.
  function applyShipMode(mode: "new" | "same") {
    setShipDataMode(mode);
    if (mode !== "same" || !selectedBatch) return;
    const b = selectedBatch;
    if (b.vehicleKey) {
      const veh = VEHICLE_FUELS.find((v) => v.vehicleKey === b.vehicleKey);
      if (veh) setVehicle(veh.vehicle);
    }
    if (b.fuelKey) setFuelKey(b.fuelKey);
    if (typeof b.isReeferUsed === "boolean") setIsReefer(b.isReeferUsed);
    if (b.destination) {
      const known = DESTINATIONS.find((d) => d.name === b.destination);
      if (known) setDestination(known.name);
      else { setDestAddress(b.destination); const prov = provinceFromAddress(b.destination); const hit = prov ? DESTINATIONS.find((d) => d.province === prov) : undefined; if (hit) setDestination(hit.name); }
    }
    if (b.destinationAddress) setDestAddress(b.destinationAddress);
    if (b.destLat != null && b.destLng != null) setDestGps(`${b.destLat}, ${b.destLng}`);
    if (b.distanceKm != null) setDistanceKm(String(b.distanceKm));
  }

  function validate(): Errors {
    const e: Errors = {};
    if (!batchId) e.batchId = "กรุณาเลือก Batch";
    if (!weightKg || Number(weightKg) <= 0) e.weightKg = "กรุณาระบุน้ำหนักรวมบรรจุภัณฑ์";
    if (!shipDate) e.shipDate = "กรุณาระบุวันที่จัดส่ง";
    if (shipType === "domestic") {
      if (!destination) e.destination = "กรุณาระบุปลายทาง";
      if (!vehicle) e.vehicle = "กรุณาเลือกประเภทรถ";
      if (!fuelKey) e.fuelKey = "กรุณาเลือกระบบเชื้อเพลิง";
    } else {
      if (!airline) e.airline = "กรุณาระบุสายการบิน";
      if (!destAirport && !(Number(flightKm) > 0)) e.destAirport = "กรุณาเลือกท่าอากาศยานปลายทาง หรือระบุระยะทางบิน";
    }
    const pe = validatePackLines(packs);
    for (const k of Object.keys(pe)) if (touched(packs[Number(k.split(".")[1])])) e[k] = pe[k];
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
      const used = packs.filter(touched);
      const pk = used.length ? packLinesToPayload(used) : null;
      const res = await fetch(`/api/batches/${batchId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shippedWeightKg: weightKg, shipType,
          ...(pk ? { packagingItems: pk.packagingItems, innerMaterials: pk.innerMaterials } : {}), shipDate, destinationAddress: destAddress.trim() || undefined,
          ...(shipType === "domestic"
            ? { vehicleKey, fuelKey, isReeferUsed: isReefer, destination, distanceKm, ...(destGpsParsed ? { destLat: destGpsParsed.lat, destLng: destGpsParsed.lng } : {}) }
            : { airline, flightNo, destination: destCountry || selectedBatch.destination || "ต่างประเทศ", isReeferUsed: false, originAirport, destAirport: destAirport || undefined, flightDistanceKm: Number(flightKm) > 0 ? Number(flightKm) : undefined }),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      setConfirmOpen(false);
      setToast(true);
      setTimeout(() => { router.push(`/logistic/status?saved=${encodeURIComponent(batchId)}`); router.refresh(); }, 1400);
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
    const F = ({ label, value }: { label: string; value: string }) => (
      <div><p className="text-[13px] font-semibold text-slate-800">{label}</p><p className="text-[13px] text-slate-500">{value || "—"}</p></div>
    );
    const H = ({ children }: { children: React.ReactNode }) => (
      <div className="px-4 py-3 text-center text-[15px] font-semibold text-slate-700">{children}</div>
    );
    const boxes = packs.filter(touched);
    return (
      <div className="max-w-4xl space-y-5">
        <Toast />
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-5"><h2 className="text-[18px] font-bold text-slate-900">ตรวจสอบและยืนยันข้อมูล</h2></div>
          <div className="px-6 pb-6 pt-5">
            <div className="grid grid-cols-1 overflow-hidden rounded-xl bg-[#e9ebf8] md:grid-cols-3">
              <H>ข้อมูลดอกไม้</H><H>บรรจุภัณฑ์</H><H>ข้อมูลการขนส่ง</H>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3">
              <div className="space-y-4 border-slate-100 p-5 md:border-r">
                <F label="Batch ID" value={batchId} />
                <F label="ชนิดดอกไม้" value={flowerType} />
                <F label="พันธุ์ดอกไม้" value={variety} />
                <F label="อายุดอกไม้หลังตัด" value={ageDays ? `${ageDays} วัน` : ""} />
                <F label="จำนวนช่อดอกไม้" value={exportBunches ? `${exportBunches} ช่อ` : ""} />
              </div>
              <div className="space-y-4 border-slate-100 p-5 md:border-r">
                {boxes.length === 0 ? <p className="text-[13px] text-slate-500">ใช้ข้อมูลบรรจุภัณฑ์เดิมของฟาร์ม</p> : null}
                {boxes.map((p, i) => (
                  <div key={i} className="space-y-2 border-b border-slate-100 pb-3 last:border-0">
                    <p className="text-[13px] font-semibold text-slate-800">รายการที่ {i + 1}</p>
                    <F label="บรรจุภัณฑ์" value={packKindLabel(p.kind)} />
                    <F label="ประเภทการใช้งาน" value={packUsageText(p)} />
                    {p.kind === "corrugated_box" ? <F label="วัสดุภายใน" value={packInnerText(p)} /> : null}
                    <F label="ขนาด" value={packSizeText(p)} />
                    <F label="จำนวน" value={packQty(p) ? `${packQty(p)} ${(p.kind === "basket" ? "ใบ" : p.kind === "corrugated_box" ? "กล่อง" : "ชิ้น")}` : ""} />
                  </div>
                ))}
              </div>
              <div className="space-y-4 p-5">
                <F label="ประเภทการจัดส่ง" value={shipType === "domestic" ? "ส่งภายในประเทศ" : "ส่งต่างประเทศ"} />
                {shipType === "domestic" ? (
                  <>
                    <F label="ปลายทาง" value={destination} />
                    <F label="วันที่จัดส่ง" value={formatThaiDate(shipDate)} />
                    <F label="น้ำหนักรวมบรรจุภัณฑ์" value={weightKg ? `${weightKg} กิโลกรัม` : ""} />
                    <F label="ประเภทรถที่ใช้" value={vehicle} />
                    <F label="ระบบเชื้อเพลิง" value={fuelsFor(vehicle).find((f) => f.fuelKey === fuelKey)?.fuel ?? fuelKey} />
                    <F label="ใช้ตู้แช่เย็น/ห้องเย็น" value={isReefer ? "ใช่" : "ไม่ใช้"} />
                  </>
                ) : (
                  <>
                    <F label="วันที่จัดส่ง" value={formatThaiDate(shipDate)} />
                    <F label="น้ำหนักรวมบรรจุภัณฑ์" value={weightKg ? `${weightKg} กิโลกรัม` : ""} />
                    <F label="เส้นทางบิน" value={`${originAirport} → ${destAirport || "—"}`} />
                    <F label="ระยะทางบิน" value={`${(Number(flightKm) > 0 ? Number(flightKm) : autoFlightKm).toLocaleString("th-TH")} กม.`} />
                    <F label="สายการบิน" value={airline} />
                    <F label="หมายเลขเที่ยวบิน" value={flightNo} />
                  </>
                )}
              </div>
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
        <PackagingLines
          lines={packs}
          onChange={setPacks}
          errs={errs}
          clearErr={(k) => setErrs((x) => ({ ...x, [k]: "" }))}
          inputCls={inputCls}
          labelCls={labelCls}
          sizePresets={sizePresets}
        />
      </Section>

      <Section title="ข้อมูลการขนส่ง" sub="ระบุรายละเอียดการขนส่งจริง">
        <div>
          <label className={labelCls}>เลือกข้อมูลการขนส่ง</label>
          <select value={shipDataMode} onChange={(e) => applyShipMode(e.target.value as "new" | "same")} className={inputCls}>
            <option value="new">เพิ่มข้อมูลการจัดส่งใหม่</option>
            <option value="same">ข้อมูลการจัดส่งเดียวกันกับ batch ก่อนหน้า</option>
          </select>
        </div>

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

        {shipType === "domestic" ? (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <div><label className={labelCls}>วันที่จัดส่ง{req}</label><DateField value={shipDate} onChange={(v) => { setShipDate(v); setErrs((x) => ({ ...x, shipDate: "" })); }} className={inputCls} invalid={!!errs.shipDate} /><Err msg={errs.shipDate} /></div>
              <div>
                <label className={labelCls}>ปลายทาง{req}</label>
                <select value={destination} onChange={(e) => onDestProvince(e.target.value)} className={`${inputCls} ${errs.destination ? "border-[#ee443f]" : ""}`}>
                  <option value="">เลือกจังหวัดปลายทาง</option>
                  {DESTINATIONS.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
                </select>
                <Err msg={errs.destination} />
              </div>
              <div><label className={labelCls}>ระยะทางขนส่ง (กิโลเมตร)</label><input type="number" value={distanceKm} onChange={(e) => setDistanceKm(e.target.value)} placeholder="ระบบจะประมาณการอัตโนมัติ" className={`${inputCls} bg-slate-50`} /></div>
              <div className="sm:col-span-2">
                <label className={labelCls}>ที่อยู่ปลายทาง (ผู้รับ)</label>
                <input value={destAddress} onChange={(e) => onDestAddress(e.target.value)} placeholder="เช่น 99/1 ถ.สุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>พิกัดปลายทาง</label>
                <div className="flex gap-2">
                  <input value={destGps} onChange={(e) => onDestGps(e.target.value)} placeholder="13.7367, 100.5602" className={`${inputCls} min-w-0 flex-1`} />
                  <button type="button" onClick={useDestLocation} title="ใช้ตำแหน่งปัจจุบัน" className="grid size-[42px] shrink-0 place-items-center rounded-[8px] border border-gray-300 text-slate-500 hover:bg-gray-50"><MapPin size={16} /></button>
                </div>
                <p className="mt-1 text-[11px] text-slate-400">ใส่พิกัดแล้วระบบคำนวณระยะทางจากฟาร์มให้ · คัดลอกจาก Google Maps ได้</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div><label className={labelCls}>น้ำหนักรวมบรรจุภัณฑ์ (กก.){req}</label><input type="number" min="0" step="any" value={weightKg} onChange={(e) => { setWeightKg(e.target.value); setErrs((x) => ({ ...x, weightKg: "" })); }} placeholder="ระบุน้ำหนักรวมบรรจุภัณฑ์" className={`${inputCls} ${errs.weightKg ? "border-[#ee443f]" : ""}`} /><Err msg={errs.weightKg} /></div>
              <div>
                <label className={labelCls}>ประเภทรถที่ใช้{req}</label>
                <SearchSelect value={vehicle} onChange={(v) => { setVehicle(v); setFuelKey(""); setErrs((x) => ({ ...x, vehicle: "" })); }} options={VEHICLE_OPTIONS} placeholder="เลือกประเภทรถที่ใช้ขนส่ง" allowCustom invalid={!!errs.vehicle} />
                <Err msg={errs.vehicle} />
              </div>
              <div>
                <label className={labelCls}>ระบบเชื้อเพลิง{req}</label>
                <SearchSelect value={fuelKey} onChange={(v) => { setFuelKey(v); setErrs((x) => ({ ...x, fuelKey: "" })); }} options={fuelOptions(vehicle)} placeholder="เลือกระบบเชื้อเพลิงที่ใช้ขนส่ง" allowCustom disabled={!vehicle} invalid={!!errs.fuelKey} />
                <Err msg={errs.fuelKey} />
              </div>
            </div>

            <label className="flex cursor-pointer items-center justify-between rounded-[8px] border border-gray-200 px-4 py-3">
              <span className="text-[13px] text-slate-700">ใช้ตู้แช่เย็น/ห้องเย็น <span className="text-slate-400">(เพิ่มคาร์บอนขนส่ง 15%)</span></span>
              <input type="checkbox" checked={isReefer} onChange={(e) => setIsReefer(e.target.checked)} className="peer sr-only" />
              <span className="relative h-6 w-11 rounded-full bg-slate-200 transition peer-checked:bg-blue-600 after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5" />
            </label>
          </>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            <div><label className={labelCls}>วันที่จัดส่ง{req}</label><DateField value={shipDate} onChange={(v) => { setShipDate(v); setErrs((x) => ({ ...x, shipDate: "" })); }} className={inputCls} invalid={!!errs.shipDate} /><Err msg={errs.shipDate} /></div>
            <div><label className={labelCls}>ประเทศ / เมืองปลายทาง</label><input value={destCountry} onChange={(e) => setDestCountry(e.target.value)} placeholder="เช่น ญี่ปุ่น (โตเกียว)" className={inputCls} /></div>
            <div><label className={labelCls}>น้ำหนักรวมบรรจุภัณฑ์ (กก.){req}</label><input type="number" min="0" step="any" value={weightKg} onChange={(e) => { setWeightKg(e.target.value); setErrs((x) => ({ ...x, weightKg: "" })); }} placeholder="ระบุน้ำหนักรวมบรรจุภัณฑ์" className={`${inputCls} ${errs.weightKg ? "border-[#ee443f]" : ""}`} /><Err msg={errs.weightKg} /></div>
            <div className="sm:col-span-2">
                <label className={labelCls}>ที่อยู่ปลายทาง (ผู้รับ)</label>
                <input value={destAddress} onChange={(e) => onDestAddress(e.target.value)} placeholder="ที่อยู่ผู้รับปลายทางในต่างประเทศ" className={inputCls} />
              </div>
            <div />
            <div>
              <label className={labelCls}>สายการบิน{req}</label>
              <SearchSelect value={airline} onChange={(v) => { setAirline(v); setErrs((x) => ({ ...x, airline: "" })); }} options={AIRLINE_OPTIONS} placeholder="เลือกสายการบิน" allowCustom invalid={!!errs.airline} />
              <Err msg={errs.airline} />
            </div>
            <div><label className={labelCls}>หมายเลขเที่ยวบิน</label><input value={flightNo} onChange={(e) => setFlightNo(e.target.value)} placeholder="ระบุหมายเลขเที่ยวบิน เช่น TG102" className={inputCls} /></div>
            <div>
              <label className={labelCls}>ท่าอากาศยานต้นทาง</label>
              <select value={originAirport} onChange={(e) => setOriginAirport(e.target.value)} className={inputCls}>
                {ORIGIN_AIRPORTS.map((a) => <option key={a.code} value={a.code}>{a.name} ({a.code})</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>ท่าอากาศยานปลายทาง{req}</label>
              <SearchSelect value={destAirport} onChange={onDestAirport} options={DEST_AIRPORT_OPTIONS} placeholder="เลือกท่าอากาศยานปลายทาง" invalid={!!errs.destAirport} />
              <Err msg={errs.destAirport} />
            </div>
            <div>
              <label className={labelCls}>ระยะทางบิน (กม.)</label>
              <input type="number" min="0" step="any" value={flightKm} onChange={(e) => { setFlightKm(e.target.value); setErrs((x) => ({ ...x, destAirport: "" })); }} placeholder={autoFlightKm ? `อัตโนมัติ ${autoFlightKm.toLocaleString("th-TH")} กม.` : "คำนวณจากท่าอากาศยาน"} className={`${inputCls} bg-slate-50`} />
            </div>
            <p className="flex items-start gap-1.5 text-[11px] text-slate-400 sm:col-span-3"><Plane size={13} className="mt-px shrink-0" /> คาร์บอนขนส่งทางอากาศคิดจาก น้ำหนักรวม × ระยะทางบิน × ค่า EF ของ DEFRA (รวมผลกระทบจากการบินที่ระดับสูง) + ถนนจากฟาร์มถึงสนามบินต้นทาง</p>
          </div>
        )}
      </Section>

      {selectedBatch ? null : <p className="rounded-[8px] bg-blue-50 px-3 py-2 text-[13px] text-blue-700"><Package size={14} className="mr-1 inline" /> เลือก Batch ด้านบนเพื่อดึงข้อมูลดอกไม้และบรรจุภัณฑ์อัตโนมัติ</p>}
      {Object.values(errs).some(Boolean) ? <p className="rounded-[8px] bg-red-50 px-3 py-2 text-[13px] text-red-600">กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน</p> : null}

      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => router.push("/logistic")} className="h-[40px] rounded-[8px] border border-gray-300 px-8 text-[14px] font-medium text-slate-700 hover:bg-gray-100">ยกเลิก</button>
        <button type="button" onClick={goReview} className="h-[40px] rounded-[8px] bg-blue-600 px-10 text-[14px] font-medium text-white hover:bg-blue-700">ถัดไป</button>
      </div>
    </div>
  );
}
