import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupplier } from "@/lib/store";
import FarmSettingsForm from "@/components/FarmSettingsForm";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function EditSupplierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supplier = await getSupplier(id);
  if (!supplier) notFound();

  return (
    <div className="space-y-6">
      <Link
        href="/kyn/suppliers"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft size={14} /> กลับไปจัดการ SUP
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">แก้ไขข้อมูล {supplier.id}</h1>
        <p className="text-sm text-slate-500">{supplier.farmName}</p>
      </div>
      <FarmSettingsForm supplier={supplier} />
    </div>
  );
}
