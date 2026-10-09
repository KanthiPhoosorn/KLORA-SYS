// Packaging rows v2 on /app/new (fruit farm): carton + reusable crate (+ ลงทะเบียนใหม่) + อื่นๆ + total weight.
import puppeteer from "puppeteer-core";
import { neon } from "@neondatabase/serverless";
const OUT = process.env.SHOT_DIR ?? "scripts/qa";
const BASE = "http://localhost:3123"; const TS = Date.now().toString(36); const EMAIL = `qa-shot2-${TS}@klora-qa.test`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`DELETE FROM rate_limits WHERE key LIKE '%:ip:::1'`;
  const reg = await fetch(BASE + "/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ farmName: "QA Shot2 " + TS, address: "อ.แม่ริม จ.เชียงใหม่", gps: "18.91, 98.94", contactName: "QA", flowerType: "มะม่วง", flowerTypes: [{ category: "fruit", type: "มะม่วง", varieties: ["น้ำดอกไม้สีทอง"] }], email: EMAIL, username: "qa_shot2_" + TS, password: "QaPassw0rd!", confirmPassword: "QaPassw0rd!" }) });
  const cookie = /klora_session=([^;]+)/.exec(reg.headers.get("set-cookie") || "")![1]; const supId = (await reg.json()).supplier.id;
  const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  try {
    const p = await b.newPage(); await p.setViewport({ width: 1440, height: 1000 });
    const errs: string[] = []; p.on("pageerror", (e) => errs.push(String(e)));
    await p.evaluateOnNewDocument("window.__name = (f) => f");
    await b.setCookie({ name: "klora_session", value: cookie, domain: "localhost", path: "/" });
    await p.goto(BASE + "/app/new", { waitUntil: "networkidle0" });
    const setSel = (label: string, nth: number, value: string) => p.evaluate((l, n, v) => {
      const sel = Array.from(document.querySelectorAll("select")).filter((s) => s.closest("div")?.querySelector("label")?.textContent?.startsWith(l))[n] as HTMLSelectElement;
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(sel, v); sel.dispatchEvent(new Event("change", { bubbles: true }));
    }, label, nth, value);
    const click = (text: string) => p.evaluate((t) => { (Array.from(document.querySelectorAll("button")).find((e) => e.textContent?.trim().startsWith(t)) as HTMLElement)?.click(); }, text);
    await click("เพิ่มบรรจุภัณฑ์"); await sleep(200); await click("เพิ่มบรรจุภัณฑ์"); await sleep(200);
    await setSel("บรรจุภัณฑ์", 1, "crate"); await sleep(200);
    await setSel("หมายเลขบรรจุภัณฑ์", 1, "new"); await sleep(200);
    await setSel("บรรจุภัณฑ์", 2, "other"); await sleep(200);
    await setSel("ชนิดวัสดุ", 0, "ldpe"); await sleep(200);
    await click("เพิ่มวัสดุภายใน"); await sleep(300);
    const top = await p.evaluate(() => { const h = Array.from(document.querySelectorAll("h2")).find((e) => e.textContent?.includes("บรรจุภัณฑ์ที่ใช้")); return h ? h.getBoundingClientRect().top + window.scrollY - 24 : 0; });
    const bottom = await p.evaluate(() => { const h = Array.from(document.querySelectorAll("label")).find((e) => e.textContent?.startsWith("น้ำหนักรวมหลังแพ็ก")); return h ? h.getBoundingClientRect().bottom + window.scrollY + 90 : 2400; });
    await p.screenshot({ path: `${OUT}/pack2-form.png`, captureBeyondViewport: true, clip: { x: 240, y: top, width: 1200, height: bottom - top } });
    console.log("errors:", errs.length ? errs : "none");
  } finally {
    await b.close();
    await sql`DELETE FROM notifications WHERE supplier_id = ${supId}`; await sql`DELETE FROM batches WHERE supplier_id = ${supId}`; await sql`DELETE FROM suppliers WHERE id = ${supId}`;
    await sql`DELETE FROM users WHERE email = ${EMAIL}`; await sql`DELETE FROM rate_limits WHERE key LIKE '%:ip:::1'`;
  }
})();
