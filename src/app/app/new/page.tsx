import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getSupplier, getBatchesBySupplier, getCatalog, getBatch, activePrintOf } from "@/lib/store";
import RoundForm from "@/components/RoundForm";

export const dynamic = "force-dynamic";

// /app/new — new round · /app/new?edit=LOT-… — แก้ไขรอบส่งออก (only while it waits to be printed)
// /app/new?copy=LOT-… — คัดลอกรายการ: a new round starting from one of the farm's lots (any status).
export default async function NewRoundPage({ searchParams }: { searchParams: Promise<{ edit?: string; copy?: string }> }) {
  const user = await requireRole("supplier");
  const supplier = user.supplierId ? await getSupplier(user.supplierId) : null;
  if (!supplier) notFound();
  const { edit: editId, copy: copyId } = await searchParams;
  const [batches, catalog, edit] = await Promise.all([
    getBatchesBySupplier(supplier.id), getCatalog(), editId ? getBatch(editId) : Promise.resolve(null),
  ]);
  const copied = !editId && copyId ? await getBatch(copyId) : null;
  const copyFrom = copied && copied.supplierId === supplier.id ? copied : null;
  if (copyId && !editId && !copyFrom) redirect("/app/history");
  if (editId) {
    if (!edit || edit.supplierId !== supplier.id || edit.cancelledAt || (await activePrintOf(edit.id))) redirect("/app/history");
  }
  const varietyOptions = Array.from(new Set(batches.map((b) => b.variety).filter((v): v is string => !!v)));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">{edit ? `แก้ไขรอบส่งออก · ${edit.id}` : copyFrom ? `กรอกข้อมูลรอบส่งออกใหม่ · คัดลอกจาก ${copyFrom.id}` : "กรอกข้อมูลรอบส่งออกใหม่"}</h1>
      <RoundForm supplier={supplier} varietyOptions={varietyOptions} catalog={catalog} edit={edit ?? undefined} copyFrom={copyFrom ?? undefined} />
    </div>
  );
}
