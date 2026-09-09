import { requireRole } from "@/lib/auth";
import { getBatches } from "@/lib/store";
import BranchTable, { type BranchRow } from "@/components/BranchTable";
import { DESTINATIONS } from "@/lib/geo";
import type { Batch } from "@/lib/types";

export const dynamic = "force-dynamic";

const provinceOf = (branch?: string) =>
  DESTINATIONS.find((d) => branch?.includes(d.province) || branch?.includes(d.name))?.province ?? "—";
const transportOf = (b: Batch) => b.carbonBreakdown?.transport ?? 0;

export default async function LogisticBranchesPage() {
  await requireRole("logistic");
  const batches = await getBatches();
  const computed = batches.filter((b) => b.status === "computed");

  // Group computed batches by branch → per-branch comparison rows
  const branchMap = new Map<string, Batch[]>();
  for (const b of computed) {
    const key = b.branch || "ไม่ระบุสาขา";
    (branchMap.get(key) ?? branchMap.set(key, []).get(key)!).push(b);
  }
  const branchRows: BranchRow[] = [...branchMap.entries()]
    .map(([branch, list]) => {
      const flowers = list.reduce((n, b) => n + b.flowerCount, 0);
      const co2eTotal = list.reduce((n, b) => n + b.co2ePerFlower * b.flowerCount, 0);
      return {
        province: provinceOf(branch),
        branch,
        rounds: list.length,
        flowers,
        transportCo2e: list.reduce((n, b) => n + transportOf(b), 0),
        avgPerStem: flowers ? co2eTotal / flowers : 0,
        trend: null,
      };
    })
    .sort((a, b) => b.rounds - a.rounds);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">ข้อมูลรายสาขา</h1>
        <p className="mt-1 text-sm text-slate-500">
          เปรียบเทียบจำนวนรอบ ปริมาณดอกไม้ และการปล่อยคาร์บอนจากการขนส่งของแต่ละสาขา
        </p>
      </div>
      <BranchTable rows={branchRows} />
    </div>
  );
}
