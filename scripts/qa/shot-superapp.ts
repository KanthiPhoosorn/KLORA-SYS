import puppeteer from "puppeteer-core";
(async () => {
  const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  const p = await b.newPage(); await p.setViewport({ width: 1200, height: 900 });
  const errs: string[] = []; p.on("pageerror", (e) => errs.push(String(e)));
  await p.goto("http://localhost:3123/superapp", { waitUntil: "networkidle0" });
  await p.screenshot({ path: "scripts/qa/sa-home.png" });
  const click = async (txt: string) => { for (const el of await p.$$("button")) { if ((await el.evaluate((e) => e.textContent))?.includes(txt)) { await el.click(); await new Promise((r) => setTimeout(r, 250)); return true; } } return false; };
  await click("ของสด / ดอกไม้"); await click("My Item"); await p.screenshot({ path: "scripts/qa/sa-orders.png" });
  await click("TH2609160001"); await click("น้ำดอกไม้"); await p.screenshot({ path: "scripts/qa/sa-item.png" });
  await p.goto("http://localhost:3123/superapp/concept", { waitUntil: "networkidle0" }); await p.screenshot({ path: "scripts/qa/sa-concept.png", fullPage: true });
  console.log("errors:", errs.length ? errs : "none"); await b.close();
})();
