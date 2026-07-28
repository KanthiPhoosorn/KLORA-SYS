import Link from "next/link";
import { notFound } from "next/navigation";
import { getBatch, getSupplier } from "@/lib/store";
import { Leaf, Clock, MapPin, Sprout, Star, Truck, ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

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

  const freshness =
    batch.ageDays <= 2
      ? { label: "สดใหม่มาก", cls: "bg-pink-100 text-pink-800" }
      : batch.ageDays <= 5
        ? { label: "ยังสด", cls: "bg-amber-100 text-amber-800" }
        : { label: "ควรรีบใช้", cls: "bg-red-100 text-red-700" };

  return (
    <div className="brand-bg min-h-screen px-4 py-10">
      <div className="mx-auto max-w-xl space-y-6">
        <Link
          href="/"
          className="no-print inline-flex items-center gap-1 text-sm text-pink-700 hover:text-pink-900"
        >
          <ArrowLeft size={14} /> KLORA
        </Link>

        <div className="overflow-hidden rounded-3xl border border-pink-900/10 bg-white/80 shadow-sm">
          <div className="bg-gradient-to-br from-pink-100 to-pink-200 px-6 py-6 text-pink-800">
            <div className="flex items-center gap-2 text-sm font-medium text-pink-600">
              <Leaf size={16} /> Carbon Passport · คาร์บอนพาสปอร์ต
            </div>
            <h1 className="mt-2 text-2xl font-bold text-pink-700">{supplier.farmName}</h1>
            <p className="text-pink-700/80">{supplier.flowerType}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-white/70 px-2.5 py-1 font-mono text-pink-700">{batch.id}</span>
              <span className="rounded-full bg-white/70 px-2.5 py-1 font-mono text-pink-700">{supplier.id}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-px bg-pink-900/10">
            <div className="bg-white px-6 py-5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-pink-900/50">
                <Leaf size={13} /> คาร์บอนต่อดอก
              </div>
              <div className="mt-1 text-3xl font-bold tabular text-pink-700">
                {batch.co2ePerFlower.toFixed(4)}
              </div>
              <div className="text-xs text-pink-900/50">kg CO₂e / ดอก</div>
            </div>
            <div className="bg-white px-6 py-5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-pink-900/50">
                <Clock size={13} /> อายุหลังตัด
              </div>
              <div className="mt-1 text-3xl font-bold tabular text-pink-700">
                {batch.ageDays} <span className="text-base font-medium text-pink-900/50">วัน</span>
              </div>
              <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${freshness.cls}`}>
                {freshness.label}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-pink-900/10 bg-white/80 p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-pink-900/70">ที่มาของดอกไม้</h2>
          <ul className="space-y-3 text-sm text-pink-900/80">
            <li className="flex gap-3">
              <Sprout size={16} className="mt-0.5 text-pink-600" />
              <span><b>ฟาร์ม:</b> {supplier.farmName} · เจ้าของ {supplier.owner}</span>
            </li>
            <li className="flex gap-3">
              <MapPin size={16} className="mt-0.5 text-pink-600" />
              <span><b>ที่ตั้ง:</b> {supplier.address} ({supplier.gpsLat}, {supplier.gpsLng})</span>
            </li>
            <li className="flex gap-3">
              <Star size={16} className="mt-0.5 text-pink-600" />
              <span><b>จุดเด่น:</b> {supplier.highlights}</span>
            </li>
            <li className="flex gap-3">
              <Truck size={16} className="mt-0.5 text-pink-600" />
              <span>
                <b>การขนส่ง:</b> ตัดเมื่อ {batch.cutDate} ·{" "}
                {batch.destination ? `ปลายทาง ${batch.destination} · ` : ""}
                ระยะทาง {batch.distanceKm.toLocaleString()} km · {batch.flowerCount.toLocaleString()} ดอกในรอบนี้
              </span>
            </li>
          </ul>
          <p className="mt-4 border-t border-pink-900/10 pt-3 text-xs text-pink-900/50">
            ติดต่อฟาร์ม: {supplier.contact}
          </p>
        </div>

        <p className="no-print text-center text-xs text-pink-900/40">
          คำนวณโดย KLORA — (คาร์บอนปลูก + ขนส่ง)/จำนวนดอก + คาร์บอนตะกร้า/รอบใช้งาน
        </p>
      </div>
    </div>
  );
}
