// One-shot production check that Resend actually delivers: registers a throw-away farm account
// on the LIVE site using the address given in QA_EMAIL, triggers forgot-password (sends the OTP
// mail), then deletes the account again. Nothing else is touched.
//   QA_EMAIL=you@example.com npx tsx --env-file=.env.local scripts/qa/prod-email.ts
import { neon } from "@neondatabase/serverless";
const BASE = process.env.QA_BASE || "https://corta.tech";
const EMAIL = process.env.QA_EMAIL!;
const TS = Date.now().toString(36);
(async () => {
  const sql = neon(process.env.DATABASE_URL!);
  const post = (p: string, b: unknown) => fetch(BASE + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
  const reg = await post("/api/auth/register", { farmName: "QA Resend Test " + TS, address: "จ.เชียงราย", contactName: "QA", flowerType: "กุหลาบ", email: EMAIL, username: "qa_resend_" + TS, password: "QaPassw0rd!", confirmPassword: "QaPassw0rd!" });
  const rj = await reg.json();
  console.log("register", reg.status, rj.error || rj.supplier?.id);
  const supId = rj.supplier?.id;
  let ok = false;
  for (let i = 0; i < 8 && supId; i++) {
    const f = await post("/api/auth/forgot", { email: EMAIL });
    const fj = await f.json();
    console.log("forgot", f.status, JSON.stringify(fj).replace(EMAIL, "<email>"));
    if (f.status === 200 && fj.ok && !fj.devCode) { ok = true; break; }
    if (f.status !== 503) break;
    await new Promise((r) => setTimeout(r, 30000)); // redeploy still rolling out
  }
  if (supId) {
    await sql`DELETE FROM users WHERE email = ${EMAIL} AND username LIKE 'qa_resend_%'`;
    await sql`DELETE FROM suppliers WHERE id = ${supId}`;
    await sql`DELETE FROM otp WHERE lower(email) = lower(${EMAIL})`;
    await sql`DELETE FROM rate_limits WHERE key LIKE ${"%" + EMAIL.toLowerCase() + "%"}`;
    const left = await sql`SELECT count(*) c FROM users WHERE email = ${EMAIL}`;
    console.log("cleanup done, accounts left with that email:", left[0].c);
  }
  console.log(ok ? "RESULT: production email SENT (check the inbox for the OTP mail)" : "RESULT: NOT sent");
})();
