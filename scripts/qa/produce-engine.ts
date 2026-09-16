// Quick engine check for produce (kg) vs flower (stem) batches. Throw-away account, self-cleaning.
import { neon } from "@neondatabase/serverless";
import { createHmac } from "crypto";
const BASE = "http://localhost:3123"; const TS = Date.now().toString(36); const EMAIL = `qa-prod-${TS}@klora-qa.test`;
const mint = (u: string) => { const p = `${u}:${Date.now() + 3600_000}`; return `${Buffer.from(p).toString("base64url")}.${createHmac("sha256", process.env.KLORA_SESSION_SECRET!).update(p).digest("base64url")}`; };
const api = async (path: string, method: string, body?: unknown, cookie?: string) => { const r = await fetch(BASE + path, { method, headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: `klora_session=${cookie}` } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, json: await r.json().catch(() => ({})), cookie: /klora_session=([^;]+)/.exec(r.headers.get("set-cookie") || "")?.[1] }; };
(async () => {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`DELETE FROM rate_limits WHERE key LIKE '%:ip:::1'`;
  const reg = await api("/api/auth/register", "POST", { farmName: "QA Produce Farm " + TS, address: "อ.ฝาง จ.เชียงใหม่", contactName: "QA", flowerType: "มะม่วง",
    flowerTypes: [{ category: "fruit", type: "มะม่วง", varieties: ["น้ำดอกไม้สีทอง"] }, { type: "กุหลาบ", varieties: ["Avalanche"] }],
    certifications: [{ kind: "GAP", appliesTo: ["fruit"], certNo: "GAP-1234" }],
    email: EMAIL, username: "qa_prod_" + TS, password: "QaPassw0rd!", confirmPassword: "QaPassw0rd!", fuelLitres: 20, electricityKwh: 200, fertilizerKg: 10, flowersPerMonth: 5000 });
  const supId = reg.json.supplier?.id; const cookie = reg.cookie!;
  console.log("register", reg.status, supId, "categories:", JSON.stringify(reg.json.supplier?.productCategories), "certs:", JSON.stringify(reg.json.supplier?.certifications));
  const fruit = await api("/api/batches", "POST", { productCategory: "fruit", productType: "มะม่วง", variety: "น้ำดอกไม้สีทอง", unit: "kg", quantity: 120, cutDate: "2026-09-14", plantingDate: "2026-03-01", ripenessAtHarvest: "turning", grade: "A", distanceKm: 700, destination: "กรุงเทพฯ", isReeferUsed: true,
    packagingItems: [{ kind: "corrugated_box", width: 40, length: 60, height: 30, quantity: 12 }], vehicleKey: "truck_6w", fuelKey: "diesel" }, cookie);
  console.log("fruit batch", fruit.status, fruit.json.id, "unit", fruit.json.unit, "qty", fruit.json.quantity, "flowerCount", fruit.json.flowerCount, "ripeness", fruit.json.ripenessAtHarvest, fruit.json.error || "");
  const flower = await api("/api/batches", "POST", { flowerCount: 500, variety: "Avalanche", cutDate: "2026-09-15", distanceKm: 700, basketIds: ["B1"] }, cookie);
  console.log("flower batch", flower.status, flower.json.id, "unit", flower.json.unit, "category", flower.json.productCategory, "qty", flower.json.quantity);
  const kyn = mint("USR-0003");
  const c1 = await api("/api/batches/" + fruit.json.id, "PATCH", { action: "compute" }, kyn);
  const c2 = await api("/api/batches/" + flower.json.id, "PATCH", { action: "compute" }, kyn);
  console.log("fruit compute", c1.status, "per kg", c1.json.co2ePerFlower, "breakdown", JSON.stringify(c1.json.carbonBreakdown), c1.json.error || "");
  console.log("flower compute", c2.status, "per stem", c2.json.co2ePerFlower, "engine", c2.json.carbonBreakdown?.engine, c2.json.error || "");
  const tr = await fetch(BASE + "/trace/" + fruit.json.id); console.log("trace fruit", tr.status);
  await sql`DELETE FROM notifications WHERE supplier_id = ${supId}`; await sql`DELETE FROM batches WHERE supplier_id = ${supId}`; await sql`DELETE FROM users WHERE email = ${EMAIL}`; await sql`DELETE FROM suppliers WHERE id = ${supId}`; await sql`DELETE FROM rate_limits WHERE key LIKE '%:ip:::1' OR key LIKE 'login:acct:qa_%'`;
  console.log("cleaned");
})();
