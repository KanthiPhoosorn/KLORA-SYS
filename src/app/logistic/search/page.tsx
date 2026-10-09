import { requireRole } from "@/lib/auth";
import { getSuppliers, getBatches, getPrints } from "@/lib/store";
import ThaiPostConsole from "@/components/ThaiPostConsole";

export const dynamic = "force-dynamic";

export default async function LogisticSearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireRole("logistic");
  const { q } = await searchParams;
  const [suppliers, batches, prints] = await Promise.all([getSuppliers(), getBatches(), getPrints()]);
  return <ThaiPostConsole suppliers={suppliers} batches={batches} prints={prints} initialQuery={q ?? ""} />;
}
