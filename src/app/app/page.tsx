import { requireUser } from "@/lib/auth";
import { getSupplier, getBatchesBySupplier } from "@/lib/store";
import { StatCard, BarChart, Card, Badge } from "@/components/ui";
import { buildMonthSeries, thaiDateShort } from "@/lib/format";
import { SHIP_STATUS } from "@/lib/status";
import { Settings2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SupOverview() {
  const user = await requireUser();
  const [supplier, batches] = await Promise.all([
    getSupplier(user.supplierId),
    getBatchesBySupplier(user.supplierId),
  ]);

  const computed = batches.filter((b) => b.status === "computed");
  const totalCo2e = computed.reduce((n, b) => n + b.co2ePerFlower * b.flowerCount, 0);
  const avgCo2e = computed.length
    ? computed.reduce((n, b) => n + b.co2ePerFlower, 0) / computed.length
    : 0;
  const pending = batches.filter((b) => b.status === "submitted").length;

  const series = buildMonthSeries(
    computed,
    (b) => b.cutDate,
    (b) => b.co2ePerFlower * b.flowerCount,
    5,
  );

  const latest = [...batches]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 4);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">ภาพรวมฟาร์ม</h1>
        <div className="flex items-center gap-1.5 text-sm text-slate-500">
          <Settings2 size={15} /> {supplier?.farmName}
        </div>
      </div>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="รอบส่งออกทั้งหมด" value={batches.length} />
        <StatCard label="CO2e สะสม (กก.)" value={totalCo2e.toFixed(1)} accent="slate" />
        <StatCard label="เฉลี่ย/ดอก (กก.)" value={avgCo2e.toFixed(3)} accent="blue" />
        <StatCard label="รอคำนวณ" value={pending} accent="orange" />
      </section>

      <Card className="p-5">
        <h2 className="mb-4 text-base font-semibold text-slate-800">แนวโน้ม CO2e รายเดือน</h2>
        <BarChart data={series} />
      </Card>

      <div>
        <h2 className="mb-2 text-base font-semibold text-slate-800">สถานะรอบล่าสุด</h2>
        <Card className="divide-y divide-slate-100">
          {latest.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-slate-400">ยังไม่มีรอบส่งออก</p>
          ) : (
            latest.map((b) => (
              <div key={b.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <span className="text-slate-700">
                  {thaiDateShort(b.cutDate)} · {b.flowerCount.toLocaleString()} ก้าน
                  {b.destination ? ` → ${b.destination}` : ""}
                </span>
                <Badge tone={SHIP_STATUS[b.shipmentStatus].tone}>
                  {SHIP_STATUS[b.shipmentStatus].label}
                </Badge>
              </div>
            ))
          )}
        </Card>
      </div>
    </div>
  );
}
