// Packaging rows v2 (Thai Post doc §4): catalog sizes × standard weights × material EF, reusable ÷
// lifetime, inner materials per package, ไม่มี / ไม่ทราบขนาด / อื่นๆ, KYN catalog edits. Self-cleaning.
import { neon } from "@neondatabase/serverless";
import { createHmac } from "crypto";
import { DEFAULT_CATALOG, rowCarbon, rowsCarbon, type PackRow } from "../../src/lib/packaging-catalog";
const BASE = "http://localhost:3123"; const TS = Date.now().toString(36); const EMAIL = `qa-pack-${TS}@klora-qa.test`;
const mint = (u: string) => { const p = `${u}:${Date.now() + 3600_000}`; return `${Buffer.from(p).toString("base64url")}.${createHmac("sha256", process.env.KLORA_SESSION_SECRET!).update(p).digest("base64url")}`; };
const api = async (path: string, method: string, body?: unknown, cookie?: string) => { const r = await fetch(BASE + path, { method, redirect: "manual", headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: `klora_session=${cookie}` } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, json: await r.json().catch(() => ({})), cookie: /klora_session=([^;]+)/.exec(r.headers.get("set-cookie") || "")?.[1] }; };
let fails = 0; const log = (n: string, ok: boolean, note = "") => { if (!ok) fails++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${note ? "  — " + note : ""}`); };
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
(async () => {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`DELETE FROM rate_limits WHERE key LIKE '%:ip:::1'`;
  const kyn = mint("USR-0003");
  const hadCatalog = (await sql`SELECT key FROM app_settings WHERE key = 'packaging_catalog'`).length > 0;
  let supId = ""; const assets: string[] = [];
  try {
    const reg = await api("/api/auth/register", "POST", { farmName: "QA Pack Farm " + TS, address: "อ.แม่ริม จ.เชียงใหม่", gps: "18.91, 98.94", contactName: "QA", flowerType: "มะม่วง", email: EMAIL, username: "qa_pack_" + TS, password: "QaPassw0rd!", confirmPassword: "QaPassw0rd!" });
    supId = reg.json.supplier?.id; const cookie = reg.cookie!;

    const crate = await api("/api/packaging-assets", "POST", { kind: "crate", priorUses: 12 }, cookie);
    if (crate.json.id) assets.push(crate.json.id);
    log("reusable crate gets a PKG code with the catalog lifetime", crate.status === 201 && /^PKG-/.test(crate.json.id) && crate.json.designLife === 100, `${crate.status} ${crate.json.id} ${crate.json.designLife}`);
    log("'no packaging' cannot be registered", (await api("/api/packaging-assets", "POST", { kind: "nopack" }, cookie)).status === 400);

    const rows: PackRow[] = [
      { v: 2, kind: "carton", usage: "single", size: "M", quantity: 10, unit: "ใบ", inners: [{ kind: "ldpe", qty: 1, unit: "ใบ" }, { kind: "divider", qty: 2, unit: "แผ่น" }] },
      { v: 2, kind: "crate", usage: "reusable", assetId: crate.json.id, size: "L", quantity: 5, unit: "ลัง", inners: [{ kind: "none", qty: 0, unit: "ใบ" }] },
      { v: 2, kind: "nopack", usage: "single", size: "none", quantity: 0, unit: "ชิ้น", inners: [] },
    ];
    const expected = rowsCarbon(rows, DEFAULT_CATALOG);
    const b = await api("/api/batches", "POST", { productCategory: "fruit", productType: "มะม่วง", unit: "kg", quantity: 100, cutDate: "2026-10-08", distanceKm: 300, shippedWeightKg: 120, packagingItems: rows }, cookie);
    log("round with catalog rows computed", b.status === 201 && b.json.status === "computed", `${b.status} ${b.json.status}`);
    log("packaging CO₂e = §4.9 formulas", near(b.json.carbonBreakdown?.packaging ?? -1, expected.carbon), `${b.json.carbonBreakdown?.packaging} vs ${expected.carbon}`);
    const carton = rowCarbon(rows[0], DEFAULT_CATALOG); const crateRow = rowCarbon(rows[1], DEFAULT_CATALOG);
    log("single-use = qty × weight × EF (+ inner per package)", near(carton.carbon, 10 * 0.55 * 1.6254 + 10 * (0.025 * 2.4345 + 2 * 0.05 * 1.6254)), String(carton.carbon));
    log("reusable = qty × weight × EF ÷ lifetime", near(crateRow.carbon, (5 * 2.0 * 2.0366) / 100), String(crateRow.carbon));
    log("stored as v2 rows, crate code in basketIds", b.json.packagingItems?.[0]?.v === 2 && (b.json.basketIds ?? []).includes(crate.json.id), JSON.stringify(b.json.basketIds));
    log("exact sizes → no estimate badge", !b.json.carbonBreakdown?.packagingEstimate);
    const used = (await api("/api/packaging-assets", "GET", undefined, cookie)).json.find((a: { id: string }) => a.id === crate.json.id);
    log("trip counted for the crate", used?.uses === 1, `uses=${used?.uses}`);

    // อื่นๆ + ไม่ทราบขนาด → estimate + KYN queue
    const OTHER = `ตะกร้าหวายQA${TS}`;
    const e = await api("/api/batches", "POST", { productCategory: "fruit", productType: "มะม่วง", unit: "kg", quantity: 20, cutDate: "2026-10-08", distanceKm: 100, shippedWeightKg: 25,
      packagingItems: [{ v: 2, kind: "other", usage: "single", size: "custom", quantity: 2, unit: "ใบ", other: { name: OTHER, material: "bamboo", weightClass: "mid" }, inners: [{ kind: "other", qty: 3, unit: "ชิ้น", other: { name: `ใบตองQA${TS}`, material: "mixed" } }] },
        { v: 2, kind: "carton", usage: "single", size: "unknown", quantity: 1, unit: "ใบ", inners: [] }] }, cookie);
    log("อื่นๆ / ไม่ทราบขนาด → ค่าประมาณ", e.json.carbonBreakdown?.packagingEstimate === true, String(e.json.carbonBreakdown?.packagingEstimate));
    const q = await sql`SELECT field FROM custom_entries WHERE supplier_id = ${supId} AND field IN ('packaging','inner') ORDER BY field`;
    log("typed packaging + inner material queued for KYN", q.length === 2, q.map((r) => r.field).join(","));

    // KYN edits the carton M weight → recompute follows
    const cat = (await api("/api/packaging-catalog", "GET", undefined, cookie)).json;
    log("catalog readable by the farm", Array.isArray(cat.packs) && cat.packs.some((k: { id: string }) => k.id === "carton"));
    log("catalog PUT: farm 403", (await api("/api/packaging-catalog", "PUT", cat, cookie)).status === 403);
    const edited = { ...cat, packs: cat.packs.map((k: { id: string; sizes: { id: string; weightKg: number }[] }) => (k.id === "carton" ? { ...k, sizes: k.sizes.map((z) => (z.id === "M" ? { ...z, weightKg: 1.1 } : z)) } : k)) };
    const put = await api("/api/packaging-catalog", "PUT", edited, kyn);
    log("KYN saves the table", put.status === 200 && put.json.packs.find((k: { id: string }) => k.id === "carton").sizes.find((z: { id: string }) => z.id === "M").weightKg === 1.1);
    const re = await api(`/api/batches/${b.json.id}`, "PATCH", { action: "compute" }, kyn);
    log("heavier standard carton → more packaging CO₂e", (re.json.carbonBreakdown?.packaging ?? 0) > (b.json.carbonBreakdown?.packaging ?? 0), `${b.json.carbonBreakdown?.packaging} → ${re.json.carbonBreakdown?.packaging}`);
    const pg = await fetch(`${BASE}/kyn/packaging`, { headers: { Cookie: `klora_session=${kyn}` } });
    log("KYN packaging page renders", pg.status === 200 && (await pg.text()).includes("ตารางบรรจุภัณฑ์"));
  } finally {
    if (!hadCatalog) await sql`DELETE FROM app_settings WHERE key = 'packaging_catalog'`;
    if (assets.length) await sql`DELETE FROM packaging_assets WHERE id = ANY(${assets})`;
    if (supId) { await sql`DELETE FROM custom_entries WHERE supplier_id = ${supId}`; await sql`DELETE FROM notifications WHERE supplier_id = ${supId}`; await sql`DELETE FROM batches WHERE supplier_id = ${supId}`; await sql`DELETE FROM suppliers WHERE id = ${supId}`; }
    await sql`DELETE FROM rate_limits WHERE key IN (SELECT 'pkg-assets:user:' || id FROM users WHERE email = ${EMAIL})`;
    await sql`DELETE FROM users WHERE email = ${EMAIL}`; await sql`DELETE FROM rate_limits WHERE key LIKE '%:ip:::1' OR key LIKE 'login:acct:qa_%'`;
  }
  console.log(fails ? `${fails} failed` : "all passed");
})();
