// Thai Post doc tab (9 Oct 2026): several resource lines + new EFs, "อื่นๆ (ระบุ)" → KYN review →
// confirmed EF used by the engine, recipient-address geocoding, expected age. Self-cleaning.
import { neon } from "@neondatabase/serverless";
import { createHmac } from "crypto";
const BASE = "http://localhost:3123"; const TS = Date.now().toString(36); const EMAIL = `qa-oct-${TS}@klora-qa.test`;
const mint = (u: string) => { const p = `${u}:${Date.now() + 3600_000}`; return `${Buffer.from(p).toString("base64url")}.${createHmac("sha256", process.env.KLORA_SESSION_SECRET!).update(p).digest("base64url")}`; };
const api = async (path: string, method: string, body?: unknown, cookie?: string) => { const r = await fetch(BASE + path, { method, redirect: "manual", headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: `klora_session=${cookie}` } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, json: await r.json().catch(() => ({})), cookie: /klora_session=([^;]+)/.exec(r.headers.get("set-cookie") || "")?.[1] }; };
let fails = 0; const log = (n: string, ok: boolean, note = "") => { if (!ok) fails++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${note ? "  — " + note : ""}`); };
(async () => {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`DELETE FROM rate_limits WHERE key LIKE '%:ip:::1'`;
  const kyn = mint("USR-0003");
  let supId = "";
  try {
    const OTHER_FUEL = `ไบโอดีเซลQA${TS}`;
    const reg = await api("/api/auth/register", "POST", {
      farmName: "QA Oct Farm " + TS, address: "อ.แม่ริม จ.เชียงใหม่", gps: "18.91, 98.94", contactName: "QA", flowerType: "กุหลาบ",
      email: EMAIL, username: "qa_oct_" + TS, password: "QaPassw0rd!", confirmPassword: "QaPassw0rd!",
      resourceLines: { fuel: [{ kind: "diesel", amount: 100 }, { kind: "gasoline", amount: 50 }, { kind: "other", amount: 20, other: OTHER_FUEL }], fertilizer: [{ kind: "urea", amount: 30 }, { kind: "organic", amount: 70 }], chemical: [] },
      electricityKwh: 200, yieldLines: [{ category: "fruit", type: "มะม่วง", amount: 1000, unit: "kg" }],
    });
    supId = reg.json.supplier?.id; const cookie = reg.cookie!;
    const [s] = await sql`SELECT fuel_litres, fuel_kind, fertilizer_kg, fertilizer_kind, chemical_kind, resource_lines FROM suppliers WHERE id = ${supId}`;
    log("resource lines stored + totals derived", s?.fuel_litres === 170 && s?.fuel_kind === "diesel" && s?.fertilizer_kg === 100 && s?.fertilizer_kind === "organic" && s?.chemical_kind === "none" && s?.resource_lines?.fuel?.length === 3, JSON.stringify({ f: s?.fuel_litres, k: s?.fuel_kind, fz: s?.fertilizer_kg, fk: s?.fertilizer_kind }));
    const [q] = await sql`SELECT id, status FROM custom_entries WHERE field = 'fuel' AND value = ${OTHER_FUEL}`;
    log("อื่นๆ fuel queued for KYN", q?.status === "pending", String(q?.status));

    const b = await api("/api/batches", "POST", { productCategory: "fruit", productType: "มะม่วง", unit: "kg", quantity: 50, cutDate: "2026-10-08", distanceKm: 300, grade: `พรีเมียมQA${TS}`, provider: `ส่งด่วนQA${TS}`, branch: `สาขาลำปางQA${TS}`, carrier: "private" }, cookie);
    log("round computed", b.status === 201 && b.json.status === "computed", `${b.status} ${b.json.status}`);
    const queued = await sql`SELECT field FROM custom_entries WHERE supplier_id = ${supId} ORDER BY field`;
    log("typed grade / provider / branch queued", ["branch", "grade", "provider"].every((f) => queued.some((r) => r.field === f)), queued.map((r) => r.field).join(","));
    const before = b.json.carbonBreakdown?.farm ?? 0;

    // KYN confirms the typed fuel with a lower EF than the generic fallback → farm CO₂e drops
    log("review page: farm blocked", (await fetch(`${BASE}/kyn/review`, { redirect: "manual", headers: { Cookie: `klora_session=${cookie}` } })).status !== 200);
    const page = await fetch(`${BASE}/kyn/review`, { headers: { Cookie: `klora_session=${kyn}` } });
    log("review page lists the entry", page.status === 200 && (await page.text()).includes(OTHER_FUEL));
    const ap = await api(`/api/custom-entries/${q.id}`, "PATCH", { status: "approved", ef: 0.5 }, kyn);
    log("KYN approves with EF", ap.status === 200 && ap.json.status === "approved" && ap.json.ef === 0.5, `${ap.status}`);
    log("farm cannot review", (await api(`/api/custom-entries/${q.id}`, "PATCH", { status: "rejected" }, cookie)).status === 403);
    const re = await api(`/api/batches/${b.json.id}`, "PATCH", { action: "compute" }, kyn);
    log("confirmed EF lowers farm CO₂e", (re.json.carbonBreakdown?.farm ?? 0) < before, `${before} → ${re.json.carbonBreakdown?.farm}`);

    const geo = await api(`/api/geocode?q=${encodeURIComponent("321/12 ต.ช้างคลาน อ.เมือง จ.เชียงใหม่ 50100")}`, "GET", undefined, cookie);
    log("geocode API places the recipient address", geo.status === 200 && geo.json.point?.precision === "subdistrict" && Math.abs(geo.json.point.lat - 18.7757) < 0.05, JSON.stringify(geo.json.point ?? geo.json).slice(0, 90));
    log("geocode needs sign-in", (await api(`/api/geocode?q=abcdefgh`, "GET")).status === 401);

    const f = await api("/api/batches", "POST", { flowerCount: 100, variety: "x", cutDate: "2026-10-08", distanceKm: 100, expectedAgeDays: 14, packagingItems: [{ kind: "basket", usage: "single", quantity: 1, width: 40, length: 60, height: 30 }] }, cookie);
    log("expected age saved", f.json.expectedAgeDays === 14, String(f.json.expectedAgeDays));

    // profile picture + label size (prefs)
    const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const av = await api("/api/profile/prefs", "PATCH", { avatar: png }, cookie);
    const [u1] = await sql`SELECT avatar FROM users WHERE email = ${EMAIL}`;
    log("avatar saved", av.status === 200 && u1?.avatar === png, String(av.status));
    log("non-image avatar refused", (await api("/api/profile/prefs", "PATCH", { avatar: "data:text/html;base64,PGI+" }, cookie)).status === 400);
    log("label size saved + bad size refused", (await api("/api/profile/prefs", "PATCH", { labelSize: "80x25" }, cookie)).status === 200 && (await api("/api/profile/prefs", "PATCH", { labelSize: "99x99" }, cookie)).status === 400);
    await api("/api/profile/prefs", "PATCH", { avatar: null }, cookie);
    const [u2] = await sql`SELECT avatar FROM users WHERE email = ${EMAIL}`;
    log("avatar removed", u2?.avatar == null);
    const prof = await fetch(`${BASE}/app/profile`, { headers: { Cookie: `klora_session=${cookie}` } });
    log("profile page renders", prof.status === 200 && (await prof.text()).includes("เปลี่ยนรหัสผ่าน"));
  } finally {
    if (supId) { await sql`DELETE FROM custom_entries WHERE supplier_id = ${supId}`; await sql`DELETE FROM notifications WHERE supplier_id = ${supId}`; await sql`DELETE FROM batches WHERE supplier_id = ${supId}`; await sql`DELETE FROM suppliers WHERE id = ${supId}`; }
    await sql`DELETE FROM rate_limits WHERE key IN (SELECT 'geocode:user:' || id FROM users WHERE email = ${EMAIL})`;
    await sql`DELETE FROM users WHERE email = ${EMAIL}`; await sql`DELETE FROM rate_limits WHERE key LIKE '%:ip:::1' OR key LIKE 'login:acct:qa_%'`;
  }
  console.log(fails ? `${fails} failed` : "all passed");
})();
