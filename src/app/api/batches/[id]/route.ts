import { NextResponse } from "next/server";
import { getBatch, computeBatch, updateBatch, addNotification, getSupplier } from "@/lib/store";
import { flightDistanceKm, roadToAirportKm } from "@/lib/airports";
import { guard, forbidden } from "@/lib/api-guard";
import { isWeightBased, unitsOf, perUnitLabel } from "@/lib/produce";
import type { ShipmentStatus } from "@/lib/types";

const SHIPMENT: ShipmentStatus[] = ["cutting", "in_transit", "delivered"];
const SHIPMENT_TH: Record<ShipmentStatus, string> = { cutting: "รอจัดส่ง", in_transit: "กำลังขนส่ง", delivered: "ส่งถึงปลายทางแล้ว" };

// Tell the farm what just happened to its round (shows in the supplier bell).
async function notifyFarm(supplierId: string, title: string, body: string, kind: "info" | "success" | "warning" = "info") {
  await addNotification({ supplierId, title, body, kind });
}

// PATCH /api/batches/[id] — signed-in only. A farm may only touch its own rounds;
// logistic / KYN operate on any batch.
//   { action: "compute" }            → KYN runs the carbon calc (needs a basket)
//   { shipmentStatus: "in_transit" } → update the shipment status
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const g = await guard();
  if (g.deny) return g.deny;
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
  if (g.user.role === "supplier" && batch.supplierId !== g.user.supplierId) return forbidden();

  // Logistic/Exporter enriches a received batch with precise transport data, then recomputes.
  const TRANSPORT = ["shippedWeightKg", "vehicleKey", "fuelKey", "isReeferUsed", "destination", "distanceKm", "packagingItems", "shipType", "innerMaterials"];
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
    if ("destinationAddress" in body) patch.destinationAddress = body.destinationAddress ? String(body.destinationAddress) : undefined;
    if (Array.isArray(body.innerMaterials)) {
      patch.innerMaterials = (body.innerMaterials as Record<string, unknown>[])
        .map((m) => ({ material: String(m.material ?? "").trim(), qty: Number(m.qty) || 0 }))
        .filter((m) => m.material && m.qty > 0);
    }
    if ("destLat" in body) patch.destLat = num(body.destLat);
    if ("destLng" in body) patch.destLng = num(body.destLng);
    // What the carrier recorded on /logistic/new — marks the round as "บันทึกการจัดส่งแล้ว".
    if (body.shipType === "domestic" || body.shipType === "international") {
      patch.shipType = body.shipType;
      patch.shipDate = body.shipDate ? String(body.shipDate) : undefined;
      patch.airline = body.shipType === "international" && body.airline ? String(body.airline) : undefined;
      patch.flightNo = body.shipType === "international" && body.flightNo ? String(body.flightNo) : undefined;
      if (body.shipType === "international") {
        patch.carrier = `ส่งออกต่างประเทศ${body.airline ? ` · ${String(body.airline)}` : ""}`;
        // Air-freight leg: airports → great-circle distance unless the carrier typed one.
        const origin = body.originAirport ? String(body.originAirport) : "BKK";
        const dest = body.destAirport ? String(body.destAirport) : undefined;
        patch.originAirport = origin;
        patch.destAirport = dest;
        const typed = num(body.flightDistanceKm);
        patch.flightDistanceKm = typed && typed > 0 ? typed : flightDistanceKm(origin, dest) || undefined;
        // Road leg = farm → origin airport (unless a distance was given explicitly).
        if (!("distanceKm" in body) || !num(body.distanceKm)) {
          const farm = await getSupplier(batch.supplierId);
          const road = farm ? roadToAirportKm(farm, origin) : 0;
          if (road > 0) patch.distanceKm = road;
        }
        if (!batch.vehicleKey && !body.vehicleKey) { patch.vehicleKey = "6_wheeler"; patch.fuelKey = "B7"; }
      } else {
        patch.originAirport = null; patch.destAirport = null; patch.flightDistanceKm = null;
      }
      patch.exportRecordedAt = new Date().toISOString();
      patch.exportRecordedBy = g.user.id;
    }
    await updateBatch(id, patch);
    const updated = await computeBatch(id);
    if (updated?.status === "computed") {
      await notifyFarm(batch.supplierId, `คำนวณคาร์บอน ${id} เสร็จแล้ว`, `ผู้ขนส่งบันทึกข้อมูลการขนส่ง — CO₂e รวม ${(updated.co2ePerFlower * unitsOf(updated)).toFixed(2)} kg (${updated.co2ePerFlower.toFixed(4)} kg ${perUnitLabel(updated)})`, "success");
    }
    return NextResponse.json(updated);
  }

  if (body.action === "compute") {
    // Flowers travel in reusable baskets (needed for the reuse amortisation); produce ships in boxes.
    if (!isWeightBased(batch) && (!batch.basketIds || batch.basketIds.length === 0)) {
      return NextResponse.json(
        { error: "ขาดตะกร้า (Basket) — คำนวณไม่ได้" },
        { status: 422 },
      );
    }
    const updated = await computeBatch(id);
    if (updated?.status === "computed") {
      await notifyFarm(batch.supplierId, `คำนวณคาร์บอน ${id} เสร็จแล้ว`, `KYN คำนวณแล้ว — CO₂e รวม ${(updated.co2ePerFlower * unitsOf(updated)).toFixed(2)} kg (${updated.co2ePerFlower.toFixed(4)} kg ${perUnitLabel(updated)})`, "success");
    }
    return NextResponse.json(updated);
  }

  // Logistics throughput (Figma #99): record forwarded / discarded flowers for a round.
  if ("forwardedCount" in body || "discardedCount" in body) {
    const clampInt = (v: unknown) => {
      const n = Math.round(Number(v));
      return Number.isFinite(n) && n >= 0 ? n : 0;
    };
    const forwarded = "forwardedCount" in body ? clampInt(body.forwardedCount) : (batch.forwardedCount ?? 0);
    const discarded = "discardedCount" in body ? clampInt(body.discardedCount) : (batch.discardedCount ?? 0);
    if (forwarded + discarded > batch.flowerCount) {
      return NextResponse.json(
        { error: `ส่งต่อ + คัดทิ้ง (${forwarded + discarded}) เกินจำนวนรับเข้า (${batch.flowerCount})` },
        { status: 422 },
      );
    }
    const updated = await updateBatch(id, { forwardedCount: forwarded, discardedCount: discarded });
    await notifyFarm(batch.supplierId, `บันทึกการส่งต่อ/คัดทิ้ง ${id}`, `ส่งต่อ ${forwarded.toLocaleString("th-TH")} ดอก · คัดทิ้ง ${discarded.toLocaleString("th-TH")} ดอก จาก ${batch.flowerCount.toLocaleString("th-TH")} ดอก`, discarded > 0 ? "warning" : "info");
    return NextResponse.json(updated);
  }

  if (body.shipmentStatus) {
    if (!SHIPMENT.includes(body.shipmentStatus as ShipmentStatus)) {
      return NextResponse.json({ error: "สถานะขนส่งไม่ถูกต้อง" }, { status: 400 });
    }
    const next = body.shipmentStatus as ShipmentStatus;
    const updated = await updateBatch(id, { shipmentStatus: next });
    if (next !== batch.shipmentStatus) {
      await notifyFarm(batch.supplierId, `สถานะขนส่ง ${id}: ${SHIPMENT_TH[next]}`, next === "delivered" ? "พัสดุถึงปลายทางเรียบร้อยแล้ว" : "ผู้ขนส่งอัปเดตสถานะพัสดุของคุณ", next === "delivered" ? "success" : "info");
    }
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "ไม่มีการเปลี่ยนแปลง" }, { status: 400 });
}
