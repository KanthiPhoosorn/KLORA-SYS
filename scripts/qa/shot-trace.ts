import puppeteer from "puppeteer-core";
(async () => {
  const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  const p = await b.newPage(); await p.setViewport({ width: 402, height: 874, deviceScaleFactor: 1 });
  const errs: string[] = []; p.on("pageerror", (e) => errs.push(String(e)));
  for (const id of process.argv.slice(2)) {
    await p.goto("http://localhost:3123/trace/" + id, { waitUntil: "networkidle0" });
    await p.screenshot({ path: `scripts/qa/trace-${id}.png`, fullPage: true });
  }
  console.log("errors:", errs.length ? errs : "none"); await b.close();
})();
