import puppeteer from "puppeteer-core";
import { neon } from "@neondatabase/serverless";
const BASE = "http://localhost:3123"; const TS = Date.now().toString(36); const EMAIL = `qa-free-${TS}@klora-qa.test`;
(async () => {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`DELETE FROM rate_limits WHERE key LIKE '%:ip:::1'`;
  const res = await fetch(BASE + "/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
    farmName: "QA Free Farm", address: "ต.แม่สาย อ.แม่สาย จ.เชียงราย", contactName: "QA", flowerType: "กุหลาบ", email: EMAIL, username: "qa_free_" + TS, password: "QaPassw0rd!", confirmPassword: "QaPassw0rd!" }) });
  const j = await res.json(); console.log("register", res.status, JSON.stringify(j).slice(0, 200)); const cookie = /klora_session=([^;]+)/.exec(res.headers.get("set-cookie") || "")?.[1]!;
  const sup = (await sql`SELECT id, plan, status FROM suppliers WHERE id = ${j.supplier.id}`)[0];
  console.log("registered", j.supplier.id, "plan=", sup.plan, "status=", sup.status);
  const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  const page = await browser.newPage(); await page.setViewport({ width: 1440, height: 900 });
  await browser.setCookie({ name: "klora_session", value: cookie, domain: "localhost", path: "/" });
  for (const r of ["/app", "/app/dashboard", "/app/history", "/app/new"]) {
    const errs: string[] = []; page.on("pageerror", (e) => errs.push(String(e))); 
    await page.goto(BASE + r, { waitUntil: "networkidle0" });
    const t = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").slice(0, 160));
    await page.screenshot({ path: `scripts/qa/free-${r.replace(/\//g, "_")}.png` });
    console.log(r, "->", page.url().replace(BASE, ""), errs.length ? "ERR " + errs[0] : "", "|", t);
  }
  await browser.close();
  await sql`DELETE FROM batches WHERE supplier_id = ${j.supplier.id}`; await sql`DELETE FROM users WHERE email LIKE '%klora-qa.test'`; await sql`DELETE FROM suppliers WHERE farm_name = 'QA Free Farm'`; await sql`DELETE FROM suppliers WHERE id = ${j.supplier.id}`;
  await sql`DELETE FROM rate_limits WHERE key LIKE '%:ip:::1' OR key LIKE 'login:acct:qa_%'`;
  console.log("cleaned");
})();
