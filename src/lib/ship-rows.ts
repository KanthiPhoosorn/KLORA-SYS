// Batches + print log → the rows of the farm's shipments table (overview + ประวัติการส่งออก).
import type { Batch, PrintLog } from "./types";
import type { ShipRow } from "@/components/ShipmentsTable";
import { thaiDateShort } from "./format";
import { quantityLabel, categoryOf } from "./produce";

export function toShipRows(batches: Batch[], prints: PrintLog[]): ShipRow[] {
  const printed = new Set(prints.filter((p) => !p.cancelled && p.batchId).map((p) => p.batchId!));
  return [...batches]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((b) => ({
      id: b.id,
      shipDateIso: b.shipDate ?? b.entryDate,
      shipDate: thaiDateShort(b.shipDate ?? b.entryDate),
      cutDate: thaiDateShort(b.cutDate),
      quantity: quantityLabel(b),
      category: categoryOf(b),
      destination: b.destination ?? "",
      address: b.destinationAddress,
      carrier: b.carrier ?? "",
      trackingNo: b.trackingNo,
      awbNo: b.awbNo,
      weightKg: b.shippedWeightKg,
      status: b.cancelledAt ? "cancelled" : printed.has(b.id) ? "printed" : "wait",
      cancelReason: b.cancelReason,
    }));
}

/** Lots that count in totals (a cancelled lot is history only). */
export const activeLots = (batches: Batch[]) => batches.filter((b) => !b.cancelledAt);
