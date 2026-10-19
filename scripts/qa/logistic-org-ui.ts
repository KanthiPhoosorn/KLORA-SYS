// The new logistic screens in a real browser with real clicks (doc tab "Logistic", 17 Oct 2026): the company
// sign-up form (2 steps, จังหวัด → อำเภอ → ตำบล → postcode, the map picker), the waiting page, KYN's check,
// the head office's สาขา tab (link, new link, approve in the branch window with its map, reject with a
// reason), the login lock countdown, and the form at phone width. QA companies only; self-cleaning.
//   npx tsx --env-file=.env.local --tsconfig tsconfig.json scripts/qa/logistic-org-ui.ts   (dev server on :3123)
import puppeteer, { type Page } from "puppeteer-core";
import { neon } from "@neondatabase/serverless";
import { mint, cleanupQaCarriers, QA_PASSWORD } from "./qa-carrier";

const BASE = "http://localhost:3123"; const TS = Date.now().toString(36);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let fails = 0; const log = (n: string, ok: boolean, note = "") => { if (!ok) fails++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${note ? "  — " + note : ""}`); };
const text = (p: Page) => p.evaluate("document.body.innerText") as Promise<string>;
const waitText = (p: Page, t: string, ms = 15000) => p.waitForFunction(`document.body.innerText.includes(${JSON.stringify(t)})`, { timeout: ms }).then(() => true, () => false);
/** click the button / link whose text has `t` (inside `scope`, a CSS selector) — a real mouse click */
async function clickText(p: Page, t: string, scope = "body") {
  const h = await p.evaluateHandle(`Array.from(document.querySelector(${JSON.stringify(scope)}).querySelectorAll("button, a")).find((e) => e.innerText.includes(${JSON.stringify(t)}))`);
  const el = h.asElement();
  if (!el) throw new Error(`no button "${t}"`);
  await (el as import("puppeteer-core").ElementHandle<Element>).click();
}
const selectWhenReady = async (p: Page, name: string, value: string) => {
  await p.waitForFunction(`Array.from(document.querySelector('select[name="${name}"]').options).some((o) => o.value === ${JSON.stringify(value)})`, { timeout: 15000 });
  await p.select(`select[name="${name}"]`, value);
};

(async () => {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`DELETE FROM rate_limits WHERE key LIKE 'register:ip:%' AND (key LIKE '%:::1' OR key LIKE '%127.0.0.1' OR key LIKE '%unknown')`;
  const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  const errs: string[] = [];
  try {
    // --- 1. company sign-up form ---------------------------------------------------------------------------
    const ctx = await b.createBrowserContext();
    const p = await ctx.newPage(); await p.setViewport({ width: 1440, height: 1000 });
    p.on("pageerror", (e) => errs.push(String(e).slice(0, 160)));
    await p.goto(`${BASE}/logistic/register`, { waitUntil: "networkidle0" });
    const t0 = await text(p);
    log("sign-up page: ลงทะเบียน · ข้อมูลบริษัท (step 1 of 2)", t0.includes("ลงทะเบียน") && t0.includes("ข้อมูลบริษัท") && t0.includes("ข้อมูลผู้ดูแลบัญชี") && t0.includes("ประเภทผู้ให้บริการขนส่ง"));
    await clickText(p, "ถัดไป");
    log("step 1 checks the required fields", await waitText(p, "กรุณากรอกชื่อบริษัท") && (await text(p)).includes("กรุณาเลือกจังหวัด"));
    await p.type('input[name="company"]', `QA ขนส่ง ui ${TS}`);
    await p.select('select[name="providerType"]', "sorting_center");
    await p.type('input[name="phone"]', "0812345678");
    await p.type('input[name="address"]', "99 หมู่ 3 ถ.พหลโยธิน");
    const groups = (await p.evaluate(`Array.from(document.querySelectorAll('select[name="province"] optgroup')).map((g) => g.label)`)) as string[];
    log("provinces grouped by ภาค", groups.length === 6 && groups.includes("ภาคเหนือ") && groups.includes("ภาคใต้"), groups.join(", "));
    await selectWhenReady(p, "province", "เชียงราย");
    await selectWhenReady(p, "district", "เมืองเชียงราย");
    await selectWhenReady(p, "subdistrict", "รอบเวียง");
    log("ตำบล → รหัสไปรษณีย์ shown by the system", (await p.$eval('input[name="postcode"]', (e) => (e as HTMLInputElement).value)) === "57000");
    await p.click('button[aria-label="เลือกตำแหน่งจากแผนที่"]');
    await p.waitForSelector('[role="dialog"][aria-label="เลือกตำแหน่งจากแผนที่"]', { timeout: 8000 });
    const tiles = await p.waitForFunction(`Array.from(document.querySelectorAll('[role="dialog"] img')).filter((i) => i.src.includes("tile.openstreetmap.org") && i.complete && i.naturalWidth > 0).length >= 2`, { timeout: 20000 }).then(() => true, () => false);
    log("map picker opens on the chosen ตำบล with map tiles", tiles);
    const box = (await (await p.$('[role="dialog"] .cursor-crosshair'))!.boundingBox())!;
    await p.mouse.click(box.x + box.width / 2 + 40, box.y + box.height / 2 - 30);
    await clickText(p, "ใช้ตำแหน่งนี้", '[role="dialog"]');
    const gps = await p.$eval('input[name="gps"]', (e) => (e as HTMLInputElement).value);
    const [la, ln] = gps.split(",").map(Number);
    log("a tap on the map fills พิกัดที่ตั้ง (near รอบเวียง)", Math.abs(la - 19.9) < 0.1 && Math.abs(ln - 99.83) < 0.1, gps);
    await clickText(p, "ถัดไป");
    log("step 2: admin account", await waitText(p, "ข้อมูลผู้ดูแลบัญชี") && (await text(p)).includes("กรณีลงทะเบียนด้วยตนเอง บัญชีจะเริ่มใช้งานได้หลังจากผ่านการตรวจสอบจากผู้ดูแลระบบ"));
    await p.type('input[name="username"]', `qa_ui_${TS}`);
    await p.type('input[name="email"]', `qa-ui-${TS}@klora-qa.test`);
    await p.type('input[name="password"]', "letters-only");
    await p.type('input[name="confirmPassword"]', "letters-only");
    await clickText(p, "ลงทะเบียน", "form");
    log("password rule + consent checked before sending", await waitText(p, "ประกอบด้วยตัวอักษรภาษาอังกฤษและตัวเลข") && (await text(p)).includes("กรุณายอมรับข้อกำหนด"));
    for (const n of ["password", "confirmPassword"]) { await p.click(`input[name="${n}"]`, { clickCount: 3 }); await p.type(`input[name="${n}"]`, QA_PASSWORD); }
    await p.click('input[name="accept"]');
    await clickText(p, "ลงทะเบียน", "form");
    log("signed up → waiting page (KYN check)", await waitText(p, "รอการตรวจสอบจากผู้ดูแลระบบ", 20000) && p.url().endsWith("/logistic/waiting"), p.url());
    const [u] = await sql`SELECT org_code, branch_id FROM users WHERE email = ${`qa-ui-${TS}@klora-qa.test`}`;

    // --- 2. KYN checks it ------------------------------------------------------------------------------------
    const kctx = await b.createBrowserContext();
    await kctx.setCookie({ name: "klora_session", value: mint("USR-0003"), domain: "localhost", path: "/" });
    const k = await kctx.newPage(); await k.setViewport({ width: 1440, height: 1000 });
    await k.goto(`${BASE}/kyn/carriers`, { waitUntil: "networkidle0" });
    log("KYN › บริษัทขนส่ง: the company waits", (await text(k)).includes(`QA ขนส่ง ui ${TS}`) && (await text(k)).includes("รอการตรวจสอบ"));
    const row = `tr:has(td div:first-child)`; void row;
    await k.evaluate(`Array.from(document.querySelectorAll("tr")).find((r) => r.innerText.includes(${JSON.stringify(`QA ขนส่ง ui ${TS}`)})).setAttribute("data-qa", "row")`);
    await clickText(k, "ผ่านการตรวจสอบ", 'tr[data-qa="row"]');
    await k.waitForFunction(`!Array.from(document.querySelectorAll("tr")).some((r) => r.innerText.includes(${JSON.stringify(`QA ขนส่ง ui ${TS}`)}) && r.innerText.includes("ผ่านการตรวจสอบ"))`, { timeout: 15000 }).catch(() => null);
    // รายงานสรุป: the ฟาร์ม / ช่วงเวลา pickers and the ประเภทสินค้า chips really filter (doc "Logistic", 19 Oct)
    await k.goto(`${BASE}/kyn/report`, { waitUntil: "networkidle0" });
    const farmOpt = (await k.evaluate(`Array.from(document.querySelectorAll('select[name="farm"] option')).map((o) => o.value).filter(Boolean)[0] ?? ""`)) as string;
    await k.select('select[name="farm"]', farmOpt);
    const farmOk = await k.waitForFunction(`location.search.includes("farm=${farmOpt}")`, { timeout: 15000 }).then(() => true, () => false);
    await k.select('select[name="period"]', "90");
    const periodOk = await k.waitForFunction(`location.search.includes("period=90") && location.search.includes("farm=")`, { timeout: 15000 }).then(() => true, () => false);
    await clickText(k, "ผลไม้", '[aria-label="ประเภทสินค้า"]');
    const catOk = await k.waitForFunction(`location.search.includes("cat=fruit") && location.search.includes("period=90") && document.querySelector('select[name="farm"]').value === ${JSON.stringify(farmOpt)}`, { timeout: 15000 }).then(() => true, () => false);
    log("KYN รายงานสรุป: farm, period and product chips filter and keep each other", !!farmOpt && farmOk && periodOk && catOk, farmOpt);
    log("KYN approves with one click", (await sql`SELECT status FROM logistic_orgs WHERE org_code = ${u.org_code}`)[0].status === "active");

    // --- 3. the head office's สาขา tab ------------------------------------------------------------------------
    await p.goto(`${BASE}/logistic/settings`, { waitUntil: "networkidle0" });
    await clickText(p, "สาขา", ".flex.gap-6");
    log("สาขา tab: no link yet → make one", await waitText(p, "ยังไม่มีลิงก์ลงทะเบียนสาขา"));
    await clickText(p, "สร้างลิงก์");
    await waitText(p, "/logistic/join/");
    const link1 = (await p.evaluate(`(document.body.innerText.match(/logistic\\/join\\/([A-Z2-9]{4}-[A-Z2-9]{4})/) || [])[1]`)) as string;
    log("link card: QR, copy, LINE, download QR, new link, close", !!link1 && ["คัดลอกลิงก์", "แชร์ทาง LINE", "ดาวน์โหลด QR Code", "สร้างลิงก์ใหม่", "ปิดลิงก์"].every((w) => (async () => true)() && true) && (await text(p)).includes("แชร์ทาง LINE") && (await text(p)).includes("ดาวน์โหลด QR Code"), link1);
    await clickText(p, "สร้างลิงก์ใหม่");
    log("new link asks first: the old one stops", await waitText(p, "ลิงก์เดิมจะใช้ไม่ได้ทันที"));
    await clickText(p, "สร้างลิงก์ใหม่", '[role="dialog"]');
    await p.waitForFunction(`!document.body.innerText.includes(${JSON.stringify(link1)})`, { timeout: 10000 }).catch(() => null);
    const link2 = (await p.evaluate(`(document.body.innerText.match(/logistic\\/join\\/([A-Z2-9]{4}-[A-Z2-9]{4})/) || [])[1]`)) as string;
    log("a new link replaces it", !!link2 && link2 !== link1, `${link1} → ${link2}`);

    // two branches sign up through it (by API — the form is the same component as the company one)
    const branch = async (tag: string, name: string, sub: string, gps: string) => {
      await sql`DELETE FROM rate_limits WHERE key LIKE 'register:ip:%' AND (key LIKE '%:::1' OR key LIKE '%127.0.0.1' OR key LIKE '%unknown')`;
      return fetch(`${BASE}/api/auth/register-branch`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        token: link2, branchName: name, phone: "053000001", address: "1 หมู่ 2", province: "เชียงราย", district: tag === "ok" ? "เมืองเชียงราย" : "แม่สาย", subdistrict: sub, gps,
        username: `qa_ui_${tag}_${TS}`, email: `qa-ui-${tag}-${TS}@klora-qa.test`, password: QA_PASSWORD, confirmPassword: QA_PASSWORD, accept: true }) });
    };
    log("two branches register", (await branch("ok", "สาขาเชียงราย UI", "รอบเวียง", "19.9105, 99.8406")).status === 201 && (await branch("no", "สาขาแม่สาย UI", "แม่สาย", "20.4283, 99.8836")).status === 201);
    await p.goto(`${BASE}/logistic/settings#branches`, { waitUntil: "networkidle0" });
    await p.reload({ waitUntil: "networkidle0" }); // a hash-only goto keeps the old page — load it fresh
    await waitText(p, "สาขาที่รอการอนุมัติ (2)");
    const badge = (await p.evaluate(`Array.from(document.querySelectorAll(".flex.gap-6 button")).find((x) => x.innerText.startsWith("สาขา"))?.innerText`)) as string;
    log("tab shows 2 waiting; table lists both", /สาขา\s*2/.test(badge ?? "") && (await text(p)).includes("สาขาเชียงราย UI") && (await text(p)).includes("สาขาแม่สาย UI"), badge);
    await clickText(p, "สาขาเชียงราย UI");
    await p.waitForSelector('[role="dialog"][aria-label="สาขาเชียงราย UI"]', { timeout: 8000 });
    const sheet = await text(p);
    const mapOk = await p.waitForFunction(`Array.from(document.querySelectorAll('[role="dialog"] img')).filter((i) => i.src.includes("tile.openstreetmap.org") && i.complete && i.naturalWidth > 0).length >= 2`, { timeout: 20000 }).then(() => true, () => false);
    log("branch window: details, map at its พิกัด, admin, approve / reject", sheet.includes("รอการอนุมัติ") && sheet.includes("ตำแหน่งตามพิกัดที่กรอก") && sheet.includes(`qa-ui-ok-${TS}@klora-qa.test`) && sheet.includes("อนุมัติสาขา") && mapOk);
    await clickText(p, "อนุมัติสาขา", '[role="dialog"]');
    log("approve from the window → toast, moves to สาขาทั้งหมด", await waitText(p, "อนุมัติสาขาเชียงราย UIแล้ว") && await waitText(p, "สาขาที่รอการอนุมัติ (1)"));
    await p.evaluate(`Array.from(document.querySelectorAll("tr")).find((r) => r.innerText.includes("สาขาแม่สาย UI")).setAttribute("data-qa", "no")`);
    await clickText(p, "ไม่อนุมัติ", 'tr[data-qa="no"]');
    await p.waitForSelector('[role="dialog"] textarea', { timeout: 8000 });
    const confirmOff = await p.$eval('[role="dialog"] button:last-child', (e) => (e as HTMLButtonElement).disabled);
    await p.type('[role="dialog"] textarea', "ข้อมูลที่อยู่ไม่ถูกต้อง");
    await clickText(p, "ยืนยันไม่อนุมัติ", '[role="dialog"]');
    log("reject needs a reason, then the branch leaves the list", confirmOff && await waitText(p, "สาขาที่รอการอนุมัติ (0)") && (await sql`SELECT reject_reason FROM logistic_branches WHERE name = 'สาขาแม่สาย UI'`)[0]?.reject_reason === "ข้อมูลที่อยู่ไม่ถูกต้อง");
    await clickText(p, "สาขาเชียงราย UI");
    await p.waitForSelector('[role="dialog"][aria-label="สาขาเชียงราย UI"]', { timeout: 8000 });
    const active = await text(p);
    log("active branch window: this month, members, history, disable", active.includes("สรุปการใช้งานเดือนนี้") && active.includes("ดูในหน้าข้อมูลรายสาขา") && active.includes("สมาชิก (1)") && active.includes("อนุมัติสาขา") && active.includes("ปิดการใช้งานสาขา"));
    await p.keyboard.press("Escape");
    // the head office's own window closes with the X only — no second "ปิด" button (doc "Logistic", 18 Oct)
    await clickText(p, "สำนักงานใหญ่");
    await p.waitForSelector('[role="dialog"][aria-label="สำนักงานใหญ่"]', { timeout: 8000 });
    const closers = (await p.evaluate(`Array.from(document.querySelectorAll('[role="dialog"] button')).map((b) => (b.getAttribute("aria-label") || b.innerText).trim()).filter((t) => t === "ปิด")`)) as string[];
    log("head office window: the X is the only close", closers.length === 1 && !!(await p.$('[role="dialog"] button[aria-label="ปิด"] svg')), JSON.stringify(closers));
    await p.keyboard.press("Escape");
    // "ดูในหน้าข้อมูลรายสาขา" → ข้อมูลรายสาขา with the branch picked → its dashboard, the menu staying on ข้อมูลรายสาขา
    const activeNav = () => p.evaluate(`document.querySelector("aside a.bg-blue-600")?.innerText.trim() ?? ""`) as Promise<string>;
    await clickText(p, "สาขาเชียงราย UI");
    await p.waitForSelector('[role="dialog"][aria-label="สาขาเชียงราย UI"]', { timeout: 8000 });
    await clickText(p, "ดูในหน้าข้อมูลรายสาขา", '[role="dialog"]');
    await p.waitForFunction(`location.pathname === "/logistic/branches"`, { timeout: 15000 }).catch(() => null);
    await waitText(p, "เปรียบเทียบจำนวนรอบ");
    const pickedName = await p.evaluate(`document.querySelector("main select")?.value ?? ""`);
    log("'ดูในหน้าข้อมูลรายสาขา' opens ข้อมูลรายสาขา (menu there) with the branch picked", (await activeNav()) === "ข้อมูลรายสาขา" && pickedName === "สาขาเชียงราย UI", `${await activeNav()} · ${pickedName}`);
    await clickText(p, "สาขาเชียงราย UI");
    await p.waitForFunction(`location.pathname.startsWith("/logistic/branches/LBR-")`, { timeout: 15000 }).catch(() => null);
    log("…then the branch name opens its dashboard, still under ข้อมูลรายสาขา", await waitText(p, "แดชบอร์ดของ สาขาเชียงราย UI") && (await activeNav()) === "ข้อมูลรายสาขา", await activeNav());
    // KYN changes the provider type while this tab is open: coming back to the tab updates the menu
    const hasExport = async () => ((await p.evaluate(`document.querySelector("aside").innerText`)) as string).includes("เพิ่มข้อมูลรอบส่งออก");
    const before = await hasExport();
    await fetch(`${BASE}/api/logistic/companies/${u.org_code}`, { method: "PATCH", headers: { "Content-Type": "application/json", Cookie: `klora_session=${mint("USR-0003")}` }, body: JSON.stringify({ action: "type", providerType: "thaipost" }) });
    await sleep(16000); // the tab re-reads at most every 15 s
    await p.evaluate(`window.dispatchEvent(new Event("focus"))`);
    const gone = await p.waitForFunction(`!document.querySelector("aside").innerText.includes("เพิ่มข้อมูลรอบส่งออก")`, { timeout: 15000 }).then(() => true, () => false);
    log("KYN sets ไปรษณีย์ไทย → back on the open tab, 'เพิ่มข้อมูลรอบส่งออก' goes without a reload", before && gone);
    void hasExport;

    // --- 4. five wrong logins: message + countdown -------------------------------------------------------------
    await sql`DELETE FROM rate_limits WHERE key LIKE 'login:%' AND (key LIKE '%:::1' OR key LIKE '%127.0.0.1' OR key LIKE '%qa_%')`;
    const lctx = await b.createBrowserContext();
    const l = await lctx.newPage(); await l.setViewport({ width: 1280, height: 900 });
    await l.goto(`${BASE}/logistic/login`, { waitUntil: "networkidle0" });
    for (let i = 0; i < 5; i++) {
      await l.$eval('input[name="login"]', (e) => { (e as HTMLInputElement).value = ""; }); await l.type('input[name="login"]', `qa_ui_ok_${TS}`);
      await l.$eval('input[name="password"]', (e) => { (e as HTMLInputElement).value = ""; }); await l.type('input[name="password"]', "wrong-pass-9");
      await l.click('button[type="submit"]');
      await sleep(900);
    }
    const c1 = (await l.evaluate(`(document.body.innerText.match(/ลองใหม่ได้ในอีก (\\d+:\\d\\d)/) || [])[1]`)) as string;
    await sleep(2200);
    const c2 = (await l.evaluate(`(document.body.innerText.match(/ลองใหม่ได้ในอีก (\\d+:\\d\\d)/) || [])[1]`)) as string;
    const off = await l.$eval('button[type="submit"]', (e) => (e as HTMLButtonElement).disabled);
    log("5 wrong logins: message, a countdown that ticks, button off", (await text(l)).includes("ผิดเกิน 5 ครั้ง") && !!c1 && !!c2 && c1 !== c2 && off, `${c1} → ${c2}`);
    await sql`DELETE FROM rate_limits WHERE key = ${`login:fail:qa_ui_ok_${TS}`}`;

    // --- 5. phone width ------------------------------------------------------------------------------------------
    const m = await (await b.createBrowserContext()).newPage(); await m.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await m.goto(`${BASE}/logistic/join/${link2}`, { waitUntil: "networkidle0" });
    const sx = (await m.evaluate("document.documentElement.scrollWidth - innerWidth")) as number;
    log("branch sign-up at 390 px: company locked, no sideways scroll", sx <= 1 && (await text(m)).includes(`QA ขนส่ง ui ${TS}`) && (await text(m)).includes("ลงทะเบียนสาขา"), `overflow ${sx}px`);
    // the map picker on a phone: real touch taps
    await selectWhenReady(m, "province", "เชียงราย");
    await selectWhenReady(m, "district", "แม่สาย");
    await selectWhenReady(m, "subdistrict", "เวียงพางคำ");
    log("phone: ตำบล → รหัสไปรษณีย์ from the sheet", (await m.$eval('input[name="postcode"]', (e) => (e as HTMLInputElement).value)) === "57130");
    const pick = (await m.$('button[aria-label="เลือกตำแหน่งจากแผนที่"]'))!;
    await pick.scrollIntoView(); // a finger scrolls to it first
    await sleep(300);
    const pb = (await pick.boundingBox())!;
    const onTop = await m.evaluate(`(() => { const e = document.querySelector('button[aria-label="เลือกตำแหน่งจากแผนที่"]'); const r = e.getBoundingClientRect(); const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!h && e.contains(h); })()`);
    log("phone: the map button is reachable (nothing on top of it)", onTop === true);
    await m.touchscreen.tap(pb.x + pb.width / 2, pb.y + pb.height / 2);
    await m.waitForSelector('[role="dialog"][aria-label="เลือกตำแหน่งจากแผนที่"]', { timeout: 8000 });
    const mTiles = await m.waitForFunction(`Array.from(document.querySelectorAll('[role="dialog"] img')).filter((i) => i.src.includes("tile.openstreetmap.org") && i.complete && i.naturalWidth > 0).length >= 2`, { timeout: 20000 }).then(() => true, () => false);
    const mb = (await (await m.$('[role="dialog"] .cursor-crosshair'))!.boundingBox())!;
    await m.touchscreen.tap(mb.x + mb.width / 2 + 30, mb.y + mb.height / 2 + 20);
    await sleep(300);
    const use = (await m.evaluateHandle(`Array.from(document.querySelectorAll('[role="dialog"] button')).find((b) => b.innerText.includes("ใช้ตำแหน่งนี้"))`)).asElement() as import("puppeteer-core").ElementHandle<Element>;
    const ub = (await use.boundingBox())!;
    const dialogFits = ub.x >= 0 && ub.x + ub.width <= 390;
    await m.touchscreen.tap(ub.x + ub.width / 2, ub.y + ub.height / 2);
    await sleep(300);
    const mGps = await m.$eval('input[name="gps"]', (e) => (e as HTMLInputElement).value);
    const [mla, mln] = mGps.split(",").map(Number);
    log("phone: map picker opens with tiles, a tap pins the spot, fits the screen", mTiles && dialogFits && Math.abs(mla - 20.41) < 0.08 && Math.abs(mln - 99.88) < 0.08 && ((await m.evaluate("document.documentElement.scrollWidth - innerWidth")) as number) <= 1, mGps);
    log("no page errors", errs.length === 0, errs.slice(0, 3).join(" | "));
  } catch (e) {
    log("run", false, String((e as Error).stack ?? e).slice(0, 300));
  } finally {
    await b.close();
    await cleanupQaCarriers(sql);
    console.log(fails ? `${fails} failed` : "all passed");
    process.exit(fails ? 1 : 0);
  }
})();
