import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getSuppliers, getCatalog } from "@/lib/store";
import { logisticAccess, myLots } from "@/lib/logistic-org";
import { RECORDS_EXPORTS } from "@/lib/carriers";
import LogisticExportForm from "@/components/LogisticExportForm";

export const dynamic = "force-dynamic";

export default async function LogisticExportPage() {
  const user = await requireRole("logistic");
  const access = await logisticAccess(user);
  // only providers that ship the goods on themselves record exports (doc "Logistic", 17 Oct 2026)
  if (access.org && !RECORDS_EXPORTS.includes(access.org.providerType)) redirect("/logistic");
  const [suppliers, batches, catalog] = await Promise.all([getSuppliers(), myLots(user), getCatalog()]);
  const b = access.branch;
  const origin = b?.lat != null && b?.lng != null ? { lat: b.lat, lng: b.lng, label: b.name } : null;
  // batches received from farms (computed) that the exporter can ship
  const ready = batches
    .filter((b) => b.status === "computed" || b.status === "submitted")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">เพิ่มข้อมูลรอบส่งออก</h1>
      <LogisticExportForm suppliers={suppliers} batches={ready} catalog={catalog} originBranch={user.branch} origin={origin} />
    </div>
  );
}
