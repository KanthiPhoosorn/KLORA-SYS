import { MetricCard, Card, BarChart } from "@/components/ui";
import ExportCsvButton from "@/components/ExportCsvButton";
import { Truck, Leaf, Cloud, Clock } from "lucide-react";
import ReportTabs, { type ReportData } from "@/components/ReportTabs";
import { buildMonthSeries, DASH } from "@/lib/format";
import type { Batch, Supplier } from "@/lib/types";
import { batchCo2e, quantityLabel, perUnitLabel } from "@/lib/produce";
import { amountsOf, amountOf, amountText, amountUnit, avgCo2e as avgOf, modeFor, perLabel, unitMode, unitColumns } from "@/lib/amounts";
import type { KynFilter } from "@/lib/kyn-filter";
import { KynCategoryChips, KynFarmPeriod } from "@/components/KynFilters";

function groupBy<T>(items: T[], key: (t: T) => string) {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it) || "–";
    (m.get(k) ?? m.set(k, []).get(k)!).push(it);
  }
  return m;
}

// รายงานสรุป. `batches` arrive already filtered (ประเภทสินค้า / ฟาร์ม / ช่วงเวลา, lib/kyn-filter.ts); amounts and
// averages follow the unit of what is shown (lib/amounts.ts): ดอก for flowers, กก. for fruit and vegetables,
// and per รอบ when the view mixes them.
export default function KynReportSection({ suppliers, batches, filter, farms }: { suppliers: Supplier[]; batches: Batch[]; filter: KynFilter; farms: { id: string; name: string }[] }) {
  const supById = new Map<string, Supplier>(suppliers.map((s) => [s.id, s]));
  const computed = batches.filter((b) => b.status === "computed");
  const submitted = batches.filter((b) => b.status === "submitted").length;
  const mode = modeFor(unitMode(computed), filter.cat);
  const mixed = mode === "mixed";
  const per = perLabel(mode);
  // the size of a lot for bars and trends: its amount in the one unit shown, or 1 รอบ when units mix
  const size = (b: Batch) => (mixed ? 1 : amountOf(b));

  const totalCo2e = computed.reduce((n, b) => n + batchCo2e(b), 0);
  const avgCo2e = avgOf(computed, mode); // none → "–"

  const amountSeries = buildMonthSeries(computed, (b) => b.cutDate, size, 5);
  const co2eSeries = buildMonthSeries(computed, (b) => b.cutDate, (b) => batchCo2e(b), 5);
  const trendTitle = mixed ? "แนวโน้มจำนวนรอบ" : mode === "kg" ? "แนวโน้มน้ำหนักสินค้า (กก.)" : "แนวโน้มจำนวนดอกไม้";

  const province = [...groupBy(computed, (b) => b.destination ?? "–")].map(([p, bs]) => {
    const co2eBy: Partial<Record<ReturnType<typeof amountUnit>, number>> = {};
    for (const b of bs) co2eBy[amountUnit(b)] = (co2eBy[amountUnit(b)] ?? 0) + batchCo2e(b);
    return { province: p, rounds: bs.length, amount: bs.reduce((n, b) => n + size(b), 0), km: bs.reduce((n, b) => n + b.distanceKm, 0) / bs.length, amounts: amountsOf(bs), co2eBy };
  }).sort((a, b) => b.amount - a.amount);

  // product types: the lot's own ชนิด (a farm may grow several); each type keeps its own unit
  const typeTotal = computed.reduce((n, b) => n + size(b), 0);
  const types = [...groupBy(computed, (b) => b.productType ?? supById.get(b.supplierId)?.flowerType ?? "–")].map(([type, bs]) => {
    const amount = bs.reduce((n, b) => n + size(b), 0);
    return { type, amount, amountText: amountText(amountsOf(bs), "mixed"), avg: bs.reduce((n, b) => n + b.co2ePerFlower, 0) / bs.length, per: perUnitLabel(bs[0]).replace("ต่อ", ""), pct: typeTotal ? Math.round((amount / typeTotal) * 100) : 0 };
  }).sort((a, b) => b.amount - a.amount);

  const fTotal = Math.max(1, computed.length);
  const freshness = [
    { label: "0-1 วัน", test: (a: number) => a <= 1 },
    { label: "2-3 วัน", test: (a: number) => a >= 2 && a <= 3 },
    { label: "4+ วัน", test: (a: number) => a >= 4 },
  ].map((bk) => { const count = computed.filter((b) => bk.test(b.ageDays)).length; return { label: bk.label, count, pct: Math.round((count / fTotal) * 100) }; });

  const ranking = suppliers.map((s) => {
    const bs = computed.filter((b) => b.supplierId === s.id);
    return { name: s.farmName, rounds: bs.length, avg: avgOf(bs, mode) ?? Infinity };
  }).filter((r) => Number.isFinite(r.avg)).sort((a, b) => a.avg - b.avg);

  // ประเภทการจัดส่ง / ดอกไม้คัดทิ้ง (#99) — logistics throughput recorded on /logistic/status.
  // Wasted CO2e uses co2ePerFlower (0 unless computed), so non-computed rounds add 0 — no false carbon claim.
  const recorded = batches.filter((b) => b.discardedCount != null || b.forwardedCount != null);
  const discardRows = [...groupBy(recorded, (b) => `${b.provider || b.carrier || "–"}||${b.supplierId}`)].map(([key, bs]) => {
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

  const units = {
    keys: unitColumns(unitMode(computed), province.map((p) => p.amounts), modeFor(null, filter.cat) as Exclude<ReturnType<typeof modeFor>, "mixed">),
    per,
    typesTab: filter.cat === "flower" ? "สัดส่วนประเภทดอกไม้" : "สัดส่วนประเภทสินค้า",
  };
  const data: ReportData = { province, types, freshness, ranking, discard, units };
  const csvRows = computed.map((b: Batch) => ({
    Batch: b.id, ฟาร์ม: supById.get(b.supplierId)?.farmName ?? "", พันธุ์: b.variety ?? "",
    จังหวัด: supById.get(b.supplierId)?.province ?? "", ปลายทาง: b.destination ?? "",
    จำนวน: quantityLabel(b), ประเภท: b.productCategory ?? "flower", ชนิด: b.productType ?? "", ระยะทางกม: b.distanceKm, อายุวัน: b.ageDays,
    "CO2e/หน่วย": Number(b.co2ePerFlower.toFixed(4)), หน่วย: perUnitLabel(b).replace("ต่อ", ""), "CO2e รวม": Number((batchCo2e(b)).toFixed(2)),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">รายงานสรุป</h1>
        <div className="flex flex-wrap items-center gap-2">
          <KynFarmPeriod value={filter} farms={farms} />
          <ExportCsvButton rows={csvRows} filename="klora-report.csv" />
        </div>
      </div>
      <KynCategoryChips value={filter} />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="จำนวน Shipment" value={computed.length.toLocaleString()} unit="รอบ" tone="blue" icon={<Truck size={20} />} note="อัปเดตล่าสุด : วันนี้" />
        <MetricCard label={`CO₂e เฉลี่ยต่อ${per}`} value={avgCo2e == null ? DASH : avgCo2e.toFixed(mixed ? 2 : 4)} unit={avgCo2e == null ? undefined : "กิโลกรัม"} tone="green" icon={<Leaf size={20} />} note="อัปเดตล่าสุด : วันนี้" />
        <MetricCard label="การปล่อย CO₂e รวม" value={totalCo2e.toFixed(1)} unit="กิโลกรัม" tone="blue" icon={<Cloud size={20} />} note="อัปเดตล่าสุด : วันนี้" />
        <MetricCard label="รอประมาณผล" value={submitted} unit="รายการ" tone="orange" icon={<Clock size={20} />} note="อัปเดตล่าสุด : วันนี้" />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 text-base font-semibold text-slate-800">{trendTitle}</h2>
          <BarChart data={amountSeries} barClassName="bg-brand-purple/85" />
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
