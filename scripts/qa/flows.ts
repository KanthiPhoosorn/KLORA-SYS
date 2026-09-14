// QA write flows against the dev server. Creates ONLY throw-away test accounts
// (email *@klora-qa.test) and cleans them up at the end. Never touches real accounts.
//   npx tsx --env-file=.env.local scripts/qa/flows.ts
import { neon } from "@neondatabase/serverless";
import { createHmac } from "crypto";

const BASE = "http://localhost:3123";
const SECRET = process.env.KLORA_SESSION_SECRET || "klora-dev-secret-change-in-production";
const TS = Date.now().toString(36);
const SUP_EMAIL = `qa-sup-${TS}@klora-qa.test`;
const LOG_EMAIL = `qa-log-${TS}@klora-qa.test`;
const PW = "QaPassw0rd!";
const results: { name: string; ok: boolean; note: string }[] = [];
function log(name: string, ok: boolean, note = "") { results.push({ name, ok, note }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${note ? "  — " + note : ""}`); }
function mint(userId: string) { const exp = Date.now() + 3600_000; const p = `${userId}:${exp}`; return `${Buffer.from(p).toString("base64url")}.${createHmac("sha256", SECRET).update(p).digest("base64url")}`; }

async function api(path: string, opts: { method?: string; body?: unknown; cookie?: string } = {}) {
  const res = await fetch(BASE + path, {
    method: opts.method || "GET",
    headers: { "Content-Type": "application/json", ...(opts.cookie ? { Cookie: `klora_session=${opts.cookie}` } : {}) },
    body: opts.body != null ? JSON.stringify(opts.body) : undefined,
    redirect: "manual",
  });
  const setCookie = res.headers.get("set-cookie") || "";
  const cookie = /klora_session=([^;]+)/.exec(setCookie)?.[1];
  let json: any = null; const text = await res.text();
  try { json = JSON.parse(text); } catch { json = { _text: text.slice(0, 120) }; }
  return { status: res.status, json, cookie, location: res.headers.get("location") };
}

(async () => {
  // Local-only rate-limit counters (::1) from previous runs would 429 this suite.
  const sql = neon(process.env.DATABASE_URL!);
  await sql`DELETE FROM rate_limits WHERE key LIKE '%:ip:::1' OR key LIKE 'login:acct:qa_%' OR key LIKE '%klora-qa.test%'`;

  // ---------- Supplier register → login ----------
  let r = await api("/api/auth/register", { method: "POST", body: {
    farmName: "QA Farm " + TS, address: "12 หมู่ 3 ต.แม่สาย อ.แม่สาย จ.เชียงราย 57130", contactName: "QA Tester", phone: "0812345678",
    flowerType: "กุหลาบ", flowerTypes: [{ type: "กุหลาบ", varieties: ["Red Naomi"] }], gps: "20.43, 99.88",
    email: SUP_EMAIL, username: "qa_sup_" + TS, password: PW, confirmPassword: PW,
    fuelLitres: 10, electricityKwh: 100, fertilizerKg: 5, flowersPerMonth: 5000,
  } });
  log("register supplier", r.status === 201 || r.status === 200, `${r.status} ${r.json?.error || r.json?.supplierId || ""}`);
  const supId: string = r.json?.supplierId || r.json?.supplier?.id;
  let supCookie = r.cookie || "";
  log("register sets session cookie", !!supCookie);
  r = await api("/api/auth/register", { method: "POST", body: { farmName: "x", address: "y", contactName: "z", flowerType: "กุหลาบ", email: SUP_EMAIL, username: "dupe" + TS, password: PW, confirmPassword: PW } });
  log("register duplicate email → 409", r.status === 409, String(r.status));
  r = await api("/api/auth/login", { method: "POST", body: { login: SUP_EMAIL, password: "wrong-password" } });
  log("login wrong password → 401", r.status === 401, String(r.status));
  r = await api("/api/auth/login", { method: "POST", body: { login: SUP_EMAIL, password: PW } });
  log("login supplier by email", r.status === 200 && !!r.cookie && r.json?.redirect === "/app", `${r.status} ${r.json?.redirect}`);
  supCookie = r.cookie || supCookie;
  r = await api("/api/auth/login", { method: "POST", body: { login: "qa_sup_" + TS, password: PW } });
  log("login supplier by username", r.status === 200, String(r.status));
  const sr = await fetch(BASE + "/app", { headers: { Cookie: `klora_session=${supCookie}` }, redirect: "manual" });
  log("GET /app with cookie → 200", sr.status === 200, String(sr.status));
  const supUserId = (() => { try { return Buffer.from(supCookie.split(".")[0], "base64url").toString().split(":")[0]; } catch { return ""; } })();

  // ---------- Supplier: create round → (draft + submitted), farm monthly, profile, invites, members ----------
  r = await api("/api/batches", { method: "POST", cookie: supCookie, body: { cutDate: "2026-09-10", flowerCount: 0 } });
  log("create batch flowerCount=0 → 400", r.status === 400, String(r.status));
  r = await api("/api/batches", { method: "POST", cookie: supCookie, body: {
    cutDate: "2026-09-10", flowerCount: 1200, variety: "Red Naomi", distanceKm: 780, destination: "กรุงเทพฯ", carrier: "ไปรษณีย์ไทย",
    provider: "ไปรษณีย์ไทย", branch: "สาขาเชียงราย", boxMaterial: "corrugated", weightKg: 30, basketIds: ["BK-QA-1", "BK-QA-2"],
    packagingItems: [{ kind: "basket", quantity: 2, basketNo: "BK-QA-1" }, { kind: "corrugated_box", width: 40, length: 60, height: 30, quantity: 10 }],
    vehicleKey: "truck_6w", fuelKey: "diesel", shippedWeightKg: 32,
  } });
  log("create batch (submitted)", r.status === 201, `${r.status} ${r.json?.id || r.json?.error}`);
  const batchId: string = r.json?.id;
  r = await api("/api/batches", { method: "POST", cookie: supCookie, body: { cutDate: "2026-09-11", flowerCount: 300, status: "draft" } });
  log("create batch (draft)", r.status === 201 && r.json?.status === "draft", `${r.status} ${r.json?.status}`);
  r = await api("/api/batches", { method: "POST", body: { cutDate: "2026-09-10", flowerCount: 10 } });
  log("create batch without session → 401", r.status === 401, String(r.status));

  r = await api("/api/farm-monthly", { method: "POST", cookie: supCookie, body: { reportingMonth: "2026-09", fuelLitres: 12, electricityKwh: 120, fertilizerKg: 6, agriChemicalsKg: 1, waterM3: 40, wasteKg: 8, flowersPerMonth: 6000 } });
  log("farm-monthly upsert", r.status < 300, `${r.status} ${r.json?.error || ""}`);
  r = await api("/api/farm-monthly", { cookie: supCookie });
  log("farm-monthly list", r.status === 200 && Array.isArray(r.json?.records) && r.json.records.length >= 1, `${r.status} n=${r.json?.records?.length ?? "?"}`);

  r = await api("/api/profile", { method: "PATCH", cookie: supCookie, body: { username: "qa_sup_" + TS, email: SUP_EMAIL, phone: "0899999999" } });
  log("profile PATCH phone", r.status === 200, `${r.status} ${r.json?.error || ""}`);
  r = await api("/api/profile", { method: "PATCH", cookie: supCookie, body: { username: "farm", email: SUP_EMAIL } });
  log("profile PATCH to taken username → 409", r.status === 409, String(r.status));

  r = await api("/api/suppliers/" + supId, { method: "PATCH", cookie: supCookie, body: { farmName: "QA Farm " + TS + " (edited)", varieties: ["Red Naomi", "Avalanche"] } });
  log("supplier edits own farm", r.status === 200 && /edited/.test(r.json?.farmName || ""), `${r.status} ${r.json?.error || r.json?.farmName}`);

  r = await api("/api/invites", { method: "POST", cookie: supCookie, body: { email: "qa-invitee@klora-qa.test", role: "member" } });
  log("invite create", r.status === 201, `${r.status} ${r.json?.id || r.json?.error}`);
  const inviteId = r.json?.id;
  r = await api("/api/invites", { method: "POST", cookie: supCookie, body: { email: "not-an-email" } });
  log("invite bad email → 400", r.status === 400, String(r.status));
  r = await api("/api/invites", { cookie: supCookie });
  log("invite list contains new", r.status === 200 && r.json?.some?.((i: any) => i.id === inviteId), String(r.status));
  r = await api("/api/invites/" + inviteId, { method: "PATCH", cookie: supCookie, body: { status: "cancelled" } });
  log("invite cancel", r.status === 200 && r.json?.status === "cancelled", `${r.status} ${r.json?.status}`);
  r = await api("/api/members", { cookie: supCookie });
  log("members list", r.status === 200 && Array.isArray(r.json), String(r.status));

  // ---------- Invite → join (creates a login inside the same farm) ----------
  const JOIN_EMAIL = "qa-join-" + TS + "@klora-qa.test";
  r = await api("/api/invites", { method: "POST", cookie: supCookie, body: { email: JOIN_EMAIL, role: "org_admin" } });
  log("invite for join created, token not echoed", r.status === 201 && !("token" in r.json), `${r.status} keys=${Object.keys(r.json).join(",")}`);
  r = await api("/api/invites", { method: "POST", cookie: supCookie, body: { email: JOIN_EMAIL, role: "member" } });
  log("duplicate pending invite → 409", r.status === 409, String(r.status));
  const tok = (await sql`SELECT token FROM invites WHERE email = ${JOIN_EMAIL}`)[0]?.token as string;
  log("invite has secret token in DB", !!tok && tok.length >= 24);
  const jp = await fetch(BASE + "/join/" + tok);
  const jpText = await jp.text();
  log("join page renders org + email", jp.status === 200 && jpText.includes("QA Farm") && jpText.includes(JOIN_EMAIL), String(jp.status));
  const jbad = await fetch(BASE + "/join/not-a-real-token");
  log("join page bad token → error text", jbad.status === 200 && (await jbad.text()).includes("ลิงก์คำเชิญไม่ถูกต้อง"), String(jbad.status));
  r = await api("/api/auth/join", { method: "POST", body: { token: tok, username: "qa_join_" + TS, password: PW, confirmPassword: "different1" } });
  log("join mismatched confirm → 400", r.status === 400, String(r.status));
  r = await api("/api/auth/join", { method: "POST", body: { token: tok, username: "qa_join_" + TS, password: PW, confirmPassword: PW } });
  log("join creates account + session", r.status === 201 && !!r.cookie && r.json?.redirect === "/app", `${r.status} ${r.json?.error || r.json?.redirect}`);
  const joinCookie = r.cookie || "";
  const jm = await fetch(BASE + "/app", { headers: { Cookie: `klora_session=${joinCookie}` }, redirect: "manual" });
  log("joined member opens /app", jm.status === 200, String(jm.status));
  const ju = (await sql`SELECT role, supplier_id FROM users WHERE email = ${JOIN_EMAIL}`)[0];
  log("joined user belongs to inviting farm", ju?.role === "supplier" && ju?.supplier_id === supId, JSON.stringify(ju));
  r = await api("/api/members", { cookie: supCookie });
  log("member row visible to inviter (org_admin)", r.status === 200 && r.json.some((m: any) => m.email === JOIN_EMAIL && m.role === "org_admin"), String(r.json?.length));
  r = await api("/api/invites", { cookie: supCookie });
  log("invite marked accepted", r.json.some((i: any) => i.email === JOIN_EMAIL && i.status === "accepted"));
  r = await api("/api/auth/join", { method: "POST", body: { token: tok, username: "qa_join2_" + TS, password: PW, confirmPassword: PW } });
  log("join link is one-time → 404", r.status === 404, String(r.status));
  r = await api("/api/members/MEM-9999", { method: "PATCH", cookie: supCookie, body: { role: "org_admin" } });
  log("member PATCH unknown → 404", r.status === 404, String(r.status));

  // ---------- Change password + forgot/OTP/reset ----------
  r = await api("/api/auth/change-password", { method: "POST", cookie: supCookie, body: { oldPassword: "nope", newPassword: PW + "2" } });
  log("change-password wrong old → 4xx", r.status >= 400 && r.status < 500, String(r.status));
  r = await api("/api/auth/change-password", { method: "POST", cookie: supCookie, body: { oldPassword: PW, newPassword: PW + "2" } });
  log("change-password ok", r.status === 200, `${r.status} ${r.json?.error || ""}`);
  r = await api("/api/auth/login", { method: "POST", body: { login: SUP_EMAIL, password: PW + "2" } });
  log("login with changed password", r.status === 200, String(r.status));

  r = await api("/api/auth/forgot", { method: "POST", body: { email: "nobody-" + TS + "@klora-qa.test" } });
  log("forgot unknown email → 200 (no enumeration)", r.status === 200 && !r.json?.devCode, `${r.status}`);
  r = await api("/api/auth/forgot", { method: "POST", body: { email: SUP_EMAIL } });
  const code = r.json?.devCode;
  log("forgot known email → devCode (no RESEND key locally)", r.status === 200 && !!code, `${r.status} sent=${!code}`);
  r = await api("/api/auth/verify-otp", { method: "POST", body: { email: SUP_EMAIL, code: "000000" } });
  log("verify-otp wrong code → 400", r.status === 400, String(r.status));
  r = await api("/api/auth/verify-otp", { method: "POST", body: { email: SUP_EMAIL, code } });
  log("verify-otp right code", r.status === 200, String(r.status));
  r = await api("/api/auth/reset", { method: "POST", body: { email: SUP_EMAIL, code, password: "short" } });
  log("reset short password → 400", r.status === 400, String(r.status));
  r = await api("/api/auth/reset", { method: "POST", body: { email: SUP_EMAIL, code, password: PW + "3" } });
  log("reset password", r.status === 200, `${r.status} ${r.json?.error || ""}`);
  r = await api("/api/auth/reset", { method: "POST", body: { email: SUP_EMAIL, code, password: PW + "4" } });
  log("reset reuse OTP → 400", r.status === 400, String(r.status));
  r = await api("/api/auth/login", { method: "POST", body: { login: SUP_EMAIL, password: PW + "3" } });
  log("login with reset password", r.status === 200, String(r.status));
  supCookie = r.cookie || supCookie;

  // ---------- Logistic register → login → transport data → status → discard → prints ----------
  r = await api("/api/auth/register-logistic", { method: "POST", body: { username: "qa_log_" + TS, email: LOG_EMAIL, company: "QA Logistics", branch: "สาขาเชียงราย", password: PW, confirmPassword: PW } });
  log("register logistic", r.status === 201 || r.status === 200, `${r.status} ${r.json?.error || ""}`);
  let logCookie = r.cookie || "";
  r = await api("/api/auth/login", { method: "POST", body: { login: LOG_EMAIL, password: PW } });
  log("login logistic", r.status === 200 && r.json?.redirect === "/logistic", `${r.status} ${r.json?.redirect}`);
  logCookie = r.cookie || logCookie;
  const logUserId = (() => { try { return Buffer.from(logCookie.split(".")[0], "base64url").toString().split(":")[0]; } catch { return ""; } })();

  r = await api("/api/batches/" + batchId, { method: "PATCH", cookie: logCookie, body: { shippedWeightKg: 33, vehicleKey: "truck_6w", fuelKey: "diesel", isReeferUsed: true, destination: "กรุงเทพฯ", distanceKm: 790 } });
  log("logistic enrich transport → recompute", r.status === 200, `${r.status} ${r.json?.error || ("co2e=" + r.json?.co2eKg)}`);
  r = await api("/api/batches/" + batchId, { method: "PATCH", cookie: logCookie, body: { shipmentStatus: "in_transit" } });
  log("shipment status in_transit", r.status === 200 && r.json?.shipmentStatus === "in_transit", `${r.status} ${r.json?.shipmentStatus || r.json?.error}`);
  r = await api("/api/batches/" + batchId, { method: "PATCH", cookie: logCookie, body: { shipmentStatus: "bogus" } });
  log("shipment status invalid → 400", r.status === 400, String(r.status));
  r = await api("/api/batches/" + batchId, { method: "PATCH", cookie: logCookie, body: { forwardedCount: 1000, discardedCount: 100 } });
  log("discard entry", r.status === 200 && r.json?.discardedCount === 100, `${r.status} ${r.json?.error || ""}`);
  r = await api("/api/batches/" + batchId, { method: "PATCH", cookie: logCookie, body: { forwardedCount: 1200, discardedCount: 100 } });
  log("discard overcap → 422", r.status === 422, String(r.status));
  r = await api("/api/batches/" + batchId, { method: "PATCH", body: { shipmentStatus: "delivered" } });
  log("batch PATCH without session → 401 (SECURITY)", r.status === 401, String(r.status));
  r = await api("/api/batches/BAT-NOPE", { method: "PATCH", cookie: logCookie, body: { shipmentStatus: "delivered" } });
  log("batch PATCH unknown → 404", r.status === 404, String(r.status));

  r = await api("/api/prints", { method: "POST", cookie: logCookie, body: { supplierId: supId, batchId, destination: "กรุงเทพฯ", printedBy: "QA", sortingPoint: "เชียงราย" } });
  log("print log create", r.status === 201 || r.status === 200, `${r.status} ${r.json?.id || r.json?.error}`);
  const printId = r.json?.id;
  r = await api("/api/prints/" + printId, { method: "PATCH", cookie: logCookie, body: { cancelled: true } });
  log("print cancel", r.status === 200, `${r.status} ${r.json?.error || ""}`);
  r = await api("/api/prints", { method: "POST", body: { supplierId: supId } });
  log("print create without session → 401 (SECURITY)", r.status === 401, String(r.status));

  // ---------- KYN: compute, suspend supplier, suspended login blocked ----------
  const kynCookie = mint("USR-0003");
  r = await api("/api/batches/" + batchId, { method: "PATCH", cookie: kynCookie, body: { action: "compute" } });
  log("kyn compute batch", r.status === 200 && r.json?.status === "computed", `${r.status} ${r.json?.status || r.json?.error} co2e=${r.json?.co2eKg}`);
  r = await api("/api/suppliers/" + supId, { method: "PATCH", cookie: kynCookie, body: { status: "suspended" } });
  log("kyn suspend supplier", r.status === 200 && r.json?.status === "suspended", `${r.status} ${r.json?.status || r.json?.error}`);
  r = await api("/api/auth/login", { method: "POST", body: { login: SUP_EMAIL, password: PW + "3" } });
  log("suspended supplier login → 403", r.status === 403, String(r.status));
  r = await api("/api/suppliers/" + supId, { method: "PATCH", cookie: kynCookie, body: { status: "active" } });
  log("kyn re-activate supplier", r.status === 200 && r.json?.status === "active", String(r.status));
  r = await api("/api/suppliers/" + supId, { method: "PATCH", body: { status: "suspended" } });
  log("supplier status PATCH without session → 401 (SECURITY)", r.status === 401, String(r.status));
  r = await api("/api/suppliers/" + supId, { method: "PATCH", cookie: logCookie, body: { farmName: "hacked" } });
  log("logistic cannot edit farm profile → 403 (SECURITY)", r.status === 403, String(r.status));
  r = await api("/api/suppliers", { method: "POST", body: { farmName: "x" } });
  log("supplier create without session → 401 (SECURITY)", r.status === 401, String(r.status));
  r = await api("/api/batches");
  log("batches list without session → 401 (SECURITY)", r.status === 401, String(r.status));
  r = await api("/api/suppliers");
  log("suppliers list without session → 401 (SECURITY)", r.status === 401, String(r.status));
  r = await api("/api/prints");
  log("prints list without session → 401 (SECURITY)", r.status === 401, String(r.status));

  // ---------- Trace + QR public ----------
  const tr = await fetch(BASE + "/trace/" + batchId);
  log("trace page public 200", tr.status === 200, String(tr.status));
  const qr = await fetch(BASE + "/api/qr?data=" + encodeURIComponent("https://corta.tech/trace/" + batchId));
  log("qr image", qr.status === 200 && /image/.test(qr.headers.get("content-type") || ""), `${qr.status} ${qr.headers.get("content-type")}`);

  // ---------- Logout ----------
  r = await api("/api/auth/logout", { method: "POST", cookie: supCookie });
  log("logout", r.status === 200 || r.status === 204 || (r.status >= 300 && r.status < 400), String(r.status));

  // ---------- Cleanup ----------
  await sql`DELETE FROM prints WHERE supplier_id = ${supId}`;
  await sql`DELETE FROM batches WHERE supplier_id = ${supId}`;
  await sql`DELETE FROM invites WHERE supplier_id = ${supId}`;
  await sql`DELETE FROM members WHERE supplier_id = ${supId}`;
  await sql`DELETE FROM notifications WHERE supplier_id = ${supId}`;
  await sql`DELETE FROM farm_monthly_inputs WHERE supplier_id = ${supId}`;
  await sql`DELETE FROM otp WHERE email LIKE '%@klora-qa.test'`;
  await sql`DELETE FROM users WHERE email LIKE '%@klora-qa.test'`;
  await sql`DELETE FROM suppliers WHERE id = ${supId}`;
  await sql`DELETE FROM rate_limits WHERE key LIKE '%:ip:::1' OR key LIKE 'login:acct:qa_%' OR key LIKE '%klora-qa.test%'`;
  const left = await sql`SELECT (SELECT count(*) FROM users WHERE email LIKE '%@klora-qa.test') u, (SELECT count(*) FROM suppliers WHERE id = ${supId}) s, (SELECT count(*) FROM batches WHERE supplier_id = ${supId}) b`;
  log("cleanup complete", left[0].u === "0" && left[0].s === "0" && left[0].b === "0", JSON.stringify(left[0]));
  void supUserId; void logUserId;

  const fails = results.filter((x) => !x.ok);
  console.log(`\n${results.length} checks, ${fails.length} failed`);
  process.exit(fails.length ? 1 : 0);
})();
