import { NextResponse } from "next/server";
import { getSupplier, getBatchesBySupplier } from "@/lib/store";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supplier = await getSupplier(id);
  if (!supplier) {
    return NextResponse.json({ error: "ไม่พบ SUP ID นี้" }, { status: 404 });
  }
  const batches = await getBatchesBySupplier(id);
  return NextResponse.json({ supplier, batches });
}
