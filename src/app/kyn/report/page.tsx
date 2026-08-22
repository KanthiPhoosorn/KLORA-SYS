import { requireRole } from "@/lib/auth";
import { getSuppliers, getBatches } from "@/lib/store";
import KynReportSection from "@/components/KynReportSection";

export const dynamic = "force-dynamic";

export default async function KynReportPage() {
  await requireRole("kyn");
  const [suppliers, batches] = await Promise.all([getSuppliers(), getBatches()]);
  return <KynReportSection suppliers={suppliers} batches={batches} />;
}
