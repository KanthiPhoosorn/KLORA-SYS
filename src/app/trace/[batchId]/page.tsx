import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getBatch, getSupplier, activePrintOf, carrierOfLot, ratingSummary, getMyRating } from "@/lib/store";
import { RATER_COOKIE } from "@/lib/rating";
import RatingBadge from "@/components/RatingBadge";
import RateLot from "@/components/RateLot";
import { thaiDateShort, thaiDateFull } from "@/lib/format";
import Co2eDisclosure from "@/components/Co2eDisclosure";
import { SavePassport, FarmSheet } from "@/components/TraceClient";
import { MapPin, Phone, ShieldCheck, Award, Thermometer, AlertTriangle, Scissors, ClipboardCheck, Truck, PackageCheck, Flower2, Apple, Carrot, Package, Leaf, CalendarDays, Clock, Cloud, type LucideIcon } from "lucide-react";
import {
  categoryOf, categoryLabel, quantityLabel, perUnitLabel, harvestLabel, ageLabel, batchCo2e,
  ripenessAtScan, shelfLifeLeft, coldChainWarning, RIPENESS_LABEL,
} from "@/lib/produce";

export const dynamic = "force-dynamic";

// the line under every product name (§15: the same for all products)
const STANDARD_LINE = "ปลอดภัยไร้สารตกค้าง คุณภาพสูง คัดสรรจากแหล่งผลิตที่ได้มาตรฐาน จากเกษตรกรไทยส่งตรงถึงมือคุณ";
const EMOJI = { flower: "🌷", fruit: "🥭", vegetable: "🥬" } as const;
const RIPE_TONE = { unripe: "bg-lime-50 text-lime-700", turning: "bg-amber-50 text-amber-700", ripe: "bg-emerald-50 text-emerald-700", overripe: "bg-rose-50 text-rose-700" } as const;
const DEFAULT_CARE = {
  flower: ["ตัดปลายก้านเฉียงประมาณ 1–2 ซม.", "แช่น้ำทันที และเปลี่ยนน้ำทุก 2 วัน", "หลีกเลี่ยงแสงแดดและลมแรง"],
};
/** Farm's own tips (one per line / "·" / numbered) → a numbered list. */
function tipsOf(text?: string): string[] {
  return (text ?? "").split(/\r?\n|·|•|(?:^|\s)\d+[.)]\s/).map((s) => s.trim()).filter((s) => s.length > 2).slice(0, 6);
}

