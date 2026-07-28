import { NextResponse } from "next/server";
import { getBatches, getBatchesBySupplier, addBatch } from "@/lib/store";
import { getCurrentUser } from "@/lib/auth";
import type { BatchStatus } from "@/lib/types";

export async function GET(req: Request) {
  const supplierId = new URL(req.url).searchParams.get("supplierId");
  const batches = supplierId
    ? await getBatchesBySupplier(supplierId)
    : await getBatches();
  return NextResponse.json(batches);
}

// POST /api/batches — the logged-in SUP logs a new cutting round for their own farm.
// supplierId is taken from the session, never from the body.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง (invalid JSON)" }, { status: 400 });
  }

  if (!body.cutDate) {
    return NextResponse.json({ error: "ต้องระบุวันที่ตัด" }, { status: 400 });
  }
  const flowerCount = Number(body.flowerCount) || 0;
  if (flowerCount <= 0) {
    return NextResponse.json({ error: "จำนวนดอกไม้ต้องมากกว่า 0" }, { status: 400 });
  }

  const status: BatchStatus = body.status === "draft" ? "draft" : "submitted";

  try {
    const batch = await addBatch({
      supplierId: user.supplierId,
      flowerCount,
      cutDate: String(body.cutDate),
      distanceKm: Number(body.distanceKm) || 0,
      destination: body.destination ? String(body.destination) : undefined,
      basketId: body.basketId ? String(body.basketId) : undefined,
      status,
    });
    return NextResponse.json(batch, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
