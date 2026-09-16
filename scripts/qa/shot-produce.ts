import puppeteer from "puppeteer-core";
import { createHmac } from "crypto";
const mint = (u: string) => { const p = `${u}:${Date.now() + 3600_000}`; return `${Buffer.from(p).toString("base64url")}.${createHmac("sha256", process.env.KLORA_SESSION_SECRET!).update(p).digest("base64url")}`; };
(async () => {
  const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  const p = await b.newPage(); await p.setViewport({ width: 1440, height: 1100 });
  const errs: string[] = []; p.on("pageerror", (e) => errs.push(String(e)));
  // register step 2
  await p.goto("http://localhost:3123/register", { waitUntil: "networkidle0" });
  const inputs = await p.$$("input");
  const vals = ["qa_user", "qa@example.com", "QaPassw0rd!", "QaPassw0rd!"];
  for (let i = 0; i < 4 && i < inputs.length; i++) await inputs[i].type(vals[i]);
  for (const btn of await p.$$("button")) { if ((await btn.evaluate((e) => e.textContent))?.includes("ถัดไป")) { await btn.click(); break; } }
  await new Promise((r) => setTimeout(r, 500));
  // pick ผลไม้ on the first group
  for (const btn of await p.$$("button")) { if ((await btn.evaluate((e) => e.textContent))?.trim() === "ผลไม้") { await btn.click(); break; } }
  await new Promise((r) => setTimeout(r, 300));
  await p.screenshot({ path: "scripts/qa/reg-step2.png", fullPage: true });
  // farm settings
  await b.setCookie({ name: "klora_session", value: mint("USR-0001"), domain: "localhost", path: "/" });
  await p.goto("http://localhost:3123/app/farm", { waitUntil: "networkidle0" });
  await p.screenshot({ path: "scripts/qa/farm.png", fullPage: true });
  // round form: pick ผลไม้
  await p.goto("http://localhost:3123/app/new", { waitUntil: "networkidle0" });
  await p.click('input[name="category"][type="radio"]:nth-of-type(1)').catch(() => {});
  const radios = await p.$$('input[name="category"]'); if (radios[1]) await radios[1].click();
  await new Promise((r) => setTimeout(r, 300));
  await p.screenshot({ path: "scripts/qa/round-fruit.png", clip: { x: 240, y: 60, width: 900, height: 820 } });
  console.log("errors:", errs.length ? errs : "none");
  await b.close();
})();
