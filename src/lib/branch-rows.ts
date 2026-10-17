// "ข้อมูลรายสาขา" rows: one per branch of the company — active branches (even without lots yet) and
// disabled branches that still have history (doc "Logistic", 17 Oct 2026). Pending/rejected ones are not
// branches yet. Each row links to that branch's own dashboard.
import type { Batch, LogisticBranch } from "./types";
import type { BranchRow } from "@/components/BranchTable";
import { batchCo2e, unitsOf } from "./produce";

export function branchRows(lots: Batch[], branches: LogisticBranch[]): BranchRow[] {
  const byBranch = new Map<string, Batch[]>();
  for (const l of lots) if (l.branchId) (byBranch.get(l.branchId) ?? byBranch.set(l.branchId, []).get(l.branchId)!).push(l);
  return branches
    .filter((b) => b.status === "active" || (b.status === "disabled" && byBranch.has(b.id)))
    .map((b) => {
      const list = byBranch.get(b.id) ?? [];
      const units = list.reduce((n, l) => n + unitsOf(l), 0);
      return {
        id: b.id,
        href: `/logistic?branch=${b.id}`,
        province: b.province ?? "—",
        branch: b.name,
        status: b.status,
        rounds: list.length,
        flowers: units,
        transportCo2e: list.reduce((n, l) => n + (l.carbonBreakdown?.transport ?? 0), 0),
        avgPerStem: units ? list.reduce((n, l) => n + batchCo2e(l), 0) / units : 0,
        trend: null,
      };
    })
    .sort((a, b) => Number(b.branch === "สำนักงานใหญ่") - Number(a.branch === "สำนักงานใหญ่") || b.rounds - a.rounds);
}
