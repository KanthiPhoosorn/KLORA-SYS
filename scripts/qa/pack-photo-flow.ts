// Packing photos (12 Oct 2026): EXIF capture time is read correctly; the server compares it with its upload
// time (≤ 24 h → ยืนยันเวลา); unsaved photos are private to their farm; saving a round links only the farm's
// own photos (max 3); an edit can drop one (history notes it); the QR page shows them; KYN sees capture vs
// upload time; deleting the lot deletes its photos. Self-cleaning.
//   npx tsx --env-file=.env.local scripts/qa/pack-photo-flow.ts
import { neon } from "@neondatabase/serverless";
import { createHmac } from "crypto";
import { exifTakenAt } from "../../src/lib/exif";
import { isVerified } from "../../src/lib/pack-photo";
const BASE = "http://localhost:3123"; const TS = Date.now().toString(36);
const mint = (u: string) => { const p = `${u}:${Date.now() + 3600_000}`; return `${Buffer.from(p).toString("base64url")}.${createHmac("sha256", process.env.KLORA_SESSION_SECRET!).update(p).digest("base64url")}`; };
let fails = 0; const log = (n: string, ok: boolean, note = "") => { if (!ok) fails++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${note ? "  — " + note : ""}`); };

/** A minimal JPEG whose EXIF says DateTimeOriginal = `when` (+ optional OffsetTimeOriginal), in either byte order. */
function exifJpeg(when: string, offset?: string, le = true): Buffer {
  const entries: [number, number, number, Buffer][] = [];
  const u16 = (n: number) => { const b = Buffer.alloc(2); le ? b.writeUInt16LE(n) : b.writeUInt16BE(n); return b; };
  const u32 = (n: number) => { const b = Buffer.alloc(4); le ? b.writeUInt32LE(n) : b.writeUInt32BE(n); return b; };
  void entries;
  // layout: TIFF header (8) | IFD0 (2 + 12 + 4) | ExifIFD (2 + n*12 + 4) | strings
  const ifd0At = 8, exifAt = ifd0At + 18;
  const tags: [number, string][] = [[0x9003, when + "\0"], ...(offset ? [[0x9011, offset + "\0"]] as [number, string][] : [])];
  const strAt = exifAt + 2 + tags.length * 12 + 4;
  let cursor = strAt; const strs: Buffer[] = []; const ents: Buffer[] = [];
  for (const [tag, val] of tags) {
    const bytes = Buffer.from(val, "ascii");
    const inline = bytes.length <= 4;
    ents.push(Buffer.concat([u16(tag), u16(2), u32(bytes.length), inline ? Buffer.concat([bytes, Buffer.alloc(4 - bytes.length)]) : u32(cursor)]));
    if (!inline) { strs.push(bytes); cursor += bytes.length; }
  }
  const tiff = Buffer.concat([
    Buffer.from(le ? "II" : "MM", "ascii"), u16(42), u32(ifd0At),
    u16(1), u16(0x8769), u16(4), u32(1), u32(exifAt), u32(0),
    u16(tags.length), ...ents, u32(0), ...strs,
  ]);
  const app1 = Buffer.concat([Buffer.from("Exif\0\0", "ascii"), tiff]);
  const len = Buffer.alloc(2); len.writeUInt16BE(app1.length + 2);
  return Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe1]), len, app1, Buffer.from([0xff, 0xda, 0, 2, 0xff, 0xd9])]);
}
const ab = (b: Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(80, 7)]);

(async () => {
  // ---- EXIF parser -----------------------------------------------------------------------------------
  log("EXIF (little-endian, no zone) → Bangkok time", exifTakenAt(ab(exifJpeg("2026:10:10 08:30:12"))) === "2026-10-10T01:30:12.000Z", exifTakenAt(ab(exifJpeg("2026:10:10 08:30:12"))));
  log("EXIF (big-endian, zone +09:00)", exifTakenAt(ab(exifJpeg("2026:10:10 08:30:12", "+09:00", false))) === "2026-10-09T23:30:12.000Z");
  log("no EXIF / not a JPEG → nothing", exifTakenAt(ab(JPG)) === undefined && exifTakenAt(ab(Buffer.from("hello"))) === undefined);
  log("24-hour rule", isVerified(new Date(Date.now() - 3600_000).toISOString(), new Date().toISOString()) && !isVerified(new Date(Date.now() - 30 * 3600_000).toISOString(), new Date().toISOString()) && !isVerified(undefined, new Date().toISOString()));

  const sql = neon(process.env.DATABASE_URL!);
  await sql`DELETE FROM rate_limits WHERE key LIKE '%:ip:::1'`;
  const EA = `qa-pp-a-${TS}@klora-qa.test`, EB = `qa-pp-b-${TS}@klora-qa.test`; const ids: string[] = [];
  try {
    const reg = async (email: string, u: string) => { const r = await fetch(BASE + "/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ farmName: `QA Pack Photo ${u} ${TS}`, address: "อ.แม่ริม จ.เชียงใหม่", gps: "18.91, 98.94", contactName: "QA", flowerType: "มะม่วง", email, username: `qa_pp_${u}_${TS}`, password: "QaPassw0rd!", confirmPassword: "QaPassw0rd!" }) }); const j = await r.json(); return { cookie: /klora_session=([^;]+)/.exec(r.headers.get("set-cookie") || "")![1], id: j.supplier.id as string }; };
    const A = await reg(EA, "a"); ids.push(A.id);
    const B = await reg(EB, "b"); ids.push(B.id);
    const up = async (cookie: string, bytes: Buffer, takenAt?: string, src = "exif") => { const fd = new FormData(); fd.append("file", new Blob([bytes], { type: "image/jpeg" }), "pack.jpg"); if (takenAt) { fd.append("takenAt", takenAt); fd.append("takenSrc", src); } const r = await fetch(BASE + "/api/pack-photos", { method: "POST", headers: { Cookie: `klora_session=${cookie}` }, body: fd }); return { status: r.status, json: await r.json().catch(() => ({})) }; };

    const p1 = await up(A.cookie, JPG, new Date(Date.now() - 2 * 3600_000).toISOString());
    const p2 = await up(A.cookie, JPG, new Date(Date.now() - 3 * 86400_000).toISOString(), "file");
    const p3 = await up(A.cookie, JPG);
    const p4 = await up(A.cookie, JPG, new Date(Date.now() - 600_000).toISOString());
    log("photo taken 2 h ago → ยืนยันเวลา", p1.status === 201 && p1.json.verified === true && p1.json.takenSrc === "exif", JSON.stringify(p1.json).slice(0, 120));
    log("photo taken 3 days ago → ไม่ยืนยันเวลา", p2.json.verified === false && p2.json.takenSrc === "file");
    log("no capture time → ไม่ยืนยันเวลา", p3.json.verified === false && p3.json.takenSrc === "none");
    log("a future capture time is not trusted", (await up(A.cookie, JPG, new Date(Date.now() + 86400_000).toISOString())).json.takenSrc === "none");
    log("not an image → refused", (await up(A.cookie, Buffer.from("%PDF-1.4"))).status === 400);
    log("carrier cannot upload", (await up(mint("USR-0002"), JPG)).status === 403);
    const pb = await up(B.cookie, JPG, new Date().toISOString());
    const get = (url: string, cookie?: string) => fetch(BASE + url, { headers: cookie ? { Cookie: `klora_session=${cookie}` } : {} });
    log("unsaved photo: its farm can open it, others can't", (await get(p1.json.url, A.cookie)).status === 200 && (await get(p1.json.url, B.cookie)).status === 404 && (await get(p1.json.url)).status === 404);

    // saving a round links only this farm's photos, max 3
    const round = { productCategory: "fruit", productType: "มะม่วง", unit: "kg", quantity: 40, cutDate: "2026-10-09", distanceKm: 300, destination: "กรุงเทพฯ", carrier: "ไปรษณีย์ไทย", shippedWeightKg: 45, packagingItems: [] };
    const lotRes = await fetch(BASE + "/api/batches", { method: "POST", headers: { "Content-Type": "application/json", Cookie: `klora_session=${A.cookie}` }, body: JSON.stringify({ ...round, packPhotoIds: [p1.json.id, p2.json.id, pb.json.id, p3.json.id, p4.json.id] }) }).then((r) => r.json());
    const lot = lotRes.id as string;
    const linked = await sql`SELECT id FROM pack_photos WHERE batch_id = ${lot} ORDER BY uploaded_at`;
    log("round saved with 3 of its own photos (another farm's photo + the 4th ignored)", linked.length === 3 && !linked.some((r) => r.id === pb.json.id), linked.map((r) => r.id).join(","));
    log("a saved photo is public (QR page)", (await get(p1.json.url)).status === 200);
    const page = (await (await fetch(`${BASE}/t/${lot}`)).text()).replace(/<!-- -->/g, "");
    log("QR page: ภาพตอนแพ็กสินค้า + แพ็กเมื่อ (verified)", page.includes("ภาพตอนแพ็กสินค้า") && page.includes("แพ็กเมื่อ") && page.includes(p1.json.url) && page.includes("ยืนยันเวลาจากรูปถ่าย"));

    // edit: drop p2 → deleted, history notes it
    const put = await fetch(`${BASE}/api/batches/${lot}`, { method: "PUT", headers: { "Content-Type": "application/json", Cookie: `klora_session=${A.cookie}` }, body: JSON.stringify({ ...round, packPhotoIds: [p1.json.id, p3.json.id] }) }).then((r) => r.json());
    const after = await sql`SELECT id FROM pack_photos WHERE id = ${p2.json.id}`;
    log("edit dropped a photo → deleted + in the history", after.length === 0 && (put.changes as { label: string }[]).some((c) => c.label === "รูปตอนแพ็ก"), JSON.stringify(put.changes));
    const kyn = (await (await get("/kyn/incoming", mint("USR-0003"))).text());
    log("KYN incoming has the lot's photos", kyn.includes(p1.json.url) || kyn.includes(p1.json.id));
    log("another farm cannot delete a saved photo", (await fetch(BASE + p1.json.url, { method: "DELETE", headers: { Cookie: `klora_session=${B.cookie}` } })).status === 404);

    // copying a lot does not copy its photos
    log("คัดลอกรายการ starts without photos", !((await (await get(`/app/new?copy=${lot}`, A.cookie)).text()).includes(p1.json.url)));
    await sql`DELETE FROM batches WHERE id = ${lot}`;
    log("deleting the lot deletes its photos", (await sql`SELECT count(*)::int n FROM pack_photos WHERE id IN (${p1.json.id}, ${p3.json.id})`)[0].n === 0);
  } catch (e) {
    log("run", false, String((e as Error).message));
  } finally {
    if (ids.length) {
      await sql`DELETE FROM pack_photos WHERE supplier_id = ANY(${ids})`;
      await sql`DELETE FROM notifications WHERE supplier_id = ANY(${ids})`;
      await sql`DELETE FROM custom_entries WHERE supplier_id = ANY(${ids})`;
      await sql`DELETE FROM batches WHERE supplier_id = ANY(${ids})`;
      await sql`DELETE FROM suppliers WHERE id = ANY(${ids})`;
    }
    await sql`DELETE FROM rate_limits WHERE key IN (SELECT 'pack-photos:user:' || id FROM users WHERE email IN (${EA}, ${EB})) OR key = 'pack-photos:user:USR-0002'`;
    await sql`DELETE FROM users WHERE email IN (${EA}, ${EB})`;
    await sql`DELETE FROM rate_limits WHERE key LIKE '%:ip:::1' OR key LIKE 'login:acct:qa_%'`;
  }
  console.log(fails ? `${fails} failed` : "all passed");
})();
