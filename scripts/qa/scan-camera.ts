// The receipt scan's camera path in a real browser (9 Nov 2026): a fake camera shows a Corta QR link, and the
// page must read it, put the lot code in the box and look it up. Runs twice: with jsQR (BarcodeDetector removed,
// as on iPhone) and with whatever this Chrome offers. Self-cleaning QA carrier.
//   npx tsx --env-file=.env.local --tsconfig tsconfig.json scripts/qa/scan-camera.ts   (dev server on :3123)
import { neon } from "@neondatabase/serverless";
import puppeteer from "puppeteer-core";
import QRCode from "qrcode";
import { qaCarrier, cleanupQaCarriers } from "./qa-carrier";

const BASE = "http://localhost:3123";
const LOT = "LOT-9911-0001"; // a code no real lot uses, so the lookup answers "not found"
let fails = 0;
const log = (name: string, ok: boolean, info = "") => { if (!ok) fails++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${info ? `  (${info})` : ""}`); };

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const qr = await QRCode.toDataURL(`https://corta.tech/t/${LOT}`, { margin: 2, width: 300 });
  const c = await qaCarrier(sql, "cam", Date.now().toString(36));
  const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  try {
    for (const mode of ["jsqr", "native"] as const) {
      const page = await b.newPage();
      page.on("console", (m) => { if (m.type() === "error") console.log("  console:", m.text().slice(0, 200)); });
      page.on("pageerror", (e) => console.log("  pageerror:", String(e).slice(0, 200)));
      await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
      await page.setCookie({ name: "klora_session", value: c.cookie, domain: "localhost", path: "/" });
      // the fake camera: a canvas stream that keeps drawing the QR image. Passed as source text, because tsx
      // compiles functions with a __name helper that does not exist in the browser.
      await page.evaluateOnNewDocument(`(() => {
        ${mode === "jsqr" ? "delete window.BarcodeDetector;" : ""}
        navigator.mediaDevices.getUserMedia = async () => {
          const cv = document.createElement("canvas"); cv.width = 480; cv.height = 480;
          const ctx = cv.getContext("2d");
          const img = new Image(); img.src = ${JSON.stringify(qr)}; await img.decode();
          const draw = () => { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, 480, 480); ctx.drawImage(img, 90, 90, 300, 300); };
          draw(); setInterval(draw, 100);
          return cv.captureStream(10);
        };
      })();`);
      await page.goto(`${BASE}/logistic/scan`, { waitUntil: "networkidle2" });
      const hasDetector = await page.evaluate(() => "BarcodeDetector" in window);
      // a real tap on "เปิดกล้อง"
      const btn = await page.evaluateHandle(() => [...document.querySelectorAll("button")].find((x) => x.textContent?.includes("เปิดกล้อง")) ?? null);
      const box = await (btn.asElement() as import("puppeteer-core").ElementHandle<Element> | null)?.boundingBox();
      if (box) await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      log(`${mode}: camera button tapped`, !!box);
      const got = await page.waitForFunction((lot: string) => {
        const input = document.querySelector<HTMLInputElement>('input[aria-label="รหัสล็อต"]');
        return input?.value === lot && document.body.innerText.includes("ไม่พบล็อตนี้");
      }, { timeout: 15000 }, LOT).then(() => true, () => false);
      if (!got) console.log("  gum:", await page.evaluate(() => navigator.mediaDevices.getUserMedia({ video: true }).then((s) => "ok tracks=" + s.getVideoTracks().length, (e) => "err " + String(e))));
      if (!got) console.log("  debug:", JSON.stringify(await page.evaluate(() => { const v = document.querySelector("video"); return { input: document.querySelector<HTMLInputElement>('input[aria-label="รหัสล็อต"]')?.value, video: v ? { w: v.videoWidth, rs: v.readyState, paused: v.paused, src: !!v.srcObject } : null, text: document.body.innerText.slice(0, 300) }; })));
      log(`${mode}: QR read from the camera and looked up${mode === "native" ? ` (BarcodeDetector ${hasDetector ? "present" : "absent, so jsQR"})` : ""}`, got);
      await page.close();
    }
  } finally {
    await b.close();
    await cleanupQaCarriers(sql);
  }
  console.log(fails ? `${fails} failed` : "all passed");
  process.exit(fails ? 1 : 0);
}
main().catch(async (e) => { console.error(e); process.exit(1); });
