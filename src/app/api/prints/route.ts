import { NextResponse } from "next/server";
import { getPrints, addPrint, getBatch, addBatchEvent } from "@/lib/store";
import { guard } from "@/lib/api-guard";
import { carrierRefusal } from "@/lib/carrier-lock";

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

  const asked = body.batchId ? String(body.batchId) : undefined;
  let destination = body.destination ? String(body.destination) : undefined;
  const lot = asked ? await getBatch(asked) : null;
  if (asked && !lot) return NextResponse.json({ error: "ไม่พบล็อตนี้" }, { status: 404 });
  const refused = carrierRefusal(g.user, lot);
  if (refused) return NextResponse.json({ error: refused }, { status: 403 });
  // store the current LOT code even when an old BAT id was sent — print lookups and the history key on it
  const batchId = lot?.id;
  if (lot?.cancelledAt) return NextResponse.json({ error: `${lot.id} ถูกยกเลิกโดยฟาร์มแล้ว — พิมพ์ฉลากไม่ได้` }, { status: 409 });
  if (!destination && lot) destination = lot.destination;

  const log = await addPrint({
    supplierId,
    batchId,
    destination,
    printedBy: body.printedBy ? String(body.printedBy) : "Thaipost",
    sortingPoint: body.sortingPoint ? String(body.sortingPoint) : undefined,
  });
  if (log.batchId) await addBatchEvent({ batchId: log.batchId, actorId: g.user.id, actorName: g.user.username, action: "print" });
  return NextResponse.json(log, { status: 201 });
}
