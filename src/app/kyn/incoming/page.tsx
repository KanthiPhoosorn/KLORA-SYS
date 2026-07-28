import { getSuppliers, getBatches } from "@/lib/store";
import IncomingConsole from "@/components/IncomingConsole";

export const dynamic = "force-dynamic";

export default async function IncomingPage() {
  const [suppliers, batches] = await Promise.all([getSuppliers(), getBatches()]);
  return <IncomingConsole suppliers={suppliers} batches={batches} />;
}
