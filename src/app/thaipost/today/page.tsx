import { getPrints, getBatches } from "@/lib/store";
import { StatCard } from "@/components/ui";
import { isSameBangkokDay } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const [prints, batches] = await Promise.all([getPrints(), getBatches()]);
  const nowIso = new Date().toISOString();

  const printedToday = prints.filter((p) => isSameBangkokDay(p.printedAt, nowIso)).length;

  // Computed rounds that haven't been printed yet (waiting to be labelled).
  const printedBatchIds = new Set(prints.map((p) => p.batchId));
  const waiting = batches.filter(
    (b) => b.status === "computed" && !printedBatchIds.has(b.id),
  ).length;

  // Distinct sorting points seen in the log.
  const sortingPoints = new Set(
    prints.map((p) => p.sortingPoint).filter(Boolean),
  ).size;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">สรุปวันนี้</h1>
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="พิมพ์แล้ววันนี้" value={printedToday} accent="blue" />
        <StatCard label="รอค้นหา/พิมพ์" value={waiting} accent="orange" />
        <StatCard label="จุดคัดแยก" value={sortingPoints} />
      </section>
    </div>
  );
}
