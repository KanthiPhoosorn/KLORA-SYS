// Label sizes (Thai Post doc §13): each option → PDF with the @page size; screen preview screenshot.
import puppeteer from "puppeteer-core";
import { createHmac } from "crypto";
import { writeFileSync } from "fs";
const OUT = process.env.SHOT_DIR ?? "scripts/qa";
const mint = (u: string) => { const p = `${u}:${Date.now() + 3600_000}`; return `${Buffer.from(p).toString("base64url")}.${createHmac("sha256", process.env.KLORA_SESSION_SECRET!).update(p).digest("base64url")}`; };
(async () => {
  const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  const p = await b.newPage(); await p.setViewport({ width: 1100, height: 800 });
  await p.evaluateOnNewDocument("window.print = () => {}; window.__name = (f) => f;");
  const errs: string[] = []; p.on("pageerror", (e) => errs.push(String(e)));
  await b.setCookie({ name: "klora_session", value: mint("USR-0002"), domain: "localhost", path: "/" });
  await p.goto("http://localhost:3123/print/labels?ids=LOT-2609-0007,LOT-2607-0005,BAT-2026-0001", { waitUntil: "networkidle0" });
  await p.screenshot({ path: `${OUT}/labels-screen.png`, fullPage: true });
  for (const [label, mm] of [["60 × 30", [60, 30]], ["80 × 25", [80, 25]], ["40 × 25", [40, 25]], ["A4", [210, 297]]] as const) {
    await p.evaluate((t) => { (Array.from(document.querySelectorAll("button.opt")).find((x) => x.textContent?.startsWith(t)) as HTMLElement)?.click(); }, label);
    await new Promise((r) => setTimeout(r, 300));
    const pdf = await p.pdf({ preferCSSPageSize: true, printBackground: true });
    const name = label.replace(/\s|×/g, "");
    writeFileSync(`${OUT}/labels-${name}.pdf`, pdf);
    const box = /\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/.exec(Buffer.from(pdf).toString("latin1"));
    const pages = (Buffer.from(pdf).toString("latin1").match(/\/Type \/Page[^s]/g) ?? []).length;
    const w = box ? (Number(box[1]) / 72) * 25.4 : 0, h = box ? (Number(box[2]) / 72) * 25.4 : 0;
    console.log(`${label}: page ${w.toFixed(1)} × ${h.toFixed(1)} mm, ${pages} page(s)`, Math.abs(w - mm[0]) < 1 && Math.abs(h - mm[1]) < 1 ? "OK" : "MISMATCH");
  }
  await p.evaluate(() => { (Array.from(document.querySelectorAll("button.opt")).find((x) => x.textContent?.startsWith("60")) as HTMLElement)?.click(); });
  console.log("errors:", errs.length ? errs : "none");
  await b.close();
})();
