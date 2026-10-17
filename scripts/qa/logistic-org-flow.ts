// Logistic companies → branches → accounts (doc tab "Logistic", 17 Oct 2026), end to end through the API:
// company sign-up (waits for KYN) / KYN invite link (active at once) · the head office's branch link ·
// branch sign-up (waits for the head office) · approve / reject / disable · whose lots each account sees ·
// the producer link locked to the account's branch · the export menu by provider type · 5 wrong logins.
// QA companies, branches, farm and lots only; self-cleaning.
//   npx tsx --env-file=.env.local --tsconfig tsconfig.json scripts/qa/logistic-org-flow.ts   (dev server on :3123)
import { neon } from "@neondatabase/serverless";
import { mint, companyForm, cleanupQaCarriers, QA_PASSWORD } from "./qa-carrier";

const BASE = "http://localhost:3123"; const TS = Date.now().toString(36);
const KYN = mint("USR-0003"), THAIPOST = mint("USR-0002");
let fails = 0; const log = (n: string, ok: boolean, note = "") => { if (!ok) fails++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${note ? "  — " + note : ""}`); };
const api = async (path: string, method: string, body?: unknown, cookie?: string) => {
  const r = await fetch(BASE + path, { method, redirect: "manual", headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: `klora_session=${cookie}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, json: await r.json().catch(() => ({})), set: r.headers.get("set-cookie") || "" };
};
const page = async (path: string, cookie?: string) => {
  const r = await fetch(BASE + path, { redirect: "manual", headers: cookie ? { Cookie: `klora_session=${cookie}` } : {} });
  return { status: r.status, where: r.headers.get("location") ?? "", text: (await r.text()).replace(/<!-- -->/g, "") };
};
const cookieOf = (set: string) => /klora_session=([^;]+)/.exec(set)?.[1] ?? "";
/** a server redirect — before streaming (307) or inside the streamed page (NEXT_REDIRECT) */
const redirected = (p: { status: number; text: string }) => p.status === 307 || p.text.includes("NEXT_REDIRECT");

