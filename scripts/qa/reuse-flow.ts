// บรรจุภัณฑ์หมุนเวียน/ใช้ครั้งเดียว (Thai Post doc tab "ข้อมูลบรรจุภัณฑ์"): register → pick by code →
// carbon spread over design life; single-use charged in full. Throw-away farm, self-cleaning.
import { neon } from "@neondatabase/serverless";
import { createHmac } from "crypto";
import { packagingItemCarbon, basketCarbonPerUse } from "../../src/lib/carbon-kyn";
import { validatePackLines, emptyPackLine, packLinesToPayload, packLinesFromBatch } from "../../src/components/PackagingLines";
const BASE = "http://localhost:3123"; const TS = Date.now().toString(36); const EMAIL = `qa-reuse-${TS}@klora-qa.test`;
const mint = (u: string) => { const p = `${u}:${Date.now() + 3600_000}`; return `${Buffer.from(p).toString("base64url")}.${createHmac("sha256", process.env.KLORA_SESSION_SECRET!).update(p).digest("base64url")}`; };
const api = async (path: string, method: string, body?: unknown, cookie?: string) => { const r = await fetch(BASE + path, { method, headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: `klora_session=${cookie}` } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, json: await r.json().catch(() => ({})), cookie: /klora_session=([^;]+)/.exec(r.headers.get("set-cookie") || "")?.[1] }; };
let fails = 0; const log = (n: string, ok: boolean, note = "") => { if (!ok) fails++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${note ? "  — " + note : ""}`); };
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
(async () => {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`DELETE FROM rate_limits WHERE key LIKE '%:ip:::1'`;
  const lg = mint("USR-0002");
  let supId = ""; let userId = "";
  const assetIds: string[] = [];
  try {
    const reg = await api("/api/auth/register", "POST", { farmName: "QA Reuse Farm " + TS, address: "อ.แม่ริม จ.เชียงใหม่", gps: "18.91, 98.94", contactName: "QA", flowerType: "กุหลาบ", email: EMAIL, username: "qa_reuse_" + TS, password: "QaPassw0rd!", confirmPassword: "QaPassw0rd!" });
    supId = reg.json.supplier?.id; userId = reg.json.user?.id ?? ""; const cookie = reg.cookie!;
    if (!cookie) console.log("register", reg.status, JSON.stringify(reg.json).slice(0, 200));

    // case 2: ลงทะเบียนใหม่ → system issues the code
    const a1 = await api("/api/packaging-assets", "POST", { kind: "basket", width: 40, length: 60, height: 30, priorUses: 10 }, cookie);
    if (a1.json.id) assetIds.push(a1.json.id);
    log("register basket → BSK code, design life 100, owner = farm", a1.status === 201 && /^BSK-\d{4}-\d{5}$/.test(a1.json.id) && a1.json.designLife === 100 && a1.json.priorUses === 10 && a1.json.ownerSupplierId === supId, `${a1.status} ${a1.json.id} ${a1.json.designLife}`);
    const a2 = await api("/api/packaging-assets", "POST", { kind: "corrugated_box", width: 30, length: 40, height: 20 }, lg);
    if (a2.json.id) assetIds.push(a2.json.id);
    log("carrier registers reusable box → BOX code, life 5, owner label", a2.status === 201 && a2.json.id?.startsWith("BOX-") && a2.json.designLife === 5 && !a2.json.ownerSupplierId && !!a2.json.ownerLabel, `${a2.json.id} ${a2.json.ownerLabel}`);
    log("register rejects bad kind", (await api("/api/packaging-assets", "POST", { kind: "crate" }, cookie)).status === 400);
    log("register needs sign-in", (await api("/api/packaging-assets", "POST", { kind: "basket" })).status === 401);
    const list = await api("/api/packaging-assets", "GET", undefined, cookie);
    log("farm sees own + carrier-owned items", list.status === 200 && list.json.some((x: { id: string }) => x.id === a1.json.id) && list.json.some((x: { id: string }) => x.id === a2.json.id));

    // case 1 + 3 in one round: reusable basket (by code) + single-use boxes with inner material
    const box = { kind: "corrugated_box", usage: "single", width: 30, length: 40, height: 20, quantity: 2 };
    const r1 = await api("/api/batches", "POST", { flowerCount: 200, variety: "Avalanche", cutDate: "2026-09-20", distanceKm: 700,
      packagingItems: [{ kind: "basket", usage: "reusable", assetId: a1.json.id, width: 40, length: 60, height: 30, quantity: 7 }, box] }, cookie);
    const expPack1 = basketCarbonPerUse(100) + packagingItemCarbon({ type: "corrugated_box", width: 30, length: 40, height: 20, quantity: 2 }).carbon;
    log("round computed; reusable item stored as 1 piece", r1.status === 201 && r1.json.status === "computed" && r1.json.packagingItems?.[0]?.quantity === 1, `${r1.status} ${r1.json.status} q=${r1.json.packagingItems?.[0]?.quantity}`);
    log("basketIds follow the reusable basket code", JSON.stringify(r1.json.basketIds) === JSON.stringify([a1.json.id]), JSON.stringify(r1.json.basketIds));
    log("packaging CO₂e = basket/100 + boxes in full", near(r1.json.carbonBreakdown?.packaging ?? -1, expPack1), `${r1.json.carbonBreakdown?.packaging} vs ${expPack1}`);

    // same basket marked single-use → full basket carbon
    const r2 = await api("/api/batches", "POST", { flowerCount: 200, cutDate: "2026-09-20", distanceKm: 700, packagingItems: [{ kind: "basket", usage: "single", width: 40, length: 60, height: 30, quantity: 1 }] }, cookie);
    log("single-use basket charged in full", near(r2.json.carbonBreakdown?.packaging ?? -1, basketCarbonPerUse(1)), `${r2.json.carbonBreakdown?.packaging} vs ${basketCarbonPerUse(1)}`);
    log("flower round with no basket still auto-computes", r2.json.status === "computed" && (r2.json.basketIds ?? []).length === 0, `${r2.json.status}`);

    // reusable box over its design life (5)
    const r3 = await api("/api/batches", "POST", { productCategory: "fruit", productType: "มะม่วง", unit: "kg", quantity: 20, cutDate: "2026-09-20", distanceKm: 300,
      packagingItems: [{ kind: "corrugated_box", usage: "reusable", assetId: a2.json.id, width: 30, length: 40, height: 20, quantity: 1 }] }, cookie);
    const full = packagingItemCarbon({ type: "corrugated_box", width: 30, length: 40, height: 20, quantity: 1 }).carbon;
    log("reusable box = full carbon ÷ 5", near(r3.json.carbonBreakdown?.packaging ?? -1, full / 5), `${r3.json.carbonBreakdown?.packaging} vs ${full / 5}`);

    const after = await api("/api/packaging-assets", "GET", undefined, cookie);
    const u1 = after.json.find((x: { id: string }) => x.id === a1.json.id);
    log("trip count = rounds using the code", u1?.uses === 1 && u1.priorUses + u1.uses === 11, `uses=${u1?.uses}`);

    // older clients (no usage) keep their basketIds + 100-trip baskets
    const old = await api("/api/batches", "POST", { flowerCount: 100, cutDate: "2026-09-20", distanceKm: 100, basketIds: ["OLD-1", "OLD-2"], packagingItems: [{ kind: "basket", quantity: 2, basketNo: "OLD-1" }] }, cookie);
    log("legacy request unchanged", old.json.status === "computed" && (old.json.basketIds ?? []).length === 2 && near(old.json.carbonBreakdown?.packaging ?? -1, 2 * basketCarbonPerUse(100)), `${JSON.stringify(old.json.basketIds)} ${old.json.carbonBreakdown?.packaging}`);

    // logistic re-declares packaging → basketIds follow
    const p = await api("/api/batches/" + r2.json.id, "PATCH", { shippedWeightKg: 15, shipType: "domestic", shipDate: "2026-09-23", vehicleKey: "van", fuelKey: "B7", destination: "กรุงเทพฯ", distanceKm: 690,
      packagingItems: [{ kind: "basket", usage: "reusable", assetId: a1.json.id, quantity: 1 }] }, lg);
    log("logistic PATCH updates basketIds from lines", p.status === 200 && JSON.stringify(p.json.basketIds) === JSON.stringify([a1.json.id]), `${p.status} ${JSON.stringify(p.json.basketIds)}`);

    // client-side rules
    const L = (x: object) => ({ ...emptyPackLine(), ...x });
    const e = validatePackLines([
      L({ kind: "basket" }),
      L({ kind: "basket", usage: "reusable", source: "existing" }),
      L({ kind: "corrugated_box", usage: "single", w: "30", l: "40" }),
      L({ kind: "basket", usage: "reusable", assetId: "X" }), L({ kind: "basket", usage: "reusable", assetId: "X" }),
      L({ kind: "basket", usage: "reusable", source: "new" }),
    ]);
    log("validation: usage / code / size+qty+inner / duplicate / register-first", !!e["pack.0.usage"] && !!e["pack.1.asset"] && !!e["pack.2.size"] && !!e["pack.2.qty"] && !!e["pack.2.boxMaterial"] && !e["pack.3.asset"] && !!e["pack.4.asset"] && e["pack.5.asset"]?.includes("ลงทะเบียน"), Object.keys(e).join(","));
    const pk = packLinesToPayload([L({ kind: "basket", usage: "reusable", assetId: "BSK-1" }), L({ kind: "plastic_film", usage: "single", w: "50", l: "70", h: "9", qty: "3" })]);
    const back = packLinesFromBatch(pk.packagingItems, pk.innerMaterials);
    log("payload round-trip", pk.packagingItems[0].quantity === 1 && pk.packagingItems[1].height === undefined && back[0].usage === "reusable" && back[0].assetId === "BSK-1" && back[1].qty === "3", JSON.stringify(pk.packagingItems));
    const legacy = packLinesFromBatch([{ kind: "basket", quantity: 1, basketNo: "BSK-014" }, { kind: "corrugated_box", width: 1, length: 1, height: 1, quantity: 4 }]);
    log("old rounds reload as reusable basket / single-use box", legacy[0].usage === "reusable" && legacy[0].assetId === "BSK-014" && legacy[1].usage === "single" && legacy[1].qty === "4");
  } finally {
    if (assetIds.length) await sql`DELETE FROM packaging_assets WHERE id = ANY(${assetIds})`;
    if (supId) { await sql`DELETE FROM notifications WHERE supplier_id = ${supId}`; await sql`DELETE FROM batches WHERE supplier_id = ${supId}`; await sql`DELETE FROM suppliers WHERE id = ${supId}`; }
    await sql`DELETE FROM users WHERE email = ${EMAIL}`; await sql`DELETE FROM rate_limits WHERE key LIKE '%:ip:::1' OR key LIKE 'login:acct:qa_%'`;
    void userId;
  }
  console.log(fails ? `${fails} failed` : "all passed");
})();
