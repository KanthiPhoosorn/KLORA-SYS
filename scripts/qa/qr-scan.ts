// Can a phone read the label QR? Rasterise each sticker size at print resolution and decode it.
//   300 dpi = 11.81 px/mm; CSS 1mm = 3.78 px → deviceScaleFactor 3.125. Also tries 203 dpi (common
//   thermal label printers). Uses production unless QA_BASE is set.
import puppeteer from "puppeteer-core";
import { createHmac } from "crypto";
import { PNG } from "pngjs";
import jsQR from "jsqr";
const BASE = process.env.QA_BASE ?? "https://corta.tech";
const mint = (u: string) => { const p = `${u}:${Date.now() + 600_000}`; return `${Buffer.from(p).toString("base64url")}.${createHmac("sha256", process.env.KLORA_SESSION_SECRET!).update(p).digest("base64url")}`; };
(async () => {
  const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  for (const dpi of [300, 203]) {
    const p = await b.newPage();
    await p.setViewport({ width: 900, height: 600, deviceScaleFactor: dpi / 25.4 / (96 / 25.4) });
    await p.evaluateOnNewDocument("window.print = () => {}; window.__name = (f) => f;");
    await b.setCookie({ name: "klora_session", value: mint("USR-0002"), domain: new URL(BASE).hostname, path: "/" });
    await p.goto(`${BASE}/print/labels?ids=LOT-2609-0007`, { waitUntil: "networkidle0" });
    await p.emulateMediaType("print");
    for (const t of ["60", "80", "40"]) {
      await p.emulateMediaType("screen");
      await p.evaluate((x) => (Array.from(document.querySelectorAll("button.opt")).find((e) => e.textContent?.startsWith(x)) as HTMLElement).click(), t);
      await new Promise((r) => setTimeout(r, 250));
      await p.emulateMediaType("print");
      const png = PNG.sync.read(Buffer.from(await (await p.$(".label"))!.screenshot({ type: "png" })));
      const code = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
      console.log(`${dpi} dpi · ${t}: ${png.width}×${png.height}px →`, code ? `OK ${code.data}` : "NOT READ");
    }
    await p.close();
  }
  await b.close();
})();
