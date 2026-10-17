import { requireRole } from "@/lib/auth";
import { getBatches, getUsers } from "@/lib/store";
import { getOrgs, getBranches, getCompanyInvite } from "@/lib/logistic-org";
import CompanyAdmin, { type CompanyView } from "@/components/CompanyAdmin";

export const dynamic = "force-dynamic";

// KYN › บริษัทขนส่ง — logistic companies (doc "Logistic", 17 Oct 2026).
export default async function KynCarriersPage() {
  await requireRole("kyn");
  const [orgs, branches, users, lots, invite] = await Promise.all([getOrgs(), getBranches(), getUsers(), getBatches(), getCompanyInvite()]);
  const companies: CompanyView[] = orgs
    .map((o) => {
      const mine = branches.filter((b) => b.orgCode === o.orgCode);
      const hq = mine.find((b) => b.isHq);
      const admin = hq?.adminUserId ? users.find((u) => u.id === hq.adminUserId) : undefined;
      const ids = new Set(mine.map((b) => b.id));
      return {
        orgCode: o.orgCode, company: o.company, providerType: o.providerType, status: o.status, phone: o.phone, taxId: o.taxId,
        address: [o.address, o.subdistrict, o.district, o.province, o.postcode].filter(Boolean).join(" "),
        createdAt: o.createdAt,
        admin: admin ? { name: admin.username, email: admin.email } : undefined,
        branches: mine.filter((b) => b.status === "active").length,
        pendingBranches: mine.filter((b) => b.status === "pending").length,
        lots: lots.filter((l) => l.branchId && ids.has(l.branchId)).length,
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return <CompanyAdmin companies={companies} invite={{ token: invite?.token ?? null, createdAt: invite?.createdAt }} />;
}
