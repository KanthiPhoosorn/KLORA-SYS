import { NextResponse } from "next/server";
import { getPrints, addPrint, getBatch } from "@/lib/store";
import { guard } from "@/lib/api-guard";

// Print logs are an operator concern (logistic / KYN) — never public.
export async function GET() {
  const g = await guard(["logistic", "kyn"]);
  if (g.deny) return g.deny;
  const prints = await getPrints();
  return NextResponse.json(prints);
}

// POST /api/prints — Thai Post logs a QR label print (feeds the KYN Shipment/QR log).
export async function POST(req: Request) {
  const g = await guard(["logistic", "kyn"]);
  if (g.deny) return g.deny;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  const supplierId = String(body.supplierId ?? "").trim();
  if (!supplierId) {
    return NextResponse.json({ error: "ต้องระบุ supplierId" }, { status: 400 });
  }

  const batchId = body.batchId ? String(body.batchId) : undefined;
  let destination = body.destination ? String(body.destination) : undefined;
  if (!destination && batchId) {
    destination = (await getBatch(batchId))?.destination;
  }

  const log = await addPrint({
    supplierId,
    batchId,
    destination,
    printedBy: body.printedBy ? String(body.printedBy) : "Thaipost",
    sortingPoint: body.sortingPoint ? String(body.sortingPoint) : undefined,
  });
  return NextResponse.json(log, { status: 201 });
}
