import { requireRole } from "@/lib/auth";
import { getBatchesBySupplier, getPrints } from "@/lib/store";
import HistoryTable, { type HistoryRow } from "@/components/HistoryTable";
import { thaiDateShort } from "@/lib/format";
import type { Tone } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const user = await requireRole("supplier");
  const [batches, prints] = await Promise.all([
    getBatchesBySupplier(user.supplierId!),
    getPrints(),
  ]);
  const printed = new Set(prints.filter((p) => !p.cancelled).map((p) => p.batchId));

  const rows: HistoryRow[] = [...batches]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((b) => {
      let statusLabel = "รอดำเนินการ";
      let statusTone: Tone = "neutral";
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
      <HistoryTable rows={rows} />
    </div>
  );
}
