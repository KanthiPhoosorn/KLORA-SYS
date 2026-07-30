import { requireUser } from "@/lib/auth";
import { getSupplier, getBatchesBySupplier, getPrints } from "@/lib/store";
import { sourceBreakdown, basketReuseCounts } from "@/lib/carbon";
import { StatCard, BarChart, Card, Bar } from "@/components/ui";
import HistoryTable, { type HistoryRow } from "@/components/HistoryTable";
import { buildMonthSeries, thaiDateShort } from "@/lib/format";
import { CALC_STATUS, SHIP_STATUS } from "@/lib/status";
import { Scissors, Inbox, QrCode, Check } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SupDashboard() {
  const user = await requireUser();
  const [supplier, batches, prints] = await Promise.all([
    getSupplier(user.supplierId),
    getBatchesBySupplier(user.supplierId),
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
    5,
  );

  const reuse = basketReuseCounts(batches);
  const bySource = sourceBreakdown(
    computed,
    () => supplier ?? undefined,
    (id) => reuse.get(id) ?? 0,
  );
  const sources = [
    { label: "การขนส่ง", pct: bySource.pct.transport },
    { label: "การปลูก (ปุ๋ย/ไฟฟ้า)", pct: bySource.pct.planting },
    { label: "บรรจุภัณฑ์/ตะกร้า", pct: bySource.pct.basket },
  ];

  const sorted = [...batches].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const rows: HistoryRow[] = sorted.map((b) => ({
    id: b.id,
    dateLabel: thaiDateShort(b.cutDate),
    flowerCount: b.flowerCount,
    destination: b.destination ?? "",
    calcLabel: CALC_STATUS[b.status].label,
    calcTone: CALC_STATUS[b.status].tone,
    shipLabel: SHIP_STATUS[b.shipmentStatus].label,
    shipTone: SHIP_STATUS[b.shipmentStatus].tone,
  }));

  const latest = sorted[0];
  const printedIds = new Set(prints.filter((p) => !p.cancelled).map((p) => p.batchId));
  const steps = latest
    ? [
        { label: "ตัดดอก", icon: Scissors, done: true },
        { label: "รับข้อมูล", icon: Inbox, done: latest.status === "computed" },
        { label: "พิมพ์ QR", icon: QrCode, done: printedIds.has(latest.id) },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">ภาพรวมฟาร์ม</h1>
        <span className="text-sm text-slate-500">{supplier?.farmName}</span>
      </div>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="รอบส่งออกทั้งหมด" value={batches.length} />
        <StatCard label="CO2e สะสม (กก.)" value={totalCo2e.toFixed(1)} />
        <StatCard label="เฉลี่ย/ดอก (กก.)" value={avgCo2e.toFixed(3)} accent="blue" />
        <StatCard label="รอคำนวณ" value={pending} accent="orange" />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 text-base font-semibold text-slate-800">แนวโน้ม CO2e รายเดือน</h2>
          <BarChart data={series} />
        </Card>
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
      </div>

      <div className="space-y-3">
        <h2 className="text-base font-semibold text-slate-800">ประวัติการส่งออก</h2>
        <HistoryTable rows={rows} />
      </div>

      {latest ? (
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">
            ติดตามสถานะรอบล่าสุด ({user.supplierId} · {thaiDateShort(latest.cutDate)})
          </h2>
          <div className="flex items-center">
            {steps.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="flex flex-1 items-center last:flex-none">
                  <div className="flex flex-col items-center gap-1.5">
                    <div
                      className={`grid h-9 w-9 place-items-center rounded-full ${
                        s.done ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      {s.done ? <Check size={16} /> : <Icon size={16} />}
                    </div>
                    <span className={`text-xs ${s.done ? "text-slate-700" : "text-slate-400"}`}>
                      {s.label}
                    </span>
                  </div>
                  {i < steps.length - 1 ? (
                    <div className={`mx-1 h-0.5 flex-1 ${steps[i + 1].done ? "bg-emerald-500" : "bg-slate-200"}`} />
                  ) : null}
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
