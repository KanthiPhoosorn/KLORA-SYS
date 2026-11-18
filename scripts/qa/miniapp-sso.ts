// Thai Post SuperApp mini app sign-in against a MOCK Thai Post SSO (never the real API). Proves: the challenge
// vectors, redeem (happy path, single use, expired, malformed, no-name profile), the member cookie cannot open a
// portal, the lookup API (cookie required, lot id, tracking number, unknown), the real browser landing (hash and
// query handoff are gone from the address bar) and that the server log holds no handoff, challenge or token.
// Dev server must run with (output redirected to a file, whose path is MINIAPP_LOG):
//   THP_SSO_BASE_URL=http://localhost:3998/ms-commons THP_SSO_CLIENT_ID=corta-test THP_SSO_CLIENT_SECRET=test-secret npx next dev -p 3123 > <log> 2>&1
//   MINIAPP_LOG=<log> npx tsx --env-file=.env.local --tsconfig tsconfig.json scripts/qa/miniapp-sso.ts
import http from "http";
import { randomBytes } from "crypto";
import { readFileSync } from "fs";
import { neon } from "@neondatabase/serverless";
import puppeteer from "puppeteer-core";
import { computeChallenge } from "../../src/lib/thp-sso";
import { todayBangkok } from "../../src/lib/evidence";

