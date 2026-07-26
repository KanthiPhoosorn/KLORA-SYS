import { NextResponse } from "next/server";
import { getBatches, getBatchesBySupplier, addBatch } from "@/lib/store";
import type { BatchInput } from "@/lib/types";

export async function GET(req: Request) {
  const supplierId = new URL(req.url).searchParams.get("supplierId");
  const batches = supplierId
    ? await getBatchesBySupplier(supplierId)
    : await getBatches();
  return NextResponse.json(batches);
}

export async function POST(req: Request) {
  let body: Partial<BatchInput>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง (invalid JSON)" }, { status: 400 });
  }

  if (!body.supplierId) {
    return NextResponse.json({ error: "ต้องระบุ supplierId" }, { status: 400 });
  }
  if (!body.cutDate) {
    return NextResponse.json({ error: "ต้องระบุวันที่ตัด (cutDate)" }, { status: 400 });
  }

  const input: BatchInput = {
    supplierId: String(body.supplierId),
    flowerCount: Number(body.flowerCount) || 0,
    cutDate: String(body.cutDate),
    distanceKm: Number(body.distanceKm) || 0,
  };

  try {
    const batch = await addBatch(input);
    return NextResponse.json(batch, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 400 },
    );
  }
}
