import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getSupplier, getBatchesBySupplier, getCatalog, getBatch, activePrintOf } from "@/lib/store";
import RoundForm from "@/components/RoundForm";

export const dynamic = "force-dynamic";

// /app/new — new round · /app/new?edit=LOT-… — แก้ไขรอบส่งออก (only while it waits to be printed).
export default async function NewRoundPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const user = await requireRole("supplier");
  const supplier = user.supplierId ? await getSupplier(user.supplierId) : null;
  if (!supplier) notFound();
  const { edit: editId } = await searchParams;
  const [batches, catalog, edit] = await Promise.all([
    getBatchesBySupplier(supplier.id), getCatalog(), editId ? getBatch(editId) : Promise.resolve(null),
  ]);
  if (editId) {
    if (!edit || edit.supplierId !== supplier.id || edit.cancelledAt || (await activePrintOf(edit.id))) redirect("/app/history");
  }
  const varietyOptions = Array.from(new Set(batches.map((b) => b.variety).filter((v): v is string => !!v)));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">{edit ? `แก้ไขรอบส่งออก · ${edit.id}` : "กรอกข้อมูลรอบส่งออกใหม่"}</h1>
      <RoundForm supplier={supplier} varietyOptions={varietyOptions} catalog={catalog} edit={edit ?? undefined} />
    </div>
  );
}
