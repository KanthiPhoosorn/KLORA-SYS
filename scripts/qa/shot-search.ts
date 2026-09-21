import puppeteer from "puppeteer-core";
import { createHmac } from "crypto";
const mint = (u: string) => { const p = `${u}:${Date.now() + 3600_000}`; return `${Buffer.from(p).toString("base64url")}.${createHmac("sha256", process.env.KLORA_SESSION_SECRET!).update(p).digest("base64url")}`; };
(async () => {
  const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  const p = await b.newPage(); await p.setViewport({ width: 1440, height: 900 });
  const errs: string[] = []; p.on("pageerror", (e) => errs.push(String(e)));
  await b.setCookie({ name: "klora_session", value: mint("USR-0002"), domain: "localhost", path: "/" });
  await p.goto("http://localhost:3123/logistic/search", { waitUntil: "networkidle0" });
  await p.type("input", "BAT-2026-0009"); await p.keyboard.press("Enter"); await new Promise((r) => setTimeout(r, 400));
  await p.screenshot({ path: "scripts/qa/search-printed.png", clip: { x: 240, y: 60, width: 1000, height: 330 } });
  console.log("errors:", errs.length ? errs : "none"); await b.close();
})();
