import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getBatchesBySupplier, getPrints } from "@/lib/store";
import HistoryTable, { type HistoryRow } from "@/components/HistoryTable";
import { Card } from "@/components/ui";
import { thaiDateShort } from "@/lib/format";
import type { Tone } from "@/components/ui";
import { Inbox, Scissors, QrCode, Check } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const user = await requireRole("supplier");
  const [batches, prints] = await Promise.all([
    getBatchesBySupplier(user.supplierId!),
    getPrints(),
  ]);

  const printed = new Set(prints.filter((p) => !p.cancelled).map((p) => p.batchId));

  // สถานะการจัดส่งล่าสุด — 3-step tracker for the most recent round (Figma).
  const sorted = [...batches].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const latest = sorted[0];
  const steps = latest
    ? [
        { label: "ตัดดอก", icon: Scissors, date: thaiDateShort(latest.cutDate), done: true, inProgress: false },
        { label: "รับข้อมูล", icon: Inbox, date: thaiDateShort(latest.entryDate), done: latest.status === "computed", inProgress: latest.status === "submitted" },
        { label: "พิมพ์ QR code", icon: QrCode, date: printed.has(latest.id) ? "พิมพ์แล้ว" : "กำลังดำเนินการ", done: printed.has(latest.id), inProgress: latest.status === "computed" && !printed.has(latest.id) },
      ]
    : [];

  const rows: HistoryRow[] = sorted.map((b) => {
    let statusLabel = "รอดำเนินการ";
    let statusTone: Tone = "violet";
    if (printed.has(b.id)) { statusLabel = "พิมพ์ QR Code แล้ว"; statusTone = "green"; }
    else if (b.status === "computed") { statusLabel = "รอพิมพ์ QR Code"; statusTone = "amber"; }
    else if (b.status === "draft") { statusLabel = "ร่าง"; statusTone = "neutral"; }
    return {
      id: b.id,
      shipDate: thaiDateShort(b.entryDate),
      cutDate: thaiDateShort(b.cutDate),
      flowerCount: b.flowerCount,
      destination: b.destination ?? "",
      statusLabel,
      statusTone,
    };
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">ประวัติการส่งออก</h1>

      {/* Latest shipment tracker */}
      {latest ? (
        <Card className="p-6">
          <h2 className="text-lg font-bold text-slate-800">สถานะการจัดส่งล่าสุด</h2>
          <div className="mt-6 flex items-start">
            {steps.map((s, i) => {
              const Icon = s.icon;
              const on = s.done || s.inProgress;
              return (
                <div key={s.label} className="flex flex-1 items-start last:flex-none">
                  <div className="flex flex-col items-center gap-2">
                    <div className={`grid h-16 w-16 place-items-center rounded-full ${s.done ? "bg-emerald-500 text-white" : s.inProgress ? "bg-white text-emerald-600 ring-2 ring-emerald-500" : "bg-slate-100 text-slate-400"}`}>
                      {s.done ? <Check size={24} /> : <Icon size={24} />}
                    </div>
                    <div className="text-center">
                      <div className={`text-sm font-medium ${on ? "text-slate-700" : "text-slate-400"}`}>{s.label}</div>
                      <div className={`text-xs ${s.inProgress ? "text-emerald-600" : "text-slate-400"}`}>{s.date}</div>
                    </div>
                  </div>
                  {i < steps.length - 1 ? (
                    <div className={`mt-8 h-1 flex-1 rounded ${steps[i + 1].done || steps[i + 1].inProgress ? "bg-emerald-500" : "bg-slate-200"}`} />
                  ) : null}
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}

      {/* Export history */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-800">ประวัติการส่งออก</h2>
        {rows.length === 0 ? (
          <div className="mx-auto max-w-md py-16 text-center">
            <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full bg-brand-pink-light text-brand-pink">
              <Inbox size={34} />
            </div>
            <h3 className="text-lg font-semibold text-slate-800">ยังไม่มีประวัติการส่งออก</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
              เมื่อคุณบันทึกรอบการส่งออกดอกไม้ ประวัติทั้งหมดจะปรากฏที่นี่ พร้อมให้กรองและติดตามสถานะ
            </p>
            <Link href="/app/new" className="mt-6 inline-flex rounded-[8px] bg-brand-pink px-6 py-3 text-sm font-semibold text-white hover:opacity-90">
              + กรอกข้อมูลส่งออก
            </Link>
          </div>
        ) : (
          <HistoryTable rows={rows} />
        )}
      </div>
    </div>
  );
}
