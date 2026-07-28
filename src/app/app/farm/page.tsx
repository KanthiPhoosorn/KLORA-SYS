import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getSupplier } from "@/lib/store";
import FarmSettingsForm from "@/components/FarmSettingsForm";

export const dynamic = "force-dynamic";

export default async function FarmSettingsPage() {
  const user = await requireUser();
  const supplier = await getSupplier(user.supplierId);
  if (!supplier) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">ข้อมูลฟาร์ม</h1>
      <FarmSettingsForm supplier={supplier} />
    </div>
  );
}
