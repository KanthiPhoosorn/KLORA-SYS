import { NextResponse } from "next/server";
import { getSupplier, getBatchesBySupplier, updateSupplier } from "@/lib/store";
import { getCurrentUser } from "@/lib/auth";
import { provinceFromAddress } from "@/lib/geo";
import type { Supplier } from "@/lib/types";

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

// PATCH /api/suppliers/[id] — update farm profile / calc settings (owner or KYN),
// or toggle active/suspended status (KYN). Only whitelisted fields are accepted.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supplier = await getSupplier(id);
  if (!supplier) {
    return NextResponse.json({ error: "ไม่พบ SUP ID นี้" }, { status: 404 });
  }

  // Authorization: the farm's own logged-in user may edit its profile. Status changes
  // and edits without a matching session are treated as KYN operator actions (open
  // console, as in the spec). A production deployment would add a KYN role check here.
  const user = await getCurrentUser();
  const isOwner = user?.supplierId === id;

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
    "basketId",
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
    "reuseCycles",
  ];
  for (const k of numFields) {
    if (body[k] != null && body[k] !== "")
      (patch as Record<string, unknown>)[k] = Number(body[k]);
  }
  if (typeof patch.address === "string") {
    patch.province = provinceFromAddress(patch.address) || supplier.province;
  }
  if (body.status === "active" || body.status === "suspended") {
    patch.status = body.status;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "ไม่มีข้อมูลให้แก้ไข" }, { status: 400 });
  }
  void isOwner; // owner vs KYN-operator distinction reserved for future role hardening

  const updated = await updateSupplier(id, patch);
  return NextResponse.json(updated);
}
