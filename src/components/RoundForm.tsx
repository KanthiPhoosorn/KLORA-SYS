"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, CheckCircle2 } from "lucide-react";
import Modal from "@/components/Modal";
import DateField, { formatThaiDate } from "@/components/DateField";
import { DESTINATIONS, estimateDistanceKm, haversineKm, provinceFromAddress } from "@/lib/geo";
import { PRODUCT_CATEGORIES, typesFor, variantsFor, categoryOfType } from "@/lib/master-data";
import { coldChainWarning, harvestLabel, RIPENESS_LABEL, GRADE_OPTIONS, UNIT_LABEL } from "@/lib/produce";
import type { ProductCategory, QuantityUnit, Ripeness } from "@/lib/types";
import { AlertTriangle, MapPin } from "lucide-react";
import { BRANCHES } from "@/lib/branches";
import type { Supplier } from "@/lib/types";

const inputCls =
  "w-full rounded-[8px] border border-gray-300 bg-white px-[14px] py-[10px] text-[13px] text-black outline-none placeholder:text-[#bdbdbd] focus:border-brand-pink";
const labelCls = "mb-1.5 block text-[13px] font-medium text-slate-700";
const req = <span className="text-[#ee443f]"> *</span>;

// รูปแบบการขนส่ง (design: 5 options). `key` is stable; `label` is what we store on the batch.
import { CARRIERS } from "@/lib/carriers";
import PackagingLines, { emptyPackLine, validatePackLines, packLinesToPayload, packKindLabel, packSizeText, packInnerText, packUsageText, packQty, type PackLine } from "@/components/PackagingLines";
import { DEFAULT_FACTORS, type PackageSize } from "@/lib/factors";
import type { CarrierKey } from "@/lib/types";

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

