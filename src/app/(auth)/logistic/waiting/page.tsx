import { redirect } from "next/navigation";
import { getCurrentUser, homeForRole } from "@/lib/auth";
import { logisticAccess } from "@/lib/logistic-org";
import { carrierLabel } from "@/lib/carriers";
import PendingApproval from "@/components/PendingApproval";

export const metadata = { title: "รอการอนุมัติ · Corta" };
export const dynamic = "force-dynamic";

// /logistic/waiting — the only page a logistic account sees while it waits (doc "Logistic", 17 Oct 2026):
// a branch for its head office, a company that signed up alone for KYN. Outside the portal layout, so no
// portal page (and none of its data) runs for a waiting account.
export default async function LogisticWaitingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/logistic/login");
  if (user.role !== "logistic") redirect(homeForRole(user.role));
  const a = await logisticAccess(user);
  if (a.state !== "branch_pending" && a.state !== "org_pending") redirect("/logistic");
  const branch = a.state === "branch_pending";
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex h-[64px] items-center border-b border-gray-100 bg-white px-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/corta-logo.png" alt="Corta" className="h-7 w-auto" />
      </header>
      <PendingApproval
        kind={branch ? "branch" : "company"}
        company={a.org?.company ?? user.company ?? ""}
        branch={branch ? a.branch?.name : undefined}
        providerLabel={branch ? undefined : carrierLabel(a.org?.providerType)}
        registeredAt={(branch ? a.branch?.createdAt : a.org?.createdAt) ?? user.createdAt}
      />
    </div>
  );
}
