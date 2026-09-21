// KYN spec gaps: carrier signup link, W×L×H + inner materials, air freight (DEFRA), KYN factors.
// Throw-away farm, self-cleaning; restores app_settings to how it was found.
import { neon } from "@neondatabase/serverless";
import { createHmac } from "crypto";
import { flightDistanceKm } from "../../src/lib/airports";
import { INNER_MATERIALS } from "../../src/lib/inner-materials";
import { mergeFactors, airFreightCarbon, DEFAULT_FACTORS } from "../../src/lib/factors";
const BASE = "http://localhost:3123"; const TS = Date.now().toString(36); const EMAIL = `qa-spec-${TS}@klora-qa.test`;
const mint = (u: string) => { const p = `${u}:${Date.now() + 3600_000}`; return `${Buffer.from(p).toString("base64url")}.${createHmac("sha256", process.env.KLORA_SESSION_SECRET!).update(p).digest("base64url")}`; };
const api = async (path: string, method: string, body?: unknown, cookie?: string) => { const r = await fetch(BASE + path, { method, headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: `klora_session=${cookie}` } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, json: await r.json().catch(() => ({})), cookie: /klora_session=([^;]+)/.exec(r.headers.get("set-cookie") || "")?.[1] }; };
const page = async (path: string, cookie?: string) => { const r = await fetch(BASE + path, { redirect: "manual", headers: cookie ? { Cookie: `klora_session=${cookie}` } : {} }); return { status: r.status, html: (await r.text()).replace(/<!-- -->/g, "") }; };
let fails = 0; const log = (n: string, ok: boolean, note = "") => { if (!ok) fails++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${note ? "  — " + note : ""}`); };
(async () => {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`DELETE FROM rate_limits WHERE key LIKE '%:ip:::1'`;
  const hadSettings = (await sql`SELECT key FROM app_settings WHERE key = 'factors'`).length > 0;
  const lg = mint("USR-0002"), kyn = mint("USR-0003");
  let supId = "";
  try {
    // 1) carrier signup link
    const regPage = await page("/register?via=cold_chain");
    log("register?via shows carrier banner", regPage.status === 200 && regPage.html.includes("สมัครผ่านลิงก์ของ") && regPage.html.includes("ขนส่งควบคุมอุณหภูมิ"), String(regPage.status));
    const reg = await api("/api/auth/register", "POST", { farmName: "QA Spec Farm " + TS, address: "อ.แม่ริม จ.เชียงใหม่", gps: "18.91, 98.94", contactName: "QA", flowerType: "กุหลาบ", email: EMAIL, username: "qa_spec_" + TS, password: "QaPassw0rd!", confirmPassword: "QaPassw0rd!", via: "cold_chain" });
    supId = reg.json.supplier?.id; const cookie = reg.cookie!;
    const [sup] = await sql`SELECT signup_via FROM suppliers WHERE id = ${supId}`;
    log("signupVia stored from link", sup?.signup_via === "cold_chain", String(sup?.signup_via));
    const newRound = await page("/app/new", cookie);
    log("round form offers only the linked carrier", newRound.status === 200 && newRound.html.includes("ขนส่งควบคุมอุณหภูมิ") && !newRound.html.includes(">ไปรษณีย์ไทย<"), String(newRound.status));

    // 2) W×L×H packaging + inner materials
    const mat = INNER_MATERIALS[0];
    const b = await api("/api/batches", "POST", { productCategory: "fruit", productType: "มะม่วง", unit: "kg", quantity: 50, cutDate: "2026-09-20", distanceKm: 700, carrier: "cold_chain",
      packagingItems: [{ kind: "corrugated_box", width: 30, length: 40, height: 20, quantity: 4, boxMaterial: mat.name }], innerMaterials: [{ material: mat.name, qty: 4 * mat.defaultPerBox }] }, cookie);
    log("round with W×L×H + inner material computed", b.status === 201 && b.json.status === "computed" && b.json.packagingItems?.[0]?.height === 20 && b.json.innerMaterials?.[0]?.material === mat.name, `${b.status} ${b.json.status}`);
    log("inner packaging carbon > 0", (b.json.carbonBreakdown?.innerPackaging ?? 0) > 0, String(b.json.carbonBreakdown?.innerPackaging));

    // 3) international with airports → DEFRA air leg
    const r = await api("/api/batches/" + b.json.id, "PATCH", { shippedWeightKg: 55, shipType: "international", shipDate: "2026-09-23", airline: "การบินไทย (Thai Airways)", flightNo: "TG640", destination: "ญี่ปุ่น (โตเกียว)", isReeferUsed: false, originAirport: "BKK", destAirport: "NRT" }, lg);
    const km = flightDistanceKm("BKK", "NRT"); const expAir = airFreightCarbon(55, km);
    log("flight distance from airports", r.status === 200 && Math.abs((r.json.flightDistanceKm ?? 0) - km) < 1 && r.json.originAirport === "BKK" && r.json.destAirport === "NRT", `${r.status} ${r.json.flightDistanceKm} vs ${km}`);
    log("air CO₂e = kg/1000 × km × DEFRA long-haul", Math.abs((r.json.carbonBreakdown?.air ?? 0) - expAir) < 0.01 && expAir > 0, `${r.json.carbonBreakdown?.air} vs ${expAir.toFixed(3)}`);
    log("road leg = farm → origin airport", (r.json.distanceKm ?? 0) > 500 && (r.json.distanceKm ?? 0) < 1200, String(r.json.distanceKm));
    log("transport includes air leg", (r.json.carbonBreakdown?.transport ?? 0) > (r.json.carbonBreakdown?.air ?? 0), `${r.json.carbonBreakdown?.transport}`);
    const r2 = await api("/api/batches/" + b.json.id, "PATCH", { shipType: "international", airline: "x", destAirport: "NRT", flightDistanceKm: 1000 }, lg);
    if (r2.status !== 200) console.log("r2", r2.status, JSON.stringify(r2.json).slice(0, 300));
    log("typed flight distance wins + short-haul EF", r2.json.flightDistanceKm === 1000 && Math.abs((r2.json.carbonBreakdown?.air ?? 0) - airFreightCarbon(55, 1000)) < 0.01, `${r2.json.flightDistanceKm} ${r2.json.carbonBreakdown?.air}`);
    const r3 = await api("/api/batches/" + b.json.id, "PATCH", { shipType: "domestic", shipDate: "2026-09-23", vehicleKey: "van", fuelKey: "B7" }, lg);
    log("domestic clears airports + air", r3.status === 200 && r3.json.shipType === "domestic" && r3.json.destAirport == null && r3.json.flightDistanceKm == null && !(r3.json.carbonBreakdown?.air > 0), `${r3.json.destAirport} ${r3.json.carbonBreakdown?.air}`);

    // 4) KYN factors
    const g = await api("/api/factors", "GET", undefined, cookie);
    log("factors readable by farm", g.status === 200 && g.json.factors?.packageSizes?.length > 0, String(g.status));
    log("factors PUT: farm 403", (await api("/api/factors", "PUT", g.json.factors, cookie)).status === 403);
    log("factors PUT: logistic 403", (await api("/api/factors", "PUT", g.json.factors, lg)).status === 403);
    log("recompute: logistic 403", (await api("/api/factors/recompute", "POST", undefined, lg)).status === 403);
    const put = await api("/api/factors", "PUT", g.json.factors, kyn);
    const [row] = await sql`SELECT updated_by FROM app_settings WHERE key = 'factors'`;
    log("factors PUT: KYN saves (no-op values)", put.status === 200 && row?.updated_by === "USR-0003" && put.json.factors?.air?.longHaul === g.json.factors.air.longHaul, `${put.status} ${row?.updated_by}`);
    const m = mergeFactors({ air: { longHaul: 1.2, shortHaul: -3 }, vehicleTkm: { "van|B7": 0.5, "bad key": 9 }, packageSizes: [{ label: "", w: 1, l: 1 }] });
    log("mergeFactors validates input", m.air.longHaul === 1.2 && m.air.shortHaul === DEFAULT_FACTORS.air.shortHaul && m.vehicleTkm["van|B7"] === 0.5 && !("bad key" in m.vehicleTkm) && m.packageSizes === DEFAULT_FACTORS.packageSizes);
    const fp = await page("/kyn/factors", kyn);
    log("KYN factors page renders", fp.status === 200 && fp.html.includes("ค่าสัมประสิทธิ์การปล่อยก๊าซ") && fp.html.includes("DEFRA"), String(fp.status));
    log("factors page blocked for logistic", (await page("/kyn/factors", lg)).status !== 200);
    const sm = await page("/kyn/suppliers", kyn);
    log("KYN signup links card", sm.html.includes("ลิงก์สมัครสมาชิกแยกตามขนส่ง") && sm.html.includes("/register?via=thaipost"));
    const clr = await api("/api/suppliers/" + supId, "PATCH", { signupVia: null }, kyn);
    const [sup2] = await sql`SELECT signup_via FROM suppliers WHERE id = ${supId}`;
    log("KYN clears a farm's carrier lock", clr.status === 200 && sup2?.signup_via == null, `${clr.status} ${sup2?.signup_via}`);
  } finally {
    if (!hadSettings) await sql`DELETE FROM app_settings WHERE key = 'factors'`;
    if (supId) { await sql`DELETE FROM notifications WHERE supplier_id = ${supId}`; await sql`DELETE FROM batches WHERE supplier_id = ${supId}`; await sql`DELETE FROM suppliers WHERE id = ${supId}`; }
    await sql`DELETE FROM users WHERE email = ${EMAIL}`; await sql`DELETE FROM rate_limits WHERE key LIKE '%:ip:::1' OR key LIKE 'login:acct:qa_%'`;
  }
  console.log(fails ? `${fails} failed` : "all passed");
})();