const AGE_OPTIONS = Array.from({ length: 30 }, (_, i) => i + 1);

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
  postSupplierId,
  accent = "pink",
  sizePresets = DEFAULT_FACTORS.packageSizes,
}: {
  supplier: Supplier;
  varietyOptions?: string[];
  /** KYN-managed standard package sizes (quick-fill for the W×L×H fields) */
  sizePresets?: PackageSize[];
  /** set when a non-supplier (logistic/Exporter) logs on behalf of a farm */
  postSupplierId?: string;
  /** brand accent — "pink" for the SUP portal, "blue" for the Logistic portal */
  accent?: "pink" | "blue";
}) {
  const router = useRouter();
  // Full static class strings per accent (Tailwind JIT needs literals, not interpolation).
  const T =
    accent === "blue"
      ? {
          solidBtn: "bg-blue-600 text-white hover:bg-blue-700",
          outlineBtn: "border border-blue-600 text-blue-600 hover:bg-blue-50",
          link: "text-blue-600",
          radioSel: "border-blue-600 bg-blue-50 font-medium text-blue-600",
          ring: "accent-blue-600",
          input: "focus:border-blue-600",
        }
      : {
          solidBtn: "bg-brand-pink text-white hover:opacity-90",
          outlineBtn: "border border-brand-pink text-brand-pink hover:bg-brand-pink-light",
          link: "text-brand-pink",
          radioSel: "border-brand-pink bg-brand-pink-light font-medium text-brand-pink",
          ring: "accent-brand-pink",
          input: "focus:border-brand-pink",
        };
  const inputCls =
    "w-full rounded-[8px] border border-gray-300 bg-white px-[14px] py-[10px] text-[13px] text-black outline-none placeholder:text-[#bdbdbd] " +
    T.input;
  const [step, setStep] = useState<"form" | "review">("form");
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toast, setToast] = useState(false);
  const [distEdited, setDistEdited] = useState(false);
  const [errs, setErrs] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);

  // Flowers
  // ประเภทสินค้า → ชนิด → พันธุ์. The farm's own produce list drives the defaults; every master
  // type stays available. Flowers are counted (ดอก/ช่อ), produce is weighed (กก./ตัน).
  const farmGroups = (supplier.flowerTypes ?? []).map((g) => ({ ...g, category: g.category ?? categoryOfType(g.type) ?? ("flower" as ProductCategory) }));
  const firstCat: ProductCategory = farmGroups[0]?.category ?? categoryOfType(supplier.flowerType) ?? "flower";
  const [category, setCategory] = useState<ProductCategory>(firstCat);
  const isFlower = category === "flower";
  const [flowerType, setFlowerType] = useState(farmGroups.find((g) => g.category === firstCat)?.type ?? supplier.flowerType ?? "");
  const [variety, setVariety] = useState("");
  const [flowerCount, setFlowerCount] = useState(""); // quantity in `unit`
  const [unit, setUnit] = useState<QuantityUnit>(firstCat === "flower" ? "stem" : "kg");
  const [cutDate, setCutDate] = useState("");
  const [ageDays, setAgeDays] = useState("");
  const [plantingDate, setPlantingDate] = useState("");
  const [ripeness, setRipeness] = useState<Ripeness | "">("");
  const [grade, setGrade] = useState("");
  const [ethylene, setEthylene] = useState(false);
  const [ethyleneNote, setEthyleneNote] = useState("");
  const farmTypes = farmGroups.filter((g) => g.category === category).map((g) => g.type);
  const typeOptions = Array.from(new Set([...farmTypes, ...typesFor(category)]));
  function pickCategory(c: ProductCategory) {
    setCategory(c);
    setUnit(c === "flower" ? "stem" : "kg");
    setFlowerType(farmGroups.find((g) => g.category === c)?.type ?? "");
    setVariety("");
    setRipeness("");
    setErrs((x) => ({ ...x, flowerType: "", variety: "", flowerCount: "", ageDays: "" }));
  }
  // Packaging
  const [packs, setPacks] = useState<PackLine[]>([emptyPackLine()]);
  // Shipping
  const [shipDate, setShipDate] = useState("");
  const [destination, setDestination] = useState("");
  const [destAddress, setDestAddress] = useState("");
  const [destGps, setDestGps] = useState(""); // "lat, lng"
  const [distanceKm, setDistanceKm] = useState("");
  // A farm that signed up through a carrier's link ships only with that carrier (KYN spec §1.2).
  const lockedCarrier = supplier.signupVia;
  const [carrier, setCarrier] = useState<CarrierKey>(lockedCarrier ?? "thaipost");
  const [postalCode, setPostalCode] = useState("");
  const [provider, setProvider] = useState("");
  const [branch, setBranch] = useState("");

  const isThaipost = carrier === "thaipost";
  // Freemium: a free SUP account can only ship via ไปรษณีย์ไทย; other carriers unlock with Pro.
  const showUpsell = accent === "pink" && supplier.plan !== "pro";
  const varieties = Array.from(
    new Set([
      ...farmGroups.filter((g) => g.type === flowerType).flatMap((g) => g.varieties),
      ...variantsFor(category, flowerType),
      ...(isFlower ? [...varietyOptions, ...(supplier.varieties ?? [])] : []),
    ]),
  );
  const chillWarning = coldChainWarning({ isReeferUsed: CARRIER_DEFAULTS[carrier].reefer, productType: flowerType, productCategory: category });

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
    if (!distEdited && !parseGps(destGps)) {
      const est = estimateDistanceKm(v, { lat: supplier.gpsLat, lng: supplier.gpsLng });
      if (est != null) setDistanceKm(String(est));
    }
  }
  // Destination GPS ("lat, lng") beats the province estimate: farm → recipient great-circle × 1.3 road factor.
  function parseGps(v: string): { lat: number; lng: number } | null {
    const [a, b] = v.split(",").map((x) => Number(x.trim()));
    return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180 ? { lat: a, lng: b } : null;
  }
  function onDestGps(v: string) {
    setDestGps(v);
    setErrs((e) => ({ ...e, destGps: "" }));
    const g = parseGps(v);
    if (g && !distEdited && supplier.gpsLat && supplier.gpsLng) {
      setDistanceKm(String(Math.round(haversineKm(supplier.gpsLat, supplier.gpsLng, g.lat, g.lng) * 1.3)));
    }
  }
  // Typing an address that names a province picks the destination automatically.
  function onDestAddress(v: string) {
    setDestAddress(v);
    if (destination) return;
    const prov = provinceFromAddress(v);
    const hit = prov ? DESTINATIONS.find((d) => d.province === prov || d.name.includes(prov)) : undefined;
    if (hit) onDest(hit.name);
  }
  function useDestLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((p) => onDestGps(`${p.coords.latitude.toFixed(5)}, ${p.coords.longitude.toFixed(5)}`));
  }

  const carrierLabel = CARRIERS.find((c) => c.key === carrier)!.label;
  const branchName = (id: string) => BRANCHES.find((b) => b.id === id)?.name ?? id;

  // ---- validation (drives the inline-error state) ----
  function validate(): Errors {
    const e: Errors = {};
    if (!flowerType) e.flowerType = "กรุณาเลือกชนิดสินค้า";
    if (!variety) e.variety = "กรุณาเลือกพันธุ์";
    if (!flowerCount || Number(flowerCount) <= 0) e.flowerCount = isFlower ? "กรุณาระบุจำนวนดอกไม้" : "กรุณาระบุน้ำหนักสินค้า";
    if (!cutDate) e.cutDate = isFlower ? "กรุณาเลือกวันที่ตัดดอกไม้" : "กรุณาเลือกวันที่เก็บเกี่ยว";
    if (destGps.trim() && !parseGps(destGps)) e.destGps = "รูปแบบพิกัดไม่ถูกต้อง (ละติจูด, ลองจิจูด)";
    if (isFlower && !ageDays) e.ageDays = "กรุณาระบุอายุดอกไม้";
    if (category === "fruit" && !ripeness) e.ripeness = "กรุณาระบุระยะการสุก";
    Object.assign(e, validatePackLines(packs));
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
      const pk = packLinesToPayload(packs);
      const res = await fetch("/api/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(postSupplierId ? { supplierId: postSupplierId } : {}),
          flowerCount: isFlower ? Number(flowerCount) || 0 : 0,
          quantity: Number(flowerCount) || 0,
          unit,
          productCategory: category,
          productType: flowerType,
          variety: variety || flowerType,
          cutDate,
          plantingDate: !isFlower && plantingDate ? plantingDate : undefined,
          ripenessAtHarvest: category === "fruit" && ripeness ? ripeness : undefined,
          grade: !isFlower && grade ? grade : undefined,
          ethyleneUsed: category === "fruit" ? ethylene : undefined,
          ethyleneNote: category === "fruit" && ethylene ? ethyleneNote : undefined,
          destination,
          destinationAddress: destAddress.trim() || undefined,
          destLat: parseGps(destGps)?.lat,
          destLng: parseGps(destGps)?.lng,
          distanceKm: Number(distanceKm) || 0,
          carrier: carrierLabel,
          provider: isThaipost ? undefined : provider,
          postalCode: isThaipost ? postalCode.trim() : undefined,
          branch: branchName(branch),
          boxMaterial: pk.boxMaterial,
          basketIds: pk.basketIds,
          packagingItems: pk.packagingItems,
          innerMaterials: pk.innerMaterials,
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
              <div className="rounded-lg bg-emerald-500 px-3 py-2 text-center text-[13px] font-semibold text-white">ข้อมูลสินค้า</div>
              <F label="ประเภทสินค้า" value={PRODUCT_CATEGORIES.find((c) => c.key === category)?.label ?? ""} />
              <F label="ชนิด" value={flowerType} />
              <F label="พันธุ์" value={variety} />
              <F label={isFlower ? "จำนวนดอกไม้" : "น้ำหนักสินค้า"} value={flowerCount ? `${Number(flowerCount).toLocaleString()} ${UNIT_LABEL[unit]}` : ""} />
              {!isFlower && plantingDate ? <F label="วันที่ปลูก" value={formatThaiDate(plantingDate)} /> : null}
              <F label={harvestLabel(category)} value={formatThaiDate(cutDate)} />
              {isFlower ? <F label="อายุดอกไม้" value={ageDays ? `${ageDays} วัน` : ""} /> : null}
              {category === "fruit" && ripeness ? <F label="ระยะการสุก" value={RIPENESS_LABEL[ripeness]} /> : null}
              {!isFlower && grade ? <F label="เกรด" value={grade} /> : null}
              {category === "fruit" && ethylene ? <F label="เอทิลีน/สารยับยั้งการสุก" value={ethyleneNote || "ใช้"} /> : null}
            </div>
            {/* Col 2 — packaging */}
            <div className="space-y-4 border-slate-100 p-6 md:border-r">
              <div className="rounded-lg bg-emerald-500 px-3 py-2 text-center text-[13px] font-semibold text-white">บรรจุภัณฑ์</div>
              {packRows.map((p, i) => (
                <div key={i} className="space-y-3 border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                  <p className="text-[12px] font-semibold text-slate-400">รายการที่ {i + 1}</p>
                  <F label="บรรจุภัณฑ์" value={packKindLabel(p.kind)} />
                  <F label="ประเภทการใช้งาน" value={packUsageText(p)} />
                  {p.kind === "corrugated_box" ? <F label="วัสดุภายใน" value={packInnerText(p)} /> : null}
                  <F label="ขนาด" value={packSizeText(p)} />
                  <F label="จำนวน" value={packQty(p) ? `${packQty(p)} ${(p.kind === "basket" ? "ใบ" : p.kind === "corrugated_box" ? "กล่อง" : "ชิ้น")}` : ""} />
                </div>
              ))}
            </div>
            {/* Col 3 — transport */}
            <div className="space-y-4 p-6">
              <div className="rounded-lg bg-emerald-500 px-3 py-2 text-center text-[13px] font-semibold text-white">ข้อมูลการขนส่ง</div>
              <F label="วันที่จัดส่ง" value={formatThaiDate(shipDate)} />
              <F label="ปลายทาง" value={destination} />
              {destAddress ? <F label="ที่อยู่ปลายทาง" value={destAddress} /> : null}
              {destGps ? <F label="พิกัดปลายทาง" value={destGps} /> : null}
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
          <button type="button" onClick={() => setStep("form")} className={`h-[40px] rounded-[8px] ${T.outlineBtn} px-8 text-[14px] font-medium`}>แก้ไข</button>
          <button type="button" onClick={() => setConfirmOpen(true)} className={`h-[40px] rounded-[8px] ${T.solidBtn} px-10 text-[14px] font-medium`}>บันทึก</button>
        </div>

        <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="ยืนยันการจัดส่ง?">
          <p className="text-[13px] text-slate-500">หากข้อมูลไม่ถูกต้อง สามารถยกเลิกได้ที่เมนู “สถานะพัสดุ”</p>
          <div className="mt-5 flex justify-end gap-3">
            <button onClick={() => setConfirmOpen(false)} disabled={busy} className="h-[38px] rounded-[8px] border border-gray-300 px-6 text-[14px] font-medium text-slate-700 hover:bg-gray-100">ยกเลิก</button>
            <button onClick={save} disabled={busy} className={`inline-flex h-[38px] items-center justify-center gap-2 rounded-[8px] ${T.solidBtn} px-8 text-[14px] font-medium disabled:opacity-60`}>
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

      {/* Product (ดอกไม้ / ผลไม้ / ผัก) */}
      <Section title="ข้อมูลสินค้า" sub="ระบุประเภทสินค้าและรายละเอียดของรอบการจัดส่งนี้">
        <div className="space-y-4">
          <div>
            <label className={labelCls}>ประเภทสินค้า{req}</label>
            <div className="grid grid-cols-3 gap-2.5">
              {PRODUCT_CATEGORIES.map((c) => (
                <label key={c.key} className={`flex cursor-pointer items-center justify-center gap-2 rounded-[10px] border px-4 py-3 text-[13px] transition ${category === c.key ? T.radioSel : "border-gray-300 text-slate-600 hover:border-gray-400"}`}>
                  <input type="radio" name="category" checked={category === c.key} onChange={() => pickCategory(c.key)} className={`size-4 ${T.ring}`} />
                  {c.label}
                </label>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>ชนิด{req}</label>
              <input list="ptypes" value={flowerType} onChange={(e) => { setFlowerType(e.target.value); setVariety(""); setErrs((x) => ({ ...x, flowerType: "" })); }} placeholder={isFlower ? "เช่น กุหลาบ" : category === "fruit" ? "เช่น มะม่วง" : "เช่น คะน้า"} className={`${inputCls} ${errs.flowerType ? "border-[#ee443f]" : ""}`} />
              <datalist id="ptypes">{typeOptions.map((t) => <option key={t} value={t} />)}</datalist>
              <Err msg={errs.flowerType} />
            </div>
            <div>
              <label className={labelCls}>พันธุ์{req}</label>
              <input list="fvars" value={variety} onChange={(e) => { setVariety(e.target.value); setErrs((x) => ({ ...x, variety: "" })); }} placeholder="เลือกหรือพิมพ์พันธุ์" className={`${inputCls} ${errs.variety ? "border-[#ee443f]" : ""}`} />
              <datalist id="fvars">{varieties.map((v) => <option key={v} value={v} />)}</datalist>
              <Err msg={errs.variety} />
            </div>
            <div>
              <label className={labelCls}>{isFlower ? "จำนวนดอกไม้" : "น้ำหนักสินค้า"}{req}</label>
              <div className="flex gap-2">
                <input type="number" min="0" step={isFlower ? 1 : 0.1} value={flowerCount} onChange={(e) => { setFlowerCount(e.target.value); setErrs((x) => ({ ...x, flowerCount: "" })); }} placeholder={isFlower ? "ระบุจำนวน" : "ระบุน้ำหนัก"} className={`${inputCls} min-w-0 flex-1 ${errs.flowerCount ? "border-[#ee443f]" : ""}`} />
                <select value={unit} onChange={(e) => setUnit(e.target.value as QuantityUnit)} className={`${inputCls.replace("w-full", "")} w-28 shrink-0`}>
                  {(isFlower ? (["stem", "bunch"] as QuantityUnit[]) : (["kg", "ton"] as QuantityUnit[])).map((u) => <option key={u} value={u}>{UNIT_LABEL[u]}</option>)}
                </select>
              </div>
              <Err msg={errs.flowerCount} />
            </div>
            {!isFlower ? (
              <div>
                <label className={labelCls}>วันที่ปลูก</label>
                <DateField value={plantingDate} onChange={setPlantingDate} className={inputCls} />
              </div>
            ) : null}
            <div>
              <label className={labelCls}>{harvestLabel(category)}{req}</label>
              <DateField value={cutDate} onChange={onCut} className={inputCls} invalid={!!errs.cutDate} />
              <Err msg={errs.cutDate} />
            </div>
            {isFlower ? (
              <div>
                <label className={labelCls}>อายุดอกไม้ (วัน){req}</label>
                <select value={ageDays} onChange={(e) => { setAgeDays(e.target.value); setErrs((x) => ({ ...x, ageDays: "" })); }} className={`${inputCls} ${errs.ageDays ? "border-[#ee443f]" : ""}`}>
                  <option value="">ระบุอายุดอกไม้</option>
                  {AGE_OPTIONS.map((d) => <option key={d} value={d}>{d} วัน</option>)}
                </select>
                <Err msg={errs.ageDays} />
              </div>
            ) : null}
            {category === "fruit" ? (
              <div>
                <label className={labelCls}>ระยะการสุก ณ วันเก็บเกี่ยว{req}</label>
                <select value={ripeness} onChange={(e) => { setRipeness(e.target.value as Ripeness); setErrs((x) => ({ ...x, ripeness: "" })); }} className={`${inputCls} ${errs.ripeness ? "border-[#ee443f]" : ""}`}>
                  <option value="">เลือกระยะการสุก</option>
                  {(Object.keys(RIPENESS_LABEL) as Ripeness[]).map((r) => <option key={r} value={r}>{RIPENESS_LABEL[r]}</option>)}
                </select>
                <Err msg={errs.ripeness} />
              </div>
            ) : null}
            {!isFlower ? (
              <div>
                <label className={labelCls}>เกรดคุณภาพ</label>
                <select value={grade} onChange={(e) => setGrade(e.target.value)} className={inputCls}>
                  <option value="">ไม่ระบุ</option>
                  {GRADE_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            ) : null}
            {category === "fruit" ? (
              <div className="sm:col-span-2">
                <label className="flex items-center gap-2 text-[13px] text-slate-700">
                  <input type="checkbox" checked={ethylene} onChange={(e) => setEthylene(e.target.checked)} className={`size-4 ${T.ring}`} />
                  ใช้ก๊าซเอทิลีนเร่งสุก / สารยับยั้งการสุก
                </label>
                {ethylene ? <input value={ethyleneNote} onChange={(e) => setEthyleneNote(e.target.value)} placeholder="ชนิดและปริมาณ เช่น เอทิลีน 100 ppm 24 ชม." className={`${inputCls} mt-2`} /> : null}
              </div>
            ) : null}
          </div>
        </div>
      </Section>

      {/* Packaging */}
      <Section title="บรรจุภัณฑ์ที่ใช้ในการจัดส่ง" sub="เลือกวัสดุที่ใช้จริง พร้อมระบุขนาดและจำนวน">
        <PackagingLines
          lines={packs}
          onChange={setPacks}
          errs={errs}
          clearErr={(k) => setErrs((x) => ({ ...x, [k]: "" }))}
          inputCls={inputCls}
          labelCls={labelCls}
          sizePresets={sizePresets}
          ringCls={T.ring}
          outlineBtnCls={T.outlineBtn}
        />
      </Section>

      {/* Shipping */}
      <Section title="ข้อมูลการขนส่ง" sub="ระบุรายละเอียดการขนส่ง">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={labelCls}>วันที่จัดส่ง{req}</label>
            <DateField value={shipDate} onChange={(v) => { setShipDate(v); setErrs((x) => ({ ...x, shipDate: "" })); }} className={inputCls} invalid={!!errs.shipDate} />
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
          <div className="sm:col-span-2">
            <label className={labelCls}>ที่อยู่ปลายทาง (ผู้รับ)</label>
            <input value={destAddress} onChange={(e) => onDestAddress(e.target.value)} placeholder="เช่น 99/1 ถ.สุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>พิกัดปลายทาง</label>
            <div className="flex gap-2">
              <input value={destGps} onChange={(e) => onDestGps(e.target.value)} placeholder="13.7367, 100.5602" className={`${inputCls} min-w-0 flex-1 ${errs.destGps ? "border-[#ee443f]" : ""}`} />
              <button type="button" onClick={useDestLocation} title="ใช้ตำแหน่งปัจจุบัน" className="grid size-[42px] shrink-0 place-items-center rounded-[8px] border border-gray-300 text-slate-500 hover:bg-gray-50"><MapPin size={16} /></button>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">ใส่พิกัดแล้วระบบคำนวณระยะทางจากฟาร์มให้ · คัดลอกจาก Google Maps ได้</p>
            <Err msg={errs.destGps} />
          </div>
        </div>

        <div>
          <label className={labelCls}>รูปแบบการขนส่ง</label>
          <div className="grid gap-2.5 sm:grid-cols-3">
            {CARRIERS.filter((c) => !lockedCarrier || c.key === lockedCarrier).map((c) => {
              const locked = showUpsell && c.key !== "thaipost" && c.key !== lockedCarrier;
              return (
                <label key={c.key} className={`flex items-center gap-2.5 rounded-[10px] border px-4 py-3 text-[13px] transition ${locked ? "cursor-not-allowed border-gray-200 text-slate-300" : carrier === c.key ? `cursor-pointer ${T.radioSel}` : "cursor-pointer border-gray-300 text-slate-600 hover:border-gray-400"}`}>
                  <input type="radio" name="carrier" checked={carrier === c.key} disabled={locked} onChange={() => setCarrier(c.key)} className={`size-4 ${T.ring} disabled:opacity-40`} />
                  {c.label}
                </label>
              );
            })}
          </div>
        </div>

        {chillWarning ? (
          <div className="flex items-start gap-3 rounded-[10px] border border-amber-200 bg-amber-50 px-4 py-3.5 text-[12.5px] leading-relaxed text-amber-800">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <div><p className="font-medium">ตรวจสอบอุณหภูมิขนส่ง</p><p>{chillWarning}</p></div>
          </div>
        ) : null}

        {/* Pro upsell banner — only for free accounts */}
        {showUpsell ? (
          <div className="flex items-start gap-3 rounded-[10px] border border-indigo-100 bg-indigo-50/70 px-4 py-3.5">
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-500"><Lock size={14} /></span>
            <div className="text-[12.5px] leading-relaxed">
              <p className="font-medium text-slate-700">ต้องการจัดส่งกับผู้ให้บริการอื่น?</p>
              <p className="text-slate-400">อัปเกรดระบบเพื่อเข้าถึงผู้ให้บริการจัดส่งที่หลากหลาย <span className={`cursor-pointer font-medium ${T.link} hover:underline`}>อัปเกรดแพ็กเกจ</span></p>
            </div>
          </div>
        ) : null}

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

      {Object.values(errs).some(Boolean) ? (
        <p className="rounded-[8px] bg-brand-pink-light px-3 py-2 text-[13px] text-[#c1006e]">กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน</p>
      ) : null}

      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => router.push("/app")} className="h-[40px] rounded-[8px] border border-gray-300 px-8 text-[14px] font-medium text-slate-700 hover:bg-gray-100">ยกเลิก</button>
        <button type="button" onClick={goReview} className={`h-[40px] rounded-[8px] ${T.solidBtn} px-10 text-[14px] font-medium`}>บันทึก</button>
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
