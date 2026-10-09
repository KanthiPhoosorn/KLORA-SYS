// QA crawler: every page route × every role. Records HTTP status, final URL (redirects),
// page errors, console errors, and any /api/* response ≥ 400. Read-only (GET only).
// Also audits each page (Thai Post doc 9 Oct 2026): the Corta logo is shown (§1), no old
// names/codes are visible — "SUP ID", "KLORA", SUP-/BAT-/BSK- codes (§1–3) — and the page
// never scrolls sideways (§8). Desktop pass at 1440 px, then each role's own pages at 390 px.
//   QA_BATCH=<a real lot id> [QA_LEGACY=<its old BAT id>] [QA_EDIT=<a waiting lot of USR-0001>]
//   npx tsx --env-file=.env.local scripts/qa/crawl.ts
import puppeteer from "puppeteer-core";
import { createHmac } from "crypto";
import { writeFileSync } from "fs";

const BASE = "http://localhost:3123";
const SECRET = process.env.KLORA_SESSION_SECRET || "klora-dev-secret-change-in-production";
const OUT = process.argv[2] || "scripts/qa/crawl-result.json";
const BATCH = process.env.QA_BATCH || ""; // a real lot id for /t and /trace
const LEGACY = process.env.QA_LEGACY || ""; // its old BAT- id (must redirect to /t/LOT-…)
const EDIT = process.env.QA_EDIT || ""; // a waiting lot of the supplier user, for /app/new?edit=

function mint(userId: string) {
  const exp = Date.now() + 3600_000;
  const payload = `${userId}:${exp}`;
  const sig = createHmac("sha256", SECRET).update(payload).digest("base64url");
  return `${Buffer.from(payload).toString("base64url")}.${sig}`;
}

const PUBLIC = ["/", "/login", "/register", "/forgot", "/logistic/login", "/logistic/register", "/kyn/login",
  `/trace/${BATCH || "B-NOPE"}`, ...(BATCH ? [`/t/${BATCH}`] : []), ...(LEGACY ? [`/trace/${LEGACY}`] : []), "/trace/DOES-NOT-EXIST"];
const SUP = ["/app", "/app/dashboard", "/app/farm", "/app/history", "/app/new", "/app/profile", "/app/settings", ...(EDIT ? [`/app/new?edit=${EDIT}`] : [])];
const LOG = ["/logistic", "/logistic/branches", "/logistic/history", "/logistic/incoming", "/logistic/new",
  "/logistic/profile", "/logistic/scan", "/logistic/search", "/logistic/settings", "/logistic/status", ...(BATCH ? [`/print/labels?ids=${BATCH}`] : [])];
const KYN = ["/kyn", "/kyn/incoming", "/kyn/log", "/kyn/profile", "/kyn/qrlog", "/kyn/report", "/kyn/suppliers", "/kyn/review", "/kyn/packaging", "/kyn/factors"];

const ROLES: Record<string, { user?: string; routes: string[]; own: string[]; home: string }> = {
  anon: { routes: [...PUBLIC, ...SUP, ...LOG, ...KYN], own: PUBLIC, home: "/login" },
  supplier: { user: process.env.QA_SUP_USER || "USR-0001", routes: [...SUP, ...LOG.slice(0, 2), ...KYN.slice(0, 2)], own: SUP, home: "/app" },
  logistic: { user: "USR-0002", routes: [...LOG, ...SUP.slice(0, 2), ...KYN.slice(0, 2)], own: LOG, home: "/logistic" },
  kyn: { user: "USR-0003", routes: [...KYN, ...SUP.slice(0, 2), ...LOG.slice(0, 2)], own: KYN, home: "/kyn" },
};
const WIDTHS = (process.env.QA_WIDTHS || "1440,390").split(",").map(Number);

type Row = { role: string; width: number; route: string; status: number | null; final: string; pageErrors: string[]; consoleErrors: string[]; apiFail: string[]; audit: string[]; textLen: number; h1: string; ms: number };

(async () => {
  const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-sandbox"] });
  const rows: Row[] = [];
  for (const width of WIDTHS) {
    for (const [role, cfg] of Object.entries(ROLES)) {
      const ctx = await browser.createBrowserContext();
      const page = await ctx.newPage();
      await page.setViewport({ width, height: width < 600 ? 844 : 900, isMobile: width < 600, hasTouch: width < 600 });
      if (cfg.user) await ctx.setCookie({ name: "klora_session", value: mint(cfg.user), domain: "localhost", path: "/" });
      for (const route of width === WIDTHS[0] ? cfg.routes : cfg.own) {
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
        const info = await page.evaluate(() => {
          const text = document.body?.innerText || "";
          const banned = Array.from(new Set(text.match(/SUP ID|KLORA|\b(?:SUP|BAT|BSK)-[0-9]{3,4}[0-9-]*/g) ?? [])).slice(0, 5);
          const wide = Array.from(document.querySelectorAll("body *")).filter((el) => {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.right <= window.innerWidth + 1) return false;
            for (let p = el.parentElement; p; p = p.parentElement) { const ox = getComputedStyle(p).overflowX; if (ox === "auto" || ox === "scroll" || ox === "hidden" || ox === "clip") return false; }
            return true;
          }).slice(0, 3).map((el) => `${el.tagName.toLowerCase()}.${String((el as HTMLElement).className).split(" ").slice(0, 3).join(".")} r=${Math.round(el.getBoundingClientRect().right)}`);
          return {
            textLen: text.trim().length,
            h1: (document.querySelector("h1")?.textContent || "").trim().slice(0, 60),
            logo: !!document.querySelector('img[src*="corta-logo"]'),
            scrollX: document.documentElement.scrollWidth - window.innerWidth,
            banned, wide,
          };
        }).catch(() => ({ textLen: 0, h1: "", logo: false, scrollX: 0, banned: [] as string[], wide: [] as string[] }));
        page.off("pageerror", onPE); page.off("console", onC); page.off("response", onR);
        const audit: string[] = [];
        const isLabels = final.startsWith("/print/labels");
        if (!info.logo && !isLabels && status !== 404) audit.push("no Corta logo");
        if (info.banned.length) audit.push("old text: " + info.banned.join(", "));
        if (info.scrollX > 1) audit.push(`scrolls sideways +${info.scrollX}px ${info.wide.join(" ; ")}`);
        rows.push({ role, width, route, status, final, pageErrors, consoleErrors, apiFail, audit, textLen: info.textLen, h1: info.h1, ms: Date.now() - t0 });
        const flag = pageErrors.length || consoleErrors.length || apiFail.length || audit.length ? " !!" : "";
        console.log(`${String(width).padEnd(5)}${role.padEnd(9)}${route.slice(0, 30).padEnd(31)}${status} -> ${final.slice(0, 26).padEnd(27)}txt=${String(info.textLen).padStart(5)}${flag}`);
      }
      await ctx.close();
    }
  }
  await browser.close();
  writeFileSync(OUT, JSON.stringify(rows, null, 1));
  // the anonymous 404 page is expected to log its own 404
  const bad = rows.filter((r) => r.audit.length || r.pageErrors.length || r.apiFail.filter((a) => !a.includes("DOES-NOT-EXIST")).length || r.consoleErrors.filter((c) => !c.includes("404")).length || (r.status ?? 0) >= 500);
  console.log(`\n${rows.length} visits, ${bad.length} flagged`);
  for (const r of bad) console.log(`- ${r.width} ${r.role} ${r.route}: ${[...r.audit, ...r.pageErrors, ...r.consoleErrors, ...r.apiFail].join(" | ")}`);
})();
