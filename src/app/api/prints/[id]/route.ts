import { NextResponse } from "next/server";
import { updatePrint } from "@/lib/store";

// PATCH /api/prints/[id] — { cancelled: true } marks a misprint cancelled so the
// batch becomes "not yet printed" again and can be reprinted as a new record.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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
  return NextResponse.json(updated);
}
