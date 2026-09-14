// QA crawler: every page route × every role. Records HTTP status, final URL (redirects),
// page errors, console errors, and any /api/* response ≥ 400. Read-only (GET only).
//   QA_BATCH=<a real batch id> npx tsx --env-file=.env.local scripts/qa/crawl.ts
import puppeteer from "puppeteer-core";
import { createHmac } from "crypto";
import { writeFileSync } from "fs";

const BASE = "http://localhost:3123";
const SECRET = process.env.KLORA_SESSION_SECRET || "klora-dev-secret-change-in-production";
const OUT = process.argv[2] || "scripts/qa/crawl-result.json";
const BATCH = process.env.QA_BATCH || ""; // a real batch id for /trace

function mint(userId: string) {
  const exp = Date.now() + 3600_000;
  const payload = `${userId}:${exp}`;
  const sig = createHmac("sha256", SECRET).update(payload).digest("base64url");
  return `${Buffer.from(payload).toString("base64url")}.${sig}`;
}

const PUBLIC = ["/", "/login", "/register", "/forgot", "/logistic/login", "/logistic/register", "/kyn/login",
  `/trace/${BATCH || "B-NOPE"}`, "/trace/DOES-NOT-EXIST"];
const SUP = ["/app", "/app/dashboard", "/app/farm", "/app/history", "/app/new", "/app/profile", "/app/settings"];
const LOG = ["/logistic", "/logistic/branches", "/logistic/history", "/logistic/incoming", "/logistic/new",
  "/logistic/profile", "/logistic/scan", "/logistic/search", "/logistic/settings", "/logistic/status"];
const KYN = ["/kyn", "/kyn/incoming", "/kyn/log", "/kyn/profile", "/kyn/qrlog", "/kyn/report", "/kyn/suppliers"];

const ROLES: Record<string, { user?: string; routes: string[]; home: string }> = {
  anon: { routes: [...PUBLIC, ...SUP, ...LOG, ...KYN], home: "/login" },
  supplier: { user: process.env.QA_SUP_USER || "USR-0001", routes: [...SUP, ...LOG.slice(0, 2), ...KYN.slice(0, 2)], home: "/app" },
  logistic: { user: "USR-0002", routes: [...LOG, ...SUP.slice(0, 2), ...KYN.slice(0, 2)], home: "/logistic" },
  kyn: { user: "USR-0003", routes: [...KYN, ...SUP.slice(0, 2), ...LOG.slice(0, 2)], home: "/kyn" },
};

type Row = { role: string; route: string; status: number | null; final: string; pageErrors: string[]; consoleErrors: string[]; apiFail: string[]; textLen: number; h1: string; ms: number };

(async () => {
  const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-sandbox"] });
  const rows: Row[] = [];
  for (const [role, cfg] of Object.entries(ROLES)) {
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    if (cfg.user) await ctx.setCookie({ name: "klora_session", value: mint(cfg.user), domain: "localhost", path: "/" });
    for (const route of cfg.routes) {
      const pageErrors: string[] = [], consoleErrors: string[] = [], apiFail: string[] = [];
      const onPE = (e: unknown) => pageErrors.push(String((e as Error)?.message ?? e).slice(0, 200));
      const onC = (m: { type(): string; text(): string }) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200)); };
      const onR = (r: { url(): string; status(): number }) => { const u = r.url(); if (r.status() >= 400 && !u.endsWith(".map")) apiFail.push(`${r.status()} ${u.replace(BASE, "")}`); };
      page.on("pageerror", onPE); page.on("console", onC); page.on("response", onR);
      const t0 = Date.now();
      let status: number | null = null;
      try {
        const res = await page.goto(BASE + route, { waitUntil: "networkidle0", timeout: 45000 });
        status = res?.status() ?? null;
      } catch (e) { pageErrors.push("NAV: " + String((e as Error).message).slice(0, 120)); }
      await new Promise((r) => setTimeout(r, 400));
      const final = page.url().replace(BASE, "");
      const { textLen, h1 } = await page.evaluate(() => ({
        textLen: (document.body?.innerText || "").trim().length,
        h1: (document.querySelector("h1")?.textContent || "").trim().slice(0, 60),
      })).catch(() => ({ textLen: 0, h1: "" }));
      page.off("pageerror", onPE); page.off("console", onC); page.off("response", onR);
      rows.push({ role, route, status, final, pageErrors, consoleErrors, apiFail, textLen, h1, ms: Date.now() - t0 });
      const flag = pageErrors.length || consoleErrors.length || apiFail.length ? " !!" : "";
      console.log(`${role.padEnd(8)} ${route.padEnd(24)} ${status} -> ${final.padEnd(22)} txt=${String(textLen).padStart(5)} h1=${h1.slice(0, 24)}${flag}`);
    }
    await ctx.close();
  }
  await browser.close();
  writeFileSync(OUT, JSON.stringify(rows, null, 1));
  const bad = rows.filter((r) => r.pageErrors.length || r.consoleErrors.length || r.apiFail.length || (r.status ?? 0) >= 500);
  console.log(`\n${rows.length} visits, ${bad.length} flagged`);
  for (const r of bad) console.log(`- ${r.role} ${r.route}: ${[...r.pageErrors, ...r.consoleErrors, ...r.apiFail].join(" | ")}`);
})();
