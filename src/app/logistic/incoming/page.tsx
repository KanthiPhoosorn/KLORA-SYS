import { requireRole } from "@/lib/auth";
import { getSuppliers, getBatches, getPrints } from "@/lib/store";
import LogisticIncoming, { type IncomingRow } from "@/components/LogisticIncoming";
import { thaiDateShort } from "@/lib/format";
import type { Supplier } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LogisticIncomingPage() {
  await requireRole("logistic");
  const [suppliers, batches, prints] = await Promise.all([getSuppliers(), getBatches(), getPrints()]);
  const byId = new Map<string, Supplier>(suppliers.map((s) => [s.id, s]));
  // batchId -> active (non-cancelled) print
  const activePrint = new Map<string, string>();
  for (const p of prints) if (!p.cancelled && p.batchId) activePrint.set(p.batchId, p.id);

  const rows: IncomingRow[] = batches
    .filter((b) => b.status === "computed" || b.status === "submitted")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((b) => {
      const printId = activePrint.get(b.id) ?? null;
      const dispatched = !!printId; // printed QR = dispatched out of the sorting house
      return {
        id: b.id,
        receivedDate: thaiDateShort(b.entryDate),
        farmName: byId.get(b.supplierId)?.farmName ?? "—",
        supplierId: b.supplierId,
        ageDays: b.ageDays,
        received: b.flowerCount,
        remaining: dispatched ? 0 : b.flowerCount,
        dispatched,
        printId,
      };
    });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">รายการรับเข้าจากผู้ผลิต</h1>
      <LogisticIncoming rows={rows} />
    </div>
  );
}
