import { requireRole } from "@/lib/auth";
import { getSuppliers } from "@/lib/store";
import SupManager from "@/components/SupManager";

export const dynamic = "force-dynamic";

export default async function KynSuppliersPage() {
  await requireRole("kyn");
  const suppliers = await getSuppliers();
  return <SupManager suppliers={suppliers} />;
}
