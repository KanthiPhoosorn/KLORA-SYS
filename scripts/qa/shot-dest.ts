import puppeteer from "puppeteer-core";
import { createHmac } from "crypto";
const mint = (u: string) => { const p = `${u}:${Date.now() + 3600_000}`; return `${Buffer.from(p).toString("base64url")}.${createHmac("sha256", process.env.KLORA_SESSION_SECRET!).update(p).digest("base64url")}`; };
(async () => {
  const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  const p = await b.newPage(); await p.setViewport({ width: 1440, height: 1000 });
  const errs: string[] = []; p.on("pageerror", (e) => errs.push(String(e)));
  await b.setCookie({ name: "klora_session", value: mint("USR-0004"), domain: "localhost", path: "/" });
  await p.goto("http://localhost:3123/app/new", { waitUntil: "networkidle0" });
  const gps = await p.$('input[placeholder="13.7367, 100.5602"]'); await gps!.type("13.7367, 100.5602"); await new Promise((r) => setTimeout(r, 300));
  const dist = await p.$eval('input[placeholder="ระบบจะประมาณการอัตโนมัติ"]', (e) => (e as HTMLInputElement).value);
  console.log("distance from GPS:", dist, "km");
  const top = await p.evaluate(() => { const e = document.querySelector('input[placeholder="13.7367, 100.5602"]')!; return e.getBoundingClientRect().top + window.scrollY; });
  await p.screenshot({ path: "scripts/qa/dest.png", captureBeyondViewport: true, clip: { x: 240, y: top - 230, width: 900, height: 330 } });
  console.log("errors:", errs.length ? errs : "none"); await b.close();
})();
