import { requireRole } from "@/lib/auth";
import { getSuppliers, getBatches, getPrints } from "@/lib/store";
import StatusConsole from "@/components/StatusConsole";

export const dynamic = "force-dynamic";

export default async function LogisticStatusPage() {
  await requireRole("logistic");
  const [suppliers, batches, prints] = await Promise.all([getSuppliers(), getBatches(), getPrints()]);
  return <StatusConsole suppliers={suppliers} batches={batches} prints={prints} />;
}
