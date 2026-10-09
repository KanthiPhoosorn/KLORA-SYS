// Can a phone read the label QR? Rasterise each sticker size at print resolution and decode it.
//   300 dpi = 11.81 px/mm; CSS 1mm = 3.78 px → deviceScaleFactor 3.125. Also tries 203 dpi (common
//   thermal label printers). At 300 dpi it also checks the label itself (Thai Post doc §13.7–8): every
//   field printed (Corta, product, qty + unit, cut date, farm, LOT), nothing spills off the sticker,
//   smallest text ≈ 2 mm (6 pt). Uses production unless QA_BASE is set.
//   npm i --no-save puppeteer-core jsqr pngjs  ·  [QA_BASE=http://localhost:3123] [QA_BATCH=LOT-…] npx tsx --env-file=.env.local scripts/qa/qr-scan.ts
import puppeteer from "puppeteer-core";
import { createHmac } from "crypto";
import { PNG } from "pngjs";
import jsQR from "jsqr";
import { neon } from "@neondatabase/serverless";
const BASE = process.env.QA_BASE ?? "https://corta.tech";
const LOT = process.env.QA_BATCH ?? "LOT-2609-0007";
const mint = (u: string) => { const p = `${u}:${Date.now() + 600_000}`; return `${Buffer.from(p).toString("base64url")}.${createHmac("sha256", process.env.KLORA_SESSION_SECRET!).update(p).digest("base64url")}`; };

// runs in the page: what is printed on the first sticker
const AUDIT = `(() => {
  const L = document.querySelector(".label"), R = L.getBoundingClientRect(), mm = (px) => px / (96 / 25.4);
  const els = Array.from(L.querySelectorAll("*")).filter((e) => Array.from(e.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim()));
  const flat = els.filter((e) => { for (let x = e; x && x !== L; x = x.parentElement) if (getComputedStyle(x).transform !== "none") return false; return true; });
  const spill = flat.filter((e) => { const r = e.getBoundingClientRect(); return r.right > R.right + 0.5 || r.bottom > R.bottom + 0.5 || r.left < R.left - 0.5 || r.top < R.top - 0.5; }).map((e) => e.textContent.trim().slice(0, 16));
  const cut = els.filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).textOverflow !== "ellipsis").map((e) => e.textContent.trim().slice(0, 16));
  return { text: L.innerText.replace(/\\s+/g, " "), minMm: +Math.min(...els.map((e) => mm(parseFloat(getComputedStyle(e).fontSize)))).toFixed(2), spill, cut };
})()`;

(async () => {
  const sql = neon(process.env.DATABASE_URL!);
  const [lot] = await sql`SELECT s.farm_name FROM batches b JOIN suppliers s ON s.id = b.supplier_id WHERE b.id = ${LOT}`;
  const farm = String(lot?.farm_name ?? "");
  let fails = 0;
  const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  for (const dpi of [300, 203]) {
    const p = await b.newPage();
    await p.setViewport({ width: 900, height: 600, deviceScaleFactor: dpi / 25.4 / (96 / 25.4) });
    await p.evaluateOnNewDocument("window.print = () => {}; window.__name = (f) => f;");
    await b.setCookie({ name: "klora_session", value: mint("USR-0002"), domain: new URL(BASE).hostname, path: "/" });
    await p.goto(`${BASE}/print/labels?ids=${LOT}`, { waitUntil: "networkidle0" });
    await p.emulateMediaType("print");
    for (const t of ["60", "80", "40"]) {
      await p.emulateMediaType("screen");
      await p.evaluate((x) => (Array.from(document.querySelectorAll("button.opt")).find((e) => e.textContent?.startsWith(x)) as HTMLElement).click(), t);
      await new Promise((r) => setTimeout(r, 250));
      await p.emulateMediaType("print");
      const png = PNG.sync.read(Buffer.from(await (await p.$(".label"))!.screenshot({ type: "png" })));
      const code = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
      if (!code) fails++;
      console.log(`${dpi} dpi · ${t}: ${png.width}×${png.height}px →`, code ? `OK ${code.data}` : "NOT READ");
      if (dpi !== 300) continue;
      const info = (await p.evaluate(AUDIT)) as { text: string; minMm: number; spill: string[]; cut: string[] };
      // the farm name may be cut with "…" on small stickers — its first characters must still be there
      const fields = {
        Corta: info.text.includes("Corta"), LOT: info.text.includes(LOT), farm: !!farm && info.text.includes(farm.slice(0, 6)),
        qty: /[0-9][0-9,.]*\s*(ดอก|ช่อ|ก้าน|กก\.|กิโลกรัม|ตัน)/.test(info.text), date: /(ตัด|เก็บ)\S*\s*[0-9]{1,2}\s*\S+\s*[0-9]{2}/.test(info.text),
      };
      const ok = info.minMm >= 1.99 && !info.spill.length && !info.cut.length && Object.values(fields).every(Boolean);
      if (!ok) fails++;
      console.log(`   ${ok ? "PASS" : "FAIL"} label ${t}: smallest text ${info.minMm} mm · ${JSON.stringify(fields)} · spill ${info.spill.join("|") || "none"} · cut ${info.cut.join("|") || "none"}`);
      if (!ok) console.log("      ", info.text.slice(0, 160));
    }
    await p.close();
  }
  await b.close();
  console.log(fails ? `${fails} failed` : "all passed");
})();
