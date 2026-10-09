import { NextResponse } from "next/server";
import { getBatch, computeBatch, updateBatch, addNotification, getSupplier, addBatchEvent, activePrintOf } from "@/lib/store";
import { parseRound, type RoundFields } from "@/lib/round-parse";
import { flowerAgeDays } from "@/lib/carbon";
import { queueRoundOthers } from "@/lib/custom-queue";
import type { Batch } from "@/lib/types";
import { flightDistanceKm, roadToAirportKm } from "@/lib/airports";
import { parsePackagingItems, basketIdsOf } from "@/lib/packaging-parse";
import { queueTransportOthers, queuePackagingOthers } from "@/lib/custom-queue";
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
  const { id: rawId } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  const batch = await getBatch(rawId);
  if (!batch) {
    return NextResponse.json({ error: "ไม่พบล็อตนี้" }, { status: 404 });
  }
  const id = batch.id; // the current LOT code even when called with an old BAT id
  if (g.user.role === "supplier" && batch.supplierId !== g.user.supplierId) return forbidden();

  // ยกเลิกรายการ (farm / KYN) — only while waiting to be printed; a soft cancel kept for history,
  // out of every total, and its reusable packaging gives the trip back (Thai Post doc §5.6).
  if (body.action === "cancel") {
    if (g.user.role === "logistic") return forbidden();
    if (batch.cancelledAt) return NextResponse.json({ error: "รายการนี้ถูกยกเลิกแล้ว" }, { status: 409 });
    if (await activePrintOf(id)) return NextResponse.json({ error: "พิมพ์ QR แล้ว · ให้ผู้ขนส่งยกเลิกการพิมพ์ก่อน" }, { status: 409 });
    const reason = String(body.reason ?? "").trim().slice(0, 200);
    if (!reason) return NextResponse.json({ error: "กรุณาเลือกเหตุผลที่ยกเลิก" }, { status: 400 });
    const updated = await updateBatch(id, { cancelledAt: new Date().toISOString(), cancelReason: reason, cancelledBy: g.user.username });
    await addBatchEvent({ batchId: id, actorId: g.user.id, actorName: g.user.username, action: "cancel", detail: { reason } });
    return NextResponse.json(updated);
  }

  // ใส่ / แก้เลขพัสดุ + น้ำหนักรวมจากใบเสร็จ — only after the QR is printed (§5.5).
  if (body.action === "tracking") {
    if (batch.cancelledAt) return NextResponse.json({ error: "รายการนี้ถูกยกเลิกแล้ว" }, { status: 409 });
    if (!(await activePrintOf(id))) return NextResponse.json({ error: "ใส่เลขพัสดุได้หลังพิมพ์ QR แล้ว" }, { status: 409 });
    const trackingNo = String(body.trackingNo ?? "").trim().toUpperCase().slice(0, 40);
    if (!trackingNo) return NextResponse.json({ error: "กรุณาระบุเลขพัสดุ" }, { status: 400 });
    const w = Number(body.weightKg);
    const patch: Partial<Batch> = { trackingNo };
    if (w > 0) patch.shippedWeightKg = w;
    await updateBatch(id, patch);
    await addBatchEvent({ batchId: id, actorId: g.user.id, actorName: g.user.username, action: "tracking", detail: { trackingNo, weightKg: w > 0 ? w : undefined, before: batch.trackingNo } });
    // the receipt weight is the real parcel weight → transport CO₂e follows it
    const updated = w > 0 ? await computeBatch(id, { advanceShipment: false }) : await getBatch(id);
    return NextResponse.json(updated);
  }

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
    const items = parsePackagingItems(body.packagingItems);
    if (items) {
      await queuePackagingOthers(items, { userId: g.user.id, batchId: id, supplierId: batch.supplierId }).catch(() => undefined);
      patch.packagingItems = items;
      if (items.some((p) => p.usage)) patch.basketIds = basketIdsOf(items);
    }
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
    await queueTransportOthers({ vehicleOther: body.vehicleOther ? String(body.vehicleOther) : undefined, fuelKey: body.fuelKey ? String(body.fuelKey) : undefined, airline: body.airline ? String(body.airline) : undefined, destAirport: body.destAirport ? String(body.destAirport) : undefined }, { userId: g.user.id, batchId: id, supplierId: batch.supplierId }).catch(() => undefined);
    const updated = await computeBatch(id);
    if (updated?.status === "computed") {
      await notifyFarm(batch.supplierId, `คำนวณคาร์บอน ${id} เสร็จแล้ว`, `ผู้ขนส่งบันทึกข้อมูลการขนส่ง — CO₂e รวม ${(updated.co2ePerFlower * unitsOf(updated)).toFixed(2)} kg (${updated.co2ePerFlower.toFixed(4)} kg ${perUnitLabel(updated)})`, "success");
    }
    return NextResponse.json(updated);
  }

  if (body.action === "compute") {
    // A flower round needs its packaging (baskets or boxes) declared; produce is weighed.
    if (!isWeightBased(batch) && !(batch.basketIds?.length) && !(batch.packagingItems?.length)) {
      return NextResponse.json(
        { error: "ขาดข้อมูลบรรจุภัณฑ์ — คำนวณไม่ได้" },
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

// What the edit review and the history show as "ค่าเดิม → ค่าใหม่".
const EDIT_LABELS: [keyof RoundFields, string][] = [
  ["productType", "ชนิด"], ["variety", "พันธุ์"], ["quantity", "จำนวน"], ["unit", "หน่วย"], ["cutDate", "วันที่ตัด/เก็บเกี่ยว"],
  ["expectedAgeDays", "อายุหลังตัดที่คาดการณ์ (วัน)"], ["plantingDate", "วันที่ปลูก"], ["ripenessAtHarvest", "ระยะการสุก"], ["grade", "เกรด"],
  ["destination", "จังหวัดปลายทาง"], ["destinationAddress", "ที่อยู่ปลายทาง"], ["distanceKm", "ระยะทาง (กม.)"], ["carrier", "รูปแบบการขนส่ง"],
  ["provider", "ผู้ให้บริการ"], ["postalCode", "รหัสไปรษณีย์"], ["branch", "สาขาต้นทาง"], ["shippedWeightKg", "น้ำหนักรวมหลังแพ็ก (กก.)"],
  ["packagingItems", "บรรจุภัณฑ์"],
];
const shown = (v: unknown) => (v == null || v === "" ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));

// PUT /api/batches/[id] — the farm edits its own round while it still waits to be printed
// (Thai Post doc §5.4). Same LOT code; carbon is recomputed; the change list goes to the history.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(["supplier", "kyn"]);
  if (g.deny) return g.deny;
  const { id: rawId } = await params;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 }); }
  const batch = await getBatch(rawId);
  if (!batch) return NextResponse.json({ error: "ไม่พบล็อตนี้" }, { status: 404 });
  if (g.user.role === "supplier" && batch.supplierId !== g.user.supplierId) return forbidden();
  if (batch.cancelledAt) return NextResponse.json({ error: "รายการนี้ถูกยกเลิกแล้ว" }, { status: 409 });
  if (await activePrintOf(batch.id)) return NextResponse.json({ error: "พิมพ์ QR แล้ว · แก้ไขไม่ได้" }, { status: 409 });
  const parsed = parseRound(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const f = parsed.fields;

  const changes = EDIT_LABELS
    .filter(([k]) => shown(f[k]) !== shown((batch as unknown as Record<string, unknown>)[k]))
    .map(([k, label]) => (k === "packagingItems"
      ? { field: k, label, from: "รายการเดิม", to: "แก้ไขรายการ" }
      : { field: k, label, from: shown((batch as unknown as Record<string, unknown>)[k]), to: shown(f[k]) }));
  // undefined → null so an emptied optional field is really cleared
  const patch = Object.fromEntries(Object.entries({ ...f, ageDays: flowerAgeDays(f.cutDate, batch.entryDate) }).map(([k, v]) => [k, v === undefined ? null : v]));
  await updateBatch(batch.id, patch as Partial<Batch>);
  await addBatchEvent({ batchId: batch.id, actorId: g.user.id, actorName: g.user.username, action: "edit", detail: { changes } });
  await queueRoundOthers(f, { supplierId: batch.supplierId, userId: g.user.id, batchId: batch.id }).catch(() => undefined);
  const updated = await computeBatch(batch.id, { advanceShipment: false }).catch(() => null);
  return NextResponse.json({ batch: updated ?? (await getBatch(batch.id)), changes });
}
