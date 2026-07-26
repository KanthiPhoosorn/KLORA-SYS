import { NextResponse } from "next/server";
import { getSuppliers, addSupplier } from "@/lib/store";
import type { SupplierInput } from "@/lib/types";

export async function GET() {
  const suppliers = await getSuppliers();
  return NextResponse.json(suppliers);
}

export async function POST(req: Request) {
  let body: Partial<SupplierInput>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง (invalid JSON)" }, { status: 400 });
  }

  // Mandatory fields per the flowchart (ข้อมูลพื้นฐานบังคับ).
  const required: (keyof SupplierInput)[] = [
    "farmName",
    "address",
    "owner",
    "flowerType",
    "highlights",
    "contact",
  ];
  const missing = required.filter((k) => !body[k]);
  if (missing.length) {
    return NextResponse.json(
      { error: `กรอกข้อมูลไม่ครบ: ${missing.join(", ")}` },
      { status: 400 },
    );
  }

  const input: SupplierInput = {
    farmName: String(body.farmName),
    address: String(body.address),
    gpsLat: Number(body.gpsLat) || 0,
    gpsLng: Number(body.gpsLng) || 0,
    owner: String(body.owner),
    flowerType: String(body.flowerType),
    highlights: String(body.highlights),
    contact: String(body.contact),
    fuelLitres: body.fuelLitres != null ? Number(body.fuelLitres) : undefined,
    electricityKwh:
      body.electricityKwh != null ? Number(body.electricityKwh) : undefined,
    fertilizerKg:
      body.fertilizerKg != null ? Number(body.fertilizerKg) : undefined,
    basketId: body.basketId ? String(body.basketId) : undefined,
    reuseCycles:
      body.reuseCycles != null ? Number(body.reuseCycles) : undefined,
  };

  const supplier = await addSupplier(input);
  return NextResponse.json(supplier, { status: 201 });
}
