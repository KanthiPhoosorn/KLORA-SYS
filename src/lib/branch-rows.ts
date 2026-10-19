// "ข้อมูลรายสาขา" rows: one per branch of the company — active branches (even without lots yet) and
// disabled branches that still have history (doc "Logistic", 17 Oct 2026). Pending/rejected ones are not
// branches yet. Each row links to that branch's own dashboard.
//
// Amounts never mix units (doc "Logistic", 19 Oct 2026): flowers count ดอก or ช่อ, fruit and vegetables are
// weighed in กก. (ตัน → กก.). When the lots shown use one unit the table reads "ปริมาณรวม (ดอก)" /
// "น้ำหนักรวม (กก.)" with transport CO₂e per that unit; with several units the table gets a pair of columns
// for each unit (BranchTable).
import type { Batch, LogisticBranch } from "./types";
import type { BranchRow } from "@/components/BranchTable";
import { amountsOf, amountUnit, unitMode, transportOf, type UnitMode } from "./amounts";

/** The rows, and the one unit they are counted in (`"mixed"` when the lots use several, null with no lots). */
export function branchRows(lots: Batch[], branches: LogisticBranch[]): { rows: BranchRow[]; unit: UnitMode } {
  const unit = unitMode(lots);
  const byBranch = new Map<string, Batch[]>();
  for (const l of lots) if (l.branchId) (byBranch.get(l.branchId) ?? byBranch.set(l.branchId, []).get(l.branchId)!).push(l);
  const rows = branches
    .filter((b) => b.status === "active" || (b.status === "disabled" && byBranch.has(b.id)))
    .map((b): BranchRow => {
      const list = byBranch.get(b.id) ?? [];
      const amounts = amountsOf(list);
      const transport = list.reduce((n, l) => n + transportOf(l), 0);
      const transportBy: BranchRow["transportBy"] = {};
      for (const l of list) transportBy[amountUnit(l)] = (transportBy[amountUnit(l)] ?? 0) + transportOf(l);
      return {
        id: b.id,
        href: `/logistic/branches/${b.id}`,
        province: b.province ?? "–",
        branch: b.name,
        status: b.status,
        rounds: list.length,
        amounts,
        transportCo2e: transport,
        transportBy,
        trend: null,
      };
    })
    .sort((a, b) => Number(b.branch === "สำนักงานใหญ่") - Number(a.branch === "สำนักงานใหญ่") || b.rounds - a.rounds);
  return { rows, unit };
}
