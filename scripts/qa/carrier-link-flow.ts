// Carrier sign-up links (10 Oct 2026): a carrier makes /c/<token> on /logistic/incoming; a farm that signs up
// (or attaches) through it ships only with that carrier — enforced for the farm's rounds and for other
// carriers' print/export. Also: rounds are calculated as soon as they are submitted (no KYN confirm).
// Two QA carrier orgs + QA farms; self-cleaning.   npx tsx --env-file=.env.local scripts/qa/carrier-link-flow.ts
import { neon } from "@neondatabase/serverless";
import { createHmac } from "crypto";
const BASE = "http://localhost:3123"; const TS = Date.now().toString(36);
const mint = (u: string) => { const p = `${u}:${Date.now() + 3600_000}`; return `${Buffer.from(p).toString("base64url")}.${createHmac("sha256", process.env.KLORA_SESSION_SECRET!).update(p).digest("base64url")}`; };
const api = async (path: string, method: string, body?: unknown, cookie?: string) => { const r = await fetch(BASE + path, { method, redirect: "manual", headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: `klora_session=${cookie}` } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, json: await r.json().catch(() => ({})), cookie: /klora_session=([^;]+)/.exec(r.headers.get("set-cookie") || "")?.[1] }; };
let fails = 0; const log = (n: string, ok: boolean, note = "") => { if (!ok) fails++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${note ? "  — " + note : ""}`); };
const EMAILS: string[] = [];
const carrier = async (tag: string) => { const email = `qa-cl-${tag}-${TS}@klora-qa.test`; EMAILS.push(email); const r = await api("/api/auth/register-logistic", "POST", { username: `qa_cl_${tag}_${TS}`, email, company: `QA Carrier ${tag} ${TS}`, branch: "สาขาเชียงใหม่", password: "QaPassw0rd!", confirmPassword: "QaPassw0rd!" }); return { cookie: r.cookie!, id: r.json.userId as string }; };
const farm = async (tag: string, extra: Record<string, unknown> = {}) => { const email = `qa-cl-${tag}-${TS}@klora-qa.test`; EMAILS.push(email); const r = await api("/api/auth/register", "POST", { farmName: `QA CL Farm ${tag} ${TS}`, address: "อ.แม่ริม จ.เชียงใหม่", gps: "18.91, 98.94", contactName: "QA", flowerType: "มะม่วง", email, username: `qa_cl_${tag}_${TS}`, password: "QaPassw0rd!", confirmPassword: "QaPassw0rd!", ...extra }); return { status: r.status, cookie: r.cookie, id: r.json.supplier?.id as string, error: r.json.error as string | undefined }; };
const ROUND = { productCategory: "fruit", productType: "มะม่วง", unit: "kg", quantity: 40, cutDate: "2026-10-09", distanceKm: 300, destination: "กรุงเทพฯ", shippedWeightKg: 45, packagingItems: [] };

(async () => {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`DELETE FROM rate_limits WHERE key LIKE '%:ip:::1'`;
  const farmIds: string[] = []; const orgs: string[] = [];
  try {
    const A = await carrier("a"); const B = await carrier("b");
    const [ua] = await sql`SELECT org_code, company FROM users WHERE id = ${A.id}`; const [ub] = await sql`SELECT org_code FROM users WHERE id = ${B.id}`;
    orgs.push(ua.org_code, ub.org_code);
    log("two QA carrier orgs", !!ua.org_code && !!ub.org_code && ua.org_code !== ub.org_code, `${ua.org_code} ${ub.org_code}`);

    // the carrier makes a link
    log("no links yet", (await api("/api/carrier-links", "GET", undefined, A.cookie)).json.length === 0);
    const mk = await api("/api/carrier-links", "POST", { carrierKey: "private", branch: "สาขาเชียงใหม่" }, A.cookie);
    const token = mk.json.token as string;
    log("link created (type + branch + org)", mk.status === 201 && /^[A-Za-z0-9_-]{6,}$/.test(token) && mk.json.orgCode === ua.org_code && mk.json.branch === "สาขาเชียงใหม่", `${mk.status} ${token}`);
    log("a farm cannot make links", (await api("/api/carrier-links", "POST", {}, mint("USR-0001"))).status === 403);
    const land = await fetch(`${BASE}/c/${token}`); const landHtml = (await land.text()).replace(/<!-- -->/g, "");
    log("/c/<token> invites to sign up or sign in", land.status === 200 && landHtml.includes(ua.company) && landHtml.includes("สมัครใช้งาน") && landHtml.includes(`next=${encodeURIComponent(`/c/${token}`)}`));

    // a new farm signs up through it (the request's own via is ignored)
    const F1 = await farm("f1", { carrierLink: token, via: "thaipost" }); farmIds.push(F1.id);
    const [s1] = await sql`SELECT signup_via, carrier_org, carrier_company, carrier_branch, carrier_link FROM suppliers WHERE id = ${F1.id}`;
    log("farm bound from the stored link", F1.status === 201 && s1.signup_via === "private" && s1.carrier_org === ua.org_code && s1.carrier_company === ua.company && s1.carrier_branch === "สาขาเชียงใหม่" && s1.carrier_link === token, JSON.stringify(s1));
    log("link use counted + farm listed", (await api("/api/carrier-links", "GET", undefined, A.cookie)).json[0]?.farms?.length === 1 && (await sql`SELECT uses FROM carrier_links WHERE token = ${token}`)[0].uses === 1);

    // the farm ships only with this carrier
    log("another carrier refused", (await api("/api/batches", "POST", { ...ROUND, carrier: "ไปรษณีย์ไทย" }, F1.cookie)).status === 400);
    const ok = await api("/api/batches", "POST", { ...ROUND, carrier: "ขนส่งเอกชน", provider: "Kerry Express" }, F1.cookie);
    const lot = ok.json.id as string;
    log("bound carrier accepted: provider = company, branch filled, lot carries the org, calculated", ok.status === 201 && ok.json.provider === ua.company && ok.json.branch === "สาขาเชียงใหม่" && ok.json.carrierOrg === ua.org_code && ok.json.status === "computed", `${ok.status} ${ok.json.provider} ${ok.json.branch} ${ok.json.carrierOrg} ${ok.json.status}`);
    log("company/branch not sent to KYN's อื่นๆ queue", (await sql`SELECT count(*)::int n FROM custom_entries WHERE supplier_id = ${F1.id}`)[0].n === 0);
    log("edit to another carrier refused", (await api(`/api/batches/${lot}`, "PUT", { ...ROUND, carrier: "ไปรษณีย์ไทย" }, F1.cookie)).status === 400);
    log("another carrier org cannot print the lot", (await api("/api/prints", "POST", { supplierId: F1.id, batchId: lot }, B.cookie)).status === 403);
    log("another carrier org cannot record its export", (await api(`/api/batches/${lot}`, "PATCH", { shippedWeightKg: 50 }, B.cookie)).status === 403);
    log("another carrier org cannot add rounds for the farm", (await api("/api/batches", "POST", { ...ROUND, carrier: "ขนส่งเอกชน", supplierId: F1.id }, B.cookie)).status === 403);
    const pr = await api("/api/prints", "POST", { supplierId: F1.id, batchId: lot }, A.cookie);
    log("its own carrier prints", pr.status === 201, String(pr.status));

    // an existing farm attaches
    const F2 = await farm("f2"); farmIds.push(F2.id);
    log("existing farm attaches", (await api(`/api/carrier-links/${token}/attach`, "POST", undefined, F2.cookie)).status === 200 && (await sql`SELECT carrier_org FROM suppliers WHERE id = ${F2.id}`)[0].carrier_org === ua.org_code);
    log("attaching again is a no-op", (await api(`/api/carrier-links/${token}/attach`, "POST", undefined, F2.cookie)).json.already === true);
    const tokB = (await api("/api/carrier-links", "POST", { carrierKey: "thaipost" }, B.cookie)).json.token as string;
    log("bound to another org → refused (ask KYN)", (await api(`/api/carrier-links/${tokB}/attach`, "POST", undefined, F2.cookie)).status === 409);
    log("a carrier cannot attach", (await api(`/api/carrier-links/${token}/attach`, "POST", undefined, B.cookie)).status === 403);

    // closing a link
    log("another org cannot close it", (await api(`/api/carrier-links/${token}`, "PATCH", { revoke: true }, B.cookie)).status === 404);
    log("owner closes it", (await api(`/api/carrier-links/${token}`, "PATCH", { revoke: true }, A.cookie)).status === 200);
    const F3 = await farm("f3", { carrierLink: token });
    if (F3.id) farmIds.push(F3.id);
    log("closed link: sign-up through it refused", F3.status === 400 && !F3.id, `${F3.status} ${F3.error}`);
    log("closed link: landing page says so", ((await (await fetch(`${BASE}/c/${token}`)).text())).includes("ลิงก์นี้ถูกปิดแล้ว"));
    log("bound farms stay bound after closing", (await sql`SELECT carrier_org FROM suppliers WHERE id = ${F1.id}`)[0].carrier_org === ua.org_code);

    // KYN releases a farm
    const un = await api(`/api/suppliers/${F1.id}`, "PATCH", { signupVia: null }, mint("USR-0003"));
    const [s1b] = await sql`SELECT signup_via, carrier_org, carrier_company FROM suppliers WHERE id = ${F1.id}`;
    log("KYN unbinding clears the org too", un.status === 200 && s1b.signup_via === null && s1b.carrier_org === null && s1b.carrier_company === null, JSON.stringify(s1b));

    // automatic calculation: even a flower round without packaging is calculated on submit
    await sql`DELETE FROM rate_limits WHERE key LIKE '%:ip:::1'`; // sign-ups are rate-limited per IP
    const F4 = await farm("f4", { flowerType: "กุหลาบ" }); farmIds.push(F4.id);
    const fl = await api("/api/batches", "POST", { productCategory: "flower", productType: "กุหลาบ", unit: "stem", quantity: 200, cutDate: "2026-10-09", distanceKm: 120, destination: "กรุงเทพฯ", carrier: "ไปรษณีย์ไทย" }, F4.cookie);
    log("calculated automatically (no KYN confirm)", fl.status === 201 && fl.json.status === "computed" && fl.json.co2ePerFlower > 0, `${fl.status} ${fl.json.status}`);
  } catch (e) {
    log("run", false, String((e as Error).message));
  } finally {
    const ids = farmIds.filter(Boolean);
    if (ids.length) {
      await sql`DELETE FROM prints WHERE supplier_id = ANY(${ids})`;
      await sql`DELETE FROM notifications WHERE supplier_id = ANY(${ids})`;
      await sql`DELETE FROM custom_entries WHERE supplier_id = ANY(${ids})`;
      await sql`DELETE FROM packaging_assets WHERE owner_supplier_id = ANY(${ids})`;
      await sql`DELETE FROM batches WHERE supplier_id = ANY(${ids})`;
      await sql`DELETE FROM suppliers WHERE id = ANY(${ids})`;
    }
    const og = orgs.filter(Boolean);
    if (og.length) await sql`DELETE FROM carrier_links WHERE org_code = ANY(${og})`;
    await sql`DELETE FROM rate_limits WHERE key IN (SELECT 'carrier-links:user:' || id FROM users WHERE email = ANY(${EMAILS}))`;
    await sql`DELETE FROM users WHERE email = ANY(${EMAILS})`;
    await sql`DELETE FROM rate_limits WHERE key LIKE '%:ip:::1' OR key LIKE 'login:acct:qa_%'`;
  }
  console.log(fails ? `${fails} failed` : "all passed");
})();
