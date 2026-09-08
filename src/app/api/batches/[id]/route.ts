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
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  const batch = await getBatch(id);
  if (!batch) {
    return NextResponse.json({ error: "ไม่พบ Batch นี้" }, { status: 404 });
  }

  // Logistic/Exporter enriches a received batch with precise transport data, then recomputes.
  const TRANSPORT = ["shippedWeightKg", "vehicleKey", "fuelKey", "isReeferUsed", "destination", "distanceKm", "packagingItems"];
  if (TRANSPORT.some((k) => k in body)) {
    const num = (v: unknown) => (v != null && v !== "" ? Number(v) : undefined);
    const patch: Record<string, unknown> = {};
    if ("shippedWeightKg" in body) patch.shippedWeightKg = num(body.shippedWeightKg);
    if (body.vehicleKey) patch.vehicleKey = String(body.vehicleKey);
    if (body.fuelKey) patch.fuelKey = String(body.fuelKey);
    if (typeof body.isReeferUsed === "boolean") patch.isReeferUsed = body.isReeferUsed;
    if (body.destination) patch.destination = String(body.destination);
    if ("distanceKm" in body) patch.distanceKm = num(body.distanceKm) ?? 0;
    if (Array.isArray(body.packagingItems)) patch.packagingItems = body.packagingItems;
    await updateBatch(id, patch);
    const updated = await computeBatch(id);
    return NextResponse.json(updated);
  }

  if (body.action === "compute") {
    if (!batch.basketIds || batch.basketIds.length === 0) {
      return NextResponse.json(
        { error: "ขาดตะกร้า (Basket) — คำนวณไม่ได้" },
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
