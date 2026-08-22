import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getSuppliers, getBatches, getPrints } from "@/lib/store";
import { FACTORS, FACTOR_LABELS } from "@/lib/carbon";
import { MetricCard, Card, Donut, DONUT_COLORS } from "@/components/ui";
import { isSameBangkokDay } from "@/lib/format";
import { Printer, Search, MapPin, Scissors, Package, Cloud, Boxes } from "lucide-react";
import type { Supplier } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LogisticDashboard() {
  await requireRole("logistic");
  const [suppliers, batches, prints] = await Promise.all([getSuppliers(), getBatches(), getPrints()]);
  const byId = new Map<string, Supplier>(suppliers.map((s) => [s.id, s]));
  const computed = batches.filter((b) => b.status === "computed");

  const nowIso = new Date().toISOString();
  const printedToday = prints.filter((p) => !p.cancelled && isSameBangkokDay(p.printedAt, nowIso)).length;
  const printedBatchIds = new Set(prints.filter((p) => !p.cancelled).map((p) => p.batchId));
  const waiting = computed.filter((b) => !printedBatchIds.has(b.id)).length;
  const sortingPoints = new Set(prints.filter((p) => p.sortingPoint).map((p) => p.sortingPoint)).size;

  const totalFlowers = computed.reduce((n, b) => n + b.flowerCount, 0);
  const totalCo2e = computed.reduce((n, b) => n + b.co2ePerFlower * b.flowerCount, 0);
  const avgCo2e = computed.length ? computed.reduce((n, b) => n + b.co2ePerFlower, 0) / computed.length : 0;

  // CO2e by farm → donut
  const perFarm = suppliers
    .map((s) => ({ s, total: computed.filter((b) => b.supplierId === s.id).reduce((n, b) => n + b.co2ePerFlower * b.flowerCount, 0) }))
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);
  const farmTotal = perFarm.reduce((n, r) => n + r.total, 0) || 1;
  const segments = perFarm.slice(0, 6).map((r, i) => ({
    label: r.s.farmName,
    pct: Math.round((r.total / farmTotal) * 100),
    color: DONUT_COLORS[i % DONUT_COLORS.length],
  }));

  const rows = [...computed].sort((a, b) => b.id.localeCompare(a.id));

  return (
    <div className="space-y-6">
      {/* Banner + today tiles */}
      <div className="rounded-2xl bg-gradient-to-r from-blue-50 via-indigo-50 to-emerald-50 p-6">
        <div className="grid gap-4 lg:grid-cols-[1.1fr_2fr] lg:items-center">
          <div>
            <h1 className="text-xl font-bold text-slate-800">ภาพรวมการขนส่ง</h1>
            <p className="mt-1 text-sm text-slate-500">ติดตามการส่งพัสดุและการปล่อยคาร์บอนจากการขนส่งของคุณ</p>
            <Link href="/logistic/search" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
              <Search size={16} /> ค้นหา / พิมพ์ QR
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-white/80 p-4"><div className="flex items-center justify-between text-slate-500"><span className="text-xs">พิมพ์แล้ววันนี้</span><Printer size={16} className="text-blue-500" /></div><div className="mt-1 text-2xl font-bold text-slate-900">{printedToday}</div></div>
            <div className="rounded-xl bg-white/80 p-4"><div className="flex items-center justify-between text-slate-500"><span className="text-xs">รอค้นหา</span><Search size={16} className="text-blue-500" /></div><div className="mt-1 text-2xl font-bold text-slate-900">{waiting}</div></div>
            <div className="rounded-xl bg-white/80 p-4"><div className="flex items-center justify-between text-slate-500"><span className="text-xs">จุดคัดแยก</span><MapPin size={16} className="text-blue-500" /></div><div className="mt-1 text-2xl font-bold text-slate-900">{sortingPoints}</div></div>
          </div>
        </div>
      </div>

      <h2 className="text-lg font-bold text-slate-800">ผลการคำนวณแต่ละ Batch</h2>
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="จำนวนรอบการตัด" value={computed.length} unit="รอบ" tone="blue" icon={<Scissors size={20} />} />
        <MetricCard label="จำนวนดอกทั้งหมด" value={totalFlowers.toLocaleString()} unit="ดอก" tone="green" icon={<Package size={20} />} />
        <MetricCard label="การปล่อย CO2e รวม" value={totalCo2e.toFixed(1)} unit="กิโลกรัม" tone="blue" icon={<Cloud size={20} />} />
        <MetricCard label="CO2e เฉลี่ยต่อดอก" value={avgCo2e.toFixed(4)} unit="กิโลกรัม" tone="green" icon={<Boxes size={20} />} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-4 text-base font-semibold text-slate-800">ค่าสัมประสิทธิ์คาร์บอน</h3>
          <table className="w-full text-sm">
            <tbody>
              {(Object.keys(FACTORS) as (keyof typeof FACTORS)[]).map((k) => (
                <tr key={k} className="border-b border-slate-50 last:border-0">
                  <td className="py-2 text-slate-600">{FACTOR_LABELS[k]}</td>
                  <td className="py-2 text-right font-semibold tabular text-slate-800">{FACTORS[k]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card className="p-5">
          <h3 className="mb-4 text-base font-semibold text-slate-800">สัดส่วน CO₂e แยกตามฟาร์ม</h3>
          <Donut segments={segments} centerTop="CO₂e รวม" centerValue={Math.round(farmTotal).toLocaleString()} centerUnit="กิโลกรัม" />
        </Card>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-bold text-slate-800">ผลการคำนวณแต่ละ Batch <span className="text-sm font-normal text-slate-400">Result {rows.length} รายการ</span></h2>
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="bg-blue-50 text-left text-slate-600">
                <th className="px-5 py-3 font-semibold">Batch ID</th>
                <th className="px-5 py-3 font-semibold">ชื่อฟาร์ม</th>
                <th className="px-5 py-3 text-right font-semibold">จำนวนดอก</th>
                <th className="px-5 py-3 text-right font-semibold">ระยะทาง (กม.)</th>
                <th className="px-5 py-3 text-right font-semibold">CO2e ต่อดอก (kg)</th>
                <th className="px-5 py-3 text-center font-semibold">อายุหลังตัด (วัน)</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400">ยังไม่มีข้อมูล</td></tr>
              ) : (
                rows.map((b) => (
                  <tr key={b.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-5 py-3 font-mono text-xs text-slate-600">{b.id}</td>
                    <td className="px-5 py-3 text-slate-700">{byId.get(b.supplierId)?.farmName ?? "—"}</td>
                    <td className="px-5 py-3 text-right tabular">{b.flowerCount.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right tabular">{b.distanceKm}</td>
                    <td className="px-5 py-3 text-right font-semibold tabular text-slate-800">{b.co2ePerFlower.toFixed(3)}</td>
                    <td className="px-5 py-3 text-center"><span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">{b.ageDays}</span></td>
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
