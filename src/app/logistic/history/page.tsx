import { requireRole } from "@/lib/auth";
import { getBatches, getPrints } from "@/lib/store";
import LogisticHistory, { type PrintRow, type ShipRow, type ShipState } from "@/components/LogisticHistory";

export const dynamic = "force-dynamic";

export default async function LogisticHistoryPage() {
  await requireRole("logistic");
  const [batches, prints] = await Promise.all([getBatches(), getPrints()]);

  const activeByBatch = new Set(prints.filter((p) => !p.cancelled && p.batchId).map((p) => p.batchId!));
  const anyByBatch = new Set(prints.filter((p) => p.batchId).map((p) => p.batchId!));

  // ประวัติการพิมพ์ QR code — actual (non-cancelled) prints, newest first
  const printRows: PrintRow[] = prints
    .filter((p) => !p.cancelled)
    .sort((a, b) => b.printedAt.localeCompare(a.printedAt))
    .map((p) => ({
      id: p.id,
      supplierId: p.supplierId,
      printedAtIso: p.printedAt,
      batchId: p.batchId ?? p.supplierId,
      destination: p.destination ?? "—",
    }));

  // ประวัติการจัดส่ง — every shipment batch, newest first
  const shipRows: ShipRow[] = batches
    .filter((b) => b.status === "computed" || b.status === "submitted")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((b) => {
      let state: ShipState;
      if (activeByBatch.has(b.id)) state = "printed";
      else if (b.status !== "computed") state = "waiting";
      else if (anyByBatch.has(b.id)) state = "reprint"; // had a cancelled print → needs reprint
      else state = "computed";
      return {
        batchId: b.id,
        supplierId: b.supplierId,
        shipDateIso: b.entryDate,
        cutDateIso: b.cutDate,
        flowerCount: b.flowerCount,
        destination: b.destination ?? "—",
        state,
      };
    });

  return <LogisticHistory printRows={printRows} shipRows={shipRows} />;
}
