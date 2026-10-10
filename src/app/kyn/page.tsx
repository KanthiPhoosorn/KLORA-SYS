import { requireRole } from "@/lib/auth";
import { getSuppliers, getBatches, getRatings } from "@/lib/store";
import RatingsCard from "@/components/RatingsCard";
import KynOverviewSection from "@/components/KynOverviewSection";

export const dynamic = "force-dynamic";

export default async function KynOverviewPage() {
  await requireRole("kyn");
  const [suppliers, batches, ratings] = await Promise.all([getSuppliers(), getBatches(), getRatings()]);
  return (
    <div className="space-y-6">
      <KynOverviewSection suppliers={suppliers} batches={batches} />
      <RatingsCard ratings={ratings} show="all" farmNames={Object.fromEntries(suppliers.map((s) => [s.id, s.farmName]))} />
    </div>
  );
}
