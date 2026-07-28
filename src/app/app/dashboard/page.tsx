import { requireUser } from "@/lib/auth";
import { getSupplier, getBatches, getSuppliers } from "@/lib/store";
import { sourceBreakdown } from "@/lib/carbon";
import { StatCard, Card, Bar } from "@/components/ui";
import { thaiDateShort } from "@/lib/format";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import type { Batch, Supplier } from "@/lib/types";

export const dynamic = "force-dynamic";

// Average co2e/flower per Bangkok month, for computed batches.
function monthlyAvg(batches: Batch[]): Map<string, number> {
  const acc = new Map<string, { sum: number; n: number }>();
  for (const b of batches) {
    const key = b.cutDate.slice(0, 7); // YYYY-MM
    const cur = acc.get(key) ?? { sum: 0, n: 0 };
    cur.sum += b.co2ePerFlower;
    cur.n += 1;
    acc.set(key, cur);
  }
  return new Map([...acc].map(([k, v]) => [k, v.sum / v.n]));
}

export default async function CarbonDashboard() {
  const user = await requireUser();
  const [supplier, allBatches, suppliers] = await Promise.all([
    getSupplier(user.supplierId),
    getBatches(),
    getSuppliers(),
  ]);

  const computed = allBatches.filter(
    (b) => b.supplierId === user.supplierId && b.status === "computed",
  );
  const avgCo2e = computed.length
    ? computed.reduce((n, b) => n + b.co2ePerFlower, 0) / computed.length
    : 0;

  // Month-over-month change (lower is better).
  const monthly = monthlyAvg(computed);
  const months = [...monthly.keys()].sort();
  let momPct: number | null = null;
  if (months.length >= 2) {
    const cur = monthly.get(months[months.length - 1])!;
    const prev = monthly.get(months[months.length - 2])!;
    if (prev > 0) momPct = ((cur - prev) / prev) * 100;
  }

  // Rank among farms by average co2e/flower (ascending — lower = greener).
  const farmAvgs = suppliers
    .map((s: Supplier) => {
      const bs = allBatches.filter((b) => b.supplierId === s.id && b.status === "computed");
      const avg = bs.length ? bs.reduce((n, b) => n + b.co2ePerFlower, 0) / bs.length : Infinity;
      return { id: s.id, avg };
    })
    .filter((f) => Number.isFinite(f.avg))
    .sort((a, b) => a.avg - b.avg);
  const rank = farmAvgs.findIndex((f) => f.id === user.supplierId) + 1;
  const topPct = rank > 0 && farmAvgs.length ? Math.max(1, Math.round((rank / farmAvgs.length) * 100)) : null;

  const bySource = sourceBreakdown(
    computed,
    () => supplier ?? undefined,
  );
  const sources = [
    { label: "การขนส่ง", pct: bySource.pct.transport },
    { label: "การปลูก (ปุ๋ย/ไฟฟ้า)", pct: bySource.pct.planting },
    { label: "บรรจุภัณฑ์/ตะกร้า", pct: bySource.pct.basket },
  ];

  const rounds = [...computed].sort((a, b) => b.cutDate.localeCompare(a.cutDate));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">แดชบอร์ดคาร์บอน</h1>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="CO2e/ดอก เฉลี่ย" value={avgCo2e.toFixed(3)} unit="กก." accent="blue" />
        <Card className="px-5 py-4">
          <div className="text-xs font-medium text-slate-500">เทียบเดือนก่อน</div>
          <div className="mt-1.5 flex items-center gap-1.5 text-2xl font-bold tabular">
            {momPct == null ? (
              <span className="text-slate-400">—</span>
            ) : momPct < 0 ? (
              <span className="flex items-center gap-1 text-emerald-600">
                <TrendingDown size={22} /> {Math.abs(momPct).toFixed(0)}%
              </span>
            ) : momPct > 0 ? (
              <span className="flex items-center gap-1 text-red-600">
                <TrendingUp size={22} /> {momPct.toFixed(0)}%
              </span>
            ) : (
              <span className="flex items-center gap-1 text-slate-500">
                <Minus size={22} /> 0%
              </span>
            )}
          </div>
        </Card>
        <StatCard
          label="อันดับเทียบฟาร์มอื่น"
          value={topPct == null ? "—" : `Top ${topPct}%`}
          accent="green"
        />
      </section>

      <Card className="p-5">
        <h2 className="mb-4 text-base font-semibold text-slate-800">สัดส่วนที่มาของคาร์บอน</h2>
        {bySource.total === 0 ? (
          <p className="text-sm text-slate-400">ยังไม่มีข้อมูลที่คำนวณแล้ว</p>
        ) : (
          <div className="space-y-3">
            {sources.map((s) => (
              <div key={s.label} className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">{s.label}</span>
                  <span className="font-semibold tabular text-slate-800">{s.pct}%</span>
                </div>
                <Bar value={s.pct} max={100} />
              </div>
            ))}
          </div>
        )}
      </Card>

      <div>
        <h2 className="mb-2 text-base font-semibold text-slate-800">รายละเอียดตามรอบ</h2>
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-2.5 font-medium">วันที่</th>
                <th className="px-5 py-2.5 text-right font-medium">จำนวน</th>
                <th className="px-5 py-2.5 text-right font-medium">CO2e รวม</th>
                <th className="px-5 py-2.5 text-right font-medium">CO2e/ดอก</th>
              </tr>
            </thead>
            <tbody>
              {rounds.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-slate-400">
                    ยังไม่มีรอบที่คำนวณแล้ว
                  </td>
                </tr>
              ) : (
                rounds.map((b) => (
                  <tr key={b.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-5 py-2.5 text-slate-700">{thaiDateShort(b.cutDate)}</td>
                    <td className="px-5 py-2.5 text-right tabular">{b.flowerCount.toLocaleString()}</td>
                    <td className="px-5 py-2.5 text-right tabular">
                      {(b.co2ePerFlower * b.flowerCount).toFixed(1)} กก.
                    </td>
                    <td className="px-5 py-2.5 text-right font-semibold tabular text-slate-800">
                      {b.co2ePerFlower.toFixed(3)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
