import { requireRole } from "@/lib/auth";
import { KYN_ORG } from "@/lib/api-guard";
import { getSuppliers, getUsers, getInvites } from "@/lib/store";
import SupManager from "@/components/SupManager";

export const dynamic = "force-dynamic";

export default async function KynSuppliersPage() {
  const me = await requireRole("kyn");
  const [suppliers, users, kynInvites] = await Promise.all([getSuppliers(), getUsers(), getInvites(KYN_ORG)]);
  const logistics = users.filter((u) => u.role === "logistic");
  const kynUsers = users.filter((u) => u.role === "kyn");
  return <SupManager suppliers={suppliers} logistics={logistics} kynUsers={kynUsers} kynInvites={kynInvites} currentUserId={me.id} />;
}
