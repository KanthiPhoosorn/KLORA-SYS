// "ข้อมูลรายสาขา" rows: one per branch of the company — active branches (even without lots yet) and
// disabled branches that still have history (doc "Logistic", 17 Oct 2026). Pending/rejected ones are not
// branches yet. Each row links to that branch's own dashboard.
//
// Amounts never mix units (doc "Logistic", 19 Oct 2026): flowers count ดอก or ช่อ, fruit and vegetables are
// weighed in กก. (ตัน → กก.). When the lots shown use one unit the table reads "ปริมาณรวม (ดอก)" /
// "น้ำหนักรวม (กก.)" with CO₂e per that unit; with several units each cell lists them and the average is
// per รอบ, as on the dashboards.
import type { Batch, LogisticBranch } from "./types";
import type { BranchRow, AmountUnit } from "@/components/BranchTable";
import { batchCo2e, unitOf } from "./produce";

const unitKey = (l: Batch): AmountUnit => { const u = unitOf(l); return u === "ton" ? "kg" : u; };
const amountOf = (l: Batch) => { const q = l.quantity ?? l.flowerCount ?? 0; return unitOf(l) === "ton" ? q * 1000 : q; };

/** The rows, and the one unit they are counted in (`"mixed"` when the lots use several, null with no lots). */
export function branchRows(lots: Batch[], branches: LogisticBranch[]): { rows: BranchRow[]; unit: AmountUnit | "mixed" | null } {
  const units = new Set(lots.map(unitKey));
  const unit = units.size === 0 ? null : units.size > 1 ? "mixed" : [...units][0];
  const byBranch = new Map<string, Batch[]>();
  for (const l of lots) if (l.branchId) (byBranch.get(l.branchId) ?? byBranch.set(l.branchId, []).get(l.branchId)!).push(l);
  const rows = branches
    .filter((b) => b.status === "active" || (b.status === "disabled" && byBranch.has(b.id)))
    .map((b): BranchRow => {
      const list = byBranch.get(b.id) ?? [];
      const amounts: BranchRow["amounts"] = {};
      for (const l of list) amounts[unitKey(l)] = (amounts[unitKey(l)] ?? 0) + amountOf(l);
      const co2e = list.reduce((n, l) => n + batchCo2e(l), 0);
      const per = unit === "mixed" ? list.length : unit ? amounts[unit] ?? 0 : 0;
      return {
        id: b.id,
        href: `/logistic/branches/${b.id}`,
        province: b.province ?? "–",
        branch: b.name,
        status: b.status,
        rounds: list.length,
        amounts,
        transportCo2e: list.reduce((n, l) => n + (l.carbonBreakdown?.transport ?? 0), 0),
        avg: per > 0 ? co2e / per : null, // nothing to divide by → "–"
        trend: null,
      };
    })
    .sort((a, b) => Number(b.branch === "สำนักงานใหญ่") - Number(a.branch === "สำนักงานใหญ่") || b.rounds - a.rounds);
  return { rows, unit };
}
