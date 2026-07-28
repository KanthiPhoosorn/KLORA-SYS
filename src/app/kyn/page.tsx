import Link from "next/link";
import { getBatches, getSuppliers } from "@/lib/store";
import { FACTORS, FACTOR_LABELS } from "@/lib/carbon";
import { StatCard, Card, CardHeader, Bar, Badge } from "@/components/ui";
import { freshnessTone } from "@/lib/status";
import { Leaf, ArrowUpRight, SlidersHorizontal } from "lucide-react";
import type { Supplier } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function KynOverview() {
  const [batches, suppliers] = await Promise.all([getBatches(), getSuppliers()]);
  const byId = new Map<string, Supplier>(suppliers.map((s) => [s.id, s]));
  const computed = batches.filter((b) => b.status === "computed");

  const rows = [...computed].sort((a, b) => b.id.localeCompare(a.id));
  const totalFlowers = computed.reduce((n, b) => n + b.flowerCount, 0);
  const totalCo2e = computed.reduce((n, b) => n + b.co2ePerFlower * b.flowerCount, 0);
  const avgCo2e = computed.length
    ? computed.reduce((n, b) => n + b.co2ePerFlower, 0) / computed.length
    : 0;

  const perFarm = suppliers
    .map((s) => ({
      s,
      total: computed
        .filter((b) => b.supplierId === s.id)
        .reduce((n, b) => n + b.co2ePerFlower * b.flowerCount, 0),
    }))
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);
  const maxFarm = Math.max(1, ...perFarm.map((r) => r.total));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">ภาพรวมระบบ</h1>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="รอบการตัด" value={computed.length} accent="blue" />
        <StatCard label="ดอกไม้รวม" value={totalFlowers.toLocaleString()} unit="ดอก" accent="orange" />
        <StatCard label="CO₂E รวม" value={totalCo2e.toFixed(1)} unit="kg" />
        <StatCard label="CO₂E เฉลี่ย/ดอก" value={avgCo2e.toFixed(4)} unit="kg" accent="green" />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            icon={<Leaf size={18} />}
            title="ผลการคำนวณรายรอบ"
            subtitle="data ที่ต้องคำนวณ (คาร์บอน + อายุ)"
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2 font-medium">Batch</th>
                  <th className="px-4 py-2 font-medium">ฟาร์ม</th>
                  <th className="px-4 py-2 text-right font-medium">ดอก</th>
                  <th className="px-4 py-2 text-right font-medium">ระยะทาง</th>
                  <th className="px-4 py-2 text-right font-medium">อายุ</th>
                  <th className="px-4 py-2 text-right font-medium">CO₂E/ดอก</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      ยังไม่มีข้อมูลที่คำนวณแล้ว
                    </td>
                  </tr>
                ) : (
                  rows.map((b) => {
                    const s = byId.get(b.supplierId);
                    return (
                      <tr key={b.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{b.id}</td>
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-slate-800">{s?.farmName ?? "—"}</div>
                          <div className="text-xs text-slate-400">{s?.flowerType ?? b.supplierId}</div>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular">{b.flowerCount.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right tabular">{b.distanceKm} km</td>
                        <td className="px-4 py-2.5 text-right">
                          <Badge tone={freshnessTone(b.ageDays)}>{b.ageDays} วัน</Badge>
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold tabular text-slate-800">
                          {b.co2ePerFlower.toFixed(4)}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <Link href={`/trace/${b.id}`} className="inline-flex text-slate-400 hover:text-blue-600">
                            <ArrowUpRight size={16} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="CO₂e รวมรายฟาร์ม" subtitle="kg CO₂e" />
            <div className="space-y-3 px-5 py-4">
              {perFarm.length === 0 ? (
                <p className="text-sm text-slate-400">ยังไม่มีข้อมูล</p>
              ) : (
                perFarm.map(({ s, total }) => (
                  <div key={s.id} className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-600">{s.farmName}</span>
                      <span className="font-semibold tabular text-slate-800">{total.toFixed(1)}</span>
                    </div>
                    <Bar value={total} max={maxFarm} />
                  </div>
                ))
              )}
            </div>
          </Card>

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
                    <tr key={k} className="border-b border-slate-50 last:border-0">
                      <td className="py-1.5 text-slate-600">{FACTOR_LABELS[k]}</td>
                      <td className="py-1.5 text-right font-semibold tabular text-slate-800">{FACTORS[k]}</td>
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
