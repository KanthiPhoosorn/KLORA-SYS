// Logistic export flow: pick a batch, fill domestic shipping (province/address/GPS), save → status row.
import puppeteer from "puppeteer-core";
import { createHmac } from "crypto";
const mint = (u: string) => { const p = `${u}:${Date.now() + 3600_000}`; return `${Buffer.from(p).toString("base64url")}.${createHmac("sha256", process.env.KLORA_SESSION_SECRET!).update(p).digest("base64url")}`; };
(async () => {
  const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  const p = await b.newPage(); await p.setViewport({ width: 1440, height: 1000 });
  const errs: string[] = []; p.on("pageerror", (e) => errs.push(String(e)));
  await b.setCookie({ name: "klora_session", value: mint("USR-0002"), domain: "localhost", path: "/" });
  await p.goto("http://localhost:3123/logistic/new", { waitUntil: "networkidle0" });
  const top = await p.evaluate(() => { const h = Array.from(document.querySelectorAll("h2,h3,p,div")).find((e) => e.textContent?.trim() === "ข้อมูลการขนส่ง"); return h ? h.getBoundingClientRect().top + window.scrollY : 0; });
  await p.screenshot({ path: "scripts/qa/export-form.png", captureBeyondViewport: true, clip: { x: 240, y: top - 20, width: 960, height: 560 } });
  console.log("errors:", errs.length ? errs : "none"); await b.close();
})();
