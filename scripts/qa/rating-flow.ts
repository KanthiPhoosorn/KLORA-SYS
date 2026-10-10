// Satisfaction ratings (Thai Post doc §15): a buyer rates the farm (สวน) and the carrier (การขนส่ง) on the QR
// page; the page shows the averages of that farm and that carrier; comments reach the back offices only.
// QA carrier + QA farm; self-cleaning.   npx tsx --env-file=.env.local scripts/qa/rating-flow.ts
import { neon } from "@neondatabase/serverless";
import { createHmac } from "crypto";
const BASE = "http://localhost:3123"; const TS = Date.now().toString(36);
const mint = (u: string) => { const p = `${u}:${Date.now() + 3600_000}`; return `${Buffer.from(p).toString("base64url")}.${createHmac("sha256", process.env.KLORA_SESSION_SECRET!).update(p).digest("base64url")}`; };
const api = async (path: string, method: string, body?: unknown, cookie?: string, raw?: string) => { const r = await fetch(BASE + path, { method, redirect: "manual", headers: { "Content-Type": "application/json", ...(raw ? { Cookie: raw } : cookie ? { Cookie: `klora_session=${cookie}` } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, json: await r.json().catch(() => ({})), set: r.headers.get("set-cookie") || "" }; };
const html = async (path: string, raw?: string) => (await (await fetch(BASE + path, { headers: raw ? { Cookie: raw } : {} })).text()).replace(/<!-- -->/g, "");
let fails = 0; const log = (n: string, ok: boolean, note = "") => { if (!ok) fails++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${note ? "  — " + note : ""}`); };
const EC = `qa-rt-c-${TS}@klora-qa.test`, EF = `qa-rt-f-${TS}@klora-qa.test`;
const COMMENT = `ส่งเร็ว ดอกสดมาก QA ${TS}`;

(async () => {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`DELETE FROM rate_limits WHERE key LIKE '%:ip:::1'`;
  let supId = "";
  try {
    const C = await api("/api/auth/register-logistic", "POST", { username: `qa_rt_c_${TS}`, email: EC, company: `QA ขนส่ง ${TS}`, branch: "สาขาเชียงใหม่", password: "QaPassw0rd!", confirmPassword: "QaPassw0rd!" });
    const cCookie = /klora_session=([^;]+)/.exec(C.set)![1];
    const [cu] = await sql`SELECT org_code, company FROM users WHERE email = ${EC}`;
    const F = await api("/api/auth/register", "POST", { farmName: `QA Rating Farm ${TS}`, address: "อ.แม่ริม จ.เชียงใหม่", gps: "18.91, 98.94", contactName: "QA", flowerType: "มะม่วง", email: EF, username: `qa_rt_f_${TS}`, password: "QaPassw0rd!", confirmPassword: "QaPassw0rd!" });
    const fCookie = /klora_session=([^;]+)/.exec(F.set)![1]; supId = F.json.supplier.id;
    const b = await api("/api/batches", "POST", { productCategory: "fruit", productType: "มะม่วง", unit: "kg", quantity: 40, cutDate: "2026-10-09", distanceKm: 300, destination: "กรุงเทพฯ", carrier: "ขนส่งเอกชน", provider: "Kerry Express", shippedWeightKg: 45, packagingItems: [] }, fCookie);
    const lot = b.json.id as string;
    log("fixture lot", b.status === 201 && !!lot, lot);

    log("no rating before the QR is printed", (await api("/api/ratings", "POST", { batchId: lot, farm: 5 })).status === 409);
    log("QR page has no rating form before printing", !(await html(`/t/${lot}`)).includes("ให้คะแนนความพึงพอใจ"));
    const pr = await api("/api/prints", "POST", { supplierId: supId, batchId: lot }, cCookie);
    log("print records the carrier org", pr.status === 201 && (await sql`SELECT org_code FROM prints WHERE id = ${pr.json.id}`)[0]?.org_code === cu.org_code);
    log("QR page offers the rating form + 'no score yet'", (await html(`/t/${lot}`)).includes("ให้คะแนนความพึงพอใจ") && (await html(`/t/${lot}`)).includes("ยังไม่มีคะแนน"));

    // device 1
    const r1 = await api("/api/ratings", "POST", { batchId: lot, farm: 5, transport: 4, comment: COMMENT });
    const dev1 = /corta_rater=([^;]+)/.exec(r1.set)?.[1] ?? "";
    log("rated: farm 5 · transport 4, device cookie set (httpOnly)", r1.status === 200 && r1.json.summary?.farm?.avg === 5 && r1.json.summary?.transport?.avg === 4 && dev1.length >= 16 && /HttpOnly/i.test(r1.set), JSON.stringify(r1.json.summary));
    const [row] = await sql`SELECT carrier_key, carrier_name, supplier_id FROM ratings WHERE batch_id = ${lot}`;
    log("transport score belongs to the carrier that handled the lot", row?.carrier_key === cu.org_code && row?.carrier_name === cu.company && row?.supplier_id === supId, JSON.stringify(row));
    const again = await api("/api/ratings", "POST", { batchId: lot, farm: 3 }, undefined, `corta_rater=${dev1}`);
    log("same device again replaces its rating (one per device)", again.status === 200 && again.json.summary.farm.n === 1 && again.json.summary.farm.avg === 3 && again.json.summary.transport.n === 0, JSON.stringify(again.json.summary));
    // device 2
    const r2 = await api("/api/ratings", "POST", { batchId: lot, farm: 5, transport: 5 });
    log("another device adds to the averages", r2.json.summary?.farm?.n === 2 && r2.json.summary?.farm?.avg === 4 && r2.json.summary?.transport?.avg === 5, JSON.stringify(r2.json.summary));
    log("bad stars refused", (await api("/api/ratings", "POST", { batchId: lot, farm: 9 })).status === 400 && (await api("/api/ratings", "POST", { batchId: lot })).status === 400);
    log("unknown lot refused", (await api("/api/ratings", "POST", { batchId: "LOT-0000-0000", farm: 5 })).status === 404);

    // QR page: averages of this farm + this carrier; no comments
    const page = await html(`/t/${lot}`);
    log("QR page shows the farm average (4.0 · 2) and the carrier average (5.0 · 1)", page.includes("4.0") && page.includes("2 คะแนน") && page.includes("5.0") && page.includes(cu.company));
    log("comments are not public", !page.includes(COMMENT));
    log("this device sees its own rating to edit", (await html(`/t/${lot}`, `corta_rater=${dev1}`)).includes("ขอบคุณสำหรับคะแนน"));

    // back offices
    const farmHome = await html("/app", `klora_session=${fCookie}`);
    log("farm overview: its ratings + the comment", farmHome.includes("ความพึงพอใจของผู้ซื้อ") && farmHome.includes("คะแนนสวน"));
    const carrierHome = await html("/logistic", `klora_session=${cCookie}`);
    log("carrier overview: its transport score", carrierHome.includes("ความพึงพอใจของผู้ซื้อ") && carrierHome.includes("คะแนนการขนส่ง") && carrierHome.includes("5.0"));
    const kyn = await html("/kyn", `klora_session=${mint("USR-0003")}`);
    log("KYN overview: by farm + by carrier", kyn.includes("รายสวน") && kyn.includes("รายผู้ขนส่ง") && kyn.includes(`QA Rating Farm ${TS}`) && kyn.includes(cu.company));
    const other = await html("/logistic", `klora_session=${mint("USR-0002")}`);
    log("another carrier does not see these ratings", !other.includes(cu.company));
  } catch (e) {
    log("run", false, String((e as Error).message));
  } finally {
    if (supId) {
      await sql`DELETE FROM prints WHERE supplier_id = ${supId}`;
      await sql`DELETE FROM notifications WHERE supplier_id = ${supId}`;
      await sql`DELETE FROM custom_entries WHERE supplier_id = ${supId}`;
      await sql`DELETE FROM batches WHERE supplier_id = ${supId}`; // ratings + history go with their lot
      await sql`DELETE FROM ratings WHERE supplier_id = ${supId}`;
      await sql`DELETE FROM suppliers WHERE id = ${supId}`;
    }
    await sql`DELETE FROM users WHERE email IN (${EC}, ${EF})`;
    await sql`DELETE FROM rate_limits WHERE key LIKE 'ratings:ip:%' OR key LIKE '%:ip:::1' OR key LIKE 'login:acct:qa_%'`;
  }
  console.log(fails ? `${fails} failed` : "all passed");
})();
