import { NextResponse } from "next/server";
import { getBatch, getSupplier, getPackPhotos, activePrintOf } from "@/lib/store";
import { harvestPhotoAt } from "@/lib/evidence";
import { buildTraceSummary } from "@/lib/trace-summary";
import { siteOrigin } from "@/lib/origin";

// GET /api/trace/[batchId] — public, read-only traceability JSON for partner apps
// (the same consumer-safe data the QR passport shows). CORS-open; no PII beyond the farm name.
export async function GET(req: Request, { params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  const batch = await getBatch(batchId);
  const supplier = batch ? await getSupplier(batch.supplierId) : null;
  if (!batch || !supplier) {
    return NextResponse.json({ error: "ไม่พบรหัสสินค้านี้" }, { status: 404, headers: { "Access-Control-Allow-Origin": "*" } });
  }
  const [photos, print] = await Promise.all([getPackPhotos(batch.id), activePrintOf(batch.id)]);
  return NextResponse.json(buildTraceSummary(batch, supplier, siteOrigin(req), { harvestPhotoAt: harvestPhotoAt(photos), labelPrintedAt: print?.printedAt }), {
    headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=60" },
  });
}