const BASE = "http://localhost:3123";
const SECRET = "test-secret"; // the mock's own fake secret
const CLIENT = "corta-test";
const TS = Date.now().toString(36);
const NAME = "สมชาย ทดสอบ";
let fails = 0;
const log = (n: string, ok: boolean, note = "") => { if (!ok) fails++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${note ? "  - " + note : ""}`); };

// ---- the mock Thai Post SSO ------------------------------------------------------------------------------------
type Kind = "name" | "noname" | "expired";
const handoffs = new Map<string, { kind: Kind; used: boolean }>();
const tokens = new Map<string, Kind>();
const issued: string[] = []; const queryHandoffs = new Set<string>(); // query-style handoffs are in the URL, so Next dev logs them (info only)
const issuedNote = ""; // every secret-ish value, for the log check
const fresh = (kind: Kind) => { const h = randomBytes(32).toString("hex"); handoffs.set(h, { kind, used: false }); issued.push(h, computeChallenge(h, SECRET)); return h; };
const reply = (res: http.ServerResponse, status: number, body: unknown) => { res.statusCode = status; res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(body)); };

const mock = http.createServer((req, res) => {
  const url = req.url || "";
  if (req.method === "POST" && url === "/ms-commons/v1/sso/oauth/token") {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      let b: { clientId?: string; challenge?: string } = {};
      try { b = JSON.parse(raw); } catch { return reply(res, 400, { error: { code: "004001", message: "bad request" } }); }
      if (b.clientId !== CLIENT || typeof b.challenge !== "string") return reply(res, 400, { error: { code: "004001", message: "bad request" } });
      const hit = [...handoffs.entries()].find(([h]) => computeChallenge(h, SECRET) === b.challenge);
      if (!hit) return reply(res, 401, { error: { code: "500011", message: "invalid" } });
      const [, st] = hit;
      if (st.kind === "expired") return reply(res, 401, { error: { code: "500012", message: "expired" } });
      if (st.used) return reply(res, 401, { error: { code: "500011", message: "used" } });
      st.used = true;
      const tok = randomBytes(24).toString("hex"); tokens.set(tok, st.kind); issued.push(tok);
      reply(res, 200, { data: { token: tok, tokenType: "Bearer", scope: ["name", "mobileNo", "address"] } });
    });
    return;
  }
  if (req.method === "GET" && url.split("?")[0] === "/ms-commons/v1/sso/profile") {
    const m = /^Bearer (.+)$/.exec(String(req.headers.authorization || ""));
    const kind = m ? tokens.get(m[1]) : undefined;
    if (!kind) return reply(res, 401, { error: "invalid_token", error_description: "bad token" }); // the gateway's own shape
    if (kind === "noname") return reply(res, 404, { error: { code: "004004", message: "no data" } });
    return reply(res, 200, { data: { name: NAME, mobileNo: "0800000000", address: [{ line: "x" }] } });
  }
  reply(res, 404, {});
});

const cookieOf = (res: Response, name: string) => new RegExp(`${name}=([^;]+)`).exec(res.headers.get("set-cookie") || "")?.[1];
const redeem = (handoffToken: unknown) => fetch(BASE + "/api/sso/redeem", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ handoffToken }) });
const home = (cookie: string) => fetch(BASE + "/miniapp/home", { headers: { Cookie: `corta_member=${cookie}` } }).then((r) => r.text());

async function main() {
  await new Promise<void>((r) => mock.listen(3998, r));
  const sql = neon(process.env.DATABASE_URL!);
  const EMAIL = `qa-mini-${TS}@klora-qa.test`;
  let farmId = "";
  try {
    await sql`DELETE FROM rate_limits WHERE key LIKE '%:ip:::1'`;

    // 1. challenge vectors
    log("computeChallenge: guide vector 1", computeChallenge("what do ya want for nothing?", "Jefe") === "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843");
    log("computeChallenge: guide vector 2", computeChallenge("3f8a".repeat(16), "example-secret-1234567890") === "cdae2abbcb241455a4da0abafa57d483cacf512f0883b3f3c4776be9c6215f62");

    // 2. happy path
    const h1 = fresh("name");
    const r1 = await redeem(h1);
    const j1 = await r1.json();
    const setc = r1.headers.get("set-cookie") || "";
    const member = cookieOf(r1, "corta_member") || "";
    log("redeem: 200, ok, name returned", r1.status === 200 && j1.ok === true && j1.name === NAME, String(r1.status));
    log("redeem: corta_member cookie set, httpOnly, lax", !!member && /httponly/i.test(setc) && /samesite=lax/i.test(setc));
    log("redeem: no-store header", /no-store/.test(r1.headers.get("cache-control") || ""));
    log("redeem: response and cookie hold no phone number or address", !/0800000000/.test(JSON.stringify(j1)) && !/0800000000/.test(Buffer.from(member.split(".")[0], "base64url").toString()));
    const html = await home(member);
    log("home with the cookie shows the greeting with the name", html.includes(`สวัสดี คุณ${NAME}`));
    log("home shows the one-line description and privacy link", html.includes("ดูที่มาของสินค้าเกษตร") && html.includes("ข้อมูลส่วนบุคคล"));

    // 3. single use, expired, malformed, wrong type
    const again = await redeem(h1);
    const aj = await again.json();
    log("second use of a handoff -> 401 expired message", again.status === 401 && String(aj.error).startsWith("ลิงก์หมดอายุแล้ว"), String(again.status));
    const ex = await redeem(fresh("expired"));
    const ej = await ex.json();
    log("expired handoff -> 401 expired message", ex.status === 401 && String(ej.error).startsWith("ลิงก์หมดอายุแล้ว") && ej.code === "500012", String(ex.status));
    const unk = await redeem(randomBytes(32).toString("hex"));
    log("unknown handoff -> 401 expired message", unk.status === 401 && String((await unk.json()).error).startsWith("ลิงก์หมดอายุแล้ว"));
    const bad = await redeem("not-a-handoff");
    log("malformed handoff -> 400", bad.status === 400 && String((await bad.json()).error).startsWith("ลิงก์เข้าใช้งานไม่ถูกต้อง"));
    const none = await fetch(BASE + "/api/sso/redeem", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    log("missing handoff -> 400", none.status === 400);

    // 4. profile without data (004004)
    const r4 = await redeem(fresh("noname"));
    const j4 = await r4.json();
    const m4 = cookieOf(r4, "corta_member") || "";
    const h4 = await home(m4);
    log("004004 profile -> still signed in, empty name", r4.status === 200 && j4.ok === true && !j4.name && !!m4);
    log("004004 profile -> greeting without a name", h4.includes("สวัสดี") && !h4.includes("สวัสดี คุณ"));

    // 5. the member cookie is not a portal session
    const portal = await fetch(BASE + "/app", { redirect: "manual", headers: { Cookie: `klora_session=${member}` } });
    log("corta_member as klora_session does not open /app", portal.status >= 300 && portal.status < 400 && /\/login/.test(portal.headers.get("location") || ""), `${portal.status} ${portal.headers.get("location")}`);
    const noCookieHome = await fetch(BASE + "/miniapp/home").then((r) => r.text());
    log("home without a cookie asks to open from the Thai Post app", noCookieHome.includes("กรุณาเปิด Corta จากแอปไปรษณีย์ไทย"));
    const forged = await fetch(BASE + "/miniapp/home", { headers: { Cookie: `corta_member=${member.slice(0, -3)}abc` } }).then((r) => r.text());
    log("a tampered member cookie is refused", forged.includes("กรุณาเปิด Corta จากแอปไปรษณีย์ไทย"));

    // 6. lookup: a throwaway farm + lot with a tracking number
    const reg = await fetch(BASE + "/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ farmName: `QA Mini ${TS}`, address: "อ.แม่ริม จ.เชียงใหม่", gps: "18.91, 98.94", contactName: "QA", flowerType: "มะม่วง", email: EMAIL, username: `qa_mini_${TS}`, password: "QaPassw0rd!", confirmPassword: "QaPassw0rd!" }) });
    const rj = await reg.json().catch(() => ({}));
    farmId = rj.supplier?.id as string;
    const farmCookie = /klora_session=([^;]+)/.exec(reg.headers.get("set-cookie") ?? "")?.[1] ?? "";
    if (!farmId || !farmCookie) throw new Error(`farm sign-up failed: ${reg.status}`);
    const mk = await fetch(BASE + "/api/batches", { method: "POST", headers: { "Content-Type": "application/json", Cookie: `klora_session=${farmCookie}` }, body: JSON.stringify({ productCategory: "fruit", productType: "มะม่วง", unit: "kg", quantity: 40, distanceKm: 300, destination: "กรุงเทพฯ", shippedWeightKg: 45, packagingItems: [], cutDate: todayBangkok() }) });
    const lotId = (await mk.json().catch(() => ({}))).id as string;
    if (!lotId) throw new Error(`lot create failed: ${mk.status}`);
    const TRACK = `QA${TS}TH`.toUpperCase();
    await sql`UPDATE batches SET tracking_no = ${TRACK} WHERE id = ${lotId}`;
    const look = (q: string, cookie?: string) => fetch(`${BASE}/api/miniapp/lookup?q=${encodeURIComponent(q)}`, { headers: cookie ? { Cookie: `corta_member=${cookie}` } : {} });
    log("lookup without the cookie -> 401", (await look(lotId)).status === 401);
    const byId = await look(lotId.toLowerCase(), member);
    log("lookup by lot id (any case) -> its id only", byId.status === 200 && JSON.stringify(await byId.json()) === JSON.stringify({ id: lotId }));
    const byTrack = await look(` ${TRACK.toLowerCase()} `, member);
    log("lookup by tracking number (case-insensitive) -> the lot id", byTrack.status === 200 && (await byTrack.json()).id === lotId);
    const u1 = await look("LOT-0000-9999", member); const u2 = await look("NOSUCHTRACKING1", member);
    const t1 = await u1.text(); const t2 = await u2.text();
    log("unknown lot and unknown tracking number -> the same 404", u1.status === 404 && u2.status === 404 && t1 === t2 && t1.includes("ไม่พบสินค้านี้ในระบบ Corta"));
    await sql`UPDATE batches SET cancelled_at = ${new Date().toISOString()} WHERE id = ${lotId}`;
    log("a cancelled lot is not found (id and tracking)", (await look(lotId, member)).status === 404 && (await look(TRACK, member)).status === 404);
    await sql`UPDATE batches SET cancelled_at = NULL WHERE id = ${lotId}`;

    // 7. browser
    const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
    const hashHandoffs: string[] = [];
    try {
      const newPage = async () => {
        const page = await b.newPage();
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
        await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
        return { page, errors };
      };
      const tap = async (page: import("puppeteer-core").Page, text: string) => {
        const h = await page.evaluateHandle(`[...document.querySelectorAll("button")].find((x) => x.textContent.includes(${JSON.stringify(text)})) || null`);
        const box = await (h.asElement() as import("puppeteer-core").ElementHandle<Element> | null)?.boundingBox();
        if (box) await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
        return !!box;
      };

      for (const variant of ["hash", "query"] as const) {
        const { page, errors } = await newPage();
        const h = fresh("name");
        if (variant === "hash") hashHandoffs.push(h); else queryHandoffs.add(h);
        // watch every URL the page ever has, from the first script on
        await page.evaluateOnNewDocument(`window.__urls = []; setInterval(() => window.__urls.push(location.href), 20);`);
        await page.goto(variant === "hash" ? `${BASE}/miniapp#handoff=${h}` : `${BASE}/miniapp?handoffToken=${h}`, { waitUntil: "load" });
        const hrefAfterLoad = await page.evaluate("location.href") as string;
        const landed = await page.waitForFunction(`location.pathname === "/miniapp/home" && document.body.innerText.includes(${JSON.stringify(NAME)})`, { timeout: 20000 }).then(() => true, () => false);
        const seen = (await page.evaluate("window.__urls || []").catch(() => [])) as string[];
        const finalHref = await page.evaluate("location.href") as string;
        log(`browser ${variant}: handoff gone from the address bar right after load`, !hrefAfterLoad.includes(h), hrefAfterLoad.replace(h, "<handoff>"));
        log(`browser ${variant}: lands on /miniapp/home showing the name`, landed, finalHref);
        log(`browser ${variant}: final URL clean and no page errors`, !finalHref.includes(h) && errors.length === 0, errors.join(" | "));
        if (variant === "hash") {
          // real taps: type the QA tracking number, tap ตรวจสอบ, land on the passport
          const inp = await page.$("#mini-q");
          const ib = await inp?.boundingBox();
          if (ib) await page.touchscreen.tap(ib.x + ib.width / 2, ib.y + ib.height / 2);
          await page.type("#mini-q", TRACK);
          const tapped = await tap(page, "ตรวจสอบ");
          const went = await page.waitForFunction(`location.pathname === "/t/${lotId}"`, { timeout: 20000 }).then(() => true, () => false);
          log("browser: typing a tracking number and tapping ตรวจสอบ opens the passport", tapped && went, await page.evaluate("location.pathname") as string);
          await page.goto(`${BASE}/miniapp/home`, { waitUntil: "networkidle2" });
          const recent = await page.waitForFunction(`document.body.innerText.includes("ที่เคยดู") && document.body.innerText.includes(${JSON.stringify(lotId)})`, { timeout: 8000 }).then(() => true, () => false);
          log("browser: the lot appears under ที่เคยดู", recent);
        }
        await page.close();
      }

      // opened directly: no handoff, no cookie
      const ctx = await b.createBrowserContext(); // no cookies from the pages above
      const page = await ctx.newPage(); const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
      await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
      await page.goto(`${BASE}/miniapp`, { waitUntil: "networkidle2" });
      const msg = await page.waitForFunction(`document.body.innerText.includes("กรุณาเปิด Corta")`, { timeout: 8000 }).then(() => true, () => false);
      log("browser: /miniapp with no handoff and no cookie asks to open from the app, no page errors", msg && errors.length === 0, errors.join(" | "));
      // a used handoff shows the Thai error and no retry button
      const used = fresh("expired");
      await page.goto("about:blank"); // a hash-only change on the same page would not reload it
      await page.goto(`${BASE}/miniapp#handoff=${used}`, { waitUntil: "load" });
      const err = await page.waitForFunction(`document.body.innerText.includes("ลิงก์หมดอายุแล้ว")`, { timeout: 15000 }).then(() => true, () => false);
      const buttons = (await page.evaluate("document.querySelectorAll('button').length")) as number;
      log("browser: a refused handoff shows the Thai message and no retry button", err && buttons === 0);
      await page.close(); await ctx.close();
    } finally {
      await b.close();
    }

    // 8. the server log holds no handoff, challenge or token
    const logFile = process.env.MINIAPP_LOG;
    if (!logFile) log("server log check", false, "set MINIAPP_LOG to the dev server's log file");
    else {
      const text = readFileSync(logFile, "utf8");
      console.log(`INFO  query-style handoff appears in the dev server request log: ${[...queryHandoffs].some((v) => text.includes(v))} (expected for the query form; the hash form never reaches the server)`);
      const leaked = issued.filter((v) => !queryHandoffs.has(v) && text.includes(v)).length + (text.includes(SECRET) ? 1 : 0);
      log("server log: no hash-variant handoff, challenge, token or secret", leaked === 0 && text.length > 0 && hashHandoffs.every((h) => !text.includes(h)), `${text.length} bytes, ${leaked} leaked`);
    }
  } finally {
    mock.close();
    if (farmId) {
      await sql`DELETE FROM batch_events WHERE batch_id IN (SELECT id FROM batches WHERE supplier_id = ${farmId})`;
      await sql`DELETE FROM notifications WHERE supplier_id = ${farmId}`;
      await sql`DELETE FROM prints WHERE supplier_id = ${farmId}`;
      await sql`DELETE FROM custom_entries WHERE supplier_id = ${farmId}`;
      await sql`DELETE FROM batches WHERE supplier_id = ${farmId}`;
      await sql`DELETE FROM suppliers WHERE id = ${farmId}`;
    }
    await sql`DELETE FROM users WHERE email = ${EMAIL}`;
    await sql`DELETE FROM rate_limits WHERE key LIKE '%:ip:::1' OR key LIKE 'login:acct:qa_%'`;
  }
  console.log(fails ? `${fails} failed` : "all passed");
  process.exit(fails ? 1 : 0);
}
main().catch((e) => { console.log("ERROR", String(e).slice(0, 300)); mock.close(); process.exit(1); });
