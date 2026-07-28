import { NextResponse } from "next/server";
import { getBatch, computeBatch, updateBatch } from "@/lib/store";
import type { ShipmentStatus } from "@/lib/types";

const SHIPMENT: ShipmentStatus[] = ["cutting", "in_transit", "delivered"];

// PATCH /api/batches/[id]
//   { action: "compute" }            → KYN runs the carbon calc (needs a basket)
//   { shipmentStatus: "in_transit" } → update the shipment status
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let body: { action?: string; shipmentStatus?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  const batch = await getBatch(id);
  if (!batch) {
    return NextResponse.json({ error: "ไม่พบ Batch นี้" }, { status: 404 });
  }

  if (body.action === "compute") {
    if (!batch.basketId) {
      return NextResponse.json(
        { error: "ขาด Basket ID — คำนวณไม่ได้" },
        { status: 422 },
      );
    }
    const updated = await computeBatch(id);
    return NextResponse.json(updated);
  }

  if (body.shipmentStatus) {
    if (!SHIPMENT.includes(body.shipmentStatus as ShipmentStatus)) {
      return NextResponse.json({ error: "สถานะขนส่งไม่ถูกต้อง" }, { status: 400 });
    }
    const updated = await updateBatch(id, {
      shipmentStatus: body.shipmentStatus as ShipmentStatus,
    });
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "ไม่มีการเปลี่ยนแปลง" }, { status: 400 });
}
