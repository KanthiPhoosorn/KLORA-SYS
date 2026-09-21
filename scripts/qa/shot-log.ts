import puppeteer from "puppeteer-core";
import { createHmac } from "crypto";
const mint = (u: string) => { const p = `${u}:${Date.now() + 3600_000}`; return `${Buffer.from(p).toString("base64url")}.${createHmac("sha256", process.env.KLORA_SESSION_SECRET!).update(p).digest("base64url")}`; };
(async () => {
  const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  const p = await b.newPage(); await p.setViewport({ width: 1440, height: 1000 });
  const errs: string[] = []; p.on("pageerror", (e) => errs.push(String(e)));
  await b.setCookie({ name: "klora_session", value: mint("USR-0002"), domain: "localhost", path: "/" });
  for (const r of ["/logistic", "/logistic?cat=fruit", "/logistic/status?cat=vegetable", "/logistic/incoming", "/logistic/history?cat=flower", "/logistic/branches"]) {
    const res = await p.goto("http://localhost:3123" + r, { waitUntil: "networkidle0" });
    console.log(r, res?.status());
    if (r === "/logistic" || r === "/logistic?cat=fruit") await p.screenshot({ path: `scripts/qa/log${r.replace(/[\/?=]/g, "_")}.png` });
  }
  console.log("errors:", errs.length ? errs : "none"); await b.close();
})();
