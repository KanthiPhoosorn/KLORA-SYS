import { NextResponse } from "next/server";
import { getBatches, getBatchesBySupplier, addBatch, getSupplier, computeBatch, addNotification, addBatchEvent } from "@/lib/store";
import { unitsOf, perUnitLabel } from "@/lib/produce";
import { getCurrentUser } from "@/lib/auth";
import { guard } from "@/lib/api-guard";
import type { BatchStatus } from "@/lib/types";
import { parseRound } from "@/lib/round-parse";
import { queueRoundOthers, queuePackagingOthers } from "@/lib/custom-queue";

// GET /api/batches[?supplierId=] — signed-in only. A farm account only ever sees its own rounds;
// logistic / KYN may list every farm (optionally filtered).
export async function GET(req: Request) {
  const g = await guard();
  if (g.deny) return g.deny;
  const q = new URL(req.url).searchParams.get("supplierId");
  const supplierId = g.user.role === "supplier" ? (g.user.supplierId ?? "") : q;
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

  // SUP logs a round for its own farm (supplierId from session). A logistic/Exporter
  // account logs an export on behalf of a farm, passing that farm's supplierId explicitly.
  let supplierId: string;
  if (user.role === "supplier" && user.supplierId) {
    supplierId = user.supplierId;
  } else if (user.role === "logistic" && body.supplierId) {
    const sup = await getSupplier(String(body.supplierId));
    if (!sup) return NextResponse.json({ error: "ไม่พบฟาร์มที่เลือก" }, { status: 400 });
    supplierId = sup.id;
  } else {
    return NextResponse.json({ error: "เฉพาะบัญชีฟาร์มหรือผู้ส่งออกเท่านั้น" }, { status: 403 });
  }

  const parsed = parseRound(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { fields } = parsed;
  const { productCategory, packagingItems, basketIds } = fields;
  const status: BatchStatus = body.status === "draft" ? "draft" : "submitted";

  try {
    const batch = await addBatch({ ...fields, supplierId, status });
    await addBatchEvent({ batchId: batch.id, actorId: user.id, actorName: user.username, action: "create" });
    // "อื่นๆ (ระบุ)" values → KYN review queue
    await queueRoundOthers(batch, { supplierId, userId: user.id, batchId: batch.id }).catch(() => undefined);
    await queuePackagingOthers(packagingItems, { supplierId, userId: user.id, batchId: batch.id }).catch(() => undefined);
    // Auto-compute on submit so the round is printable by the carrier right away (a flower
    // round needs its packaging declared; anything incomplete stays "submitted" for KYN).
    let result = batch;
    if (status === "submitted" && ((basketIds?.length ?? 0) > 0 || (packagingItems?.length ?? 0) > 0 || productCategory !== "flower")) {
      const computed = await computeBatch(batch.id, { advanceShipment: false }).catch(() => null);
      if (computed?.status === "computed") {
        result = computed;
        await addNotification({
          supplierId, kind: "success", title: `คำนวณคาร์บอน ${batch.id} เสร็จแล้ว`,
          body: `CO₂e รวม ${(computed.co2ePerFlower * unitsOf(computed)).toFixed(2)} kg (${computed.co2ePerFlower.toFixed(4)} kg ${perUnitLabel(computed)}) — พร้อมให้ผู้ขนส่งพิมพ์ QR`,
        });
      }
    }
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
