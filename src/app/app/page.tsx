import { requireRole } from "@/lib/auth";
import { getSupplier, getBatchesBySupplier, getPrints, getRatings } from "@/lib/store";
import RatingsCard from "@/components/RatingsCard";
import { MetricCard, BarChart, Card } from "@/components/ui";
import ProLock from "@/components/ProLock";
import ShipmentStepper from "@/components/ShipmentStepper";
import { buildMonthSeries, thaiDateShort } from "@/lib/format";
import { Truck, Cloud, Package, Clock } from "lucide-react";
import ShipmentsTable from "@/components/ShipmentsTable";
import { toShipRows } from "@/lib/ship-rows";
import { batchCo2e, categoryOf, perUnitLabel } from "@/lib/produce";
import CategoryFilter, { parseCat } from "@/components/CategoryFilter";

export const dynamic = "force-dynamic";

export default async function SupplierOverview({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  const user = await requireRole("supplier");
  const cat = parseCat((await searchParams).cat);
  const [supplier, allBatches, prints] = await Promise.all([
    getSupplier(user.supplierId!),
    getBatchesBySupplier(user.supplierId!),
    getPrints(),
  ]);
  // Category filter (ทั้งหมด / ดอกไม้ / ผลไม้ / ผัก) scopes every number on the page. Units never mix:
  // a single category reports CO₂e per stem/kg, "ทั้งหมด" reports CO₂e per shipment instead.
  const inCat = cat === "all" ? allBatches : allBatches.filter((b) => categoryOf(b) === cat);
  const batches = inCat.filter((b) => !b.cancelledAt); // ยกเลิกรายการ = out of every total
  const mixed = new Set(allBatches.map(categoryOf)).size > 1;

  // Freemium (Figma "Lock" state): the ภาพรวม overview is a Pro feature.
  if (supplier && supplier.plan !== "pro") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">ภาพรวม</h1>
        <ProLock
          title="ปลดล็อกภาพรวม"
          desc="อัปเกรดเป็นแพ็กเกจ Pro เพื่อดูภาพรวมการส่งออก แนวโน้ม CO₂e รายเดือน และสถานะการจัดส่งทั้งหมดในหน้าเดียว"
        />
      </div>
    );
  }

  const computed = batches.filter((b) => b.status === "computed");
  const totalCo2e = computed.reduce((n, b) => n + batchCo2e(b), 0);
  const avgCo2e = computed.length
    ? cat === "all" && mixed
      ? totalCo2e / computed.length
      : computed.reduce((n, b) => n + b.co2ePerFlower, 0) / computed.length
    : 0;
  const avgLabel = cat === "all" && mixed ? "CO2e เฉลี่ยต่อ Shipment" : `CO2e เฉลี่ย${computed[0] ? perUnitLabel(computed[0]) : cat === "flower" || cat === "all" ? "ต่อดอก" : "ต่อกก."}`;
  const pending = batches.filter((b) => b.status === "submitted").length;

  const series = buildMonthSeries(
    computed,
    (b) => b.cutDate,
    (b) => batchCo2e(b),
    12,
  );

  const printedIds = new Set(prints.filter((p) => !p.cancelled).map((p) => p.batchId));
  const sorted = [...batches].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const latest = sorted[0];
  const printed = latest ? printedIds.has(latest.id) : false;
  const steps = latest
    ? [
        { label: categoryOf(latest) === "flower" ? "ตัดดอก" : "เก็บเกี่ยว", img: "/figma/step-cut.webp", date: thaiDateShort(latest.cutDate), done: true },
        { label: "รับข้อมูล", img: "/figma/step-receive.webp", date: thaiDateShort(latest.entryDate), done: latest.status === "computed" },
        { label: "พิมพ์ QR code", img: "/figma/step-qr.webp", date: printed ? "พิมพ์แล้ว" : "กำลังดำเนินการ", done: printed, inProgress: latest.status === "computed" && !printed },
      ]
    : [];

  return (
    <div className="space-y-6">
      {mixed ? <CategoryFilter value={cat} basePath="/app" accent="pink" /> : null}
      {/* Metric cards */}
      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard label="จำนวนรอบการส่งออก" value={batches.length} unit="รอบ" tone="green" icon={<Truck size={20} />} note="อัปเดตล่าสุด : วันนี้" />
        <MetricCard label="CO2e สะสม" value={totalCo2e.toFixed(0)} unit="กิโลกรัม" tone="blue" icon={<Cloud size={20} />} note="อัปเดตล่าสุด : วันนี้" />
        <MetricCard label={avgLabel} value={avgCo2e.toFixed(cat === "all" && mixed ? 2 : 4)} unit="กิโลกรัม" tone="green" icon={<Package size={20} />} note="อัปเดตล่าสุด : วันนี้" />
        <MetricCard label="รอคำนวณ" value={pending} unit="รายการ" tone="orange" icon={<Clock size={20} />} note="อัปเดตล่าสุด : วันนี้" />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Trend */}
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-800">แนวโน้ม CO2e รายเดือน</h2>
              <p className="text-xs text-slate-400">กิโลกรัมคาร์บอนไดออกไซด์เทียบเท่า (kgCO₂e)</p>
            </div>
            <span className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600">ปี 2569</span>
          </div>
          <BarChart data={series} height={200} barClassName="bg-gradient-to-t from-pink-200 to-pink-500" />
        </Card>

        {/* Shipment stepper */}
        <Card className="p-5">
          <h2 className="mb-6 text-lg font-bold text-slate-800">สถานะการจัดส่งล่าสุด</h2>
          {latest ? <ShipmentStepper steps={steps} /> : <p className="text-sm text-slate-400">ยังไม่มีรอบส่งออก</p>}
        </Card>
      </div>

      {/* Latest shipments — ✏️ opens the manage menu in place (Thai Post doc §5) */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-slate-800">รายการจัดส่งล่าสุด</h2>
        <ShipmentsTable rows={toShipRows(inCat, prints).slice(0, 8)} />
      </div>

      {/* buyers' ratings from the QR page (Thai Post doc §15) */}
      <RatingsCard ratings={await getRatings({ supplierId: user.supplierId! })} show="farm" />
    </div>
  );
}
