import { requireRole } from "@/lib/auth";
import { getSuppliers, getBatches } from "@/lib/store";
import { parseKynFilter, applyKynFilter } from "@/lib/kyn-filter";
import KynReportSection from "@/components/KynReportSection";

export const dynamic = "force-dynamic";

export default async function KynReportPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireRole("kyn");
  const filter = parseKynFilter(await searchParams);
  const [suppliers, batches] = await Promise.all([getSuppliers(), getBatches()]);
  // the farm picker lists farms that have lots
  const withLots = new Set(batches.map((b) => b.supplierId));
  const farms = suppliers.filter((s) => withLots.has(s.id) || s.id === filter.farm).map((s) => ({ id: s.id, name: s.farmName })).sort((a, b) => a.name.localeCompare(b.name, "th"));
  return <KynReportSection suppliers={suppliers} batches={applyKynFilter(batches, filter)} filter={filter} farms={farms} />;
}
