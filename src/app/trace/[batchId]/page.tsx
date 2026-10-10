import { notFound, redirect } from "next/navigation";
import { getBatch, getSupplier, activePrintOf } from "@/lib/store";
import { thaiDateShort, thaiDateFull } from "@/lib/format";
import Co2eDisclosure from "@/components/Co2eDisclosure";
import { SavePassport, HighlightBar } from "@/components/TraceClient";
import { MapPin, Phone, ShieldCheck, Award, Thermometer, AlertTriangle, Scissors, ClipboardCheck, QrCode } from "lucide-react";
import {
  categoryOf, categoryLabel, quantityLabel, perUnitLabel, harvestLabel, ageLabel,
  ripenessAtScan, shelfLifeLeft, coldChainWarning, isWeightBased, RIPENESS_LABEL,
} from "@/lib/produce";

export const dynamic = "force-dynamic";

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
// steps, care tips; ⬇ saves the page as an image or PDF; a long farm story → "ดูเพิ่มเติม".
export default async function TracePage({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  const batch = await getBatch(batchId);
  if (!batch) notFound();
  // An old sticker (BAT-…) opens the lot under its current code.
  if (batch.id !== batchId) redirect(`/t/${batch.id}`);
  const [supplier, print] = await Promise.all([getSupplier(batch.supplierId), activePrintOf(batch.id)]);
  if (!supplier) notFound();

  const category = categoryOf(batch);
  const isFlower = category === "flower";
  const weightBased = isWeightBased(batch);
  const typeName = batch.productType || supplier.flowerType;
  const productName = batch.variety || typeName;
  const { stage, daysSinceHarvest, profile } = ripenessAtScan(batch);
  const left = shelfLifeLeft(batch);
  const chill = coldChainWarning(batch);
  const weight = batch.shippedWeightKg ?? (weightBased ? batch.quantity ?? 0 : batch.weightKg ?? Math.round(batch.flowerCount * 0.052 * 10) / 10);
  const certs = (supplier.certifications ?? []).filter((c) => c.appliesTo.includes(category));
  const care = tipsOf(supplier.careTips).length ? tipsOf(supplier.careTips) : isFlower ? DEFAULT_CARE.flower
    : category === "fruit"
      ? [`เก็บที่ ${profile.storageMinC}–${profile.storageMaxC}°C${profile.chillSensitive ? " ไม่ควรแช่เย็นจัด" : ""}`, ...(profile.ripens ? ["วางไว้ที่อุณหภูมิห้องหากต้องการให้สุกต่อ"] : []), "ล้างให้สะอาดก่อนรับประทาน"]
      : ["ล้างให้สะอาดก่อนปรุง", `เก็บในตู้เย็นช่องผักที่ ${profile.storageMinC}–${profile.storageMaxC}°C`, `ควรบริโภคภายใน ${profile.shelfLifeDays} วัน`];
  const story = supplier.description || supplier.highlights || "";
  const steps = [
    { label: isFlower ? "ตัดดอก" : "เก็บเกี่ยว", date: thaiDateFull(batch.cutDate), done: true, Icon: Scissors },
    { label: "บันทึกข้อมูล", date: thaiDateFull(batch.entryDate), done: true, Icon: ClipboardCheck },
    { label: "พิมพ์ QR · ส่งออก", date: print ? thaiDateFull(print.printedAt.slice(0, 10)) : "รอดำเนินการ", done: !!print, Icon: QrCode },
  ];
  const tiles = [
    { v: productName, l: isFlower ? "ชนิดดอกไม้" : categoryLabel(category) },
    { v: quantityLabel(batch), l: isFlower ? "จำนวนดอก" : "น้ำหนักสินค้า" },
    { v: `${batch.co2ePerFlower.toFixed(4)} kg`, l: `CO₂e ${perUnitLabel(batch)}` },
    { v: weight ? `${weight} kg.` : "—", l: "น้ำหนักรวม" },
    { v: thaiDateFull(batch.cutDate), l: harvestLabel(category) },
    { v: `${daysSinceHarvest} วัน`, l: ageLabel(category) },
  ];

  return (
    <div className="min-h-screen bg-slate-50 py-5">
      <div id="passport" className="mx-auto max-w-md space-y-5 bg-slate-50 px-4 pb-4">
        {/* header: Corta + save */}
        <div className="flex items-center justify-between pt-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/corta-logo.png" alt="Corta" className="h-7 w-auto" />
          <SavePassport targetId="passport" fileName={`Corta-${batch.id}`} />
        </div>

        {/* hero */}
        <section className="rounded-2xl bg-gradient-to-br from-[#FDECEC] via-[#FFF6F6] to-white p-5 shadow-sm ring-1 ring-[#F7CDD0]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/80 px-2.5 py-0.5 text-[11px] font-semibold text-[#EE2C34]">{categoryLabel(category)}</span>
            {batch.grade ? <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-[11px] font-semibold text-white">เกรด {batch.grade}</span> : null}
          </div>
          <h1 className="mt-2 text-[22px] font-bold leading-tight text-[#EE2C34]">{productName}</h1>
          {/* one standard line for every product (§15) — the farm's own story lives behind the bar below */}
          <p className="mt-1 text-[13px] text-slate-600">{typeName || categoryLabel(category)} · {quantityLabel(batch)} · {harvestLabel(category)} {thaiDateFull(batch.cutDate)}</p>
        </section>
        {story ? <HighlightBar title={supplier.farmName} text={story} /> : null}

        {/* farm */}
        <section className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-100">
          {supplier.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={supplier.photoUrl} alt="" className="size-16 shrink-0 rounded-full object-cover" />
          ) : (
            <div className="grid size-16 shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-100 to-emerald-200 text-2xl">{EMOJI[category]}</div>
          )}
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-800">{supplier.farmName}</p>
            <p className="flex items-start gap-1 text-[12px] text-slate-500"><MapPin size={12} className="mt-0.5 shrink-0" /><span className="line-clamp-2">{supplier.address}</span></p>
            {supplier.contact && supplier.contact !== "—" ? <p className="mt-0.5 flex items-center gap-1 text-[12px] text-emerald-700"><Phone size={12} /> {supplier.contact}</p> : null}
          </div>
        </section>
        {certs.length ? (
          <div className="-mt-2 flex flex-wrap gap-2">
            {certs.map((c, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                <Award size={12} /> {c.kind === "other" ? c.name : c.kind}{c.certNo ? ` · ${c.certNo}` : ""}
              </span>
            ))}
          </div>
        ) : null}

        {/* product tiles */}
        <section>
          <h2 className="mb-2 text-[14px] font-semibold text-slate-700">รายละเอียดสินค้า</h2>
          <div className="grid grid-cols-3 gap-2">
            {tiles.map((t) => (
              <div key={t.l} className="min-w-0 rounded-xl bg-[#E6E7E8]/60 px-2 py-3 text-center">
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
          <h2 className="mb-2 text-[14px] font-semibold text-slate-700">สถานะขนส่ง</h2>
          <div className="rounded-2xl bg-white px-3 py-4 shadow-sm ring-1 ring-slate-100">
            <div className="relative grid grid-cols-3">
              <div className="absolute left-[16.6%] right-[16.6%] top-[7px] h-0.5 bg-slate-200" />
              <div className="absolute left-[16.6%] top-[7px] h-0.5 bg-[#193686]" style={{ width: `${(steps.filter((s) => s.done).length - 1) * 33.3}%` }} />
              {steps.map((s) => (
                <div key={s.label} className="relative flex flex-col items-center text-center">
                  <span className={`size-4 rounded-full ring-4 ring-white ${s.done ? "bg-[#193686]" : "bg-slate-300"}`} />
                  <span className={`mt-3 grid size-11 place-items-center rounded-full ${s.done ? "bg-[#E8ECF6] text-[#193686]" : "bg-slate-50 text-slate-400"}`}><s.Icon size={20} /></span>
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

        <div className="flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-400">
          <ShieldCheck size={13} /> ข้อมูลยืนยันโดย Corta · {supplier.code ?? supplier.id} · {batch.id}{batch.destination ? ` · ปลายทาง ${batch.destination}` : ""}
        </div>
        <p className="text-center text-[11px] text-slate-400">{thaiDateShort(batch.cutDate)} · บันทึกเมื่อ {thaiDateFull(batch.entryDate)}</p>
      </div>
    </div>
  );
}