(async () => {
  const sql = neon(process.env.DATABASE_URL!);
  const freshIp = () => sql`DELETE FROM rate_limits WHERE key LIKE 'register:ip:%' AND (key LIKE '%:::1' OR key LIKE '%127.0.0.1' OR key LIKE '%unknown')`;
  let farmId = "";
  const keptInvite = await sql`SELECT value, updated_at, updated_by FROM app_settings WHERE key = 'logistic_invite'`;
  try {
    await freshIp();
    // --- 1. a company signing up alone waits for KYN ---------------------------------------------------
    const bad = await api("/api/auth/register-logistic", "POST", companyForm("lo-bad", TS, { password: "onlyletters", confirmPassword: "onlyletters", subdistrict: "ไม่มีตำบลนี้", taxId: "123" }));
    log("sign-up checks: password letters+digits, ตำบล in the list, tax id 13 digits", bad.status === 400 && !!bad.json.errors?.password && !!bad.json.errors?.subdistrict && !!bad.json.errors?.taxId, JSON.stringify(bad.json.errors));
    const A = await api("/api/auth/register-logistic", "POST", companyForm("loa", TS, { providerType: "thaipost" }));
    const aCookie = cookieOf(A.set);
    log("self sign-up → company pending, signed in", A.status === 201 && A.json.status === "pending" && !!aCookie, JSON.stringify(A.json));
    const [aUser] = await sql`SELECT id, org_code, branch_id, branch FROM users WHERE email = ${`qa-loa-${TS}@klora-qa.test`}`;
    const [aHq] = await sql`SELECT * FROM logistic_branches WHERE id = ${aUser.branch_id}`;
    const [aOrg] = await sql`SELECT * FROM logistic_orgs WHERE org_code = ${aUser.org_code}`;
    log("head office made at the given address (postcode from the list)", aHq?.is_hq === true && aHq.name === "สำนักงานใหญ่" && aHq.status === "active" && aHq.postcode === "50100" && aHq.admin_user_id === aUser.id && aOrg.postcode === "50100", `${aHq?.postcode}`);
    const aGo = await page("/logistic", aCookie);
    const aWait = await page("/logistic/waiting", aCookie);
    log("pending company: every portal page sends it to the waiting page (no page data)", aGo.status === 307 && aGo.where.endsWith("/logistic/waiting") && redirected(await page("/logistic/incoming", aCookie)) && aWait.text.includes("รอการตรวจสอบจากผู้ดูแลระบบ") && !aWait.text.includes("ภาพรวมการขนส่ง"), `${aGo.status} ${aGo.where}`);
    log("pending company cannot make a producer link", (await api("/api/carrier-links", "POST", {}, aCookie)).status === 403);
    const kynApprove = await api(`/api/logistic/companies/${aUser.org_code}`, "PATCH", { action: "approve" }, KYN);
    log("KYN approves the company", kynApprove.status === 200 && kynApprove.json.org?.status === "active");
    const aHome = await page("/logistic", aCookie);
    log("new company starts empty — none of the other companies' lots", aHome.text.includes("ภาพรวมการขนส่ง") && !/LOT-26\d\d-\d{4}/.test(aHome.text));
    log("API: new company lists no lots", Array.isArray((await api("/api/batches", "GET", undefined, aCookie)).json) && (await api("/api/batches", "GET", undefined, aCookie)).json.length === 0);
    log("ไปรษณีย์ไทย type: no 'เพิ่มข้อมูลรอบส่งออก' menu, page redirects", !aHome.text.includes("เพิ่มข้อมูลรอบส่งออก") && redirected(await page("/logistic/new", aCookie)));
    log("approved company: the waiting page sends it on", redirected(await page("/logistic/waiting", aCookie)));
    log("head office has 'ข้อมูลรายสาขา'", aHome.text.includes("ข้อมูลรายสาขา"));

    // --- 2. KYN's invite link: a company through it is active at once -------------------------------------
    const inv = await api("/api/logistic/company-invite", "POST", { action: "new" }, KYN);
    await freshIp();
    const B = await api("/api/auth/register-logistic", "POST", companyForm("lob", TS, { invite: inv.json.token }));
    const bCookie = cookieOf(B.set);
    log("through KYN's invite link → active at once", B.status === 201 && B.json.status === "active");
    log("ศูนย์คัดแยกสินค้า type: has 'เพิ่มข้อมูลรอบส่งออก'", (await page("/logistic", bCookie)).text.includes("เพิ่มข้อมูลรอบส่งออก") && (await page("/logistic/new", bCookie)).status === 200);
    await api("/api/logistic/company-invite", "POST", { action: "close" }, KYN);
    log("KYN changes the provider type → menu follows", (await api(`/api/logistic/companies/${aUser.org_code}`, "PATCH", { action: "type", providerType: "exporter" }, KYN)).status === 200 && (await page("/logistic", aCookie)).text.includes("เพิ่มข้อมูลรอบส่งออก"));
    await api(`/api/logistic/companies/${aUser.org_code}`, "PATCH", { action: "type", providerType: "thaipost" }, KYN);

    // --- 3. the head office's branch link -----------------------------------------------------------------
    const l1 = await api("/api/logistic/branch-link", "POST", { action: "new" }, aCookie);
    log("head office makes the branch link (XXXX-XXXX)", l1.status === 200 && /^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(l1.json.token ?? ""), l1.json.token);
    const join1 = await page(`/logistic/join/${l1.json.token}`);
    log("branch sign-up page: company locked, no 'ใช้ได้ 1 ครั้ง' line", join1.text.includes("ลงทะเบียนสาขา") && join1.text.includes(`QA ขนส่ง loa ${TS}`) && !join1.text.includes("ลิงก์นี้ใช้ได้ 1 ครั้ง"));
    const l2 = await api("/api/logistic/branch-link", "POST", { action: "new" }, aCookie);
    log("a new link stops the old one", l2.json.token !== l1.json.token && (await page(`/logistic/join/${l1.json.token}`)).text.includes("ลิงก์นี้ใช้ไม่ได้แล้ว"));
    const branchForm = (tag: string, name: string, over: Record<string, unknown> = {}) => ({
      token: l2.json.token, branchName: name, phone: "053000001", address: "1 หมู่ 2", province: "เชียงราย", district: "เมืองเชียงราย", subdistrict: "รอบเวียง", gps: "19.9105, 99.8406",
      username: `qa_${tag}_${TS}`, email: `qa-${tag}-${TS}@klora-qa.test`, password: QA_PASSWORD, confirmPassword: QA_PASSWORD, accept: true, ...over,
    });
    await freshIp();
    const C = await api("/api/auth/register-branch", "POST", branchForm("loc", "สาขาเชียงราย QA"));
    const cCookie = cookieOf(C.set);
    const [cUser] = await sql`SELECT id, org_code, branch_id, branch, company FROM users WHERE email = ${`qa-loc-${TS}@klora-qa.test`}`;
    const [cBr] = await sql`SELECT * FROM logistic_branches WHERE id = ${cUser?.branch_id}`;
    log("branch signs up → pending, in that company", C.status === 201 && cBr?.status === "pending" && cBr.org_code === aUser.org_code && cUser.company === `QA ขนส่ง loa ${TS}` && cBr.postcode === "57000");
    log("same branch name twice refused", (await api("/api/auth/register-branch", "POST", branchForm("loc2", "สาขาเชียงราย QA"))).status === 400);
    const cWait = await page("/logistic/waiting", cCookie);
    log("pending branch sees 'รอการอนุมัติจากสำนักงานใหญ่'", redirected(await page("/logistic", cCookie)) && cWait.text.includes("รอการอนุมัติจากสำนักงานใหญ่") && cWait.text.includes("สาขาเชียงราย QA"));
    log("pending branch cannot make a producer link or invite", (await api("/api/carrier-links", "POST", {}, cCookie)).status === 403 && (await api("/api/invites", "POST", { email: `qa-x-${TS}@klora-qa.test` }, cCookie)).status === 403);
    const settings = await page("/logistic/settings", aCookie);
    log("จัดการระบบ: head office gets the สาขา tab with the waiting branch", settings.text.includes(">สาขา<") && settings.text.includes("สาขาเชียงราย QA") && settings.text.includes(l2.json.token));
    log("a branch's จัดการระบบ has no สาขา tab", !(await page("/logistic/settings", bCookie)).text.includes("ลิงก์ลงทะเบียนสาขา"));
    log("only the head office runs branches", (await api(`/api/logistic/branches/${cUser.branch_id}`, "PATCH", { action: "approve" }, cCookie)).status === 403 && (await api(`/api/logistic/branches/${cUser.branch_id}`, "PATCH", { action: "approve" }, THAIPOST)).status === 404);
    const ap = await api(`/api/logistic/branches/${cUser.branch_id}`, "PATCH", { action: "approve" }, aCookie);
    log("head office approves → branch active, history kept", ap.status === 200 && ap.json.branch?.status === "active" && ap.json.branch.history.some((h: { text: string }) => h.text === "อนุมัติสาขา"));
    const cHome = await page("/logistic", cCookie);
    log("approved branch: dashboard, no 'ข้อมูลรายสาขา'", cHome.text.includes("ภาพรวมการขนส่ง") && !cHome.text.includes("ข้อมูลรายสาขา") && redirected(await page("/logistic/branches", cCookie)));
    log("head office cannot be disabled", (await api(`/api/logistic/branches/${aUser.branch_id}`, "PATCH", { action: "disable" }, aCookie)).status === 409);

    // reject with a reason
    await freshIp();
    const D = await api("/api/auth/register-branch", "POST", branchForm("lod", "สาขาแม่สาย QA", { district: "แม่สาย", subdistrict: "แม่สาย", gps: "20.4283, 99.8836" }));
    const [dUser] = await sql`SELECT branch_id FROM users WHERE email = ${`qa-lod-${TS}@klora-qa.test`}`;
    log("reject needs a reason", (await api(`/api/logistic/branches/${dUser.branch_id}`, "PATCH", { action: "reject" }, aCookie)).status === 400);
    const rj = await api(`/api/logistic/branches/${dUser.branch_id}`, "PATCH", { action: "reject", reason: "ไม่ใช่สาขาของบริษัท" }, aCookie);
    const dLogin = await api("/api/auth/login", "POST", { login: `qa-lod-${TS}@klora-qa.test`, password: QA_PASSWORD });
    log("rejected branch cannot sign in (reason shown)", D.status === 201 && rj.status === 200 && dLogin.status === 403 && String(dLogin.json.error).includes("ไม่ใช่สาขาของบริษัท"), dLogin.json.error);

    // --- 4. whose lots: the farm picks the branch it drops the lot at --------------------------------------
    await freshIp();
    const F = await api("/api/auth/register", "POST", { farmName: `QA Branch Farm ${TS}`, address: "อ.แม่ริม จ.เชียงใหม่", gps: "18.91, 98.94", contactName: "QA", flowerType: "มะม่วง", email: `qa-lof-${TS}@klora-qa.test`, username: `qa_lof_${TS}`, password: QA_PASSWORD, confirmPassword: QA_PASSWORD });
    const fCookie = cookieOf(F.set); farmId = F.json.supplier?.id ?? "";
    const newRound = await page("/app/new", fCookie);
    log("farm form lists the new active branch (not the pending/rejected one)", newRound.text.includes("สาขาเชียงราย QA") && !newRound.text.includes("สาขาแม่สาย QA"));
    const round = { productCategory: "fruit", productType: "มะม่วง", variety: "น้ำดอกไม้", grade: "A", unit: "kg", quantity: 40, cutDate: "2026-10-15", distanceKm: 120, destination: "กรุงเทพฯ", destinationAddress: "99/1 ถ.สุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110", carrier: "ไปรษณีย์ไทย", postalCode: "57000", shippedWeightKg: 45, packagingItems: [] };
    const refused = await api("/api/batches", "POST", { ...round, branchId: dUser.branch_id }, fCookie);
    log("a lot cannot go to a rejected branch", refused.status === 400);
    const lotR = await api("/api/batches", "POST", { ...round, branchId: cUser.branch_id, branch: "anything" }, fCookie);
    const lot = String(lotR.json.id ?? "");
    log("farm lot → that branch (name from the record)", lotR.status === 201 && lotR.json.branchId === cUser.branch_id && lotR.json.branch === "สาขาเชียงราย QA", `${lotR.json.branchId} ${lotR.json.branch}`);
    const ids = async (c: string) => ((await api("/api/batches", "GET", undefined, c)).json as { id: string }[]).map((b) => b.id);
    log("branch and its head office see it; another company and Thai Post do not", (await ids(cCookie)).includes(lot) && (await ids(aCookie)).includes(lot) && !(await ids(bCookie)).includes(lot) && !(await ids(THAIPOST)).includes(lot));
    log("Thai Post demo still sees its own history (10 lots), not TTT's", (await ids(THAIPOST)).filter((x) => /^LOT-26(07|08|09)/.test(x)).length >= 10 && !(await ids(THAIPOST)).includes("LOT-2610-0011"));
    log("another company cannot print it; the branch can", (await api("/api/prints", "POST", { supplierId: farmId, batchId: lot }, bCookie)).status === 403 && (await api("/api/prints", "POST", { supplierId: farmId, batchId: lot }, cCookie)).status === 201);
    const branches = await page("/logistic/branches", aCookie);
    log("ข้อมูลรายสาขา: active branches, linking to each dashboard", branches.text.includes("สาขาเชียงราย QA") && branches.text.includes(`/logistic?branch=${cUser.branch_id}`) && !branches.text.includes("สาขาแม่สาย QA"));
    const dash = await page(`/logistic?branch=${cUser.branch_id}`, aCookie);
    log("head office opens one branch's dashboard", dash.text.includes("แดชบอร์ดของ") && dash.text.includes("สาขาเชียงราย QA") && dash.text.includes(lot));
    log("another company cannot open that branch", !(await page(`/logistic?branch=${cUser.branch_id}`, bCookie)).text.includes(lot));

    // --- 5. the producer link is the account's own branch -----------------------------------------------------
    const link = await api("/api/carrier-links", "POST", { carrierKey: "exporter", branch: "สาขาอื่น" }, cCookie);
    log("producer link: company type + the account's branch (body ignored)", link.status === 201 && link.json.carrierKey === "thaipost" && link.json.branch === "สาขาเชียงราย QA" && link.json.branchId === cUser.branch_id, `${link.json.carrierKey} ${link.json.branch}`);
    const inc = await page("/logistic/incoming", cCookie);
    log("link panel has no type / branch pickers", !inc.text.includes("เลือกสาขาต้นทาง") && !inc.text.includes(">รูปแบบการจัดส่ง<"));

    // --- 6. disable: the branch is locked out at once, its lots stay with the head office ------------------
    log("disable branch", (await api(`/api/logistic/branches/${cUser.branch_id}`, "PATCH", { action: "disable" }, aCookie)).status === 200);
    log("disabled branch: session ends, login refused", (await page("/logistic", cCookie)).status === 307 && (await api("/api/auth/login", "POST", { login: `qa-loc-${TS}@klora-qa.test`, password: QA_PASSWORD })).status === 403);
    log("its lots stay in the head office's figures", (await ids(aCookie)).includes(lot));
    log("enable again", (await api(`/api/logistic/branches/${cUser.branch_id}`, "PATCH", { action: "enable" }, aCookie)).status === 200 && (await page("/logistic", cCookie)).status === 200);
    const ed = await api(`/api/logistic/branches/${cUser.branch_id}`, "PATCH", { action: "edit", name: "สาขาเชียงราย QA2", phone: "053000002" }, aCookie);
    log("head office edits a branch (name follows to its accounts)", ed.status === 200 && (await sql`SELECT branch FROM users WHERE id = ${cUser.id}`)[0].branch === "สาขาเชียงราย QA2");

    // --- 7. five wrong passwords lock the login with a countdown ----------------------------------------------
    const who = `qa_loa_${TS}`;
    const tries: number[] = [];
    for (let i = 0; i < 5; i++) tries.push((await api("/api/auth/login", "POST", { login: who, password: "wrong-pass-1" })).status);
    const locked = await api("/api/auth/login", "POST", { login: who, password: QA_PASSWORD });
    log("5 wrong logins → locked (429 + retryAfter), even the right password waits", JSON.stringify(tries) === "[401,401,401,401,429]" && locked.status === 429 && locked.json.retryAfter > 200 && locked.json.locked === true, `${JSON.stringify(tries)} ${locked.status} ${locked.json.retryAfter}`);
    await sql`DELETE FROM rate_limits WHERE key = ${`login:fail:${who}`}`;
    log("after the wait: signs in", (await api("/api/auth/login", "POST", { login: who, password: QA_PASSWORD })).status === 200);

    // --- 8. KYN sees the companies -------------------------------------------------------------------------
    const kyn = await page("/kyn/carriers", KYN);
    log("KYN › บริษัทขนส่ง lists the companies with their type", kyn.text.includes(`QA ขนส่ง loa ${TS}`) && kyn.text.includes("ลิงก์เชิญบริษัท"));
    log("places API: provinces by region, districts, ตำบล + postcode", (await api("/api/places", "GET")).json.regions?.length === 6 && (await api(`/api/places?province=${encodeURIComponent("เชียงราย")}&district=${encodeURIComponent("แม่สาย")}`, "GET")).json.subdistricts?.some((s: { name: string; postcode: string }) => s.name === "เวียงพางคำ" && s.postcode === "57130"));
  } catch (e) {
    log("run", false, String((e as Error).stack ?? e).slice(0, 300));
  } finally {
    // clean up: the QA farm and its lots, then the QA companies
    if (farmId) {
      const lots = (await sql`SELECT id FROM batches WHERE supplier_id = ${farmId}`).map((r) => String(r.id));
      if (lots.length) {
        await sql`DELETE FROM prints WHERE batch_id = ANY(${lots})`;
        await sql`DELETE FROM custom_entries WHERE batch_id = ANY(${lots})`;
        await sql`DELETE FROM batches WHERE id = ANY(${lots})`;
      }
      await sql`DELETE FROM prints WHERE supplier_id = ${farmId}`;
      await sql`DELETE FROM notifications WHERE supplier_id = ${farmId}`;
      await sql`DELETE FROM custom_entries WHERE supplier_id = ${farmId}`;
      await sql`DELETE FROM users WHERE supplier_id = ${farmId}`;
      await sql`DELETE FROM suppliers WHERE id = ${farmId}`;
    }
    await cleanupQaCarriers(sql);
    await sql`DELETE FROM app_settings WHERE key = 'logistic_invite'`;
    if (keptInvite[0]) await sql`INSERT INTO app_settings (key, value, updated_at, updated_by) VALUES ('logistic_invite', ${JSON.stringify(keptInvite[0].value)}::jsonb, ${keptInvite[0].updated_at}, ${keptInvite[0].updated_by})`;
    console.log(fails ? `${fails} failed` : "all passed");
    process.exit(fails ? 1 : 0);
  }
})();
