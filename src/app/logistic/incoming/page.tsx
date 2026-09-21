import { requireRole } from "@/lib/auth";
import { getSuppliers, getBatches, getPrints } from "@/lib/store";
import LogisticIncoming, { type IncomingRow } from "@/components/LogisticIncoming";
import { thaiDateShort } from "@/lib/format";
import type { Supplier } from "@/lib/types";

export const dynamic = "force-dynamic";

import CategoryFilter, { parseCat } from "@/components/CategoryFilter";
import { categoryOf } from "@/lib/produce";

export default async function LogisticIncomingPage({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  const cat = parseCat((await searchParams).cat);
  await requireRole("logistic");
  const [suppliers, allBatches, prints] = await Promise.all([getSuppliers(), getBatches(), getPrints()]);
  const mixed = new Set(allBatches.map(categoryOf)).size > 1;
  const batches = cat === "all" ? allBatches : allBatches.filter((b) => categoryOf(b) === cat);
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
        receivedIso: b.entryDate,
        farmName: byId.get(b.supplierId)?.farmName ?? "—",
        supplierId: b.supplierId,
        ageDays: b.ageDays,
        received: b.flowerCount,
        remaining: dispatched ? 0 : b.flowerCount,
        printId,
      };
    });

  return (
    <div className="space-y-6">
      {mixed ? <CategoryFilter value={cat} basePath="/logistic/incoming" accent="blue" /> : null}
      <LogisticIncoming rows={rows} />
    </div>
  );
}
