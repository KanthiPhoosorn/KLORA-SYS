import { getSuppliers } from "@/lib/store";
import SupManager from "@/components/SupManager";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  const suppliers = await getSuppliers();
  return <SupManager suppliers={suppliers} />;
}
