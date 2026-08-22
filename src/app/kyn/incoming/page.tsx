import { requireRole } from "@/lib/auth";
import { getSuppliers, getBatches } from "@/lib/store";
import IncomingConsole from "@/components/IncomingConsole";

export const dynamic = "force-dynamic";

export default async function KynIncomingPage() {
  await requireRole("kyn");
  const [suppliers, batches] = await Promise.all([getSuppliers(), getBatches()]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">ข้อมูลที่รับเข้าจากผู้ผลิต</h1>
      <IncomingConsole suppliers={suppliers} batches={batches} />
    </div>
  );
}
