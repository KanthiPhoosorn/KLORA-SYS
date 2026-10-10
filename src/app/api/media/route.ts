import { NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { addMedia, getSupplier, updateSupplier, mediaUrl, pruneMedia } from "@/lib/store";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import type { Supplier } from "@/lib/types";

// Farm photo + product photos shown on the public QR page (Super App mockup, 10 Oct 2026).
//   POST   (multipart: file, kind=farm|product [, productType] [, supplierId for KYN]) → the image goes up
//          (JPEG/PNG/WebP ≤ 1.5 MB — the browser shrinks it first) and replaces the previous one.
//   DELETE ?kind=farm|product[&productType=…][&supplierId=…] → removes it.
const MAX = 1.5 * 1024 * 1024;
const kindOf = (b: Uint8Array): string | null =>
  b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff ? "image/jpeg"
    : b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 ? "image/png"
      : b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 ? "image/webp" : null;

async function target(role: string, own: string | undefined, asked: string): Promise<Supplier | null> {
  const id = role === "kyn" ? asked : own ?? "";
  return id ? getSupplier(id) : null;
}
const keep = (s: Pick<Supplier, "photoUrl" | "productPhotos">) => [s.photoUrl, ...Object.values(s.productPhotos ?? {})];

export async function POST(req: Request) {
  const g = await guard(["supplier", "kyn"]);
  if (g.deny) return g.deny;
  const lim = await rateLimit(`media:user:${g.user.id}`, 40, 60 * 60 * 1000);
  if (!lim.allowed) return tooMany(lim.retryAfter);
  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 }); }
  const sup = await target(g.user.role, g.user.supplierId, String(form.get("supplierId") ?? ""));
  if (!sup) return NextResponse.json({ error: "ไม่พบฟาร์ม" }, { status: 404 });
  const kind = form.get("kind") === "product" ? "product" : form.get("kind") === "farm" ? "farm" : null;
  const type = String(form.get("productType") ?? "").trim();
  if (!kind) return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  if (kind === "product" && !(sup.flowerTypes ?? []).some((f) => f.type === type)) return NextResponse.json({ error: "บันทึกรายการผลผลิตนี้ก่อน แล้วจึงเพิ่มรูปสินค้า" }, { status: 400 });
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "กรุณาเลือกรูป" }, { status: 400 });
  if (file.size > MAX) return NextResponse.json({ error: "รูปใหญ่เกินไป" }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = kindOf(bytes);
  if (!mime) return NextResponse.json({ error: "รองรับเฉพาะรูป JPG, PNG หรือ WebP" }, { status: 400 });
  const url = mediaUrl(await addMedia({ supplierId: sup.id, kind, mime, size: bytes.length, data: Buffer.from(bytes).toString("base64") }));
  const patch = kind === "farm" ? { photoUrl: url } : { productPhotos: { ...(sup.productPhotos ?? {}), [type]: url } };
  await updateSupplier(sup.id, patch);
  await pruneMedia(sup.id, keep({ ...sup, ...patch })); // the replaced image goes
  return NextResponse.json({ url }, { status: 201 });
}

export async function DELETE(req: Request) {
  const g = await guard(["supplier", "kyn"]);
  if (g.deny) return g.deny;
  const q = new URL(req.url).searchParams;
  const sup = await target(g.user.role, g.user.supplierId, q.get("supplierId") ?? "");
  if (!sup) return NextResponse.json({ error: "ไม่พบฟาร์ม" }, { status: 404 });
  const kind = q.get("kind");
  if (kind !== "farm" && kind !== "product") return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  const photos = { ...(sup.productPhotos ?? {}) };
  if (kind === "product") delete photos[q.get("productType") ?? ""];
  const patch = kind === "farm" ? { photoUrl: null } : { productPhotos: photos };
  await updateSupplier(sup.id, patch as Partial<Supplier>);
  await pruneMedia(sup.id, kind === "farm" ? Object.values(photos) : [sup.photoUrl, ...Object.values(photos)]);
  return NextResponse.json({ ok: true });
}
