// Carrier export record: domestic + international on a throw-away farm; checks the status page
// shows the highlighted row. Self-cleaning.
import { neon } from "@neondatabase/serverless";
import { createHmac } from "crypto";
const BASE = "http://localhost:3123"; const TS = Date.now().toString(36); const EMAIL = `qa-exp-${TS}@klora-qa.test`;
const mint = (u: string) => { const p = `${u}:${Date.now() + 3600_000}`; return `${Buffer.from(p).toString("base64url")}.${createHmac("sha256", process.env.KLORA_SESSION_SECRET!).update(p).digest("base64url")}`; };
const api = async (path: string, method: string, body?: unknown, cookie?: string) => { const r = await fetch(BASE + path, { method, headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: `klora_session=${cookie}` } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, json: await r.json().catch(() => ({})), cookie: /klora_session=([^;]+)/.exec(r.headers.get("set-cookie") || "")?.[1] }; };
let fails = 0; const log = (n: string, ok: boolean, note = "") => { if (!ok) fails++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${note ? "  — " + note : ""}`); };
(async () => {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`DELETE FROM rate_limits WHERE key LIKE '%:ip:::1'`;
  const reg = await api("/api/auth/register", "POST", { farmName: "QA Export Farm " + TS, address: "อ.แม่ริม จ.เชียงใหม่", gps: "18.91, 98.94", contactName: "QA", flowerType: "กุหลาบ", email: EMAIL, username: "qa_exp_" + TS, password: "QaPassw0rd!", confirmPassword: "QaPassw0rd!" });
  const supId = reg.json.supplier?.id; const cookie = reg.cookie!;
  const b1 = await api("/api/batches", "POST", { flowerCount: 300, variety: "Avalanche", cutDate: "2026-09-20", distanceKm: 700, basketIds: ["B1"] }, cookie);
  const b2 = await api("/api/batches", "POST", { productCategory: "fruit", productType: "มะม่วง", unit: "kg", quantity: 50, cutDate: "2026-09-20", distanceKm: 700 }, cookie);
  log("rounds auto-computed", b1.json.status === "computed" && b2.json.status === "computed", `${b1.json.status} ${b2.json.status}`);
  const lg = mint("USR-0002");
  let r = await api("/api/batches/" + b1.json.id, "PATCH", { shippedWeightKg: 12, packagingItems: [{ kind: "basket", quantity: 1, basketNo: "B1" }], shipType: "domestic", shipDate: "2026-09-22", vehicleKey: "van", fuelKey: "B7", isReeferUsed: true, destination: "กรุงเทพฯ", distanceKm: 690, destinationAddress: "99/1 ถ.สุขุมวิท กรุงเทพฯ 10110", destLat: 13.7367, destLng: 100.5602 }, lg);
  log("domestic record saved", r.status === 200 && r.json.shipType === "domestic" && r.json.shipDate === "2026-09-22" && !!r.json.exportRecordedAt && r.json.destinationAddress?.includes("สุขุมวิท") && r.json.destLat === 13.7367, `${r.status} ${r.json.shipType} ${r.json.shipDate} ${r.json.destinationAddress}`);
  r = await api("/api/batches/" + b2.json.id, "PATCH", { shippedWeightKg: 55, packagingItems: [], shipType: "international", shipDate: "2026-09-23", airline: "การบินไทย (Thai Airways)", flightNo: "TG640", destination: "ญี่ปุ่น (โตเกียว)", destinationAddress: "1-2-3 Shibuya, Tokyo", isReeferUsed: false }, lg);
  log("international record saved", r.status === 200 && r.json.shipType === "international" && r.json.airline?.includes("การบินไทย") && r.json.flightNo === "TG640" && r.json.carrier?.startsWith("ส่งออกต่างประเทศ") && r.json.destination === "ญี่ปุ่น (โตเกียว)", `${r.status} ${r.json.carrier} ${r.json.destination}`);
  const page = await fetch(`${BASE}/logistic/status?saved=${b2.json.id}`, { headers: { Cookie: `klora_session=${lg}` } });
  const html = (await page.text()).replace(/<!-- -->/g, "");
  log("status page shows saved banner + intl row", page.status === 200 && html.includes(`บันทึกข้อมูลการจัดส่งของ ${b2.json.id} แล้ว`) && html.includes("TG640"), String(page.status));
  const dash = await fetch(`${BASE}/logistic`, { headers: { Cookie: `klora_session=${lg}` } });
  log("logistic dashboard renders", dash.status === 200, String(dash.status));
  await sql`DELETE FROM notifications WHERE supplier_id = ${supId}`; await sql`DELETE FROM batches WHERE supplier_id = ${supId}`; await sql`DELETE FROM users WHERE email = ${EMAIL}`; await sql`DELETE FROM suppliers WHERE id = ${supId}`; await sql`DELETE FROM rate_limits WHERE key LIKE '%:ip:::1' OR key LIKE 'login:acct:qa_%'`;
  console.log(fails ? `${fails} failed` : "all passed");
})();
