import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getSupplier, getBatchesBySupplier } from "@/lib/store";
import RoundForm from "@/components/RoundForm";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewRoundPage() {
  const user = await requireRole("supplier");
  const supplier = user.supplierId ? await getSupplier(user.supplierId) : null;
  if (!supplier) notFound();
  const batches = await getBatchesBySupplier(supplier.id);
  const varietyOptions = Array.from(new Set(batches.map((b) => b.variety).filter((v): v is string => !!v)));
  const basketOptions = Array.from(new Set(batches.flatMap((b) => b.basketIds ?? [])));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">กรอกข้อมูลรอบส่งออกใหม่</h1>
      <Card className="max-w-2xl p-6">
        <RoundForm supplier={supplier} varietyOptions={varietyOptions} basketOptions={basketOptions} />
      </Card>
    </div>
  );
}
