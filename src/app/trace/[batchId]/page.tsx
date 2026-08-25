import { notFound } from "next/navigation";
import { getBatch, getSupplier } from "@/lib/store";
import { thaiDateShort } from "@/lib/format";
import Co2eDisclosure from "@/components/Co2eDisclosure";
import { Flower2, MapPin, Phone, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-2.5 last:border-0">
      <span className="text-sm text-slate-400">{label}</span>
      <span className="text-sm font-medium text-slate-800">{value}</span>
    </div>
  );
}

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

  const productName = batch.variety || supplier.flowerType;
  const weight = batch.weightKg ?? Math.round(batch.flowerCount * 0.052 * 10) / 10;
  const careTips =
    supplier.careTips ||
    "เปลี่ยนน้ำทุก 2 วัน ตัดปลายก้าน 1–2 ซม. หลีกเลี่ยงแสงแดดและความร้อนจัด";
  const description = supplier.description || supplier.highlights;

  return (
    <div className="min-h-screen bg-slate-100 py-6">
      <div className="mx-auto max-w-md space-y-5 px-5">
        {/* Brand + product */}
        <div>
          <div className="flex items-center gap-1.5 text-xl font-extrabold tracking-tight text-pink-500">
            <Flower2 size={20} /> KLORA
          </div>
          <h1 className="mt-3 text-2xl font-bold text-slate-900">{productName}</h1>
          <p className="mt-1 text-sm leading-relaxed text-slate-500">{description}</p>
        </div>

        {/* Origin */}
        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-700">แหล่งที่มา</h2>
          <div className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="grid h-20 w-24 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-200 text-3xl">
              🌷
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
        </section>

        {/* Product details */}
        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-700">รายละเอียดสินค้า</h2>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-1 shadow-sm">
            <Row label="ชนิดดอกไม้" value={productName} />
            <Row label="จำนวนดอก" value={`${batch.flowerCount.toLocaleString()} ดอก`} />
            <Row label="Estimated CO₂e ต่อดอก" value={`${batch.co2ePerFlower.toFixed(4)} Kg`} />
            <Row label="น้ำหนักรวม" value={`${weight} kg.`} />
            <Row label="วันที่ตัด" value={thaiDateShort(batch.cutDate)} />
            <Row label="อายุหลังตัด" value={`${batch.ageDays} วัน`} />
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
