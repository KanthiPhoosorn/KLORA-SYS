import { requireRole } from "@/lib/auth";
import { getSuppliers, getUsers } from "@/lib/store";
import SupManager from "@/components/SupManager";

export const dynamic = "force-dynamic";

export default async function KynSuppliersPage() {
  await requireRole("kyn");
  const [suppliers, users] = await Promise.all([getSuppliers(), getUsers()]);
  const logistics = users.filter((u) => u.role === "logistic");
  return <SupManager suppliers={suppliers} logistics={logistics} />;
}
