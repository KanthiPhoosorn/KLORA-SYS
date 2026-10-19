// "ข้อมูลรายสาขา" rows: one per branch of the company — active branches (even without lots yet) and
// disabled branches that still have history (doc "Logistic", 17 Oct 2026). Pending/rejected ones are not
// branches yet. Each row links to that branch's own dashboard.
//
// Figures (doc "Logistic", 19 Oct 2026): no amounts in ดอก / กก. any more, so products never need a unit.
// CO₂e is split into สินค้า (everything but transport: farm + packaging) and ขนส่ง, each averaged per รอบ, plus
// the branch's total CO₂e.
import type { Batch, LogisticBranch } from "./types";
import type { BranchRow } from "@/components/BranchTable";
import { batchCo2e } from "./produce";
import { transportOf } from "./amounts";

export function branchRows(lots: Batch[], branches: LogisticBranch[]): BranchRow[] {
  const byBranch = new Map<string, Batch[]>();
  for (const l of lots) if (l.branchId) (byBranch.get(l.branchId) ?? byBranch.set(l.branchId, []).get(l.branchId)!).push(l);
  return branches
    .filter((b) => b.status === "active" || (b.status === "disabled" && byBranch.has(b.id)))
    .map((b): BranchRow => {
      const list = byBranch.get(b.id) ?? [];
      const total = list.reduce((n, l) => n + batchCo2e(l), 0);
      const transport = list.reduce((n, l) => n + transportOf(l), 0);
      return {
        id: b.id,
        href: `/logistic/branches/${b.id}`,
        province: b.province ?? "–",
        branch: b.name,
        status: b.status,
        rounds: list.length,
        productCo2e: total - transport,
        transportCo2e: transport,
        totalCo2e: total,
        trend: null,
      };
    })
    .sort((a, b) => Number(b.branch === "สำนักงานใหญ่") - Number(a.branch === "สำนักงานใหญ่") || b.rounds - a.rounds);
}
