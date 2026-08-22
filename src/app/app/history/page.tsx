import { requireRole } from "@/lib/auth";
import { getBatchesBySupplier } from "@/lib/store";
import HistoryTable, { type HistoryRow } from "@/components/HistoryTable";
import { thaiDateShort } from "@/lib/format";
import { CALC_STATUS, SHIP_STATUS } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const user = await requireRole("supplier");
  const batches = await getBatchesBySupplier(user.supplierId!);
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">ประวัติการส่งออก</h1>
      <HistoryTable rows={rows} />
    </div>
  );
}