// Consumer passport (public; the QR label opens /t/LOT-…). Thai Post doc 9 Oct 2026 §14 — the UX/UI
// design without the flower cartoon for now: product hero, farm card, product tiles, shipping
// steps, care tips; ⬇ saves the page as an image or PDF. §15 (Super App mockup): the farm card is the bar
// that opens the farm's จุดเด่น, one standard line under the product name, Thai Post CI colours.
export default async function TracePage({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  const batch = await getBatch(batchId);
  if (!batch) notFound();
  // An old sticker (BAT-…) opens the lot under its current code.
  if (batch.id !== batchId) redirect(`/t/${batch.id}`);
  const [supplier, print] = await Promise.all([getSupplier(batch.supplierId), activePrintOf(batch.id)]);
  if (!supplier) notFound();
  // §15 ratings: the averages of THIS farm and THIS carrier; this device's own rating (to edit)
  const carrier = await carrierOfLot(batch, print);
  const rater = (await cookies()).get(RATER_COOKIE)?.value;
  const [summary, mine] = await Promise.all([ratingSummary(supplier.id, carrier?.key), rater ? getMyRating(batch.id, rater) : null]);

  const category = categoryOf(batch);
  const isFlower = category === "flower";
  const typeName = batch.productType || supplier.flowerType;
  const productName = batch.variety || typeName;
  const { stage, daysSinceHarvest, profile } = ripenessAtScan(batch);
  const left = shelfLifeLeft(batch);
  const chill = coldChainWarning(batch);
  const today = new Date().toISOString().slice(0, 10);
  const certs = (supplier.certifications ?? []).filter((c) => c.appliesTo.includes(category) && (!c.expiresAt || c.expiresAt >= today));
  const care = tipsOf(supplier.careTips).length ? tipsOf(supplier.careTips) : isFlower ? DEFAULT_CARE.flower
    : category === "fruit"
      ? [`เก็บที่ ${profile.storageMinC}–${profile.storageMaxC}°C${profile.chillSensitive ? " ไม่ควรแช่เย็นจัด" : ""}`, ...(profile.ripens ? ["วางไว้ที่อุณหภูมิห้องหากต้องการให้สุกต่อ"] : []), "ล้างให้สะอาดก่อนรับประทาน"]
      : ["ล้างให้สะอาดก่อนปรุง", `เก็บในตู้เย็นช่องผักที่ ${profile.storageMinC}–${profile.storageMaxC}°C`, `ควรบริโภคภายใน ${profile.shelfLifeDays} วัน`];
  const story = supplier.description || (supplier.highlights !== "—" ? supplier.highlights : "") || "";
  // photos (uploaded on ข้อมูลฟาร์ม); a farm without one shows the greenhouse picture
  const farmPhoto = supplier.photoUrl || "/figma/greenhouse.webp";
  const productPhoto = supplier.productPhotos?.[typeName] ?? supplier.productPhotos?.[batch.productType ?? ""];
  const standards = certs.length
    ? certs.map((c) => [c.kind === "other" ? c.name : c.kind, c.certNo, c.issuer].filter(Boolean).join(" · ")).join(" / ")
    : "ยังไม่มีข้อมูลใบรับรองมาตรฐาน";
  const carbonLine = `ติดตามคาร์บอนทุกรอบส่งออก · ล็อตนี้ ${batch.co2ePerFlower.toFixed(4)} kg CO₂e ${perUnitLabel(batch)} (ISO 14067, Tier-1)`;
  const steps = [
    { label: isFlower ? "ตัดดอก" : "เก็บเกี่ยว", date: thaiDateFull(batch.cutDate), done: true, Icon: Scissors },
    { label: "รับสินค้า", date: thaiDateFull(batch.entryDate), done: true, Icon: ClipboardCheck },
    { label: "กำลังขนส่ง", date: print ? thaiDateFull(print.printedAt.slice(0, 10)) : "รอดำเนินการ", done: !!print || batch.shipmentStatus !== "cutting", Icon: Truck },
    { label: "ถึงปลายทาง", date: batch.shipmentStatus === "delivered" ? "ส่งถึงแล้ว" : "รอดำเนินการ", done: batch.shipmentStatus === "delivered", Icon: PackageCheck },
  ];
  // the 6 tiles keep our own content (product · quantity · CO₂e per unit · CO₂e รวม · cut date · age) in the
  // mockup's card style — the lot's total CO₂e, not its weight (10 Oct 2026)
  const tiles: { v: string; l: string; Icon: LucideIcon }[] = [
    { v: productName, l: isFlower ? "ชนิดดอกไม้" : categoryLabel(category), Icon: isFlower ? Flower2 : category === "fruit" ? Apple : Carrot },
    { v: quantityLabel(batch), l: isFlower ? "จำนวนดอก" : "น้ำหนักสินค้า", Icon: Package },
    { v: `${batch.co2ePerFlower.toFixed(4)} kg`, l: `CO₂e ${perUnitLabel(batch)}`, Icon: Leaf },
    { v: `${batchCo2e(batch).toFixed(2)} kg`, l: "CO₂e รวม", Icon: Cloud },
    { v: thaiDateFull(batch.cutDate), l: harvestLabel(category), Icon: CalendarDays },
    { v: `${daysSinceHarvest} วัน`, l: ageLabel(category), Icon: Clock },
  ];

  return (
    <div className="min-h-screen bg-slate-50 py-5">
      <div id="passport" className="mx-auto max-w-md space-y-5 bg-slate-50 px-4 pb-4">
        {/* header: Corta + save, Thai Post red corner (Super App mockup) */}
        <div className="relative -mx-4 flex items-center justify-between overflow-hidden px-4 pb-1 pt-5">
          <span aria-hidden className="pointer-events-none absolute -left-1 -top-5 h-10 w-20 bg-[#EE2C34] [clip-path:polygon(0_0,100%_0,0_100%)]" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/corta-logo.png" alt="Corta" className="relative h-7 w-auto" />
          <SavePassport targetId="passport" fileName={`Corta-${batch.id}`} />
        </div>

        {/* hero */}
        <section className="flex items-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-br from-[#FDECEC] via-[#FFF6F6] to-white p-5 shadow-sm ring-1 ring-[#F7CDD0]">
          <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#EE2C34]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#EE2C34]">Product Passport</span>
            <span className="rounded-full bg-white/80 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">{categoryLabel(category)}</span>
            {batch.grade ? <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-[11px] font-semibold text-white">เกรด {batch.grade}</span> : null}
          </div>
          <h1 className="mt-2 text-[22px] font-bold leading-tight text-[#EE2C34]">{productName}</h1>
          {/* one standard line for every product (§15) — the farm's own story lives behind the bar below */}
          <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{STANDARD_LINE}</p>
          </div>
          {productPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={productPhoto} alt={productName} className="size-28 shrink-0 rounded-2xl object-cover shadow-sm" />
          ) : null}
        </section>

        {/* farm card → sheet with the farm's details (§15, Super App mockup) */}
        <FarmSheet name={supplier.farmName} address={supplier.address} photo={farmPhoto} story={story || undefined} standards={standards} carbon={carbonLine}>
          <span className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={farmPhoto} alt="" className="size-[72px] shrink-0 rounded-xl object-cover object-[80%_60%]" />
            <span className="min-w-0">
              <span className="block truncate text-[16px] font-semibold text-slate-800">{supplier.farmName}</span>
              <RatingBadge kind="farm" initial={summary.farm} />
              <span className="mt-0.5 flex items-start gap-1 text-[12px] text-slate-500"><MapPin size={13} className="mt-0.5 shrink-0 text-[#EE2C34]" /><span className="line-clamp-2">{supplier.address}</span></span>
              {supplier.contact && supplier.contact !== "—" ? <span className="mt-0.5 flex items-center gap-1 text-[12px] text-slate-600"><Phone size={13} className="shrink-0 text-[#EE2C34]" /><span className="truncate">{supplier.contact}</span></span> : null}
            </span>
          </span>
        </FarmSheet>

        {/* product tiles */}
        <section>
          <h2 className="mb-2 text-[14px] font-semibold text-slate-700">รายละเอียดสินค้า</h2>
          <div className="grid grid-cols-3 gap-2">
            {tiles.map((t) => (
              <div key={t.l} className="min-w-0 rounded-xl bg-white px-2 py-3 text-center shadow-sm ring-1 ring-[#E6E7E8]">
                <t.Icon size={20} className="mx-auto mb-1 text-[#EE2C34]" />
                <p className="truncate text-[13px] font-semibold text-slate-800" title={t.v}>{t.v}</p>
                <p className="mt-0.5 truncate text-[11px] text-slate-500">{t.l}</p>
              </div>
            ))}
          </div>
          <div className="mt-2 rounded-xl bg-white px-3 py-2.5 text-[12px] text-slate-600 shadow-sm ring-1 ring-slate-100">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5"><Thermometer size={13} /> เก็บรักษา {profile.storageMinC}–{profile.storageMaxC}°C · อายุมาตรฐาน {profile.shelfLifeDays} วัน</span>
              {!isFlower && (profile.ripens || category === "fruit")
                ? <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${RIPE_TONE[stage]}`}>{RIPENESS_LABEL[stage]}</span>
                : <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${left >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{left >= 0 ? "สดใหม่" : "ควรบริโภคโดยเร็ว"}</span>}
            </div>
            {batch.expectedAgeDays ? <p className="mt-1 text-slate-500">ฟาร์มคาดการณ์อายุหลังตัด {batch.expectedAgeDays} วัน</p> : null}
            {batch.ripenessAtHarvest ? <p className="mt-1 text-slate-500">ระยะการสุก ณ วันเก็บเกี่ยว: {RIPENESS_LABEL[batch.ripenessAtHarvest]}</p> : null}
            {batch.ethyleneUsed ? <p className="mt-1 text-slate-500">เอทิลีน/สารยับยั้งการสุก: {batch.ethyleneNote || "ใช้"}</p> : null}
          </div>
          {chill ? (
            <div className="mt-2 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-[12px] leading-relaxed text-amber-800">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {chill}
            </div>
          ) : null}
          <Co2eDisclosure className="mt-2 px-1" />
        </section>

        {/* shipping steps */}
        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="shrink-0 text-[14px] font-semibold text-slate-700">สถานะขนส่ง</h2>
            {carrier ? <span className="flex min-w-0 items-center gap-1.5 text-[12px] text-slate-500"><span className="truncate">{carrier.name}</span><RatingBadge kind="transport" initial={summary.transport} /></span> : null}
          </div>
          <div className="rounded-2xl bg-white px-3 py-4 shadow-sm ring-1 ring-slate-100">
            <div className="relative grid grid-cols-4">
              <div className="absolute left-[12.5%] right-[12.5%] top-[22px] h-0.5 bg-slate-200" />
              <div className="absolute left-[12.5%] top-[22px] h-0.5 bg-[#EE2C34]" style={{ width: `${Math.max(0, steps.filter((s) => s.done).length - 1) * 25}%` }} />
              {steps.map((s) => (
                <div key={s.label} className="relative flex flex-col items-center text-center">
                                    <span className={`grid size-11 place-items-center rounded-full ring-4 ring-white ${s.done ? "bg-[#EE2C34] text-white" : "bg-slate-200 text-slate-400"}`}><s.Icon size={20} /></span>
                  <p className="mt-1.5 text-[12px] font-semibold text-slate-800">{s.label}</p>
                  <p className="text-[11px] text-slate-500">{s.date}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* care */}
        <section>
          <h2 className="mb-2 text-[14px] font-semibold text-slate-700">การดูแลเบื้องต้น</h2>
          <ol className="space-y-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
            {care.map((t, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[13px] text-slate-700">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[#EE2C34] text-[11px] font-semibold text-white">{i + 1}</span>{t}
              </li>
            ))}
          </ol>
        </section>

        {/* §15 ให้คะแนนความพึงพอใจ — once the QR has been printed */}
        {print && !batch.cancelledAt ? (
          <RateLot batchId={batch.id} farmName={supplier.farmName} carrierName={carrier?.name} mine={mine ? { farm: mine.farmStars, transport: mine.transportStars, comment: mine.comment } : null} />
        ) : null}

        <div className="flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-400">
          <ShieldCheck size={13} /> ข้อมูลยืนยันโดย Corta · {supplier.code ?? supplier.id} · {batch.id}{batch.destination ? ` · ปลายทาง ${batch.destination}` : ""}
        </div>
        <p className="text-center text-[11px] text-slate-400">{thaiDateShort(batch.cutDate)} · บันทึกเมื่อ {thaiDateFull(batch.entryDate)}</p>
      </div>
    </div>
  );
}
