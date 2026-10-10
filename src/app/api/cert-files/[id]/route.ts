import { NextResponse } from "next/server";
import { guard, forbidden } from "@/lib/api-guard";
import { getCertFile } from "@/lib/store";

// GET /api/cert-files/[id] — open a certificate attachment: the farm that owns it, or KYN. Never public.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(["supplier", "kyn"]);
  if (g.deny) return g.deny;
  const { id } = await params;
  const f = await getCertFile(id);
  if (!f) return NextResponse.json({ error: "ไม่พบไฟล์" }, { status: 404 });
  if (g.user.role === "supplier" && g.user.supplierId !== f.supplierId) return forbidden();
  return new Response(Buffer.from(f.data, "base64"), {
    headers: {
      "Content-Type": f.mime,
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(f.name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
