import { requireRole } from "@/lib/auth";
import { getMembers, getInvites } from "@/lib/store";
import { orgOf } from "@/lib/api-guard";
import { logisticAccess, getBranches, orgUsers, myLots } from "@/lib/logistic-org";
import TeamManager from "@/components/TeamManager";
import BranchManager, { type BranchView } from "@/components/BranchManager";
import CompanyNameEdit from "@/components/CompanyNameEdit";

export const dynamic = "force-dynamic";

const monthOf = (iso: string) => new Date(new Date(iso).getTime() + 7 * 3600_000).toISOString().slice(0, 7); // Bangkok month

// จัดการระบบ — members and invites of the account's branch; the head office also gets the "สาขา" tab
// (branch link, approvals, all branches) — doc tab "Logistic", 17 Oct 2026.
export default async function LogisticSettingsPage() {
  const user = await requireRole("logistic");
  const access = await logisticAccess(user);
  const team = orgOf(user);
  const [members, invites] = await Promise.all([getMembers(team), getInvites(team)]);
  const orgName = access.org ? `${access.org.company}${access.branch && !access.branch.isHq ? ` · ${access.branch.name}` : ""}` : user.company ?? "องค์กรของฉัน";

  let extraTab: { label: string; badge?: number; content: React.ReactNode } | undefined;
  if (access.hq && access.org) {
    const [branches, people, lots] = await Promise.all([getBranches(access.org.orgCode), orgUsers(access.org.orgCode), myLots(user)]);
    const thisMonth = monthOf(new Date().toISOString());
    const views: BranchView[] = branches
      .filter((b) => b.status !== "rejected")
      .map((b) => {
        const mine = people.filter((u) => u.branchId === b.id);
        const admin = mine.find((u) => u.id === b.adminUserId);
        const month = lots.filter((l) => l.branchId === b.id && monthOf(l.createdAt) === thisMonth);
        return {
          id: b.id, name: b.name, isHq: b.isHq, status: b.status, phone: b.phone, address: b.address, subdistrict: b.subdistrict,
          district: b.district, province: b.province, postcode: b.postcode, lat: b.lat, lng: b.lng,
          createdAt: b.createdAt, decidedAt: b.decidedAt, decidedBy: b.decidedBy, rejectReason: b.rejectReason, history: b.history,
          // on ข้อมูลรายสาขา: active branches, and disabled ones that still have lots (lib/branch-rows.ts)
          listed: b.status === "active" || (b.status === "disabled" && lots.some((l) => l.branchId === b.id)),
          admin: admin ? { name: admin.username, email: admin.email } : undefined,
          members: mine.map((u) => ({ name: u.username, email: u.email, admin: u.id === b.adminUserId })).sort((x, y) => Number(y.admin) - Number(x.admin)),
          month: {
            rounds: month.length,
            weightKg: month.reduce((n, l) => n + (l.shippedWeightKg ?? l.weightKg ?? 0), 0),
            co2e: month.reduce((n, l) => n + (l.carbonBreakdown?.transport ?? 0), 0),
          },
        };
      });
    const pending = views.filter((v) => v.status === "pending").length;
    extraTab = {
      label: "สาขา",
      badge: pending,
      content: <BranchManager company={access.org.company} join={{ token: access.org.joinToken ?? null, createdAt: access.org.joinCreatedAt, createdBy: access.org.joinCreatedBy }} branches={views} />,
    };
  }
  return <TeamManager members={members} invites={invites} orgName={orgName} accent="blue" joinedAt={user.createdAt} extraTab={extraTab}
    orgAction={access.hq && access.org && access.state === "active" ? <CompanyNameEdit company={access.org.company} /> : undefined}
    title="จัดการระบบ" subtitle={access.hq ? "จัดการสมาชิก คำเชิญ และสาขาของบริษัท" : "จัดการสมาชิกและคำเชิญของสาขา"} />;
}
