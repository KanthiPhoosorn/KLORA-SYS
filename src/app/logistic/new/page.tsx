import { requireRole } from "@/lib/auth";
import { getSuppliers } from "@/lib/store";
import LogisticExportForm from "@/components/LogisticExportForm";

export const dynamic = "force-dynamic";

export default async function LogisticExportPage() {
  await requireRole("logistic");
  const suppliers = (await getSuppliers()).filter((s) => s.status !== "suspended");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">เพิ่มข้อมูลรอบส่งออก</h1>
      <LogisticExportForm suppliers={suppliers} />
    </div>
  );
}
