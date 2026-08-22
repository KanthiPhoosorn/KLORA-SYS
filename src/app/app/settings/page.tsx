import { requireRole } from "@/lib/auth";
import { getMembers, getInvites } from "@/lib/store";
import TeamManager from "@/components/TeamManager";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const user = await requireRole("supplier");
  const org = user.supplierId ?? user.id;
  const [members, invites] = await Promise.all([getMembers(org), getInvites(org)]);
  return <TeamManager members={members} invites={invites} />;
}
