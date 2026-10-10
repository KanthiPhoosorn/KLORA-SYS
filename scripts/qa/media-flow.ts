// Farm + product photos for the QR page (Super App mockup, 10 Oct 2026): a farm uploads them on ข้อมูลฟาร์ม;
// the QR page shows the product photo in its hero and the farm photo on the farm card + sheet; replaced /
// removed photos are deleted; uploads are images only and only for the farm itself (or KYN). Self-cleaning.
//   npx tsx --env-file=.env.local scripts/qa/media-flow.ts
import { neon } from "@neondatabase/serverless";
import { createHmac } from "crypto";
const BASE = "http://localhost:3123"; const TS = Date.now().toString(36);
const mint = (u: string) => { const p = `${u}:${Date.now() + 3600_000}`; return `${Buffer.from(p).toString("base64url")}.${createHmac("sha256", process.env.KLORA_SESSION_SECRET!).update(p).digest("base64url")}`; };
let fails = 0; const log = (n: string, ok: boolean, note = "") => { if (!ok) fails++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${note ? "  — " + note : ""}`); };
// a 1×1 PNG and a tiny JPEG header + body (the server checks the first bytes)
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1)]);
const up = async (cookie: string, bytes: Buffer, kind: string, extra: Record<string, string> = {}) => {
  const fd = new FormData(); fd.append("file", new Blob([bytes], { type: "image/jpeg" }), "photo.jpg"); fd.append("kind", kind); for (const [k, v] of Object.entries(extra)) fd.append(k, v);
  const r = await fetch(BASE + "/api/media", { method: "POST", headers: { Cookie: `klora_session=${cookie}` }, body: fd });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};
const EA = `qa-media-a-${TS}@klora-qa.test`, EB = `qa-media-b-${TS}@klora-qa.test`;

(async () => {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`DELETE FROM rate_limits WHERE key LIKE '%:ip:::1'`;
  const ids: string[] = [];
  try {
    const reg = async (email: string, u: string) => { const r = await fetch(BASE + "/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ farmName: `QA Media Farm ${u} ${TS}`, address: "อ.แม่ริม จ.เชียงใหม่", gps: "18.91, 98.94", contactName: "QA", flowerType: "มะม่วง", flowerTypes: [{ category: "fruit", type: "มะม่วง", varieties: ["น้ำดอกไม้สีทอง"] }], email, username: `qa_media_${u}_${TS}`, password: "QaPassw0rd!", confirmPassword: "QaPassw0rd!" }) }); const j = await r.json(); return { cookie: /klora_session=([^;]+)/.exec(r.headers.get("set-cookie") || "")![1], id: j.supplier.id as string }; };
    const A = await reg(EA, "a"); ids.push(A.id);

    const f1 = await up(A.cookie, JPG, "farm");
    const [s1] = await sql`SELECT photo_url FROM suppliers WHERE id = ${A.id}`;
    log("farm photo saved as /api/media/<id>", f1.status === 201 && s1.photo_url === f1.json.url && /^\/api\/media\/MD-/.test(f1.json.url), `${f1.status} ${f1.json.url}`);
    const pub = await fetch(BASE + f1.json.url);
    log("served publicly, cached for good", pub.status === 200 && pub.headers.get("content-type") === "image/jpeg" && /immutable/.test(pub.headers.get("cache-control") ?? ""));
    const f2 = await up(A.cookie, PNG, "farm");
    log("a new farm photo replaces the old one (old deleted)", f2.status === 201 && (await fetch(BASE + f1.json.url)).status === 404 && (await fetch(BASE + f2.json.url)).status === 200);
    const p1 = await up(A.cookie, JPG, "product", { productType: "มะม่วง" });
    log("product photo saved for มะม่วง", p1.status === 201 && (await sql`SELECT product_photos FROM suppliers WHERE id = ${A.id}`)[0].product_photos?.["มะม่วง"] === p1.json.url);
    log("product photo for a product the farm doesn't list → refused", (await up(A.cookie, JPG, "product", { productType: "ทุเรียน" })).status === 400);
    log("not an image → refused", (await up(A.cookie, Buffer.from("%PDF-1.4 nope"), "farm")).status === 400);
    log("signed out → refused", (await fetch(BASE + "/api/media", { method: "POST", body: new FormData() })).status === 401);
    const B = await reg(EB, "b"); ids.push(B.id);
    await up(B.cookie, JPG, "farm", { supplierId: A.id }); // a farm can only set its own photo — supplierId is ignored
    log("another farm cannot change this farm's photo", (await sql`SELECT photo_url FROM suppliers WHERE id = ${A.id}`)[0].photo_url === f2.json.url);
    const k = await up(mint("USR-0003"), JPG, "product", { productType: "มะม่วง", supplierId: A.id });
    log("KYN can set it for the farm", k.status === 201 && (await fetch(BASE + p1.json.url)).status === 404);

    // QR page
    const lot = await fetch(`${BASE}/api/batches`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: `klora_session=${A.cookie}` }, body: JSON.stringify({ productCategory: "fruit", productType: "มะม่วง", variety: "น้ำดอกไม้สีทอง", unit: "kg", quantity: 40, cutDate: "2026-10-09", distanceKm: 300, destination: "กรุงเทพฯ", carrier: "ไปรษณีย์ไทย", shippedWeightKg: 45, packagingItems: [] }) }).then((r) => r.json());
    const page = (await (await fetch(`${BASE}/t/${lot.id}`)).text()).replace(/<!-- -->/g, "");
    log("QR page: product photo in the hero, farm photo on card + sheet", page.includes(k.json.url) && page.split(f2.json.url).length - 1 >= 2);
    log("QR page tiles: CO₂e รวม instead of weight", page.includes("CO₂e รวม") && !page.includes("น้ำหนักรวม<"));
    log("farm sheet: ข้อมูลแหล่งผลิต + the three rows", ["ข้อมูลแหล่งผลิต", "มาตรฐานการผลิต", "ตรวจสอบย้อนกลับ", "การดูแลสิ่งแวดล้อม"].every((t) => page.includes(t)));

    // removing
    const del = await fetch(`${BASE}/api/media?kind=farm`, { method: "DELETE", headers: { Cookie: `klora_session=${A.cookie}` } });
    log("farm photo removed → file deleted, page falls back to the greenhouse picture", del.status === 200 && (await fetch(BASE + f2.json.url)).status === 404 && (await (await fetch(`${BASE}/t/${lot.id}`)).text()).includes("/figma/greenhouse.webp"));
  } catch (e) {
    log("run", false, String((e as Error).message));
  } finally {
    if (ids.length) {
      await sql`DELETE FROM media WHERE supplier_id = ANY(${ids})`;
      await sql`DELETE FROM notifications WHERE supplier_id = ANY(${ids})`;
      await sql`DELETE FROM custom_entries WHERE supplier_id = ANY(${ids})`;
      await sql`DELETE FROM batches WHERE supplier_id = ANY(${ids})`;
      await sql`DELETE FROM suppliers WHERE id = ANY(${ids})`;
    }
    await sql`DELETE FROM rate_limits WHERE key IN (SELECT 'media:user:' || id FROM users WHERE email IN (${EA}, ${EB})) OR key = 'media:user:USR-0003'`;
    await sql`DELETE FROM users WHERE email IN (${EA}, ${EB})`;
    await sql`DELETE FROM rate_limits WHERE key LIKE '%:ip:::1' OR key LIKE 'login:acct:qa_%'`;
  }
  console.log(fails ? `${fails} failed` : "all passed");
})();
