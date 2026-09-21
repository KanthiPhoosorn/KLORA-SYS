import { requireRole } from "@/lib/auth";
import { getSuppliers, getBatches, getFactors } from "@/lib/store";
import LogisticExportForm from "@/components/LogisticExportForm";

export const dynamic = "force-dynamic";

export default async function LogisticExportPage() {
  await requireRole("logistic");
  const [suppliers, batches, factors] = await Promise.all([getSuppliers(), getBatches(), getFactors()]);
  // batches received from farms (computed) that the exporter can ship
  const ready = batches
    .filter((b) => b.status === "computed" || b.status === "submitted")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">เพิ่มข้อมูลรอบส่งออก</h1>
      <LogisticExportForm suppliers={suppliers} batches={ready} sizePresets={factors.packageSizes} />
    </div>
  );
}
