import { NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { revokeCarrierLink } from "@/lib/store";

// PATCH /api/carrier-links/[token] { revoke: true } — the carrier closes one of its own links (farms that
// already joined stay bound; a new link can be made any time).
export async function PATCH(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const g = await guard(["logistic"]);
  if (g.deny) return g.deny;
  const { token } = await params;
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty */ }
  if (body.revoke !== true) return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  const ok = g.user.orgCode ? await revokeCarrierLink(token, g.user.orgCode) : false;
  if (!ok) return NextResponse.json({ error: "ไม่พบลิงก์นี้ หรือปิดไปแล้ว" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
