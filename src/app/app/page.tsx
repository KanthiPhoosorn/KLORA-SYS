import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getSupplier, getBatchesBySupplier, getPrints } from "@/lib/store";
import { MetricCard, BarChart, Card } from "@/components/ui";
import { buildMonthSeries, thaiDateShort } from "@/lib/format";
import { SHIP_STATUS } from "@/lib/status";
import { Truck, Cloud, Package, Clock, Scissors, Inbox, QrCode, Check, Pencil } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SupplierOverview() {
  const user = await requireRole("supplier");
  const [supplier, batches, prints] = await Promise.all([
    getSupplier(user.supplierId!),
    getBatchesBySupplier(user.supplierId!),
    getPrints(),
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
    12,
  );

  const printedIds = new Set(prints.filter((p) => !p.cancelled).map((p) => p.batchId));
  const sorted = [...batches].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const latest = sorted[0];
  const steps = latest
    ? [
        { label: "ตัดดอก", icon: Scissors, done: true },
        { label: "รับข้อมูล", icon: Inbox, done: latest.status === "computed" },
        { label: "พิมพ์ QR code", icon: QrCode, done: printedIds.has(latest.id), inProgress: latest.status === "computed" && !printedIds.has(latest.id) },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Metric cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="จำนวนรอบการส่งออก" value={batches.length} unit="รอบ" tone="green" icon={<Truck size={20} />} note="อัปเดตล่าสุด : วันนี้" />
        <MetricCard label="CO2e สะสม" value={totalCo2e.toFixed(0)} unit="กิโลกรัม" tone="blue" icon={<Cloud size={20} />} note="อัปเดตล่าสุด : วันนี้" />
        <MetricCard label="CO2e เฉลี่ยต่อดอก" value={avgCo2e.toFixed(4)} unit="กิโลกรัม" tone="green" icon={<Package size={20} />} note="อัปเดตล่าสุด : วันนี้" />
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
          {latest ? (
            <div className="flex items-start">
              {steps.map((s, i) => {
                const Icon = s.icon;
                const on = s.done || s.inProgress;
                return (
                  <div key={s.label} className="flex flex-1 items-start last:flex-none">
                    <div className="flex flex-col items-center gap-2">
                      <div className={`grid h-14 w-14 place-items-center rounded-full ${s.done ? "bg-emerald-500 text-white" : s.inProgress ? "bg-white text-emerald-600 ring-2 ring-emerald-500" : "bg-slate-100 text-slate-400"}`}>
                        {s.done ? <Check size={22} /> : <Icon size={22} />}
                      </div>
                      <div className="text-center">
                        <div className={`text-sm font-medium ${on ? "text-slate-700" : "text-slate-400"}`}>{s.label}</div>
                        {s.inProgress ? <div className="text-xs text-emerald-600">กำลังดำเนินการ</div> : null}
                      </div>
                    </div>
                    {i < steps.length - 1 ? (
                      <div className={`mt-7 h-1 flex-1 rounded ${steps[i + 1].done || steps[i + 1].inProgress ? "bg-emerald-500" : "bg-slate-200"}`} />
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-400">ยังไม่มีรอบส่งออก</p>
          )}
        </Card>
      </div>

      {/* Latest shipments table */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-slate-800">รายการจัดส่งล่าสุด</h2>
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="bg-emerald-500 text-left text-white">
                <th className="px-5 py-3 font-semibold">วันที่ส่ง</th>
                <th className="px-5 py-3 text-center font-semibold">จำนวนดอก</th>
                <th className="px-5 py-3 font-semibold">ปลายทาง</th>
                <th className="px-5 py-3 font-semibold">ขนส่ง</th>
                <th className="px-5 py-3 text-center font-semibold">สถานะ</th>
                <th className="px-5 py-3 text-center font-semibold">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400">ยังไม่มีรอบส่งออก</td></tr>
              ) : (
                sorted.map((b) => {
                  const printed = printedIds.has(b.id);
                  return (
                    <tr key={b.id} className="border-b border-slate-50 last:border-0">
                      <td className="px-5 py-3 text-slate-700">{thaiDateShort(b.cutDate)}</td>
                      <td className="px-5 py-3 text-center tabular">{b.flowerCount.toLocaleString()}</td>
                      <td className="px-5 py-3 text-slate-700">{b.destination ?? "—"}</td>
                      <td className="px-5 py-3 text-slate-600">{b.carrier ?? "—"}</td>
                      <td className="px-5 py-3 text-center">
                        {printed ? (
                          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">พิมพ์แล้ว</span>
                        ) : (
                          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">รอสั่งพิมพ์</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <Link href="/app/history" className="inline-grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                          <Pencil size={15} />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
