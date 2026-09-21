// KYN spec gaps UI: logistic packaging (W×L×H + inner material) + intl airports, KYN factors page, signup links.
import puppeteer from "puppeteer-core";
import { createHmac } from "crypto";
const OUT = process.env.SHOT_DIR ?? "scripts/qa";
const mint = (u: string) => { const p = `${u}:${Date.now() + 3600_000}`; return `${Buffer.from(p).toString("base64url")}.${createHmac("sha256", process.env.KLORA_SESSION_SECRET!).update(p).digest("base64url")}`; };
(async () => {
  const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  const p = await b.newPage(); await p.setViewport({ width: 1440, height: 1000 });
  const errs: string[] = []; p.on("pageerror", (e) => errs.push(String(e)));
  await p.evaluateOnNewDocument("window.__name = (f) => f"); // tsx keepNames helper inside evaluate()

  await b.setCookie({ name: "klora_session", value: mint("USR-0002"), domain: "localhost", path: "/" });
  await p.goto("http://localhost:3123/logistic/new", { waitUntil: "networkidle0" });
  // pick the first batch, fill the seeded box card via a preset, switch to international
  await p.evaluate(() => {
    const set = (el: HTMLSelectElement | HTMLInputElement, v: string) => {
      const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, v);
      el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
    };
    const sel = document.querySelector("select") as HTMLSelectElement;
    set(sel, sel.options[1].value);
  });
  await new Promise((r) => setTimeout(r, 400));
  await p.evaluate(() => {
    const set = (el: HTMLSelectElement, v: string) => { Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(el, v); el.dispatchEvent(new Event("change", { bubbles: true })); };
    const kinds = Array.from(document.querySelectorAll("select")).filter((s) => Array.from(s.options).some((o) => o.value === "corrugated_box"));
    const box = kinds.find((s) => s.value === "corrugated_box") ?? kinds[kinds.length - 1];
    if (box.value !== "corrugated_box") set(box, "corrugated_box");
  });
  await new Promise((r) => setTimeout(r, 300));
  await p.evaluate(() => {
    const set = (el: HTMLSelectElement, v: string) => { Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(el, v); el.dispatchEvent(new Event("change", { bubbles: true })); };
    const mat = Array.from(document.querySelectorAll("select")).find((s) => s.options[0]?.text === "ระบุวัสดุภายในกล่อง") as HTMLSelectElement | undefined;
    if (mat && mat.options.length > 1) set(mat, mat.options[1].value);
    const preset = Array.from(document.querySelectorAll("select")).find((s) => s.options[0]?.text === "เลือกขนาด" && s.closest("div.rounded-xl")?.textContent?.includes("วัสดุภายในกล่อง")) as HTMLSelectElement | undefined;
    if (preset && preset.options.length > 2) set(preset, preset.options[2].value);
    (Array.from(document.querySelectorAll("input[type=radio]")) as HTMLInputElement[])[1]?.click();
  });
  await new Promise((r) => setTimeout(r, 500));
  await p.screenshot({ path: `${OUT}/spec-logistic-form.png`, fullPage: true });

  await b.setCookie({ name: "klora_session", value: mint("USR-0003"), domain: "localhost", path: "/" });
  await p.goto("http://localhost:3123/kyn/factors", { waitUntil: "networkidle0" });
  await p.screenshot({ path: `${OUT}/spec-kyn-factors.png`, fullPage: true });
  await p.goto("http://localhost:3123/kyn/suppliers", { waitUntil: "networkidle0" });
  await p.screenshot({ path: `${OUT}/spec-kyn-links.png`, clip: { x: 0, y: 0, width: 1440, height: 900 } });
  console.log("errors:", errs.length ? errs : "none"); await b.close();
})();
