// Packaging lines UI (หมุนเวียน · เลือกจากที่มีอยู่แล้ว / ลงทะเบียนใหม่ / ใช้ครั้งเดียว) on /app/new.
// Throw-away farm + one registered basket; self-cleaning.
import puppeteer from "puppeteer-core";
import { neon } from "@neondatabase/serverless";
const OUT = process.env.SHOT_DIR ?? "scripts/qa";
const BASE = "http://localhost:3123"; const TS = Date.now().toString(36); const EMAIL = `qa-shot-${TS}@klora-qa.test`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`DELETE FROM rate_limits WHERE key LIKE '%:ip:::1'`;
  const reg = await fetch(BASE + "/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ farmName: "QA Shot Farm " + TS, address: "อ.แม่ริม จ.เชียงใหม่", gps: "18.91, 98.94", contactName: "QA", flowerType: "กุหลาบ", email: EMAIL, username: "qa_shot_" + TS, password: "QaPassw0rd!", confirmPassword: "QaPassw0rd!" }) });
  const cookie = /klora_session=([^;]+)/.exec(reg.headers.get("set-cookie") || "")![1]; const supId = (await reg.json()).supplier.id;
  const asset = await (await fetch(BASE + "/api/packaging-assets", { method: "POST", headers: { "Content-Type": "application/json", Cookie: `klora_session=${cookie}` }, body: JSON.stringify({ kind: "basket", width: 40, length: 60, height: 30, priorUses: 66 }) })).json();
  const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  try {
    const p = await b.newPage(); await p.setViewport({ width: 1440, height: 1000 });
    const errs: string[] = []; p.on("pageerror", (e) => errs.push(String(e)));
    await p.evaluateOnNewDocument("window.__name = (f) => f");
    await b.setCookie({ name: "klora_session", value: cookie, domain: "localhost", path: "/" });
    await p.goto(BASE + "/app/new", { waitUntil: "networkidle0" });
    const click = (text: string, nth = 0) => p.evaluate((t, n) => { const el = Array.from(document.querySelectorAll("button,label")).filter((e) => e.textContent?.trim().startsWith(t))[n] as HTMLElement | undefined; el?.click(); return !!el; }, text, nth);
    const setKind = (idx: number, kind: string) => p.evaluate((i, k) => {
      const sel = Array.from(document.querySelectorAll("select")).filter((s) => s.options[0]?.text === "เลือกบรรจุภัณฑ์")[i] as HTMLSelectElement;
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(sel, k); sel.dispatchEvent(new Event("change", { bubbles: true }));
    }, idx, kind);
    // line 1: basket → reusable · existing → pick the registered code
    await setKind(0, "basket"); await sleep(300);
    await click("ค้นหา / เลือกรหัส"); await sleep(200); await click(asset.id); await sleep(300);
    // line 2: basket → reusable · new
    await click("เพิ่มรายการอื่น"); await sleep(200); await setKind(1, "basket"); await sleep(200); await click("ลงทะเบียนใหม่", 1); await sleep(200);
    // line 3: box → single-use (default)
    await click("เพิ่มรายการอื่น"); await sleep(200); await setKind(2, "corrugated_box"); await sleep(300);
    const top = await p.evaluate(() => { const h = Array.from(document.querySelectorAll("h2,h3")).find((e) => e.textContent?.includes("บรรจุภัณฑ์")); return h ? h.getBoundingClientRect().top + window.scrollY - 16 : 0; });
    const bottom = await p.evaluate(() => { const h = Array.from(document.querySelectorAll("button")).find((e) => e.textContent?.includes("เพิ่มรายการอื่น")); return h ? h.getBoundingClientRect().bottom + window.scrollY + 24 : 2000; });
    await p.screenshot({ path: `${OUT}/reuse-packaging.png`, captureBeyondViewport: true, clip: { x: 240, y: top, width: 960, height: bottom - top } });
    console.log("errors:", errs.length ? errs : "none");
  } finally {
    await b.close();
    await sql`DELETE FROM packaging_assets WHERE id = ${asset.id}`;
    await sql`DELETE FROM notifications WHERE supplier_id = ${supId}`; await sql`DELETE FROM batches WHERE supplier_id = ${supId}`; await sql`DELETE FROM suppliers WHERE id = ${supId}`;
    await sql`DELETE FROM users WHERE email = ${EMAIL}`; await sql`DELETE FROM rate_limits WHERE key LIKE '%:ip:::1'`;
  }
})();
