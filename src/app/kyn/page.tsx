import { requireRole } from "@/lib/auth";
import { getSuppliers, getBatches, getRatings } from "@/lib/store";
import { parseKynFilter, applyKynFilter } from "@/lib/kyn-filter";
import RatingsCard from "@/components/RatingsCard";
import KynOverviewSection from "@/components/KynOverviewSection";

export const dynamic = "force-dynamic";

export default async function KynOverviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireRole("kyn");
  const filter = parseKynFilter(await searchParams);
  const [suppliers, batches, ratings] = await Promise.all([getSuppliers(), getBatches(), getRatings()]);
  const withLots = new Set(batches.map((b) => b.supplierId));
  const farms = suppliers.filter((s) => withLots.has(s.id) || s.id === filter.farm).map((s) => ({ id: s.id, name: s.farmName })).sort((a, b) => a.name.localeCompare(b.name, "th"));
  const lots = applyKynFilter(batches, filter);
  const lotIds = new Set(lots.map((b) => b.id));
  const filtered = filter.cat !== "all" || filter.farm || filter.period;
  return (
    <div className="space-y-6">
      <KynOverviewSection suppliers={suppliers} batches={lots} filter={filter} farms={farms} />
      <RatingsCard ratings={filtered ? ratings.filter((r) => lotIds.has(r.batchId)) : ratings} show="all" farmNames={Object.fromEntries(suppliers.map((s) => [s.id, s.farmName]))} />
    </div>
  );
}
