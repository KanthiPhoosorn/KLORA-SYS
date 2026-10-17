import { requireRole } from "@/lib/auth";
import { getSuppliers, getPrints } from "@/lib/store";
import { myLots } from "@/lib/logistic-org";
import ThaiPostConsole from "@/components/ThaiPostConsole";

export const dynamic = "force-dynamic";

export default async function LogisticSearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireRole("logistic");
  const { q } = await searchParams;
  // only this account's lots — its branch, or its whole company for the head office (doc "Logistic", 17 Oct 2026)
  const [suppliers, batches, allPrints] = await Promise.all([getSuppliers(), myLots(user), getPrints()]);
  const lotIds = new Set(batches.map((b) => b.id));
  const prints = allPrints.filter((p) => p.batchId && lotIds.has(p.batchId));
  return <ThaiPostConsole suppliers={suppliers} batches={batches} prints={prints} initialQuery={q ?? ""} />;
}
