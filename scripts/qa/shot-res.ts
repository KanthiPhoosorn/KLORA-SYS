import puppeteer from "puppeteer-core";
import { createHmac } from "crypto";
const mint = (u: string) => { const p = `${u}:${Date.now() + 3600_000}`; return `${Buffer.from(p).toString("base64url")}.${createHmac("sha256", process.env.KLORA_SESSION_SECRET!).update(p).digest("base64url")}`; };
(async () => {
  const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  const p = await b.newPage(); await p.setViewport({ width: 1440, height: 1200 });
  const errs: string[] = []; p.on("pageerror", (e) => errs.push(String(e)));
  await b.setCookie({ name: "klora_session", value: mint(process.argv[2] || "USR-0004"), domain: "localhost", path: "/" });
  await p.goto("http://localhost:3123/app/farm", { waitUntil: "networkidle0" });
  for (const el of await p.$$("button")) { if ((await el.evaluate((e) => e.textContent))?.includes("ข้อมูลการใช้ทรัพยากร")) { await el.click(); break; } }
  await new Promise((r) => setTimeout(r, 400));
  await p.screenshot({ path: "scripts/qa/farm-res.png", fullPage: true });
  console.log("errors:", errs.length ? errs : "none"); await b.close();
})();
