import { MetricCard, Card, BarChart } from "@/components/ui";
import ExportCsvButton from "@/components/ExportCsvButton";
import { Truck, Leaf, Cloud, Clock } from "lucide-react";
import ReportTabs, { type ReportData } from "@/components/ReportTabs";
import { buildMonthSeries } from "@/lib/format";
import type { Batch, Supplier } from "@/lib/types";

function groupBy<T>(items: T[], key: (t: T) => string) {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it) || "—";
    (m.get(k) ?? m.set(k, []).get(k)!).push(it);
  }
  return m;
}

export default function KynReportSection({ suppliers, batches }: { suppliers: Supplier[]; batches: Batch[] }) {
  const supById = new Map<string, Supplier>(suppliers.map((s) => [s.id, s]));
  const computed = batches.filter((b) => b.status === "computed");
  const submitted = batches.filter((b) => b.status === "submitted").length;

  const totalFlowers = computed.reduce((n, b) => n + b.flowerCount, 0);
  const totalCo2e = computed.reduce((n, b) => n + b.co2ePerFlower * b.flowerCount, 0);
  const avgCo2e = computed.length ? computed.reduce((n, b) => n + b.co2ePerFlower, 0) / computed.length : 0;

  const flowerSeries = buildMonthSeries(computed, (b) => b.cutDate, (b) => b.flowerCount, 5);
  const co2eSeries = buildMonthSeries(computed, (b) => b.cutDate, (b) => b.co2ePerFlower * b.flowerCount, 5);

  const province = [...groupBy(computed, (b) => b.destination ?? "—")].map(([p, bs]) => {
    const flowers = bs.reduce((n, b) => n + b.flowerCount, 0);
    const co2e = bs.reduce((n, b) => n + b.co2ePerFlower * b.flowerCount, 0);
    return { province: p, rounds: bs.length, flowers, km: bs.reduce((n, b) => n + b.distanceKm, 0) / bs.length, perFlower: flowers ? co2e / flowers : 0 };
  }).sort((a, b) => b.flowers - a.flowers);

  const typeTotal = totalFlowers || 1;
  const types = [...groupBy(computed, (b) => supById.get(b.supplierId)?.flowerType ?? "—")].map(([type, bs]) => {
    const flowers = bs.reduce((n, b) => n + b.flowerCount, 0);
    return { type, flowers, avg: bs.reduce((n, b) => n + b.co2ePerFlower, 0) / bs.length, pct: Math.round((flowers / typeTotal) * 100) };
  }).sort((a, b) => b.flowers - a.flowers);

  const fTotal = Math.max(1, computed.length);
  const freshness = [
    { label: "0-1 วัน", test: (a: number) => a <= 1 },
    { label: "2-3 วัน", test: (a: number) => a >= 2 && a <= 3 },
    { label: "4+ วัน", test: (a: number) => a >= 4 },
  ].map((bk) => { const count = computed.filter((b) => bk.test(b.ageDays)).length; return { label: bk.label, count, pct: Math.round((count / fTotal) * 100) }; });

  const ranking = suppliers.map((s) => {
    const bs = computed.filter((b) => b.supplierId === s.id);
    const avg = bs.length ? bs.reduce((n, b) => n + b.co2ePerFlower, 0) / bs.length : Infinity;
    return { name: s.farmName, rounds: bs.length, avg };
  }).filter((r) => Number.isFinite(r.avg)).sort((a, b) => a.avg - b.avg);

  // ประเภทการจัดส่ง / ดอกไม้คัดทิ้ง (#99) — logistics throughput recorded on /logistic/status.
  // Wasted CO2e uses co2ePerFlower (0 unless computed), so non-computed rounds add 0 — no false carbon claim.
  const recorded = batches.filter((b) => b.discardedCount != null || b.forwardedCount != null);
  const discardRows = [...groupBy(recorded, (b) => `${b.provider || b.carrier || "—"}||${b.supplierId}`)].map(([key, bs]) => {
    const [provider, supId] = key.split("||");
    const received = bs.reduce((n, b) => n + b.flowerCount, 0);
    const forwarded = bs.reduce((n, b) => n + (b.forwardedCount ?? 0), 0);
    const discarded = bs.reduce((n, b) => n + (b.discardedCount ?? 0), 0);
    const wastedCo2e = bs.reduce((n, b) => n + (b.discardedCount ?? 0) * b.co2ePerFlower, 0);
    return {
      provider, farm: supById.get(supId)?.farmName ?? supId,
      received, forwarded, discarded, remaining: Math.max(0, received - forwarded - discarded),
      rate: received ? (discarded / received) * 100 : 0, wastedCo2e,
    };
  }).sort((a, b) => b.discarded - a.discarded);
  const totalReceived = discardRows.reduce((n, r) => n + r.received, 0);
  const totalDiscarded = discardRows.reduce((n, r) => n + r.discarded, 0);
  const totalWasted = discardRows.reduce((n, r) => n + r.wastedCo2e, 0);
  const discard = {
    rows: discardRows, totalReceived, totalDiscarded, totalWasted,
    avgRate: totalReceived ? (totalDiscarded / totalReceived) * 100 : 0,
  };

  const data: ReportData = { province, types, freshness, ranking, discard };
  const csvRows = computed.map((b: Batch) => ({
    Batch: b.id, ฟาร์ม: supById.get(b.supplierId)?.farmName ?? "", พันธุ์: b.variety ?? "",
    จังหวัด: supById.get(b.supplierId)?.province ?? "", ปลายทาง: b.destination ?? "",
    ดอก: b.flowerCount, ระยะทางกม: b.distanceKm, อายุวัน: b.ageDays,
    "CO2e/ดอก": Number(b.co2ePerFlower.toFixed(4)), "CO2e รวม": Number((b.co2ePerFlower * b.flowerCount).toFixed(2)),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">รายงานสรุป</h1>
        <div className="flex items-center gap-2">
          <select className="rounded-[5px] border border-gray-300 bg-white px-3 py-2 text-[13px] text-slate-700 outline-none"><option>ทุกฟาร์ม</option></select>
          <select className="rounded-[5px] border border-gray-300 bg-white px-3 py-2 text-[13px] text-slate-700 outline-none"><option>รายเดือน</option></select>
          <ExportCsvButton rows={csvRows} filename="klora-report.csv" />
        </div>
      </div>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="จำนวน Shipment" value={computed.length.toLocaleString()} unit="รอบ" tone="blue" icon={<Truck size={20} />} note="อัปเดตล่าสุด : วันนี้" />
        <MetricCard label="CO₂e เฉลี่ยต่อดอก" value={avgCo2e.toFixed(4)} unit="กิโลกรัม" tone="green" icon={<Leaf size={20} />} note="อัปเดตล่าสุด : วันนี้" />
        <MetricCard label="การปล่อย CO₂e รวม" value={totalCo2e.toFixed(1)} unit="กิโลกรัม" tone="blue" icon={<Cloud size={20} />} note="อัปเดตล่าสุด : วันนี้" />
        <MetricCard label="รอประมาณผล" value={submitted} unit="รายการ" tone="orange" icon={<Clock size={20} />} note="อัปเดตล่าสุด : วันนี้" />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 text-base font-semibold text-slate-800">แนวโน้มจำนวนดอกไม้</h2>
          <BarChart data={flowerSeries} barClassName="bg-brand-purple/85" />
        </Card>
        <Card className="p-5">
          <h2 className="mb-4 text-base font-semibold text-slate-800">แนวโน้มการปล่อย CO₂e</h2>
          <BarChart data={co2eSeries} barClassName="bg-blue-500/90" />
        </Card>
      </div>

      <ReportTabs data={data} />
    </div>
  );
}
