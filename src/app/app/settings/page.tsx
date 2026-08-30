import { requireRole } from "@/lib/auth";
import { getMembers, getInvites, getSupplier } from "@/lib/store";
import TeamManager from "@/components/TeamManager";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const user = await requireRole("supplier");
  const org = user.supplierId ?? user.id;
  const [members, invites, supplier] = await Promise.all([
    getMembers(org),
    getInvites(org),
    user.supplierId ? getSupplier(user.supplierId) : Promise.resolve(null),
  ]);
  return <TeamManager members={members} invites={invites} orgName={supplier?.farmName ?? "องค์กรของฉัน"} />;
}
