import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getSupplier } from "@/lib/store";
import RoundForm from "@/components/RoundForm";

export const dynamic = "force-dynamic";

export default async function NewRoundPage() {
  const user = await requireUser();
  const supplier = await getSupplier(user.supplierId);
  if (!supplier) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">กรอกข้อมูลรอบส่งออกใหม่</h1>
      <RoundForm supplier={supplier} />
    </div>
  );
}
