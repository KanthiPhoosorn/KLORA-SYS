import { requireRole } from "@/lib/auth";
import { getSuppliers, getBatches, getPrints } from "@/lib/store";
import StatusConsole from "@/components/StatusConsole";

export const dynamic = "force-dynamic";

import CategoryFilter, { parseCat } from "@/components/CategoryFilter";
import { categoryOf } from "@/lib/produce";

export default async function LogisticStatusPage({ searchParams }: { searchParams: Promise<{ cat?: string; saved?: string }> }) {
  const sp = await searchParams;
  const cat = parseCat(sp.cat);
  await requireRole("logistic");
  const [suppliers, allBatches, prints] = await Promise.all([getSuppliers(), getBatches(), getPrints()]);
  const mixed = new Set(allBatches.map(categoryOf)).size > 1;
  const batches = cat === "all" ? allBatches : allBatches.filter((b) => categoryOf(b) === cat);
  return (
    <div className="space-y-4">
      {mixed ? <CategoryFilter value={cat} basePath="/logistic/status" accent="blue" /> : null}
      <StatusConsole suppliers={suppliers} batches={batches} prints={prints} highlightId={sp.saved} />
    </div>
  );
}
