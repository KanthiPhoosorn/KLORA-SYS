import { StatCard, Card, Bar, BarChart } from "@/components/ui";
import ExportCsvButton from "@/components/ExportCsvButton";
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

export default function KynReportSection({
  suppliers,
  batches,
}: {
  suppliers: Supplier[];
  batches: Batch[];
}) {
  const supById = new Map<string, Supplier>(suppliers.map((s) => [s.id, s]));
  const computed = batches.filter((b) => b.status === "computed");

  const totalFlowers = computed.reduce((n, b) => n + b.flowerCount, 0);
  const totalCo2e = computed.reduce((n, b) => n + b.co2ePerFlower * b.flowerCount, 0);
  const avgAge = computed.length ? computed.reduce((n, b) => n + b.ageDays, 0) / computed.length : 0;
  const activeFarms = suppliers.filter((s) => s.status === "active").length;

  const co2eSeries = buildMonthSeries(computed, (b) => b.cutDate, (b) => b.co2ePerFlower * b.flowerCount, 5);

  const byProvince = [...groupBy(computed, (b) => b.destination ?? "—")]
    .map(([province, bs]) => {
      const flowers = bs.reduce((n, b) => n + b.flowerCount, 0);
      const co2e = bs.reduce((n, b) => n + b.co2ePerFlower * b.flowerCount, 0);
      const km = bs.reduce((n, b) => n + b.distanceKm, 0) / bs.length;
      return { province, rounds: bs.length, flowers, km, perFlower: flowers ? co2e / flowers : 0 };
    })
    .sort((a, b) => b.flowers - a.flowers);

  const byType = [...groupBy(computed, (b) => supById.get(b.supplierId)?.flowerType ?? "—")]
    .map(([type, bs]) => ({
      type,
      flowers: bs.reduce((n, b) => n + b.flowerCount, 0),
      avg: bs.reduce((n, b) => n + b.co2ePerFlower, 0) / bs.length,
    }))
    .sort((a, b) => b.flowers - a.flowers);
  const maxType = Math.max(1, ...byType.map((t) => t.flowers));

  const buckets = [
    { label: "0-1 วัน", test: (a: number) => a <= 1 },
    { label: "2-3 วัน", test: (a: number) => a >= 2 && a <= 3 },
    { label: "4+ วัน", test: (a: number) => a >= 4 },
  ].map((bk) => ({ label: bk.label, count: computed.filter((b) => bk.test(b.ageDays)).length }));
  const freshTotal = Math.max(1, computed.length);

  const ranking = suppliers
    .map((s) => {
      const bs = computed.filter((b) => b.supplierId === s.id);
      const avg = bs.length ? bs.reduce((n, b) => n + b.co2ePerFlower, 0) / bs.length : Infinity;
      return { s, avg, rounds: bs.length };
    })
    .filter((r) => Number.isFinite(r.avg))
    .sort((a, b) => a.avg - b.avg);

  const csvRows = computed.map((b: Batch) => ({
    Batch: b.id,
    ฟาร์ม: supById.get(b.supplierId)?.farmName ?? "",
    พันธุ์: b.variety ?? "",
    จังหวัด: supById.get(b.supplierId)?.province ?? "",
    ปลายทาง: b.destination ?? "",
    ดอก: b.flowerCount,
    ระยะทางกม: b.distanceKm,
    อายุวัน: b.ageDays,
    "CO2e/ดอก": Number(b.co2ePerFlower.toFixed(4)),
    "CO2e รวม": Number((b.co2ePerFlower * b.flowerCount).toFixed(2)),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">รายงานสรุป</h1>
        <ExportCsvButton rows={csvRows} filename="klora-report.csv" />
      </div>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="ดอกไม้รวม (ก้าน)" value={totalFlowers.toLocaleString()} />
        <StatCard label="CO2e รวม (กก.)" value={totalCo2e.toFixed(1)} accent="blue" />
        <StatCard label="ระยะเวลาเฉลี่ย (วัน)" value={avgAge.toFixed(1)} accent="orange" />
        <StatCard label="ฟาร์ม active" value={`${activeFarms} / ${suppliers.length}`} accent="green" />
      </section>

      <Card className="p-5">
        <h2 className="mb-4 text-base font-semibold text-slate-800">แนวโน้ม CO2e รายเดือน (กก.)</h2>
        <BarChart data={co2eSeries} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="overflow-x-auto">
          <div className="border-b border-slate-100 px-5 py-3 text-base font-semibold text-slate-800">สถิติจังหวัดปลายทาง</div>
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-2 font-medium">จังหวัด</th>
                <th className="px-5 py-2 text-right font-medium">รอบ</th>
                <th className="px-5 py-2 text-right font-medium">ดอกไม้</th>
                <th className="px-5 py-2 text-right font-medium">กม.เฉลี่ย</th>
                <th className="px-5 py-2 text-right font-medium">CO2e/ดอก</th>
              </tr>
            </thead>
            <tbody>
              {byProvince.map((r) => (
                <tr key={r.province} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-2 text-slate-700">{r.province}</td>
                  <td className="px-5 py-2 text-right tabular">{r.rounds}</td>
                  <td className="px-5 py-2 text-right tabular">{r.flowers.toLocaleString()}</td>
                  <td className="px-5 py-2 text-right tabular">{Math.round(r.km)}</td>
                  <td className="px-5 py-2 text-right tabular">{r.perFlower.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-base font-semibold text-slate-800">สัดส่วนประเภทดอกไม้</h2>
          <div className="space-y-3">
            {byType.map((t) => (
              <div key={t.type} className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">{t.type}</span>
                  <span className="tabular text-slate-500">{t.flowers.toLocaleString()} · {t.avg.toFixed(3)} กก./ดอก</span>
                </div>
                <Bar value={t.flowers} max={maxType} />
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-base font-semibold text-slate-800">การกระจายความสด (ระยะเวลาหลังตัด)</h2>
          <div className="space-y-3">
            {buckets.map((bk) => (
              <div key={bk.label} className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">{bk.label}</span>
                  <span className="font-semibold tabular text-slate-800">{Math.round((bk.count / freshTotal) * 100)}%</span>
                </div>
                <Bar value={bk.count} max={freshTotal} className="bg-emerald-500" />
              </div>
            ))}
          </div>
        </Card>

        <Card className="overflow-x-auto">
          <div className="border-b border-slate-100 px-5 py-3 text-base font-semibold text-slate-800">อันดับฟาร์มที่ปล่อยคาร์บอนต่ำสุด</div>
          <table className="w-full min-w-[360px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-2 font-medium">#</th>
                <th className="px-5 py-2 font-medium">ฟาร์ม</th>
                <th className="px-5 py-2 text-right font-medium">รอบ</th>
                <th className="px-5 py-2 text-right font-medium">CO2e/ดอก</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((r, i) => (
                <tr key={r.s.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-2 tabular text-slate-500">{i + 1}</td>
                  <td className="px-5 py-2 text-slate-700">{r.s.farmName}</td>
                  <td className="px-5 py-2 text-right tabular">{r.rounds}</td>
                  <td className="px-5 py-2 text-right font-semibold tabular text-emerald-600">{r.avg.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
