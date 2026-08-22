import { requireRole } from "@/lib/auth";
import { getSupplier, getBatchesBySupplier } from "@/lib/store";
import { sourceBreakdown, basketReuseCounts } from "@/lib/carbon";
import { MetricCard, Card, Bar } from "@/components/ui";
import { thaiDateShort } from "@/lib/format";
import { Leaf } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CarbonDashboardPage() {
  const user = await requireRole("supplier");
  const [supplier, batches] = await Promise.all([
    getSupplier(user.supplierId!),
    getBatchesBySupplier(user.supplierId!),
  ]);
  const computed = batches.filter((b) => b.status === "computed");
  const avgCo2e = computed.length
    ? computed.reduce((n, b) => n + b.co2ePerFlower, 0) / computed.length
    : 0;
  const totalCo2e = computed.reduce((n, b) => n + b.co2ePerFlower * b.flowerCount, 0);

  const reuse = basketReuseCounts(batches);
  const bs = sourceBreakdown(computed, () => supplier ?? undefined, (id) => reuse.get(id) ?? 0);
  const sources = [
    { label: "การขนส่ง", pct: bs.pct.transport },
    { label: "การปลูก (ปุ๋ย/ไฟฟ้า)", pct: bs.pct.planting },
    { label: "บรรจุภัณฑ์/ตะกร้า", pct: bs.pct.basket },
  ];
  const rounds = [...computed].sort((a, b) => b.cutDate.localeCompare(a.cutDate));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">แดชบอร์ดคาร์บอน</h1>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard label="CO2e/ดอก เฉลี่ย" value={avgCo2e.toFixed(4)} unit="กก." tone="green" icon={<Leaf size={20} />} />
        <MetricCard label="CO2e สะสม" value={totalCo2e.toFixed(1)} unit="กก." tone="blue" />
        <MetricCard label="รอบที่คำนวณแล้ว" value={computed.length} unit="รอบ" tone="pink" />
      </section>

      <Card className="p-5">
        <h2 className="mb-4 text-base font-semibold text-slate-800">สัดส่วนที่มาของคาร์บอน</h2>
        {bs.total === 0 ? (
          <p className="text-sm text-slate-400">ยังไม่มีข้อมูลที่คำนวณแล้ว</p>
        ) : (
          <div className="space-y-3">
            {sources.map((s) => (
              <div key={s.label} className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">{s.label}</span>
                  <span className="font-semibold tabular text-slate-800">{s.pct}%</span>
                </div>
                <Bar value={s.pct} max={100} className="bg-gradient-to-r from-pink-300 to-pink-500" />
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="space-y-3">
        <h2 className="text-base font-semibold text-slate-800">รายละเอียดตามรอบ</h2>
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
                <tr><td colSpan={4} className="px-5 py-8 text-center text-slate-400">ยังไม่มีรอบที่คำนวณแล้ว</td></tr>
              ) : (
                rounds.map((b) => (
                  <tr key={b.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-5 py-2.5 text-slate-700">{thaiDateShort(b.cutDate)}</td>
                    <td className="px-5 py-2.5 text-right tabular">{b.flowerCount.toLocaleString()}</td>
                    <td className="px-5 py-2.5 text-right tabular">{(b.co2ePerFlower * b.flowerCount).toFixed(1)} กก.</td>
                    <td className="px-5 py-2.5 text-right font-semibold tabular text-slate-800">{b.co2ePerFlower.toFixed(4)}</td>
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
