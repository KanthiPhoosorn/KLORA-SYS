import puppeteer from "puppeteer-core";
import { createHmac } from "crypto";
const mint = (u: string) => { const p = `${u}:${Date.now() + 3600_000}`; return `${Buffer.from(p).toString("base64url")}.${createHmac("sha256", process.env.KLORA_SESSION_SECRET!).update(p).digest("base64url")}`; };
(async () => {
  const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  const p = await b.newPage(); await p.setViewport({ width: 900, height: 1000 });
  const errs: string[] = []; p.on("pageerror", (e) => errs.push(String(e)));
  await b.setCookie({ name: "klora_session", value: mint("USR-0002"), domain: "localhost", path: "/" });
  await p.evaluateOnNewDocument(() => { (window as any).print = () => { (window as any).__printed = true; }; });
  await p.goto("http://localhost:3123/print/labels?ids=BAT-2026-0007,BAT-2026-0001,BAT-2026-0009", { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 600));
  console.log("auto print called:", await p.evaluate(() => (window as any).__printed === true));
  await p.emulateMediaType("print");
  await p.pdf({ path: "scripts/qa/labels.pdf", format: "A4", printBackground: true });
  await p.screenshot({ path: "scripts/qa/labels.png", fullPage: true });
  console.log("errors:", errs.length ? errs : "none"); await b.close();
})();
