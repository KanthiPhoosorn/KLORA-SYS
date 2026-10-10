import { NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { addCertFile, getSupplier, updateSupplier, pruneCertFiles } from "@/lib/store";
import { rateLimit, tooMany } from "@/lib/rate-limit";

// POST /api/cert-files (multipart: file [, certIndex]) — a farm attaches its certificate (Thai Post doc §17):
// PDF / JPG / PNG up to 2 MB, checked by its first bytes. With certIndex (right after sign-up) the file is
// put on that certificate straight away; without it the id is returned and saved with the farm's profile.
const MAX = 2 * 1024 * 1024;
const kindOf = (b: Uint8Array): string | null =>
  b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 ? "application/pdf"
    : b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 ? "image/png"
      : b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff ? "image/jpeg" : null;

export async function POST(req: Request) {
  const g = await guard(["supplier", "kyn"]);
  if (g.deny) return g.deny;
  const lim = await rateLimit(`cert-files:user:${g.user.id}`, 30, 60 * 60 * 1000);
  if (!lim.allowed) return tooMany(lim.retryAfter);
  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 }); }
  // a farm uploads its own; KYN may upload for a named farm (from /kyn/suppliers)
  const supplierId = g.user.role === "kyn" ? String(form.get("supplierId") ?? "") : g.user.supplierId ?? "";
  if (!supplierId || !(await getSupplier(supplierId))) return NextResponse.json({ error: "ไม่พบฟาร์ม" }, { status: 404 });
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "กรุณาเลือกไฟล์" }, { status: 400 });
  if (file.size > MAX) return NextResponse.json({ error: "ไฟล์ต้องไม่เกิน 2 MB" }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = kindOf(bytes);
  if (!mime) return NextResponse.json({ error: "รองรับเฉพาะไฟล์ PDF, JPG หรือ PNG" }, { status: 400 });
  const name = (file.name || "certificate").replace(/[\\/\r\n"]/g, "_").slice(0, 120);
  const saved = await addCertFile({ supplierId, name, mime, size: bytes.length, data: Buffer.from(bytes).toString("base64"), uploadedBy: g.user.id });

  const idx = form.get("certIndex");
  if (idx != null && idx !== "") {
    const i = Number(idx);
    const sup = await getSupplier(supplierId);
    const certs = sup?.certifications ?? [];
    if (!Number.isInteger(i) || i < 0 || i >= certs.length) return NextResponse.json({ error: "ไม่พบใบรับรองนี้" }, { status: 400 });
    const next = certs.map((c, j) => (j === i ? { ...c, fileId: saved.id, fileName: saved.name } : c));
    await updateSupplier(supplierId, { certifications: next });
    await pruneCertFiles(supplierId, next.map((c) => c.fileId).filter((x): x is string => !!x)); // a replaced file goes
  }
  return NextResponse.json(saved, { status: 201 });
}
