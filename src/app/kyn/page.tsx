import Link from "next/link";
import { getBatches, getSuppliers } from "@/lib/store";
import { FACTORS, FACTOR_LABELS } from "@/lib/carbon";
import { Card, CardHeader, Stat, Bar, Badge } from "@/components/ui";
import { Factory, Leaf, ArrowUpRight, SlidersHorizontal } from "lucide-react";
import type { Supplier } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function KynPage() {
  const [batches, suppliers] = await Promise.all([
    getBatches(),
    getSuppliers(),
  ]);
  const byId = new Map<string, Supplier>(suppliers.map((s) => [s.id, s]));

  const rows = [...batches]
    .reverse()
    .map((b) => ({ b, s: byId.get(b.supplierId) ?? null }));

  const totalFlowers = batches.reduce((n, b) => n + b.flowerCount, 0);
  const totalCo2e = batches.reduce(
    (n, b) => n + b.co2ePerFlower * b.flowerCount,
    0,
  );
  const avgCo2e =
    batches.length > 0
      ? batches.reduce((n, b) => n + b.co2ePerFlower, 0) / batches.length
      : 0;

  // Total CO2e grouped by farm (for the bar breakdown).
  const perFarm = suppliers
    .map((s) => {
      const total = batches
        .filter((b) => b.supplierId === s.id)
        .reduce((n, b) => n + b.co2ePerFlower * b.flowerCount, 0);
      return { s, total };
    })
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);
  const maxFarm = Math.max(1, ...perFarm.map((r) => r.total));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-emerald-950">
          <Factory className="text-emerald-600" /> กลางน้ำ · KYN×Outsource
        </h1>
        <p className="mt-1 text-emerald-900/60">
          รับข้อมูล SUP → คัดแยก → คำนวณคาร์บอน + อายุดอกไม้ → รวบรวมและแสดงผล
        </p>
      </div>

      {/* Aggregate */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="รอบการตัด" value={batches.length} tone="blue" />
        <Stat label="ดอกไม้รวม" value={totalFlowers.toLocaleString()} unit="ดอก" tone="amber" />
        <Stat label="CO₂e รวม" value={totalCo2e.toFixed(1)} unit="kg" />
        <Stat label="CO₂e เฉลี่ย/ดอก" value={avgCo2e.toFixed(4)} unit="kg" />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Results table */}
        <Card className="lg:col-span-2">
          <CardHeader
            icon={<Leaf size={18} />}
            title="ผลการคำนวณรายรอบ"
            subtitle="data ที่ต้องคำนวณ (คาร์บอน + อายุ)"
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-emerald-900/10 text-left text-xs uppercase tracking-wide text-emerald-900/50">
                  <th className="px-4 py-2 font-medium">Batch</th>
                  <th className="px-4 py-2 font-medium">ฟาร์ม</th>
                  <th className="px-4 py-2 text-right font-medium">ดอก</th>
                  <th className="px-4 py-2 text-right font-medium">ระยะทาง</th>
                  <th className="px-4 py-2 text-right font-medium">อายุ</th>
                  <th className="px-4 py-2 text-right font-medium">CO₂e/ดอก</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-emerald-900/50">
                      ยังไม่มีข้อมูลรอบการตัด
                    </td>
                  </tr>
                ) : (
                  rows.map(({ b, s }) => (
                    <tr
                      key={b.id}
                      className="border-b border-emerald-900/5 hover:bg-emerald-50/50"
                    >
                      <td className="px-4 py-2.5 font-mono text-xs text-emerald-700">
                        {b.id}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-emerald-950">
                          {s?.farmName ?? "—"}
                        </div>
                        <div className="text-xs text-emerald-900/50">
                          {s?.flowerType ?? b.supplierId}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular">
                        {b.flowerCount.toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular">
                        {b.distanceKm} km
                      </td>
                      <td className="px-4 py-2.5 text-right tabular">
                        <Badge tone={b.ageDays <= 2 ? "green" : b.ageDays <= 5 ? "amber" : "red"}>
                          {b.ageDays} วัน
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular text-emerald-700">
                        {b.co2ePerFlower.toFixed(4)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Link
                          href={`/trace/${b.id}`}
                          className="inline-flex text-emerald-500 hover:text-emerald-700"
                        >
                          <ArrowUpRight size={16} />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-6">
          {/* Per-farm breakdown */}
          <Card>
            <CardHeader title="CO₂e รวมรายฟาร์ม" subtitle="kg CO₂e" />
            <div className="space-y-3 px-5 py-4">
              {perFarm.length === 0 ? (
                <p className="text-sm text-emerald-900/50">ยังไม่มีข้อมูล</p>
              ) : (
                perFarm.map(({ s, total }) => (
                  <div key={s.id} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-emerald-900/70">{s.farmName}</span>
                      <span className="font-semibold tabular text-emerald-700">
                        {total.toFixed(1)}
                      </span>
                    </div>
                    <Bar value={total} max={maxFarm} />
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Emission factors */}
          <Card>
            <CardHeader
              icon={<SlidersHorizontal size={18} />}
              title="ค่าสัมประสิทธิ์คาร์บอน"
              subtitle="Emission factors (แก้ได้ใน carbon.ts)"
            />
            <div className="px-5 py-4">
              <table className="w-full text-sm">
                <tbody>
                  {(Object.keys(FACTORS) as (keyof typeof FACTORS)[]).map((k) => (
                    <tr key={k} className="border-b border-emerald-900/5 last:border-0">
                      <td className="py-1.5 text-emerald-900/70">
                        {FACTOR_LABELS[k]}
                      </td>
                      <td className="py-1.5 text-right font-semibold tabular text-emerald-800">
                        {FACTORS[k]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
