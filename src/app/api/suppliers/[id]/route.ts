import { NextResponse } from "next/server";
import { getSupplier, getBatchesBySupplier, updateSupplier, addNotification } from "@/lib/store";
import { guard, forbidden } from "@/lib/api-guard";
import { provinceFromAddress } from "@/lib/geo";
import type { Supplier } from "@/lib/types";

// GET /api/suppliers/[id] — signed-in only; a farm may only read itself.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const g = await guard();
  if (g.deny) return g.deny;
  const { id } = await params;
  if (g.user.role === "supplier" && g.user.supplierId !== id) return forbidden();
  const supplier = await getSupplier(id);
  if (!supplier) {
    return NextResponse.json({ error: "ไม่พบ SUP ID นี้" }, { status: 404 });
  }
  const batches = await getBatchesBySupplier(id);
  return NextResponse.json({ supplier, batches });
}

// PATCH /api/suppliers/[id] — update farm profile / calc settings (owner or KYN),
// or toggle active/suspended status (KYN). Only whitelisted fields are accepted.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const g = await guard();
  if (g.deny) return g.deny;
  const { id } = await params;
  const supplier = await getSupplier(id);
  if (!supplier) {
    return NextResponse.json({ error: "ไม่พบ SUP ID นี้" }, { status: 404 });
  }

  // Authorization: the farm's own account edits its profile; a KYN operator may edit any
  // farm and is the only one who may toggle active/suspended. Everyone else is refused.
  const isKyn = g.user.role === "kyn";
  const isOwner = g.user.role === "supplier" && g.user.supplierId === id;
  if (!isKyn && !isOwner) return forbidden();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  const patch: Partial<Omit<Supplier, "id" | "createdAt">> = {};
  const strFields: (keyof Supplier)[] = [
    "farmName",
    "address",
    "owner",
    "flowerType",
    "highlights",
    "contact",
    "contactName",
    "phone",
    "lineId",
  ];
  for (const k of strFields) {
    if (body[k] != null) (patch as Record<string, unknown>)[k] = String(body[k]);
  }
  const numFields: (keyof Supplier)[] = [
    "gpsLat",
    "gpsLng",
    "fuelLitres",
    "electricityKwh",
    "fertilizerKg",
    "agriChemicalsKg",
    "waterM3",
    "wasteKg",
    "flowersPerMonth",
  ];
  for (const k of numFields) {
    if (body[k] != null && body[k] !== "")
      (patch as Record<string, unknown>)[k] = Number(body[k]);
  }
  if (Array.isArray(body.varieties)) {
    patch.varieties = (body.varieties as unknown[]).map((x) => String(x).trim()).filter(Boolean);
  }
  if (Array.isArray(body.flowerTypes)) {
    const fts = (body.flowerTypes as { type?: unknown; varieties?: unknown }[])
      .map((ft) => ({
        type: String(ft.type ?? "").trim(),
        varieties: Array.isArray(ft.varieties) ? ft.varieties.map((v) => String(v).trim()).filter(Boolean) : [],
      }))
      .filter((ft) => ft.type);
    patch.flowerTypes = fts;
    // keep the flat varieties list (feeds the round-form variety dropdown + passport) —
    // only overwrite when we actually have varieties, never wipe an existing list.
    const flat = [...new Set(fts.flatMap((ft) => ft.varieties))];
    if (flat.length) patch.varieties = flat;
    // flowerType stays single-valued (LogisticExportForm.onPickBatch / trace read it)
    if (fts[0]) patch.flowerType = fts[0].type;
  }
  if (typeof patch.address === "string") {
    patch.province = provinceFromAddress(patch.address) || supplier.province;
  }
  if (isKyn && (body.status === "active" || body.status === "suspended")) {
    patch.status = body.status;
  }
  // Subscription plan is a KYN decision (no self-serve billing yet).
  if (isKyn && (body.plan === "free" || body.plan === "pro")) {
    patch.plan = body.plan;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "ไม่มีข้อมูลให้แก้ไข" }, { status: 400 });
  }

  const updated = await updateSupplier(id, patch);
  if (patch.plan && patch.plan !== supplier.plan) {
    await addNotification({
      supplierId: id, kind: patch.plan === "pro" ? "success" : "info",
      title: patch.plan === "pro" ? "อัปเกรดเป็นแพ็กเกจ Pro แล้ว" : "แพ็กเกจเปลี่ยนเป็น Free",
      body: patch.plan === "pro" ? "ภาพรวมและแดชบอร์ดคาร์บอนเปิดใช้งานแล้ว" : "ฟีเจอร์ภาพรวมและแดชบอร์ดคาร์บอนถูกจำกัด ติดต่อ KYN หากต้องการใช้งานต่อ",
    });
  }
  if (patch.status && patch.status !== supplier.status) {
    await addNotification({
      supplierId: id, kind: patch.status === "active" ? "success" : "warning",
      title: patch.status === "active" ? "บัญชีฟาร์มเปิดใช้งานแล้ว" : "บัญชีฟาร์มถูกระงับการใช้งาน",
      body: patch.status === "active" ? "คุณสามารถเข้าสู่ระบบและบันทึกรอบส่งออกได้ตามปกติ" : "กรุณาติดต่อ KYN เพื่อขอเปิดใช้งานอีกครั้ง",
    });
  }
  return NextResponse.json(updated);
}
