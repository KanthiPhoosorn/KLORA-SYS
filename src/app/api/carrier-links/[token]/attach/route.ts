import { NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { getCarrierLink, getSupplier, useCarrierLink, bindingOf, updateSupplier } from "@/lib/store";

// POST /api/carrier-links/[token]/attach — a farm that already has an account opens a carrier's link and
// binds itself to that carrier. The binding comes from the stored link only; a farm already bound to a
// different carrier is refused (KYN can unbind it on /kyn/suppliers).
export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const g = await guard(["supplier"]);
  if (g.deny) return g.deny;
  const { token } = await params;
  const supplier = g.user.supplierId ? await getSupplier(g.user.supplierId) : null;
  if (!supplier) return NextResponse.json({ error: "ไม่พบฟาร์มของบัญชีนี้" }, { status: 404 });
  const link = await getCarrierLink(token);
  if (!link || link.revokedAt) return NextResponse.json({ error: "ลิงก์นี้ถูกปิดแล้ว — ขอลิงก์ใหม่จากผู้ขนส่ง" }, { status: 410 });
  if (supplier.carrierOrg === link.orgCode) return NextResponse.json({ ok: true, already: true });
  if (supplier.carrierOrg) {
    return NextResponse.json({ error: `ฟาร์มนี้ผูกกับ ${supplier.carrierCompany ?? "ผู้ขนส่งรายอื่น"} อยู่แล้ว — ติดต่อ KYN หากต้องการเปลี่ยน` }, { status: 409 });
  }
  const used = await useCarrierLink(token);
  if (!used) return NextResponse.json({ error: "ลิงก์นี้ถูกปิดแล้ว — ขอลิงก์ใหม่จากผู้ขนส่ง" }, { status: 410 });
  await updateSupplier(supplier.id, bindingOf(used));
  return NextResponse.json({ ok: true, company: used.company ?? null });
}
