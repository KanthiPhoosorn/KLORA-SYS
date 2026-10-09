// Redesigned passport (Thai Post doc §14): mobile screenshot, ดูเพิ่มเติม pop-up, save as PNG + PDF.
import puppeteer from "puppeteer-core";
import { readdirSync, statSync, mkdirSync, readFileSync } from "fs";
const OUT = process.env.SHOT_DIR ?? "scripts/qa";
const LOT = process.env.QA_LOT ?? "LOT-2607-0005";
(async () => {
  const dl = `${OUT}/dl`; mkdirSync(dl, { recursive: true });
  const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  const p = await b.newPage(); await p.setViewport({ width: 402, height: 874, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errs: string[] = []; p.on("pageerror", (e) => errs.push(String(e)));
  await p.evaluateOnNewDocument("window.__name = (f) => f");
  const cdp = await p.createCDPSession(); await cdp.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: dl.replace(/\//g, "\\") });
  await p.goto(`http://localhost:3123/t/${LOT}`, { waitUntil: "networkidle0" });
  await p.screenshot({ path: `${OUT}/trace2.png`, fullPage: true });
  const more = await p.evaluate(() => { const bt = Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("ดูเพิ่มเติม")) as HTMLElement | undefined; bt?.click(); return !!bt; });
  await new Promise((r) => setTimeout(r, 300));
  if (more) await p.screenshot({ path: `${OUT}/trace2-more.png` });
  await p.keyboard.press("Escape"); await p.evaluate(() => (document.querySelector('[role="dialog"]')?.parentElement as HTMLElement | undefined)?.click());
  for (const label of ["บันทึกเป็นรูปภาพ", "บันทึกเป็น PDF"]) {
    await p.evaluate(() => (document.querySelector('button[aria-label="บันทึกหน้านี้"]') as HTMLElement).click());
    await new Promise((r) => setTimeout(r, 200));
    await p.evaluate((t) => (Array.from(document.querySelectorAll('[role="menuitem"]')).find((x) => x.textContent?.includes(t)) as HTMLElement).click(), label);
    await new Promise((r) => setTimeout(r, 4000));
  }
  const files = readdirSync(dl).map((f) => `${f} ${statSync(`${dl}/${f}`).size}B`);
  console.log("more popup:", more, "| downloads:", files.join(", ") || "none");
  const pdf = readdirSync(dl).find((f) => f.endsWith(".pdf"));
  if (pdf) console.log("pdf header:", readFileSync(`${dl}/${pdf}`).subarray(0, 8).toString());
  console.log("errors:", errs.length ? errs : "none");
  await b.close();
})();
