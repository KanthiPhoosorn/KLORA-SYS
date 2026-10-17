// Test helper: a QA logistic company through the real sign-up (doc "Logistic", 17 Oct 2026) — company form,
// then KYN's approval — and its clean-up. Used by the flow tests that need a carrier account.
import { createHmac } from "crypto";
import type { NeonQueryFunction } from "@neondatabase/serverless";

const BASE = "http://localhost:3123";
export const mint = (u: string) => { const p = `${u}:${Date.now() + 3600_000}`; return `${Buffer.from(p).toString("base64url")}.${createHmac("sha256", process.env.KLORA_SESSION_SECRET!).update(p).digest("base64url")}`; };
export const QA_PASSWORD = "QaPassw0rd1";

/** The fields of the company form, filled — override any. */
export function companyForm(tag: string, ts: string, over: Record<string, unknown> = {}) {
  return {
    company: `QA ขนส่ง ${tag} ${ts}`, providerType: "sorting_center", phone: "0812345678", taxId: "",
    address: "99 หมู่ 1 ถ.ช้างคลาน", province: "เชียงใหม่", district: "เมืองเชียงใหม่", subdistrict: "ช้างคลาน", gps: "18.7774, 99.0005",
    username: `qa_${tag}_${ts}`, email: `qa-${tag}-${ts}@klora-qa.test`, password: QA_PASSWORD, confirmPassword: QA_PASSWORD, accept: true,
    ...over,
  };
}

/** Sign a company up and let KYN approve it. Returns its session cookie and ids. */
export async function qaCarrier(sql: NeonQueryFunction<false, false>, tag: string, ts: string, over: Record<string, unknown> = {}) {
  const body = companyForm(tag, ts, over);
  const r = await fetch(`${BASE}/api/auth/register-logistic`, { method: "POST", redirect: "manual", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (r.status !== 201) throw new Error(`qa carrier sign-up ${r.status}: ${j.error}`);
  const cookie = /klora_session=([^;]+)/.exec(r.headers.get("set-cookie") ?? "")![1];
  if (j.status === "pending") {
    const ok = await fetch(`${BASE}/api/logistic/companies/${j.orgCode}`, { method: "PATCH", headers: { "Content-Type": "application/json", Cookie: `klora_session=${mint("USR-0003")}` }, body: JSON.stringify({ action: "approve" }) });
    if (!ok.ok) { await cleanupQaCarriers(sql); throw new Error(`qa carrier approve ${ok.status}`); } // leave nothing behind
  }
  const [u] = await sql`SELECT id, branch_id, org_code, company FROM users WHERE email = ${String(body.email)}`;
  return { cookie, userId: String(u.id), orgCode: String(u.org_code), branchId: String(u.branch_id), company: String(u.company), email: String(body.email) };
}

/** Remove QA companies (their branches go with them), their accounts and their rate-limit keys. */
export async function cleanupQaCarriers(sql: NeonQueryFunction<false, false>) {
  const orgs = await sql`SELECT org_code FROM logistic_orgs WHERE company LIKE 'QA ขนส่ง %'`; // only what qaCarrier / the UI test make
  const codes = orgs.map((o) => String(o.org_code));
  if (codes.length) {
    const branches = await sql`SELECT id FROM logistic_branches WHERE org_code = ANY(${codes})`;
    const ids = branches.map((b) => String(b.id));
    await sql`DELETE FROM invites WHERE supplier_id = ANY(${ids})`;
    await sql`DELETE FROM members WHERE supplier_id = ANY(${ids})`;
    await sql`DELETE FROM carrier_links WHERE org_code = ANY(${codes})`;
    await sql`DELETE FROM users WHERE org_code = ANY(${codes})`;
    await sql`DELETE FROM logistic_orgs WHERE org_code = ANY(${codes})`;
  }
  await sql`DELETE FROM rate_limits WHERE key LIKE 'login:fail:qa%' OR key LIKE '%:ip:::1' OR key LIKE '%:ip:127.0.0.1' OR key LIKE '%:ip:unknown'`;
}
