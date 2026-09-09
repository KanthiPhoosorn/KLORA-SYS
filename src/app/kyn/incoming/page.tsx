import { requireRole } from "@/lib/auth";
import { getSuppliers, getBatches, getPrints } from "@/lib/store";
import IncomingConsole from "@/components/IncomingConsole";

export const dynamic = "force-dynamic";

export default async function KynIncomingPage() {
  await requireRole("kyn");
  const [suppliers, batches, prints] = await Promise.all([getSuppliers(), getBatches(), getPrints()]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">ข้อมูลที่รับเข้าจากผู้ผลิต</h1>
      <IncomingConsole suppliers={suppliers} batches={batches} prints={prints} />
    </div>
  );
}
