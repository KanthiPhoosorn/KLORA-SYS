// Google sign-in flow against a MOCK Google (token + userinfo) — proves state/CSRF handling,
// account lookup, suspended check and session issuance without real credentials.
// Dev server must run with: GOOGLE_CLIENT_ID=test GOOGLE_CLIENT_SECRET=test
//   GOOGLE_TOKEN_URL=http://localhost:3999/token GOOGLE_USERINFO_URL=http://localhost:3999/userinfo
import http from "http";
import { neon } from "@neondatabase/serverless";
const BASE = "http://localhost:3123";
let profile: Record<string, unknown> = {};
const results: boolean[] = [];
const log = (n: string, ok: boolean, note = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${n}${note ? "  — " + note : ""}`); };
const cookieOf = (res: Response, name: string) => new RegExp(`${name}=([^;]+)`).exec(res.headers.get("set-cookie") || "")?.[1];

const mock = http.createServer((req, res) => {
  if (req.url === "/token") { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ access_token: "mock-token", id_token: "x" })); return; }
  if (req.url === "/userinfo") { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(profile)); return; }
  res.statusCode = 404; res.end();
});

async function callbackWith(p: Record<string, unknown>) {
  profile = p;
  const start = await fetch(BASE + "/api/auth/google?portal=kyn", { redirect: "manual" });
  const state = new URL(start.headers.get("location")!).searchParams.get("state")!;
  const sc = cookieOf(start, "klora_oauth_state")!;
  const cb = await fetch(`${BASE}/api/auth/google/callback?code=abc&state=${encodeURIComponent(state)}`, { redirect: "manual", headers: { Cookie: `klora_oauth_state=${sc}` } });
  return { status: cb.status, loc: (cb.headers.get("location") || "").replace(BASE, ""), session: cookieOf(cb, "klora_session"), stateCleared: /klora_oauth_state=;|klora_oauth_state=; Max-Age=0|Expires=Thu, 01 Jan 1970/.test(cb.headers.get("set-cookie") || "") };
}

(async () => {
  await new Promise<void>((r) => mock.listen(3999, r));
  const sql = neon(process.env.DATABASE_URL!);
  const kyn = (await sql`SELECT email FROM users WHERE id = 'USR-0003'`)[0].email as string;

  // 1. start
  const start = await fetch(BASE + "/api/auth/google?portal=kyn", { redirect: "manual" });
  const loc = new URL(start.headers.get("location") || "http://x");
  log("start → redirect to Google", start.status === 307 && loc.hostname === "accounts.google.com", `${start.status} ${loc.hostname}`);
  log("start → correct redirect_uri + scope", loc.searchParams.get("redirect_uri") === BASE + "/api/auth/google/callback" && /email/.test(loc.searchParams.get("scope") || ""), loc.searchParams.get("redirect_uri") || "");
  log("start → state cookie set (httpOnly)", !!cookieOf(start, "klora_oauth_state") && /httponly/i.test(start.headers.get("set-cookie") || ""));

  // 2. CSRF: wrong state
  const bad = await fetch(`${BASE}/api/auth/google/callback?code=abc&state=forged.kyn`, { redirect: "manual", headers: { Cookie: `klora_oauth_state=${cookieOf(start, "klora_oauth_state")}` } });
  log("callback forged state → error=google_state", (bad.headers.get("location") || "").endsWith("/kyn/login?error=google_state"), bad.headers.get("location") || "");
  const nocode = await fetch(`${BASE}/api/auth/google/callback?error=access_denied`, { redirect: "manual" });
  log("callback user denied → error=google_failed", /error=google_failed$/.test(nocode.headers.get("location") || ""), nocode.headers.get("location") || "");

  // 3. happy path: existing KYN account
  let r = await callbackWith({ email: kyn, email_verified: true, name: "KYN" });
  log("callback known email → session + redirect /kyn", r.status === 307 && r.loc === "/kyn" && !!r.session, `${r.status} ${r.loc} session=${!!r.session}`);
  log("callback clears state cookie", r.stateCleared);
  const home = await fetch(BASE + "/kyn", { redirect: "manual", headers: { Cookie: `klora_session=${r.session}` } });
  log("session from Google opens /kyn", home.status === 200, String(home.status));
  r = await callbackWith({ email: kyn.toUpperCase(), email_verified: true });
  log("email lookup is case-insensitive", r.loc === "/kyn" && !!r.session, r.loc);

  // 4. unknown / unverified
  r = await callbackWith({ email: "nobody@klora-qa.test", email_verified: true });
  log("callback unknown email → error=no_account, no session", r.loc === "/kyn/login?error=no_account" && !r.session, r.loc);
  r = await callbackWith({ email: kyn, email_verified: false });
  log("callback unverified email → error=google_unverified", r.loc === "/kyn/login?error=google_unverified" && !r.session, r.loc);

  // 5. suspended farm account cannot sign in via Google either
  await sql`DELETE FROM rate_limits WHERE key LIKE '%:ip:::1'`;
  const reg = await fetch(BASE + "/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ farmName: "QA Google Farm", address: "จ.เชียงราย", contactName: "QA", flowerType: "กุหลาบ", email: "qa-google@klora-qa.test", username: "qa_google", password: "QaPassw0rd!", confirmPassword: "QaPassw0rd!" }) });
  const supId = (await reg.json()).supplier?.id;
  r = await callbackWith({ email: "qa-google@klora-qa.test", email_verified: true });
  log("active farm via Google → /app", r.loc === "/app" && !!r.session, r.loc);
  await sql`UPDATE suppliers SET status = 'suspended' WHERE id = ${supId}`;
  r = await callbackWith({ email: "qa-google@klora-qa.test", email_verified: true });
  log("suspended farm via Google → error=suspended", r.loc === "/kyn/login?error=suspended" && !r.session, r.loc);
  await sql`DELETE FROM users WHERE email = 'qa-google@klora-qa.test'`; await sql`DELETE FROM suppliers WHERE id = ${supId}`;
  await sql`DELETE FROM rate_limits WHERE key LIKE '%:ip:::1' OR key LIKE 'login:acct:qa_%'`;

  mock.close();
  console.log(`\n${results.length} checks, ${results.filter((x) => !x).length} failed`);
  process.exit(results.every(Boolean) ? 0 : 1);
})();
