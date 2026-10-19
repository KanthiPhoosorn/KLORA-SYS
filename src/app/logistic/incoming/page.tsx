import { requireRole } from "@/lib/auth";
import { getSuppliers, getPrints } from "@/lib/store";
import { myLots, logisticAccess } from "@/lib/logistic-org";
import { carrierLabel } from "@/lib/carriers";
import LogisticIncoming, { type IncomingRow } from "@/components/LogisticIncoming";
import { thaiDateShort } from "@/lib/format";
import type { Supplier } from "@/lib/types";

export const dynamic = "force-dynamic";

import CategoryFilter, { parseCat } from "@/components/CategoryFilter";
import { categoryOf, unitOf, UNIT_LABEL } from "@/lib/produce";

export default async function LogisticIncomingPage({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  const cat = parseCat((await searchParams).cat);
  const user = await requireRole("logistic");
  const access = await logisticAccess(user);
  // only this account's lots — its branch, or its whole company for the head office (doc "Logistic", 17 Oct 2026)
  const [suppliers, allBatches, prints] = await Promise.all([getSuppliers(), myLots(user), getPrints()]);
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
        farmName: byId.get(b.supplierId)?.farmName ?? "–",
        supplierId: b.supplierId,
        ageDays: b.ageDays,
        // every product in its own unit — ดอก / ช่อ, or กก. for fruit and vegetables (it used to count stems only)
        received: b.quantity ?? b.flowerCount,
        remaining: dispatched ? 0 : b.quantity ?? b.flowerCount,
        unit: UNIT_LABEL[unitOf(b)],
        printId,
      };
    });

  return (
    <div className="space-y-6">
      {mixed ? <CategoryFilter value={cat} basePath="/logistic/incoming" accent="blue" /> : null}
      <LogisticIncoming rows={rows} org={{ code: user.orgCode, company: access.org?.company ?? user.company, branch: access.branch?.name ?? user.branch, provider: carrierLabel(access.org?.providerType) || undefined }} />
    </div>
  );
}
