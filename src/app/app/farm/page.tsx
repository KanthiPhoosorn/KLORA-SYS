import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getSupplier } from "@/lib/store";
import FarmSettingsForm from "@/components/FarmSettingsForm";

export const dynamic = "force-dynamic";

export default async function FarmInfoPage() {
  const user = await requireRole("supplier");
  const supplier = user.supplierId ? await getSupplier(user.supplierId) : null;
  if (!supplier) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">ข้อมูลฟาร์ม</h1>
      <FarmSettingsForm supplier={supplier} />
    </div>
  );
}
