import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { logisticAccess, myLots, getBranches } from "@/lib/logistic-org";
import { branchRows } from "@/lib/branch-rows";
import BranchTable from "@/components/BranchTable";
import CategoryFilter, { parseCat } from "@/components/CategoryFilter";
import { categoryOf } from "@/lib/produce";

export const dynamic = "force-dynamic";

// ข้อมูลรายสาขา — the head office compares its branches (doc "Logistic", 17 Oct 2026): active branches and
// disabled ones that still have history; a branch name opens that branch's own dashboard.
export default async function LogisticBranchesPage({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  const cat = parseCat((await searchParams).cat);
  const user = await requireRole("logistic");
  const access = await logisticAccess(user);
  if (!access.hq || !access.org) redirect("/logistic"); // a branch sees only itself — its overview
  const [allLots, branches] = await Promise.all([myLots(user), getBranches(access.org.orgCode)]);
  const mixed = new Set(allLots.map(categoryOf)).size > 1;
  const lots = (cat === "all" ? allLots : allLots.filter((b) => categoryOf(b) === cat)).filter((b) => b.status === "computed");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">ข้อมูลรายสาขา</h1>
        <p className="mt-1 text-sm text-slate-500">
          เปรียบเทียบจำนวนรอบ ปริมาณสินค้า และการปล่อยคาร์บอนจากการขนส่งของแต่ละสาขา · กดชื่อสาขาเพื่อดูแดชบอร์ดของสาขานั้น
        </p>
        {mixed ? <div className="mt-3"><CategoryFilter value={cat} basePath="/logistic/branches" accent="blue" /></div> : null}
      </div>
      <BranchTable rows={branchRows(lots, branches)} />
    </div>
  );
}
