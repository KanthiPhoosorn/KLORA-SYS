// Demo data for the Thai Post demo (18 Sep 2026): one fruit + vegetable farm with GAP/Organic
// certifications and three computed rounds (มะม่วง / คะน้า / กล้วย-with-cold-chain-warning).
// Idempotent: skips when the farm already exists. Prints the login it created.
//   npx tsx --env-file=.env.local scripts/seed-demo-produce.ts   (dev server on :3123 must be running)
import { neon } from "@neondatabase/serverless";
import { createHmac, randomBytes } from "crypto";
import { appendFileSync } from "fs";

const BASE = process.env.SEED_BASE || "http://localhost:3123";
const EMAIL = "fruitfarm@fang-orchard.example";
const USERNAME = "fruitfarm";
const mint = (u: string) => { const p = `${u}:${Date.now() + 3600_000}`; return `${Buffer.from(p).toString("base64url")}.${createHmac("sha256", process.env.KLORA_SESSION_SECRET!).update(p).digest("base64url")}`; };
const api = async (path: string, method: string, body?: unknown, cookie?: string) => {
  const r = await fetch(BASE + path, { method, headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: `klora_session=${cookie}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, json: await r.json().catch(() => ({})), cookie: /klora_session=([^;]+)/.exec(r.headers.get("set-cookie") || "")?.[1] };
};

(async () => {
  const sql = neon(process.env.DATABASE_URL!);
  const existing = await sql`SELECT id, supplier_id FROM users WHERE email = ${EMAIL}`;
  if (existing.length) { console.log("demo farm already exists:", existing[0].supplier_id); process.exit(0); }
  await sql`DELETE FROM rate_limits WHERE key LIKE '%:ip:::1'`;

  const password = randomBytes(9).toString("base64url");
  const reg = await api("/api/auth/register", "POST", {
    farmName: "สวนผลไม้และผักดอยฝาง", address: "88 หมู่ 5 ต.แม่งอน อ.ฝาง จ.เชียงใหม่ 50320", contactName: "สมชาย ใจดี", phone: "0891234567", lineId: "@fangorchard",
    gps: "19.9167, 99.2167", details: "สวนผสมผสานบนที่สูง ปลูกมะม่วงน้ำดอกไม้และผักใบภายใต้มาตรฐาน GAP ใช้ปุ๋ยอินทรีย์เป็นหลัก",
    flowerType: "มะม่วง",
    flowerTypes: [
      { category: "fruit", type: "มะม่วง", varieties: ["น้ำดอกไม้สีทอง", "มหาชนก"] },
      { category: "fruit", type: "กล้วย", varieties: ["หอมทอง (ส่งออก)"] },
      { category: "vegetable", type: "คะน้า", varieties: ["คะน้ายอด", "เบบี้คะน้า"] },
      { category: "vegetable", type: "ผักกาดหอม / สลัด", varieties: ["กรีนโอ๊ค", "เรดโอ๊ค"] },
    ],
    certifications: [
      { kind: "GAP", appliesTo: ["fruit", "vegetable"], certNo: "กษ 03-9001-50320-0117", expiresAt: "2027-06-30" },
      { kind: "Organic Thailand", appliesTo: ["vegetable"], certNo: "OT-2569-0442", expiresAt: "2027-01-31" },
    ],
    email: EMAIL, username: USERNAME, password, confirmPassword: password,
    fuelLitres: 60, electricityKwh: 450, fertilizerKg: 120, agriChemicalsKg: 4, waterM3: 300, wasteKg: 80, flowersPerMonth: 4000,
  });
  if (reg.status !== 201) { console.error("register failed", reg.status, reg.json); process.exit(1); }
  const supId = reg.json.supplier.id as string;
  const cookie = reg.cookie!;
  await sql`UPDATE suppliers SET plan = 'pro', description = 'มะม่วงน้ำดอกไม้สีทองจากสวนบนดอยฝาง เก็บเกี่ยวตอนเริ่มสุกเพื่อให้ถึงมือคุณในระยะสุกพอดี', care_tips = NULL WHERE id = ${supId}`;

  const rounds = [
    { productCategory: "fruit", productType: "มะม่วง", variety: "น้ำดอกไม้สีทอง", unit: "kg", quantity: 240, cutDate: "2026-09-15", plantingDate: "2021-06-10", ripenessAtHarvest: "turning", grade: "ส่งออก", distanceKm: 690, destination: "กรุงเทพฯ", carrier: "ไปรษณีย์ไทย", provider: "ไปรษณีย์ไทย", branch: "สาขาฝาง", postalCode: "10110",
      packagingItems: [{ kind: "corrugated_box", width: 40, length: 60, height: 20, quantity: 24, boxMaterial: "กระดาษลูกฟูก" }], vehicleKey: "6_wheeler", fuelKey: "B7", isReeferUsed: false },
    { productCategory: "vegetable", productType: "คะน้า", variety: "เบบี้คะน้า", unit: "kg", quantity: 60, cutDate: "2026-09-16", plantingDate: "2026-08-05", grade: "A", distanceKm: 690, destination: "กรุงเทพฯ", carrier: "ขนส่งควบคุมอุณหภูมิ", provider: "ไปรษณีย์ไทย", branch: "สาขาฝาง", postalCode: "10110",
      packagingItems: [{ kind: "plastic_film", width: 30, length: 40, height: 10, quantity: 30 }, { kind: "corrugated_box", width: 40, length: 60, height: 30, quantity: 6, boxMaterial: "กระดาษลูกฟูก" }], vehicleKey: "6_wheeler", fuelKey: "B7", isReeferUsed: true },
    { productCategory: "fruit", productType: "กล้วย", variety: "หอมทอง (ส่งออก)", unit: "kg", quantity: 180, cutDate: "2026-09-14", plantingDate: "2025-11-20", ripenessAtHarvest: "unripe", grade: "A", ethyleneUsed: true, ethyleneNote: "บ่มเอทิลีน 100 ppm 24 ชม. ก่อนส่ง", distanceKm: 690, destination: "กรุงเทพฯ", carrier: "ขนส่งควบคุมอุณหภูมิ", provider: "ไปรษณีย์ไทย", branch: "สาขาฝาง", postalCode: "10110",
      packagingItems: [{ kind: "corrugated_box", width: 40, length: 60, height: 25, quantity: 15, boxMaterial: "กระดาษลูกฟูก" }], vehicleKey: "6_wheeler", fuelKey: "B7", isReeferUsed: true },
  ];
  const kyn = mint("USR-0003");
  for (const r of rounds) {
    const b = await api("/api/batches", "POST", { ...r, status: "submitted" }, cookie);
    if (b.status !== 201) { console.error("batch failed", b.status, b.json); continue; }
    const c = await api("/api/batches/" + b.json.id, "PATCH", { action: "compute" }, kyn);
    console.log(`${b.json.id} ${r.productType} ${r.quantity} ${r.unit} → ${c.status} CO2e/kg ${c.json.co2ePerFlower?.toFixed(4)}`);
  }
  appendFileSync("CREDENTIALS.local.txt", `\nfruitfarm  ${password}   (demo ผลไม้/ผัก — ${EMAIL}, ${supId})\n`);
  console.log(`created ${supId} · login ${USERNAME} (password appended to CREDENTIALS.local.txt)`);
})();
