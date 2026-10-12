import { NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { addPackPhoto } from "@/lib/store";
import { rateLimit, tooMany } from "@/lib/rate-limit";

// POST /api/pack-photos (multipart: file, takenAt?, takenSrc?) — a farm adds a photo taken while packing a
// round (12 Oct 2026). The browser shrinks + stamps it and reads its capture time (EXIF, else the file time)
// before sending; the server adds its own upload time, which is what the 24-hour check compares against.
// The photo stays unattached until the round is saved (POST/PUT /api/batches with packPhotoIds).
const MAX = 1.5 * 1024 * 1024;
const isImage = (b: Uint8Array) =>
  (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) || (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47);

export async function POST(req: Request) {
  const g = await guard(["supplier"]);
  if (g.deny) return g.deny;
  if (!g.user.supplierId) return NextResponse.json({ error: "ไม่พบฟาร์มของบัญชีนี้" }, { status: 404 });
  const lim = await rateLimit(`pack-photos:user:${g.user.id}`, 60, 60 * 60 * 1000);
  if (!lim.allowed) return tooMany(lim.retryAfter);
  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 }); }
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "กรุณาถ่ายหรือเลือกรูป" }, { status: 400 });
  if (file.size > MAX) return NextResponse.json({ error: "รูปใหญ่เกินไป" }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isImage(bytes)) return NextResponse.json({ error: "รองรับเฉพาะรูป JPG หรือ PNG" }, { status: 400 });
  // the capture time is what the phone says — kept only if it is a sane date (not in the future, ≤ 1 year old)
  const t = new Date(String(form.get("takenAt") ?? ""));
  const sane = !Number.isNaN(t.getTime()) && t.getTime() <= Date.now() + 10 * 60_000 && t.getTime() >= Date.now() - 366 * 86400_000;
  const src = form.get("takenSrc") === "exif" ? "exif" : form.get("takenSrc") === "file" ? "file" : "none";
  const photo = await addPackPhoto({
    supplierId: g.user.supplierId, mime: bytes[0] === 0xff ? "image/jpeg" : "image/png", size: bytes.length,
    data: Buffer.from(bytes).toString("base64"), takenAt: sane ? t.toISOString() : undefined, takenSrc: sane ? src : "none", createdBy: g.user.id,
  });
  return NextResponse.json(photo, { status: 201 });
}
