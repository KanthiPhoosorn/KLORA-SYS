import { notFound } from "next/navigation";
import { getBatch, getSupplier } from "@/lib/store";
import { thaiDateShort, thaiDateFull } from "@/lib/format";
import Co2eDisclosure from "@/components/Co2eDisclosure";
import { Flower2, MapPin, Phone, ShieldCheck, Award, Thermometer, AlertTriangle } from "lucide-react";
import {
  categoryOf, categoryLabel, quantityLabel, perUnitLabel, harvestLabel, ageLabel,
  ripenessAtScan, shelfLifeLeft, coldChainWarning, isWeightBased, RIPENESS_LABEL, CATEGORY_TAG,
} from "@/lib/produce";

export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-2.5 last:border-0">
      <span className="text-sm text-slate-400">{label}</span>
      <span className="text-right text-sm font-medium text-slate-800">{value}</span>
    </div>
  );
}

const EMOJI = { flower: "🌷", fruit: "🥭", vegetable: "🥬" } as const;
const RIPE_TONE = { unripe: "bg-lime-50 text-lime-700", turning: "bg-amber-50 text-amber-700", ripe: "bg-emerald-50 text-emerald-700", overripe: "bg-rose-50 text-rose-700" } as const;

// Consumer passport (public, reached from the QR label). Product-aware: flowers show stems +
// cut date, produce shows weight, harvest, ripeness at the moment of scanning and storage advice.
export default async function TracePage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;
  const batch = await getBatch(batchId);
  if (!batch) notFound();
  const supplier = await getSupplier(batch.supplierId);
  if (!supplier) notFound();

  const category = categoryOf(batch);
  const isFlower = category === "flower";
  const weightBased = isWeightBased(batch);
  const typeName = batch.productType || supplier.flowerType;
  const productName = batch.variety || typeName;
  const { stage, daysSinceHarvest, profile } = ripenessAtScan(batch);
  const left = shelfLifeLeft(batch);
  const chill = coldChainWarning(batch);
  const weight = weightBased
    ? (batch.shippedWeightKg ?? batch.quantity ?? 0)
    : (batch.weightKg ?? Math.round(batch.flowerCount * 0.052 * 10) / 10);
  const certs = (supplier.certifications ?? []).filter((c) => c.appliesTo.includes(category));
  const careTips =
    supplier.careTips ||
    (isFlower
      ? "เปลี่ยนน้ำทุก 2 วัน ตัดปลายก้าน 1–2 ซม. หลีกเลี่ยงแสงแดดและความร้อนจัด"
      : category === "fruit"
        ? `เก็บที่ ${profile.storageMinC}–${profile.storageMaxC}°C${profile.chillSensitive ? " ไม่ควรแช่เย็นจัด" : ""}${profile.ripens ? " วางไว้ที่อุณหภูมิห้องหากต้องการให้สุกต่อ" : ""} ล้างก่อนรับประทาน`
        : `ล้างให้สะอาดก่อนปรุง เก็บในตู้เย็นช่องผักที่ ${profile.storageMinC}–${profile.storageMaxC}°C ควรบริโภคภายใน ${profile.shelfLifeDays} วัน`);
  const description = supplier.description || supplier.highlights;

  return (
    <div className="min-h-screen bg-slate-100 py-6">
      <div className="mx-auto max-w-md space-y-5 px-5">
        {/* Brand + product */}
        <div>
          <div className="flex items-center gap-1.5 text-xl font-extrabold tracking-tight text-pink-500">
            <Flower2 size={20} /> KLORA
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${CATEGORY_TAG[category]}`}>{categoryLabel(category)}</span>
            {batch.grade ? <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-[11px] font-semibold text-white">เกรด {batch.grade}</span> : null}
          </div>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">{productName}</h1>
          {batch.variety && typeName && batch.variety !== typeName ? <p className="text-sm text-slate-500">{typeName}</p> : null}
          <p className="mt-1 text-sm leading-relaxed text-slate-500">{description}</p>
        </div>

        {/* Freshness at scan */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400">{ageLabel(category)} (ณ วันที่สแกน)</div>
              <div className="text-2xl font-bold text-slate-900">{daysSinceHarvest} วัน</div>
            </div>
            {!isFlower && (profile.ripens || category === "fruit") ? (
              <div className="text-right">
                <div className="text-xs text-slate-400">ระยะการสุก ณ วันที่สแกน</div>
                <span className={`mt-1 inline-block rounded-full px-3 py-1 text-sm font-semibold ${RIPE_TONE[stage]}`}>{RIPENESS_LABEL[stage]}</span>
              </div>
            ) : (
              <div className="text-right">
                <div className="text-xs text-slate-400">ความสด</div>
                <span className={`mt-1 inline-block rounded-full px-3 py-1 text-sm font-semibold ${left >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                  {left >= 0 ? "สดใหม่" : "ควรบริโภคโดยเร็ว"}
                </span>
              </div>
            )}
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
            <Thermometer size={13} />
            เก็บรักษาที่ {profile.storageMinC}–{profile.storageMaxC}°C · อายุมาตรฐาน {profile.shelfLifeDays} วัน
            {left >= 0 ? ` · เหลืออีกประมาณ ${left} วัน` : ` · เกินอายุมาตรฐาน ${-left} วัน`}
          </div>
          {chill ? (
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {chill}
            </div>
          ) : null}
        </section>

        {/* Origin */}
        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-700">แหล่งที่มา</h2>
          <div className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="grid h-20 w-24 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-200 text-3xl">
              {EMOJI[category]}
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-slate-800">{supplier.farmName}</div>
              <div className="mt-0.5 flex items-start gap-1 text-xs text-slate-500">
                <MapPin size={13} className="mt-0.5 shrink-0" /> {supplier.address}
              </div>
              <div className="mt-1 flex items-center gap-1 text-xs text-slate-600">
                <Phone size={13} /> {supplier.contact}
              </div>
            </div>
          </div>
          {certs.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {certs.map((c, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                  <Award size={12} /> {c.kind === "other" ? c.name : c.kind}{c.certNo ? ` · ${c.certNo}` : ""}
                </span>
              ))}
            </div>
          ) : null}
        </section>

        {/* Product details */}
        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-700">รายละเอียดสินค้า</h2>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-1 shadow-sm">
            <Row label="ประเภทสินค้า" value={categoryLabel(category)} />
            <Row label="ชนิด" value={typeName} />
            {batch.variety ? <Row label="พันธุ์" value={batch.variety} /> : null}
            <Row label={isFlower ? "จำนวนดอก" : "น้ำหนักสินค้า"} value={quantityLabel(batch)} />
            <Row label={`Estimated CO₂e ${perUnitLabel(batch)}`} value={`${batch.co2ePerFlower.toFixed(4)} kg`} />
            {isFlower || batch.shippedWeightKg ? <Row label="น้ำหนักรวม" value={`${weight} kg`} /> : null}
            {batch.plantingDate ? <Row label="วันที่ปลูก" value={thaiDateFull(batch.plantingDate)} /> : null}
            <Row label={harvestLabel(category)} value={thaiDateShort(batch.cutDate)} />
            {batch.ripenessAtHarvest ? <Row label="ระยะการสุก ณ วันเก็บเกี่ยว" value={RIPENESS_LABEL[batch.ripenessAtHarvest]} /> : null}
            {batch.ethyleneUsed ? <Row label="เอทิลีน/สารยับยั้งการสุก" value={batch.ethyleneNote || "ใช้"} /> : null}
            {batch.destination ? <Row label="ปลายทาง" value={batch.destination} /> : null}
          </div>
          <Co2eDisclosure className="mt-2 px-1" />
        </section>

        {/* Care */}
        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-700">การดูแลเบื้องต้น</h2>
          <p className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-600 shadow-sm">
            {careTips}
          </p>
        </section>

        <div className="flex items-center justify-center gap-1.5 pt-2 text-center text-xs text-slate-400">
          <ShieldCheck size={13} /> ข้อมูลนี้ยืนยันโดย klora system · {supplier.id} · {batch.id}
        </div>
      </div>
    </div>
  );
}
