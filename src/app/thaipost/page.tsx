import { getSuppliers, getBatches, getPrints } from "@/lib/store";
import ThaiPostConsole from "@/components/ThaiPostConsole";

export const dynamic = "force-dynamic";

export default async function ThaiPostPage() {
  const [suppliers, batches, prints] = await Promise.all([
    getSuppliers(),
    getBatches(),
    getPrints(),
  ]);
  return <ThaiPostConsole suppliers={suppliers} batches={batches} prints={prints} />;
}
