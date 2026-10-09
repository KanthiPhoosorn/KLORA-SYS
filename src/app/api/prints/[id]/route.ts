import { NextResponse } from "next/server";
import { updatePrint, addNotification, addBatchEvent } from "@/lib/store";
import { guard } from "@/lib/api-guard";

// PATCH /api/prints/[id] (logistic / KYN) — { cancelled: true } marks a misprint cancelled
// so the batch becomes "not yet printed" again and can be reprinted as a new record.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const g = await guard(["logistic", "kyn"]);
  if (g.deny) return g.deny;
  const { id } = await params;
  let body: { cancelled?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }
  const updated = await updatePrint(id, { cancelled: body.cancelled !== false });
  if (!updated) {
    return NextResponse.json({ error: "ไม่พบรายการพิมพ์" }, { status: 404 });
  }
  // ผู้ขนส่งยกเลิกการพิมพ์ QR → the farm's round is "รอสั่งพิมพ์" again and can be edited / cancelled (§5.7)
  if (updated.cancelled && updated.batchId) {
    await addBatchEvent({ batchId: updated.batchId, actorId: g.user.id, actorName: g.user.username, action: "print_cancel" });
    await addNotification({ supplierId: updated.supplierId, kind: "warning", title: `ผู้ขนส่งยกเลิกการพิมพ์ QR ของ ${updated.batchId}`, body: "สถานะกลับเป็น “รอสั่งพิมพ์” — แก้ไขข้อมูลหรือยกเลิกรายการได้อีกครั้ง" });
  }
  return NextResponse.json(updated);
}
