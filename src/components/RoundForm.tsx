"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, CheckCircle2 } from "lucide-react";
import Modal from "@/components/Modal";
import DateField, { formatThaiDate } from "@/components/DateField";
import { DESTINATIONS, provinceFromAddress } from "@/lib/geo";
import { useRecipientDistance } from "@/lib/use-distance";
import { PRODUCT_CATEGORIES, typesFor, variantsFor, categoryOfType } from "@/lib/master-data";
import { coldChainWarning, harvestLabel, RIPENESS_LABEL, GRADE_OPTIONS, UNIT_LABEL } from "@/lib/produce";
import type { ProductCategory, QuantityUnit, Ripeness } from "@/lib/types";
import { AlertTriangle, MapPin } from "lucide-react";
import { BRANCHES, findBranch } from "@/lib/branches";
import type { Supplier, Batch } from "@/lib/types";

const inputCls =
  "w-full rounded-[8px] border border-gray-300 bg-white px-[14px] py-[10px] text-[13px] text-black outline-none placeholder:text-[#bdbdbd] focus:border-brand-pink";
const labelCls = "mb-1.5 block text-[13px] font-medium text-slate-700";
const req = <span className="text-[#ee443f]"> *</span>;

// รูปแบบการขนส่ง (design: 5 options). `key` is stable; `label` is what we store on the batch.
import { CARRIERS, PROVIDERS } from "@/lib/carriers";
import SelectOther from "@/components/SelectOther";
import PackagingLines, { firstRow, validateRows, rowsToPayload, rowsFromBatch, rowsWeightKg, rowSummary, type PackRowState } from "@/components/PackagingLines";
import { DEFAULT_CATALOG, NO_PACK, OTHER, packsFor, type PackCatalog } from "@/lib/packaging-catalog";
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
  catalog = DEFAULT_CATALOG,
  edit,
}: {
  supplier: Supplier;
  /** แก้ไขรอบส่งออก: the lot to edit (form prefilled, saved with PUT under the same LOT code) */
  edit?: Batch;
  varietyOptions?: string[];
  /** KYN central packaging table (standard sizes/weights, materials) */
  catalog?: PackCatalog;
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
  const [distEdited, setDistEdited] = useState(!!edit); // an edit keeps its saved distance until asked to recompute
  const [errs, setErrs] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);

  // Flowers
  // ประเภทสินค้า → ชนิด → พันธุ์. The farm's own produce list drives the defaults; every master
  // type stays available. Flowers are counted (ดอก/ช่อ), produce is weighed (กก./ตัน).
  const farmGroups = (supplier.flowerTypes ?? []).map((g) => ({ ...g, category: g.category ?? categoryOfType(g.type) ?? ("flower" as ProductCategory) }));
  const firstCat: ProductCategory = farmGroups[0]?.category ?? categoryOfType(supplier.flowerType) ?? "flower";
  const [category, setCategory] = useState<ProductCategory>(edit?.productCategory ?? firstCat);
  const isFlower = category === "flower";
  const [flowerType, setFlowerType] = useState(edit?.productType ?? farmGroups.find((g) => g.category === firstCat)?.type ?? supplier.flowerType ?? "");
  const [variety, setVariety] = useState(edit?.variety ?? "");
  const [flowerCount, setFlowerCount] = useState(edit ? String(edit.quantity ?? edit.flowerCount ?? "") : ""); // quantity in `unit`
  const [unit, setUnit] = useState<QuantityUnit>(edit?.unit ?? (firstCat === "flower" ? "stem" : "kg"));
  const [cutDate, setCutDate] = useState(edit?.cutDate ?? "");
  const [ageDays, setAgeDays] = useState(edit?.expectedAgeDays ? String(edit.expectedAgeDays) : "");
  const [plantingDate, setPlantingDate] = useState(edit?.plantingDate ?? "");
  const [ripeness, setRipeness] = useState<Ripeness | "">(edit?.ripenessAtHarvest ?? "");
  const [grade, setGrade] = useState(edit?.grade ?? "");
  const [ethylene, setEthylene] = useState(!!edit?.ethyleneUsed);
  const [ethyleneNote, setEthyleneNote] = useState(edit?.ethyleneNote ?? "");
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
  const [packs, setPacks] = useState<PackRowState[]>(() => (edit?.packagingItems?.length ? rowsFromBatch(edit.packagingItems, catalog) : [firstRow(catalog, edit?.productCategory ?? firstCat)]));
  // น้ำหนักรวมหลังแพ็ก (§4.8) — weighed before shipping; drives transport CO₂e and checks the packaging
  const [packedWeight, setPackedWeight] = useState(edit?.shippedWeightKg ? String(edit.shippedWeightKg) : "");
  const [packedUnit, setPackedUnit] = useState<"กก." | "กรัม">("กก.");
  const packedKg = (Number(packedWeight) || 0) / (packedUnit === "กรัม" ? 1000 : 1);
  const packagingKg = rowsWeightKg(packs, catalog);
  // lists follow the product category (§4.7): a category switch drops rows that no longer fit
  useEffect(() => {
    const allowed = new Set([...packsFor(catalog, category).map((k) => k.id), OTHER, ...(category === "flower" ? [] : [NO_PACK])]);
    if (packs.some((r) => !allowed.has(r.kind))) setPacks([firstRow(catalog, category)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);
  // Shipping
  const [shipDate, setShipDate] = useState("");
  const [destination, setDestination] = useState(edit?.destination ?? "");
  const [destAddress, setDestAddress] = useState(edit?.destinationAddress ?? "");
  const [destGps, setDestGps] = useState(edit?.destLat != null && edit?.destLng != null ? `${edit.destLat}, ${edit.destLng}` : ""); // "lat, lng"
  const [distanceKm, setDistanceKm] = useState(edit?.distanceKm ? String(edit.distanceKm) : "");
  // A farm that signed up through a carrier's link ships only with that carrier (KYN spec §1.2).
  const lockedCarrier = supplier.signupVia;
  const [carrier, setCarrier] = useState<CarrierKey>(CARRIERS.find((c) => c.label === edit?.carrier)?.key ?? lockedCarrier ?? "thaipost");
  const [postalCode, setPostalCode] = useState(edit?.postalCode ?? "");
  const [provider, setProvider] = useState(edit?.provider ?? "");
  // the round stores the branch name; the select wants its id (a typed-in branch stays as text)
  const [branch, setBranch] = useState(edit?.branch ? BRANCHES.find((b) => b.name === edit.branch)?.id ?? edit.branch : "");

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
    // อายุหลังตัดที่คาดการณ์ is the farm's own forecast — no longer derived from the cut date
  }
  function onDest(v: string) {
    setDestination(v);
    setErrs((e) => ({ ...e, destination: "" }));
  }
  // Recipient GPS pin ("lat, lng") — the most precise destination point.
  function parseGps(v: string): { lat: number; lng: number } | null {
    const [a, b] = v.split(",").map((x) => Number(x.trim()));
    return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180 ? { lat: a, lng: b } : null;
  }
  function onDestGps(v: string) {
    setDestGps(v);
    setErrs((e) => ({ ...e, destGps: "" }));
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

  // Distance = recipient address − origin branch (Thai Post doc 9 Oct 2026), recomputed whenever
  // the branch, address, pin or province changes — unless the user typed a distance themselves.
  const originBranch = findBranch(branch);
  const origin = originBranch
    ? { lat: originBranch.lat, lng: originBranch.lng, label: originBranch.name }
    : supplier.gpsLat && supplier.gpsLng ? { lat: supplier.gpsLat, lng: supplier.gpsLng, label: "ที่ตั้งฟาร์ม (ยังไม่เลือกสาขาต้นทาง)" } : null;
  const dist = useRecipientDistance(origin, destAddress, parseGps(destGps), destination);
  useEffect(() => {
    if (!distEdited && dist.km != null) setDistanceKm(String(dist.km));
  }, [dist.km, distEdited]);

  const carrierLabel = CARRIERS.find((c) => c.key === carrier)!.label;
  const branchName = (id: string) => BRANCHES.find((b) => b.id === id)?.name ?? id;
  const reviewPairs = (): Record<string, string> => ({
    ชนิด: flowerType, พันธุ์: variety,
    จำนวน: flowerCount ? `${Number(flowerCount).toLocaleString()} ${UNIT_LABEL[unit]}` : "",
    วันที่ปลูก: plantingDate ? formatThaiDate(plantingDate) : "", วันที่ตัด: formatThaiDate(cutDate),
    อายุ: ageDays ? `${ageDays} วัน` : "", ระยะการสุก: ripeness ? RIPENESS_LABEL[ripeness] : "", เกรด: grade,
    จังหวัดปลายทาง: destination, ที่อยู่ปลายทาง: destAddress, พิกัดปลายทาง: destGps, ระยะทาง: distanceKm ? `${distanceKm} กม.` : "",
    รูปแบบการขนส่ง: carrierLabel, รหัสไปรษณีย์: postalCode, ผู้ให้บริการ: provider, สาขาต้นทาง: branchName(branch),
    บรรจุภัณฑ์: JSON.stringify(rowsToPayload(packs).packagingItems),
    น้ำหนักรวม: packedKg ? `${packedKg.toLocaleString("th-TH", { maximumFractionDigits: 3 })} กก.` : "",
  });
  const original = useRef<Record<string, string> | null>(null);
  useEffect(() => {
    if (edit) original.current = reviewPairs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- validation (drives the inline-error state) ----
  function validate(): Errors {
    const e: Errors = {};
    if (!flowerType) e.flowerType = "กรุณาเลือกชนิดสินค้า";
    if (!variety) e.variety = "กรุณาเลือกพันธุ์";
    if (!flowerCount || Number(flowerCount) <= 0) e.flowerCount = isFlower ? "กรุณาระบุจำนวนดอกไม้" : "กรุณาระบุน้ำหนักสินค้า";
    if (!cutDate) e.cutDate = isFlower ? "กรุณาเลือกวันที่ตัดดอกไม้" : "กรุณาเลือกวันที่เก็บเกี่ยว";
    if (destGps.trim() && !parseGps(destGps)) e.destGps = "รูปแบบพิกัดไม่ถูกต้อง (ละติจูด, ลองจิจูด)";
    if (isFlower && !ageDays) e.ageDays = "กรุณาระบุอายุหลังตัดที่คาดการณ์";
    if (category === "fruit" && !ripeness) e.ripeness = "กรุณาระบุระยะการสุก";
    Object.assign(e, validateRows(packs));
    if (!(packedKg > 0)) e.packedWeight = "กรุณาระบุน้ำหนักรวมหลังแพ็ก";
    else if (packagingKg > 0 && packedKg <= packagingKg) e.packedWeight = `น้อยกว่าน้ำหนักบรรจุภัณฑ์ที่เลือกไว้ (≈ ${packagingKg.toFixed(2)} กก.) — ตรวจสอบอีกครั้ง`;
    if (!shipDate) e.shipDate = "กรุณาระบุวันที่จัดส่ง";
    if (!destination) e.destination = "กรุณาเลือกจังหวัดปลายทาง";
    if (isThaipost) {
      if (!postalCode.trim()) e.postalCode = "กรุณาระบุรหัสไปรษณีย์";
    } else if (!provider) {
      e.provider = "กรุณาเลือกผู้ให้บริการ";
    }
    if (!branch) e.branch = "กรุณาเลือกสาขาต้นทาง";
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
      const pk = rowsToPayload(packs);
      const res = await fetch(edit ? `/api/batches/${edit.id}` : "/api/batches", {
        method: edit ? "PUT" : "POST",
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
          basketIds: pk.basketIds,
          shippedWeightKg: packedKg,
          expectedAgeDays: isFlower && ageDays ? Number(ageDays) : undefined,
          packagingItems: pk.packagingItems,
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
        router.push(edit ? `/app/history?edited=${encodeURIComponent(edit.id)}` : "/app/history");
        router.refresh();
      }, 1400);
    } catch (err) {
      setServerError((err as Error).message);
      setBusy(false);
    }
  }

  // ============================ REVIEW STEP ============================
  if (step === "review") {
    const packRows = packs.map((r) => rowSummary(r, catalog));
    const now = reviewPairs();
    const was = (k: string) => (edit && original.current && original.current[k] !== now[k] ? original.current[k] || "—" : undefined);
    const changedCount = edit && original.current ? Object.keys(now).filter((k) => original.current![k] !== now[k]).length : 0;
    const F = ({ label, value, k }: { label: string; value: string; k?: string }) => {
      const old = k ? was(k) : undefined;
      return old !== undefined ? (
        <div className="rounded-[10px] bg-[#FFF6DB] px-2.5 py-2">
          <p className="text-[13px] font-semibold text-slate-800">{label} <span className="ml-1 rounded-full bg-[#FFE7A3] px-2 py-0.5 text-[11px] font-semibold text-[#6B4A00]">แก้ไข</span></p>
          <p className="text-[13px] text-slate-400 line-through">{old}</p>
          <p className="text-[13px] font-semibold text-slate-800">→ {value || "—"}</p>
        </div>
      ) : (
        <div>
          <p className="text-[13px] font-semibold text-slate-800">{label}</p>
          <p className="text-[13px] text-slate-500">{value || "—"}</p>
        </div>
      );
    };
    return (
      <div className="max-w-4xl space-y-5">
        <Toast show={toast} />
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="text-[16px] font-semibold text-slate-900">ตรวจสอบและยืนยันข้อมูล</h2>
          </div>
          {edit ? (
            <div className="mx-6 mt-5 rounded-[12px] border border-[#F2D58A] bg-[#FFF6DB] px-4 py-3">
              <p className="text-[14px] font-semibold text-[#6B4A00]">ตรวจสอบการแก้ไข · มี {changedCount} ช่องที่เปลี่ยน</p>
              <p className="text-[13px] text-[#6B4A00]">ช่องสีเหลืองคือช่องที่แก้ไข แสดงค่าเดิม → ค่าใหม่ · บันทึกแล้วระบบคำนวณคาร์บอนใหม่และเก็บประวัติการแก้ไข โดยใช้รหัสล็อตเดิม</p>
            </div>
          ) : null}
          <div className="grid grid-cols-1 md:grid-cols-3">
            {/* Col 1 — flowers */}
            <div className="space-y-4 border-slate-100 p-6 md:border-r">
              <div className="rounded-lg bg-emerald-500 px-3 py-2 text-center text-[13px] font-semibold text-white">ข้อมูลสินค้า</div>
              <F label="ประเภทสินค้า" value={PRODUCT_CATEGORIES.find((c) => c.key === category)?.label ?? ""} />
              <F k="ชนิด" label="ชนิด" value={flowerType} />
              <F k="พันธุ์" label="พันธุ์" value={variety} />
              <F k="จำนวน" label={isFlower ? "จำนวนดอกไม้" : "น้ำหนักสินค้า"} value={flowerCount ? `${Number(flowerCount).toLocaleString()} ${UNIT_LABEL[unit]}` : ""} />
              {!isFlower && plantingDate ? <F k="วันที่ปลูก" label="วันที่ปลูก" value={formatThaiDate(plantingDate)} /> : null}
              <F k="วันที่ตัด" label={harvestLabel(category)} value={formatThaiDate(cutDate)} />
              {isFlower ? <F k="อายุ" label="อายุหลังตัดที่คาดการณ์" value={ageDays ? `${ageDays} วัน` : ""} /> : null}
              {category === "fruit" && ripeness ? <F k="ระยะการสุก" label="ระยะการสุก" value={RIPENESS_LABEL[ripeness]} /> : null}
              {!isFlower && grade ? <F k="เกรด" label="เกรด" value={grade} /> : null}
              {category === "fruit" && ethylene ? <F label="เอทิลีน/สารยับยั้งการสุก" value={ethyleneNote || "ใช้"} /> : null}
            </div>
            {/* Col 2 — packaging */}
            <div className="space-y-4 border-slate-100 p-6 md:border-r">
              <div className="rounded-lg bg-emerald-500 px-3 py-2 text-center text-[13px] font-semibold text-white">บรรจุภัณฑ์{was("บรรจุภัณฑ์") !== undefined ? <span className="ml-2 rounded-full bg-[#FFE7A3] px-2 py-0.5 text-[11px] font-semibold text-[#6B4A00]">แก้ไข</span> : null}</div>
              {packRows.map((p, i) => (
                <div key={i} className="space-y-3 border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                  <p className="text-[12px] font-semibold text-slate-400">รายการที่ {i + 1}</p>
                  <F label="บรรจุภัณฑ์" value={[p.name, p.usage].filter(Boolean).join(" · ")} />
                  {p.code ? <F label="หมายเลข" value={p.code} /> : null}
                  <F label="ขนาด · จำนวน" value={`${p.size} · ${p.qty}`} />
                  <F label="วัสดุภายใน" value={p.inner} />
                </div>
              ))}
              <F k="น้ำหนักรวม" label="น้ำหนักรวมหลังแพ็ก" value={packedKg ? `${packedKg.toLocaleString("th-TH", { maximumFractionDigits: 3 })} กก.` : ""} />
            </div>
            {/* Col 3 — transport */}
            <div className="space-y-4 p-6">
              <div className="rounded-lg bg-emerald-500 px-3 py-2 text-center text-[13px] font-semibold text-white">ข้อมูลการขนส่ง</div>
              <F label="วันที่จัดส่ง" value={formatThaiDate(shipDate)} />
              <F k="จังหวัดปลายทาง" label="จังหวัดปลายทาง" value={destination} />
              {destAddress ? <F k="ที่อยู่ปลายทาง" label="ที่อยู่ปลายทาง" value={destAddress} /> : null}
              {destGps ? <F k="พิกัดปลายทาง" label="พิกัดปลายทาง" value={destGps} /> : null}
              <F k="ระยะทาง" label="ระยะทางขนส่ง" value={distanceKm ? `${distanceKm} กม.` : ""} />
              <F k="รูปแบบการขนส่ง" label="รูปแบบการขนส่ง" value={carrierLabel} />
              {isThaipost ? (
                <>
                  <F k="รหัสไปรษณีย์" label="รหัสไปรษณีย์" value={postalCode} />
                </>
              ) : (
                <F k="ผู้ให้บริการ" label="ผู้ให้บริการ" value={provider} />
              )}
              <F k="สาขาต้นทาง" label="สาขาต้นทาง" value={branchName(branch)} />
            </div>
          </div>
        </div>

        {serverError ? <p className="rounded-[5px] bg-brand-pink-light px-3 py-2 text-[13px] text-[#c1006e]">{serverError}</p> : null}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => setStep("form")} className={`h-[40px] rounded-[8px] ${T.outlineBtn} px-8 text-[14px] font-medium`}>แก้ไข</button>
          <button type="button" onClick={() => setConfirmOpen(true)} className={`h-[40px] rounded-[8px] ${T.solidBtn} px-10 text-[14px] font-medium`}>บันทึก</button>
        </div>

        <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title={edit ? `บันทึกการแก้ไข ${edit.id}?` : "ยืนยันการจัดส่ง?"}>
          <p className="text-[13px] text-slate-500">{edit ? "ระบบจะคำนวณคาร์บอนใหม่และบันทึกประวัติการแก้ไข" : "หากข้อมูลไม่ถูกต้อง แก้ไขหรือยกเลิกได้ที่เมนู “จัดการ” ก่อนผู้ขนส่งพิมพ์ QR"}</p>
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
                <label className={labelCls}>อายุหลังตัดที่คาดการณ์ (วัน){req}</label>
                <SelectOther value={ageDays} onChange={(v) => { setAgeDays(v); setErrs((x) => ({ ...x, ageDays: "" })); }} options={AGE_OPTIONS.map((d) => ({ value: String(d), label: `${d} วัน` }))} placeholder="ระบุอายุหลังตัดที่คาดการณ์" className={inputCls} invalid={!!errs.ageDays} numeric otherPlaceholder="จำนวนวัน" />
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
                <SelectOther value={grade} onChange={setGrade} options={GRADE_OPTIONS.map((g) => ({ value: g, label: g }))} placeholder="ไม่ระบุ" className={inputCls} otherPlaceholder="ระบุเกรด" />
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
      <Section title="บรรจุภัณฑ์ที่ใช้ในการจัดส่ง" sub={`เลือกให้ตรงกับที่ใช้จริง ช่องไหนไม่มี ให้เลือก "ไม่มี" ระบบคำนวณคาร์บอนให้เอง`}>
        <PackagingLines
          rows={packs}
          onChange={setPacks}
          errs={errs}
          clearErr={(k) => setErrs((x) => ({ ...x, [k]: "" }))}
          inputCls={inputCls}
          labelCls={labelCls}
          catalog={catalog}
          product={category}
          accentText={T.link}
          outlineBtnCls={T.outlineBtn}
        />
        <div className="grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-[minmax(0,320px)_1fr] sm:items-start">
          <div>
            <label className={labelCls}>น้ำหนักรวมหลังแพ็ก{req}</label>
            <div className="grid grid-cols-[minmax(0,1fr)_88px] gap-2">
              <input inputMode="decimal" type="number" min="0" step="any" value={packedWeight} onChange={(e) => { setPackedWeight(e.target.value); setErrs((x) => ({ ...x, packedWeight: "" })); }} placeholder="0.0" className={`${inputCls} ${errs.packedWeight ? "border-[#ee443f]" : ""}`} />
              <select aria-label="หน่วยน้ำหนักรวม" value={packedUnit} onChange={(e) => setPackedUnit(e.target.value as "กก." | "กรัม")} className={inputCls}><option>กก.</option><option>กรัม</option></select>
            </div>
            <Err msg={errs.packedWeight} />
          </div>
          <p className="text-[12px] leading-relaxed text-slate-400 sm:pt-7">ชั่งสินค้าพร้อมบรรจุภัณฑ์ทั้งหมดของรอบนี้ก่อนส่ง · ใช้คำนวณคาร์บอนขนส่ง และใช้ตรวจว่าน้ำหนักบรรจุภัณฑ์ที่เลือกไว้สมเหตุสมผล{packagingKg > 0 ? ` (บรรจุภัณฑ์ที่เลือก ≈ ${packagingKg.toFixed(2)} กก.)` : ""}</p>
        </div>
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
            <label className={labelCls}>จังหวัดปลายทาง{req}</label>
            <SelectOther value={destination} onChange={onDest} options={DESTINATIONS.map((d) => ({ value: d.name, label: d.name }))} placeholder="เลือกจังหวัดปลายทาง" className={inputCls} invalid={!!errs.destination} otherPlaceholder="ชื่อจังหวัด" />
            <Err msg={errs.destination} />
          </div>
          <div>
            <label className={labelCls}>ระยะทางขนส่ง (กิโลเมตร)</label>
            <input type="number" value={distanceKm} onChange={(e) => { setDistanceKm(e.target.value); setDistEdited(true); }} placeholder="ระบบจะคำนวณอัตโนมัติ" className={`${inputCls} bg-slate-50`} />
            <p className="mt-1 text-[11px] text-slate-400">{distEdited ? <>แก้ไขเอง · <button type="button" onClick={() => setDistEdited(false)} className="underline">ให้ระบบคำนวณ</button></> : dist.looking ? "กำลังหาตำแหน่งที่อยู่ผู้รับ…" : dist.basis || "กรอกที่อยู่ผู้รับและเลือกสาขาต้นทาง"}</p>
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
            <p className="mt-1 text-[11px] text-slate-400">ไม่บังคับ · ใส่พิกัดผู้รับได้ระยะทางแม่นที่สุด · คัดลอกจาก Google Maps ได้</p>
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
              <SelectOther value={provider} onChange={(v) => { setProvider(v); setErrs((x) => ({ ...x, provider: "" })); }} options={PROVIDERS.map((p) => ({ value: p, label: p }))} placeholder="เลือกผู้ให้บริการ" className={inputCls} invalid={!!errs.provider} otherPlaceholder="ชื่อผู้ให้บริการ" />
              <Err msg={errs.provider} />
            </div>
          )}
          <div>
            <label className={labelCls}>สาขาต้นทาง{req}</label>
            <SelectOther value={branch} onChange={(v) => { setBranch(v); setErrs((x) => ({ ...x, branch: "" })); }} options={BRANCHES.map((b) => ({ value: b.id, label: b.name }))} placeholder="เลือกสาขาต้นทาง" className={inputCls} invalid={!!errs.branch} otherPlaceholder="ชื่อสาขาต้นทาง" />
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
