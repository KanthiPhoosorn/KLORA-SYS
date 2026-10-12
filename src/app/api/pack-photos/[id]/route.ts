import { NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { getCurrentUser } from "@/lib/auth";
import { getPackPhotoFile, deletePendingPackPhoto } from "@/lib/store";

// GET /api/pack-photos/[id] — a packing photo. Once on a saved lot it is public (the QR page shows it);
// before that only the farm that took it can open it.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = /^PP-[A-Z0-9]{8,20}$/.test(id) ? await getPackPhotoFile(id) : null;
  if (!p) return new Response("not found", { status: 404 });
  if (!p.batchId) {
    const u = await getCurrentUser();
    if (u?.supplierId !== p.supplierId) return new Response("not found", { status: 404 });
  }
  return new Response(Buffer.from(p.data, "base64"), {
    headers: { "Content-Type": p.mime, "Cache-Control": p.batchId ? "public, max-age=86400" : "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}

// DELETE — the farm removes a photo it has not saved with a round yet (saved ones change through the edit).
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(["supplier"]);
  if (g.deny) return g.deny;
  const { id } = await params;
  const ok = g.user.supplierId ? await deletePendingPackPhoto(id, g.user.supplierId) : false;
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "ลบรูปนี้ไม่ได้" }, { status: 404 });
}
