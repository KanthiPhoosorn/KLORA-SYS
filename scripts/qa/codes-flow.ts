// New ID scheme (Thai Post doc "เปลี่ยนรหัส"): CID for organisations, LOT-YYMM-NNNN for lots, PKG for
// reusable packaging; old BAT- links still open. Throw-away farm, self-cleaning.
import { neon } from "@neondatabase/serverless";
import { createHmac } from "crypto";
import { lotYm } from "../../src/lib/ids";
const BASE = "http://localhost:3123"; const TS = Date.now().toString(36); const EMAIL = `qa-codes-${TS}@klora-qa.test`;
const mint = (u: string) => { const p = `${u}:${Date.now() + 3600_000}`; return `${Buffer.from(p).toString("base64url")}.${createHmac("sha256", process.env.KLORA_SESSION_SECRET!).update(p).digest("base64url")}`; };
const api = async (path: string, method: string, body?: unknown, cookie?: string) => { const r = await fetch(BASE + path, { method, redirect: "manual", headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: `klora_session=${cookie}` } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, json: await r.json().catch(() => ({})), cookie: /klora_session=([^;]+)/.exec(r.headers.get("set-cookie") || "")?.[1], location: r.headers.get("location") }; };
let fails = 0; const log = (n: string, ok: boolean, note = "") => { if (!ok) fails++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${note ? "  — " + note : ""}`); };
(async () => {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`DELETE FROM rate_limits WHERE key LIKE '%:ip:::1'`;
  let supId = ""; const assets: string[] = []; let lotId = "";
  try {
    const reg = await api("/api/auth/register", "POST", { farmName: "QA Codes Farm " + TS, address: "อ.แม่ริม จ.เชียงใหม่", gps: "18.91, 98.94", contactName: "QA", flowerType: "กุหลาบ", email: EMAIL, username: "qa_codes_" + TS, password: "QaPassw0rd!", confirmPassword: "QaPassw0rd!" });
    supId = reg.json.supplier?.id; const cookie = reg.cookie!;
    log("new farm id is a CID", /^CID-\d{4,}$/.test(supId) && reg.json.supplier?.code === supId, String(supId));
    const b = await api("/api/batches", "POST", { productCategory: "fruit", productType: "มะม่วง", unit: "kg", quantity: 20, cutDate: "2026-10-08", distanceKm: 300 }, cookie);
    lotId = b.json.id;
    log("new lot id is LOT-YYMM-NNNN (Thai month)", new RegExp(`^LOT-${lotYm()}-\\d{4,}$`).test(lotId), String(lotId));
    const pk = await api("/api/packaging-assets", "POST", { kind: "basket", width: 40, length: 60, height: 30 }, cookie);
    if (pk.json.id) assets.push(pk.json.id);
    log("reusable packaging code is PKG-NNNN", /^PKG-\d{4,}$/.test(pk.json.id ?? ""), String(pk.json.id));
    // old sticker link: pretend this lot was BAT-QA-<ts>
    const legacy = `BAT-QA-${TS}`;
    await sql`UPDATE batches SET legacy_id = ${legacy} WHERE id = ${lotId}`;
    const old = await fetch(`${BASE}/trace/${legacy}`, { redirect: "manual" });
    log("old /trace/BAT-… link redirects to /t/LOT-…", (old.status === 307 || old.status === 308) && (old.headers.get("location") ?? "").endsWith(`/t/${lotId}`), `${old.status} ${old.headers.get("location")}`);
    const short = await fetch(`${BASE}/t/${lotId}`);
    log("short link /t/LOT-… opens the passport", short.status === 200, String(short.status));
    const apiTrace = await fetch(`${BASE}/api/trace/${legacy}`);
    log("public trace API still answers the old id", apiTrace.status === 200 && (await apiTrace.json()).batchId === lotId);
    const head = await fetch(`${BASE}/app`, { headers: { Cookie: `klora_session=${cookie}` } });
    const html = (await head.text()).replace(/<!-- -->/g, "");
    log("farm header shows ID + CID", html.includes(">ID<") && html.includes(supId));
    const lg = await fetch(`${BASE}/logistic/search?q=${encodeURIComponent(lotId)}`, { headers: { Cookie: `klora_session=${mint("USR-0002")}` } });
    log("logistic search accepts ?q=", lg.status === 200);
  } finally {
    if (assets.length) await sql`DELETE FROM packaging_assets WHERE id = ANY(${assets})`;
    if (supId) { await sql`DELETE FROM notifications WHERE supplier_id = ${supId}`; await sql`DELETE FROM batches WHERE supplier_id = ${supId}`; await sql`DELETE FROM suppliers WHERE id = ${supId}`; }
    await sql`DELETE FROM rate_limits WHERE key IN (SELECT 'pkg-assets:user:' || id FROM users WHERE email = ${EMAIL})`;
    await sql`DELETE FROM users WHERE email = ${EMAIL}`; await sql`DELETE FROM rate_limits WHERE key LIKE '%:ip:::1' OR key LIKE 'login:acct:qa_%'`;
  }
  console.log(fails ? `${fails} failed` : "all passed");
})();
