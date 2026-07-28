import { requireUser } from "@/lib/auth";
import { getBatchesBySupplier, getPrints } from "@/lib/store";
import { Card } from "@/components/ui";
import HistoryTable, { type HistoryRow } from "@/components/HistoryTable";
import { thaiDateShort } from "@/lib/format";
import { CALC_STATUS, SHIP_STATUS } from "@/lib/status";
import { Scissors, Inbox, QrCode, Check } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const user = await requireUser();
  const [batches, prints] = await Promise.all([
    getBatchesBySupplier(user.supplierId),
    getPrints(),
  ]);

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

  // Tracking timeline for the latest round.
  const latest = sorted[0];
  const printedIds = new Set(prints.map((p) => p.batchId));
  const steps = latest
    ? [
        { label: "ตัดดอก", icon: Scissors, done: true },
        { label: "รับข้อมูล", icon: Inbox, done: latest.status === "computed" },
        { label: "พิมพ์ QR", icon: QrCode, done: printedIds.has(latest.id) },
      ]
    : [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">ประวัติการส่งออก</h1>

      <HistoryTable rows={rows} />

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
                    <div
                      className={`mx-1 h-0.5 flex-1 ${
                        steps[i + 1].done ? "bg-emerald-500" : "bg-slate-200"
                      }`}
                    />
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
