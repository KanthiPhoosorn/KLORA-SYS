import { requireRole } from "@/lib/auth";
import { getSuppliers, getPrints } from "@/lib/store";
import { myLots } from "@/lib/logistic-org";
import StatusConsole from "@/components/StatusConsole";

export const dynamic = "force-dynamic";

import CategoryFilter, { parseCat } from "@/components/CategoryFilter";
import { categoryOf } from "@/lib/produce";

export default async function LogisticStatusPage({ searchParams }: { searchParams: Promise<{ cat?: string; saved?: string }> }) {
  const sp = await searchParams;
  const cat = parseCat(sp.cat);
  const user = await requireRole("logistic");
  // only this account's lots — its branch, or its whole company for the head office (doc "Logistic", 17 Oct 2026)
  const [suppliers, allBatches, allPrints] = await Promise.all([getSuppliers(), myLots(user), getPrints()]);
  const lotIds = new Set(allBatches.map((b) => b.id));
  const prints = allPrints.filter((p) => p.batchId && lotIds.has(p.batchId));
  const mixed = new Set(allBatches.map(categoryOf)).size > 1;
  const batches = cat === "all" ? allBatches : allBatches.filter((b) => categoryOf(b) === cat);
  return (
    <div className="space-y-4">
      {mixed ? <CategoryFilter value={cat} basePath="/logistic/status" accent="blue" /> : null}
      <StatusConsole suppliers={suppliers} batches={batches} prints={prints} highlightId={sp.saved} />
    </div>
  );
}
