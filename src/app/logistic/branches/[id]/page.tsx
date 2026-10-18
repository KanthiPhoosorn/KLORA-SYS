import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { logisticAccess, getBranches } from "@/lib/logistic-org";
import { parseCat } from "@/components/CategoryFilter";
import LogisticDashboard from "@/components/LogisticDashboard";

export const dynamic = "force-dynamic";

// ข้อมูลรายสาขา › one branch — the head office sees that branch's dashboard as the branch itself sees it
// (doc "Logistic", 17–18 Oct 2026). Under /logistic/branches so the menu stays on ข้อมูลรายสาขา.
export default async function BranchDashboardPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ cat?: string }> }) {
  const user = await requireRole("logistic");
  const access = await logisticAccess(user);
  if (!access.hq || !access.org) redirect("/logistic"); // a branch sees only itself — its overview
  const id = decodeURIComponent((await params).id);
  const viewing = (await getBranches(access.org.orgCode)).find((b) => b.id === id);
  if (!viewing) redirect("/logistic/branches"); // not a branch of this company
  return <LogisticDashboard user={user} cat={parseCat((await searchParams).cat)} viewing={viewing} />;
}
